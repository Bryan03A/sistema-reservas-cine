
class Sala < ApplicationRecord
  self.table_name = "sala"

  has_many :funciones,
           class_name: "Funcion",
           foreign_key: "sala_id"

  has_many :secciones,
           class_name: "Seccion",
           foreign_key: "sala_id"

  validates :nombre, presence: true, uniqueness: true

  validates :estado,
            inclusion: { in: %w[ACTIVA INACTIVA] }
end
