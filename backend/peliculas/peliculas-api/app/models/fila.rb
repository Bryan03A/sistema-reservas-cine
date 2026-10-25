
class Fila < ApplicationRecord
  self.table_name = "fila"

  belongs_to :seccion,
             class_name: "Seccion",
             foreign_key: "seccion_id"

  has_many :asientos,
           class_name: "Asiento",
           foreign_key: "fila_id"
end
