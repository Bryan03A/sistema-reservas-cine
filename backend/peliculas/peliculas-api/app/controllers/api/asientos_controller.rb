
module Api
  class AsientosController < ApplicationController
    include JwtAuthenticatable

    before_action :authenticate_jwt!
    before_action -> { authorize_roles!("ADMINISTRADOR") }

    def cambiar_estado
      asiento = Asiento.find_by(id: params[:id])

      unless asiento
        render json: {
          error: "Asiento no encontrado"
        }, status: :not_found
        return
      end

      estado = params[:estado].to_s.upcase

      unless %w[ACTIVO INACTIVO].include?(estado)
        render json: {
          error: "Estado inválido. Use ACTIVO o INACTIVO"
        }, status: :unprocessable_entity
        return
      end

      if asiento.update(estado: estado)
        AuditoriaClient.registrar(
          authorization: request.headers["Authorization"],
          accion: "CAMBIAR_ESTADO",
          entidad: "asiento",
          entidad_id: asiento.id,
          descripcion: "Se cambió el estado del asiento #{asiento.numero} a #{estado}."
        )

        render json: {
          id: asiento.id,
          numero: asiento.numero,
          estado: asiento.estado
        }
      else
        render json: {
          error: "No se pudo actualizar el asiento",
          detalles: asiento.errors.full_messages
        }, status: :unprocessable_entity
      end
    end
  end
end
