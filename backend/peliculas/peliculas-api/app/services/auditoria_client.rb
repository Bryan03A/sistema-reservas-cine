
require "net/http"
require "json"
require "uri"

class AuditoriaClient
  def self.registrar(authorization:, accion:, entidad:, entidad_id:, descripcion:)
    return false if authorization.blank?

    base_url = ENV.fetch(
      "USUARIOS_API_URL",
      "http://localhost:3000"
    )

    uri = URI.join("#{base_url.chomp("/")}/", "auditoria")

    request = Net::HTTP::Post.new(uri)
    request["Authorization"] = authorization
    request["Content-Type"] = "application/json"

    request.body = {
      accion: accion,
      entidad: entidad,
      entidadId: entidad_id,
      descripcion: descripcion
    }.to_json

    response = Net::HTTP.start(
      uri.host,
      uri.port,
      use_ssl: uri.scheme == "https",
      open_timeout: 2,
      read_timeout: 3
    ) do |http|
      http.request(request)
    end

    unless response.is_a?(Net::HTTPSuccess)
      Rails.logger.error(
        "[AUDITORIA] El microservicio respondió HTTP #{response.code}: " \
        "#{response.body}"
      )
      return false
    end

    true
  rescue StandardError => e
    Rails.logger.error(
      "[AUDITORIA] No se pudo enviar el evento: #{e.class}: #{e.message}"
    )
    false
  end
end
