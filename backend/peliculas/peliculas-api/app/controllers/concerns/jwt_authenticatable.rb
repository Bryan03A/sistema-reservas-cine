
require "json"
require "net/http"
require "openssl"
require "socket"
require "timeout"
require "uri"
require "jwt"

module JwtAuthenticatable
  extend ActiveSupport::Concern

  JWKS_CACHE_KEY = "peliculas_api/jwt_jwks/v1"
  JWKS_CACHE_TTL = 10.minutes
  JWKS_OPEN_TIMEOUT = 3
  JWKS_READ_TIMEOUT = 3

  included do
    attr_reader :current_jwt_payload
  end

  # Autenticar una petición con JWT RS256.
  # Uso en un controlador: before_action :authenticate_jwt!
  def authenticate_jwt!
    @current_jwt_payload = nil

    authorization = request.headers["Authorization"]

    unless authorization.is_a?(String) &&
           (match = authorization.match(/\ABearer\s+(\S+)\z/i))
      return jwt_error!(
        "Se requiere un token Bearer válido.",
        :unauthorized
      )
    end

    token = match[1]

    begin
      # Inspeccionar cabecera y payload sin confiar todavía en ellos.
      unverified_payload, unverified_header = JWT.decode(
        token, nil, false
      )

      unless unverified_header.is_a?(Hash) &&
             unverified_header["alg"] == "RS256"
        return jwt_error!(
          "Algoritmo JWT no permitido.",
          :unauthorized
        )
      end

      kid = unverified_header["kid"]
      configured_kid = ENV.fetch("JWT_KID")

      unless kid.is_a?(String) &&
             !kid.empty? &&
             kid == configured_kid
        return jwt_error!(
          "Identificador de clave JWT inválido.",
          :unauthorized
        )
      end

      unless unverified_payload.is_a?(Hash)
        return jwt_error!("Payload JWT inválido.", :unauthorized)
      end

      jwk = find_jwk!(kid)
      public_key = JWT::JWK.import(jwk).public_key

      payload, verified_header = JWT.decode(
        token,
        public_key,
        true,
        algorithm: "RS256",
        iss: ENV.fetch("JWT_ISSUER"),
        verify_iss: true,
        aud: ENV.fetch("JWT_AUDIENCE"),
        verify_aud: true,
        required_claims: %w[exp iss aud sub]
      )

      unless verified_header["kid"] == kid &&
             payload.is_a?(Hash)
        return jwt_error!("Token JWT inválido.", :unauthorized)
      end

      # Acepta IDs numéricos o UUID como subject.
      subject = payload["sub"]

      unless subject.is_a?(String) &&
             !subject.strip.empty? &&
             subject == subject.strip &&
             subject.length <= 255
        return jwt_error!(
          "El token no contiene un sub válido.",
          :unauthorized
        )
      end

      username = payload["username"]

      unless username.is_a?(String) &&
             !username.strip.empty?
        return jwt_error!(
          "El token no contiene un username válido.",
          :unauthorized
        )
      end

      roles = payload["roles"]
      role = payload["role"]

      unless roles.is_a?(Array) &&
             !roles.empty? &&
             roles.all? do |value|
               value.is_a?(String) && !value.strip.empty?
             end &&
             roles.uniq == roles &&
             (role.nil? ||
               (role.is_a?(String) && !role.strip.empty?))
        return jwt_error!(
          "El token no contiene roles válidos.",
          :unauthorized
        )
      end

      if role && !roles.include?(role)
        return jwt_error!(
          "Los roles del token son inconsistentes.",
          :unauthorized
        )
      end

      @current_jwt_payload = payload
      true

    rescue JWT::ExpiredSignature
      jwt_error!("El token ha expirado.", :unauthorized)

    rescue JWT::DecodeError, JWT::JWKError,
           OpenSSL::PKey::PKeyError, JSON::ParserError,
           KeyError, ArgumentError
      jwt_error!("Token inválido o no confiable.", :unauthorized)

    rescue Net::OpenTimeout, Net::ReadTimeout, SocketError,
           Errno::ECONNREFUSED, Errno::ETIMEDOUT,
           IOError, Timeout::Error
      jwt_error!(
        "No se pudo consultar el servicio de claves JWT.",
        :service_unavailable
      )
    end
  end

  # Autoriza al usuario si posee alguno de los roles permitidos.
  # Uso: before_action -> { authorize_roles!("ADMINISTRADOR") }
  def authorize_roles!(*allowed_roles)
    unless @current_jwt_payload
      return jwt_error!(
        "Autenticación requerida.",
        :unauthorized
      )
    end

    user_roles = @current_jwt_payload["roles"]

    unless user_roles.is_a?(Array) &&
           (user_roles & allowed_roles).any?
      return jwt_error!(
        "No tienes permisos para esta operación.",
        :forbidden
      )
    end

    true
  end

  private

  def jwt_error!(message, status)
    render json: { error: message }, status: status
    false
  end

  def find_jwk!(kid)
    keys = Rails.cache.fetch(
      JWKS_CACHE_KEY,
      expires_in: JWKS_CACHE_TTL
    ) do
      fetch_jwks!
    end

    jwk = select_jwk(keys, kid)
    return jwk if jwk

    # Actualizar la caché una vez si no aparece el kid.
    Rails.cache.delete(JWKS_CACHE_KEY)

    keys = Rails.cache.fetch(
      JWKS_CACHE_KEY,
      expires_in: JWKS_CACHE_TTL
    ) do
      fetch_jwks!
    end

    jwk = select_jwk(keys, kid)
    return jwk if jwk

    raise JWT::DecodeError,
          "No existe una clave JWKS válida para el kid"
  end

  def select_jwk(keys, kid)
    return nil unless keys.is_a?(Array)

    keys.find do |key|
      next false unless key.is_a?(Hash)
      next false unless key["kid"] == kid
      next false unless key["kty"] == "RSA"
      next false unless key["n"].is_a?(String) &&
                        !key["n"].empty?
      next false unless key["e"].is_a?(String) &&
                        !key["e"].empty?

      next false if key.key?("use") && key["use"] != "sig"
      next false if key.key?("alg") && key["alg"] != "RS256"

      # Un JWKS público no debe exponer material privado RSA.
      private_fields = %w[d p q dp dq qi oth]
      !private_fields.any? { |field| key.key?(field) }
    end
  end

  def fetch_jwks!
    jwks_url = ENV.fetch("JWT_JWKS_URL")
    uri = URI.parse(jwks_url)

    unless %w[http https].include?(uri.scheme) &&
           uri.host &&
           uri.userinfo.nil? &&
           uri.query.nil? &&
           uri.fragment.nil?
      raise ArgumentError, "JWT_JWKS_URL no es una URL válida"
    end

    response = Net::HTTP.start(
      uri.host,
      uri.port,
      use_ssl: uri.scheme == "https",
      open_timeout: JWKS_OPEN_TIMEOUT,
      read_timeout: JWKS_READ_TIMEOUT
    ) do |http|
      request = Net::HTTP::Get.new(uri.request_uri)
      request["Accept"] = "application/json"
      http.request(request)
    end

    unless response.is_a?(Net::HTTPSuccess)
      raise IOError,
            "El endpoint JWKS respondió con HTTP #{response.code}"
    end

    document = JSON.parse(response.body)
    keys = document["keys"]

    unless keys.is_a?(Array)
      raise JSON::ParserError,
            "El documento JWKS no contiene un arreglo keys"
    end

    keys
  end
end
