module Internal
  class FuncionesController < ApplicationController
    include JwtAuthenticatable

    before_action :authenticate_jwt!

    def detalle
      ids = params[:ids].to_s.split(",").map(&:strip)

      if ids.empty?
        render json: {
          error: "Debe proporcionar IDs"
        }, status: :unprocessable_entity
        return
      end

      unless ids.all? { |id| id.match?(/\A\d+\z/) }
        render json: {
          error: "Los IDs deben ser números enteros"
        }, status: :unprocessable_entity
        return
      end

      ids = ids.map(&:to_i).uniq

      funciones = Funcion.includes(
        :pelicula,
        :sala
      ).where(id: ids)

      render json: funciones.map do |funcion|
        {
          id: funcion.id,
          pelicula_id: funcion.pelicula_id,
          pelicula: funcion.pelicula.nombre,
          sala_id: funcion.sala_id,
          sala: funcion.sala.nombre,
          fecha: funcion.fecha,
          hora_inicio: funcion.hora_inicio,
          hora_fin: funcion.hora_fin,
          estado: funcion.estado
        }
      end
    end
  end
end