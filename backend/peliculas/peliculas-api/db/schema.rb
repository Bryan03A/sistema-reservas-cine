# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.1].define(version: 0) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pg_catalog.plpgsql"

  create_table "asiento", id: :integer, default: nil, force: :cascade do |t|
    t.integer "fila_id", null: false
    t.integer "numero", null: false
    t.string "estado", limit: 10, default: "ACTIVO", null: false

    t.check_constraint "estado::text = ANY (ARRAY['ACTIVO'::character varying, 'INACTIVO'::character varying]::text[])", name: "asiento_estado_check"
    t.check_constraint "numero > 0", name: "asiento_numero_check"
    t.unique_constraint ["fila_id", "numero"], name: "asiento_fila_id_numero_key"
  end

  create_table "fila", id: :integer, default: nil, force: :cascade do |t|
    t.integer "seccion_id", null: false
    t.string "letra", limit: 1, null: false

    t.unique_constraint ["seccion_id", "letra"], name: "fila_seccion_id_letra_key"
  end

  create_table "funcion", id: :integer, default: nil, force: :cascade do |t|
    t.integer "pelicula_id", null: false
    t.integer "sala_id", null: false
    t.date "fecha", null: false
    t.time "hora_inicio", null: false
    t.time "hora_fin", null: false
    t.string "estado", limit: 15, default: "ACTIVA", null: false
    t.index ["pelicula_id", "fecha"], name: "idx_funcion_pelicula_fecha"
    t.check_constraint "estado::text = ANY (ARRAY['ACTIVA'::character varying, 'CANCELADA'::character varying, 'FINALIZADA'::character varying]::text[])", name: "funcion_estado_check"
    t.check_constraint "hora_fin > hora_inicio", name: "funcion_check"
    t.unique_constraint ["sala_id", "fecha", "hora_inicio"], name: "funcion_sala_id_fecha_hora_inicio_key"
  end

  create_table "pelicula", id: :integer, default: nil, force: :cascade do |t|
    t.string "nombre", limit: 150, null: false
    t.text "descripcion"
    t.string "genero", limit: 40, null: false
    t.integer "duracion_min", null: false
    t.string "clasificacion", limit: 10, null: false
    t.string "estado", limit: 10, default: "ACTIVA", null: false
    t.timestamptz "created_at", default: -> { "now()" }, null: false
    t.timestamptz "updated_at", default: -> { "now()" }, null: false
    t.check_constraint "clasificacion::text = ANY (ARRAY['TP'::character varying, '+12'::character varying, '+15'::character varying, '+18'::character varying]::text[])", name: "pelicula_clasificacion_check"
    t.check_constraint "duracion_min > 0", name: "pelicula_duracion_min_check"
    t.check_constraint "estado::text = ANY (ARRAY['ACTIVA'::character varying, 'INACTIVA'::character varying]::text[])", name: "pelicula_estado_check"
  end

  create_table "sala", id: :integer, default: nil, force: :cascade do |t|
    t.string "nombre", limit: 50, null: false
    t.string "estado", limit: 10, default: "ACTIVA", null: false

    t.check_constraint "estado::text = ANY (ARRAY['ACTIVA'::character varying, 'INACTIVA'::character varying]::text[])", name: "sala_estado_check"
    t.unique_constraint ["nombre"], name: "sala_nombre_key"
  end

  create_table "seccion", id: :integer, default: nil, force: :cascade do |t|
    t.integer "sala_id", null: false
    t.string "nombre", limit: 50, null: false
    t.string "descripcion", limit: 150
    t.string "tipo", limit: 10, null: false
    t.decimal "precio", precision: 6, scale: 2, null: false
    t.integer "capacidad", null: false
    t.integer "num_filas", null: false
    t.integer "asientos_por_fila", null: false

    t.check_constraint "asientos_por_fila > 0", name: "seccion_asientos_por_fila_check"
    t.check_constraint "capacidad = (num_filas * asientos_por_fila)", name: "seccion_check"
    t.check_constraint "capacidad > 0", name: "seccion_capacidad_check"
    t.check_constraint "num_filas > 0", name: "seccion_num_filas_check"
    t.check_constraint "precio >= 0::numeric", name: "seccion_precio_check"
    t.check_constraint "tipo::text = 'VIP'::text AND precio = 15.00 OR tipo::text = 'DBOX'::text AND precio = 10.00 OR tipo::text = 'GENERAL'::text AND precio = 5.00", name: "seccion_check1"
    t.check_constraint "tipo::text = ANY (ARRAY['VIP'::character varying, 'DBOX'::character varying, 'GENERAL'::character varying]::text[])", name: "seccion_tipo_check"
    t.unique_constraint ["id", "sala_id"], name: "seccion_id_sala_id_key"
    t.unique_constraint ["sala_id", "nombre"], name: "seccion_sala_id_nombre_key"
  end

  add_foreign_key "asiento", "fila", name: "asiento_fila_id_fkey"
  add_foreign_key "fila", "seccion", name: "fila_seccion_id_fkey"
  add_foreign_key "funcion", "pelicula", name: "funcion_pelicula_id_fkey"
  add_foreign_key "funcion", "sala", name: "funcion_sala_id_fkey"
  add_foreign_key "seccion", "sala", name: "seccion_sala_id_fkey"
end
