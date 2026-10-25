
class Asiento < ApplicationRecord
  self.table_name = "asiento"

  belongs_to :fila,
             class_name: "Fila",
             foreign_key: "fila_id"
end
