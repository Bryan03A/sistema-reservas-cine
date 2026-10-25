
class Funcion < ApplicationRecord
  self.table_name = "funcion"

  belongs_to :pelicula,
             class_name: "Pelicula",
             foreign_key: "pelicula_id"

  belongs_to :sala,
             class_name: "Sala",
             foreign_key: "sala_id"
end
