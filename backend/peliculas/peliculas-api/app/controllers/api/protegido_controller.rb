module Api
  class ProtegidoController < ApplicationController
    include JwtAuthenticatable

    before_action :authenticate_jwt!
    before_action -> { authorize_roles!("ADMINISTRADOR") }

    def show
      render json: {
        mensaje: "Acceso autorizado",
        usuario: @current_jwt_payload["username"],
        roles: @current_jwt_payload["roles"]
      }, status: :ok
    end
  end
end
