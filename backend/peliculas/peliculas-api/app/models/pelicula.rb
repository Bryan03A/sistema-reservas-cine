
class Pelicula < ApplicationRecord
  self.table_name = "pelicula"

  has_many :funciones,
           class_name: "Funcion",
           foreign_key: "pelicula_id"

  validates :nombre, presence: true
  validates :genero, presence: true

  validates :duracion_min,
            numericality: {
              only_integer: true,
              greater_than: 0
            }

  validates :clasificacion,
            inclusion: { in: %w[TP +12 +15 +18] }

  validates :estado,
            inclusion: { in: %w[ACTIVA INACTIVA] }
end
