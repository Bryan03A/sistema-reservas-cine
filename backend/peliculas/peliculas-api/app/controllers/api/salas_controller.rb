module Api
  class SalasController < ApplicationController
    include JwtAuthenticatable

    before_action :authenticate_jwt!
    before_action -> { authorize_roles!("ADMINISTRADOR") }

    def index
      salas = Sala.includes(
        secciones: {
          filas: :asientos
        }
      )

      render json: salas.map do |sala|
        {
          id: sala.id,
          nombre: sala.nombre,
          estado: sala.estado,
          secciones: sala.secciones.map do |seccion|
            {
              id: seccion.id,
              nombre: seccion.nombre,
              tipo: seccion.tipo,
              precio: seccion.precio,
              capacidad: seccion.capacidad,
              filas: seccion.filas.map do |fila|
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
            }
          end
        }
      end
    end
  end
end