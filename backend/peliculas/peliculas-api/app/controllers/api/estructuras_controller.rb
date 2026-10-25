module Api
  class EstructurasController < ApplicationController
    include JwtAuthenticatable

    before_action :authenticate_jwt!
    before_action -> { authorize_roles!("ADMINISTRADOR") }

    def show
      funcion = Funcion.includes(
        :pelicula,
        sala: {
          secciones: {
            filas: :asientos
          }
        }
      ).find_by(id: params[:id])

      unless funcion
        render json: {
          error: "Función no encontrada"
        }, status: :not_found
        return
      end

      sala = funcion.sala

      secciones = sala.secciones.map do |seccion|
        filas = seccion.filas.map do |fila|
          {
            id: fila.id,
            letra: fila.letra,
            asientos: fila.asientos.map do |asiento|
              {
                id: asiento.id,
                numero: asiento.numero,
                estado: asiento.estado
              }
            end
          }
        end

        {
          id: seccion.id,
          nombre: seccion.nombre,
          tipo: seccion.tipo,
          precio: seccion.precio,
          capacidad: seccion.capacidad,
          filas: filas
        }
      end

      total_asientos = secciones.sum do |seccion|
        seccion[:filas].sum do |fila|
          fila[:asientos].length
        end
      end

      render json: {
        funcion: {
          id: funcion.id,
          fecha: funcion.fecha,
          hora_inicio: funcion.hora_inicio,
          hora_fin: funcion.hora_fin,
          estado: funcion.estado
        },
        pelicula: {
          id: funcion.pelicula.id,
          nombre: funcion.pelicula.nombre,
          genero: funcion.pelicula.genero,
          duracion_min: funcion.pelicula.duracion_min,
          clasificacion: funcion.pelicula.clasificacion
        },
        sala: {
          id: sala.id,
          nombre: sala.nombre,
          estado: sala.estado
        },
        secciones: secciones,
        total_asientos: total_asientos
      }
    end
  end
end