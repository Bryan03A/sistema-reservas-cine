
module Api
  class PeliculasController < ApplicationController
    include JwtAuthenticatable

    before_action :authenticate_jwt!
    before_action -> { authorize_roles!("ADMINISTRADOR") }

    before_action :buscar_pelicula,
                  only: %i[show update cambiar_estado]

    # GET /api/peliculas
    # Lista películas administrativas con filtros.
    def index
      peliculas = Pelicula.all

      # Filtro por nombre.
      if params[:nombre].present?
        peliculas = peliculas.where(
          "nombre ILIKE ?",
          "%#{params[:nombre].to_s.strip}%"
        )
      end

      # Filtro por género.
      if params[:genero].present?
        peliculas = peliculas.where(
          "genero ILIKE ?",
          params[:genero].to_s.strip
        )
      end

      # Filtro por clasificación.
      if params[:clasificacion].present?
        peliculas = peliculas.where(
          clasificacion: params[:clasificacion].to_s.strip
        )
      end

      # Filtro por fecha de función.
      if params[:fecha].present?
        begin
          fecha = Date.iso8601(params[:fecha].to_s)

          peliculas = peliculas.where(
            id: Funcion.where(fecha: fecha).select(:pelicula_id)
          )

        rescue Date::Error
          return render json: {
            error: "La fecha debe tener formato YYYY-MM-DD."
          }, status: :unprocessable_entity
        end
      end

      peliculas = peliculas.order(:id)

      render json: peliculas.as_json(
        only: %i[
          id
          nombre
          descripcion
          genero
          duracion_min
          clasificacion
          estado
        ]
      ), status: :ok
    end

    # GET /api/peliculas/:id
    def show
      render json: @pelicula.as_json(
        only: %i[
          id
          nombre
          descripcion
          genero
          duracion_min
          clasificacion
          estado
        ]
      ), status: :ok
    end

    # POST /api/peliculas
    def create
      pelicula = Pelicula.new(pelicula_params)
      pelicula.estado = "ACTIVA"

      if pelicula.save
        AuditoriaClient.registrar(
          authorization: request.headers["Authorization"],
          accion: "CREAR",
          entidad: "pelicula",
          entidad_id: pelicula.id,
          descripcion: "Se creó la película #{pelicula.nombre}."
        )

        render json: pelicula.as_json(
          only: %i[
            id
            nombre
            descripcion
            genero
            duracion_min
            clasificacion
            estado
          ]
        ), status: :created
      else
        render json: {
          error: "No se pudo crear la película.",
          detalles: pelicula.errors.full_messages
        }, status: :unprocessable_entity
      end
    end

    # PUT /api/peliculas/:id
    def update
      if @pelicula.update(pelicula_params)
        AuditoriaClient.registrar(
          authorization: request.headers["Authorization"],
          accion: "ACTUALIZAR",
          entidad: "pelicula",
          entidad_id: @pelicula.id,
          descripcion: "Se actualizaron los datos de la película #{@pelicula.nombre}."
        )

        render json: @pelicula.as_json(
          only: %i[
            id
            nombre
            descripcion
            genero
            duracion_min
            clasificacion
            estado
          ]
        ), status: :ok
      else
        render json: {
          error: "No se pudo actualizar la película.",
          detalles: @pelicula.errors.full_messages
        }, status: :unprocessable_entity
      end
    end

    # PATCH /api/peliculas/:id/estado
    def cambiar_estado
      estado = params[:estado].to_s.upcase

      unless %w[ACTIVA INACTIVA].include?(estado)
        return render json: {
          error: "El estado debe ser ACTIVA o INACTIVA."
        }, status: :unprocessable_entity
      end

      if @pelicula.update(estado: estado)
        AuditoriaClient.registrar(
          authorization: request.headers["Authorization"],
          accion: "CAMBIAR_ESTADO",
          entidad: "pelicula",
          entidad_id: @pelicula.id,
          descripcion: "Se cambió el estado de la película #{@pelicula.nombre} a #{estado}."
        )

        render json: {
          mensaje: "Estado actualizado correctamente.",
          pelicula: @pelicula.as_json(
            only: %i[id nombre estado]
          )
        }, status: :ok
      else
        render json: {
          error: "No se pudo actualizar el estado.",
          detalles: @pelicula.errors.full_messages
        }, status: :unprocessable_entity
      end
    end

    private

    def buscar_pelicula
      @pelicula = Pelicula.find_by(id: params[:id])

      unless @pelicula
        render json: {
          error: "Película no encontrada."
        }, status: :not_found
      end
    end

    def pelicula_params
      params.require(:pelicula).permit(
        :nombre,
        :descripcion,
        :genero,
        :duracion_min,
        :clasificacion
      )
    end
  end
end
