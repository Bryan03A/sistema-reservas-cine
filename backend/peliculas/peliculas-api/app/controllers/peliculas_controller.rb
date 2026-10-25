class PeliculasController < ApplicationController
  # GET /peliculas
  # Lista únicamente las películas activas.
  def index
    peliculas = Pelicula
      .where(estado: "ACTIVA")
      .order(:id)

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

  # GET /peliculas/:id
  # Solo permite consultar películas activas.
  def show
    pelicula = Pelicula.find_by(
      id: params[:id],
      estado: "ACTIVA"
    )

    unless pelicula
      return render json: {
        error: "Pelicula no encontrada"
      }, status: :not_found
    end

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
    ), status: :ok
  end
end
