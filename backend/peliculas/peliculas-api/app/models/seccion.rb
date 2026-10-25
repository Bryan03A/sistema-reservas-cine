
class Seccion < ApplicationRecord
  self.table_name = "seccion"

  belongs_to :sala,
             class_name: "Sala",
             foreign_key: "sala_id"

  has_many :filas,
           class_name: "Fila",
           foreign_key: "seccion_id"
end
