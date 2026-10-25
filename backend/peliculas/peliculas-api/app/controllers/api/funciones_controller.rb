
module Api
  class FuncionesController < ApplicationController
    include JwtAuthenticatable

    before_action :authenticate_jwt!
    before_action -> { authorize_roles!("ADMINISTRADOR") }

    before_action :buscar_funcion,
        only: %i[show update cancelar]

    def index
      funciones = Funcion.includes(:pelicula, :sala)

      if params[:fecha].present?
        begin
          fecha = Date.iso8601(params[:fecha].to_s)
          funciones = funciones.where(fecha: fecha)
        rescue Date::Error
          render json: {
            error: "La fecha debe tener formato YYYY-MM-DD"
          }, status: :unprocessable_entity
          return
        end
      end

      if params[:pelicula_id].present?
        funciones = funciones.where(
          pelicula_id: params[:pelicula_id]
        )
      end

      if params[:sala_id].present?
        funciones = funciones.where(
          sala_id: params[:sala_id]
        )
      end

      render json: funciones.order(:fecha, :hora_inicio).map { |f|
        funcion_json(f)
      }
    end

    def show
      render json: funcion_json(@funcion)
    end

    def create
      funcion = Funcion.new(funcion_params)
      funcion.estado = "ACTIVA"

      validar_funcion!(funcion)

      if funcion.errors.any?
        render json: {
          error: "No se puede crear la función",
          detalles: funcion.errors.full_messages
        }, status: :unprocessable_entity
        return
      end

      if existe_cruce?(funcion)
        render json: {
          error: "La sala ya tiene una función en ese horario"
        }, status: :conflict
        return
      end

      if funcion.save
        AuditoriaClient.registrar(
          authorization: request.headers["Authorization"],
          accion: "CREAR",
          entidad: "funcion",
          entidad_id: funcion.id,
          descripcion: "Se creó la función #{funcion.id} para la película #{funcion.pelicula_id}."
        )

        render json: funcion_json(funcion), status: :created
      else
        render json: {
          error: "No se pudo crear la función",
          detalles: funcion.errors.full_messages
        }, status: :unprocessable_entity
      end
    end

    def update
      funcion = @funcion.dup
      funcion.assign_attributes(funcion_params)

      validar_funcion!(funcion)

      if funcion.errors.any?
        render json: {
          error: "No se puede actualizar la función",
          detalles: funcion.errors.full_messages
        }, status: :unprocessable_entity
        return
      end

      if existe_cruce?(funcion, excluir_id: @funcion.id)
        render json: {
          error: "La sala ya tiene una función en ese horario"
        }, status: :conflict
        return
      end

      if @funcion.update(funcion_params)
        AuditoriaClient.registrar(
          authorization: request.headers["Authorization"],
          accion: "ACTUALIZAR",
          entidad: "funcion",
          entidad_id: @funcion.id,
          descripcion: "Se actualizaron los datos de la función #{@funcion.id}."
        )

        render json: funcion_json(@funcion)
      else
        render json: {
          error: "No se pudo actualizar la función",
          detalles: @funcion.errors.full_messages
        }, status: :unprocessable_entity
      end
    end

    def cancelar
      if @funcion.update(estado: "CANCELADA")
        AuditoriaClient.registrar(
          authorization: request.headers["Authorization"],
          accion: "CANCELAR",
          entidad: "funcion",
          entidad_id: @funcion.id,
          descripcion: "Se canceló la función #{@funcion.id}."
        )

        render json: {
          mensaje: "Función cancelada",
          funcion: funcion_json(@funcion)
        }
      else
        render json: {
          error: "No se pudo cancelar la función",
          detalles: @funcion.errors.full_messages
        }, status: :unprocessable_entity
      end
    end

    private

    def buscar_funcion
      @funcion = Funcion.find_by(id: params[:id])

      unless @funcion
        render json: {
          error: "Función no encontrada"
        }, status: :not_found
      end
    end

    def funcion_params
      params.require(:funcion).permit(
        :pelicula_id,
        :sala_id,
        :fecha,
        :hora_inicio,
        :hora_fin
      )
    end

    def funcion_json(funcion)
      {
        id: funcion.id,
        pelicula_id: funcion.pelicula_id,
        sala_id: funcion.sala_id,
        fecha: funcion.fecha,
        hora_inicio: funcion.hora_inicio,
        hora_fin: funcion.hora_fin,
        estado: funcion.estado
      }
    end

    # Validaciones de la función
    def validar_funcion!(funcion)
        funcion.errors.clear

        pelicula = Pelicula.find_by(id: funcion.pelicula_id)
        sala = Sala.find_by(id: funcion.sala_id)

        unless pelicula
            funcion.errors.add(:pelicula_id, "no existe")
            return
        end

        unless pelicula.estado == "ACTIVA"
            funcion.errors.add(
            :pelicula_id,
            "debe estar activa"
            )
        end

        unless sala
            funcion.errors.add(:sala_id, "no existe")
            return
        end

        unless sala.estado == "ACTIVA"
            funcion.errors.add(
            :sala_id,
            "debe estar activa"
            )
        end

        unless funcion.fecha.present?
            funcion.errors.add(:fecha, "es obligatoria")
        end

        unless funcion.hora_inicio.present?
            funcion.errors.add(:hora_inicio, "es obligatoria")
        end

        unless funcion.hora_fin.present?
            funcion.errors.add(:hora_fin, "es obligatoria")
        end

        if funcion.hora_inicio.present? &&
            funcion.hora_fin.present? &&
            funcion.hora_inicio >= funcion.hora_fin

            funcion.errors.add(
            :hora_fin,
            "debe ser posterior a la hora de inicio"
            )
        end
    end

    def existe_cruce?(funcion, excluir_id: nil)
        return false unless funcion.fecha.present?
        return false unless funcion.sala_id.present?
        return false unless funcion.hora_inicio.present?
        return false unless funcion.hora_fin.present?

        funciones = Funcion.where(
            sala_id: funcion.sala_id,
            fecha: funcion.fecha,
            estado: "ACTIVA"
        )

        if excluir_id.present?
            funciones = funciones.where.not(id: excluir_id)
        end

        funciones.where(
            "hora_inicio < ? AND hora_fin > ?",
            funcion.hora_fin,
            funcion.hora_inicio
        ).exists?
    end
  end
end
