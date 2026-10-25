
# db/seeds.rb

# ==================================================
# PELICULAS
# ==================================================

datos_peliculas = [
  {
    nombre: "La aventura espacial",
    descripcion: "Película de ciencia ficción de prueba",
    genero: "Ciencia ficción",
    duracion_min: 120,
    clasificacion: "+12",
    estado: "ACTIVA"
  },
  {
    nombre: "Misterio en la ciudad",
    descripcion: "Película de misterio de prueba",
    genero: "Misterio",
    duracion_min: 105,
    clasificacion: "+15",
    estado: "ACTIVA"
  },
  {
    nombre: "Aventura en el bosque",
    descripcion: "Película de aventuras",
    genero: "Aventura",
    duracion_min: 110,
    clasificacion: "TP",
    estado: "ACTIVA"
  }
]

datos_peliculas.each do |datos|
  Pelicula.find_or_create_by!(nombre: datos[:nombre]) do |p|
    p.assign_attributes(datos)
  end
end

# ==================================================
# SALAS
# ==================================================

sala_1 = Sala.find_or_create_by!(nombre: "Sala 1") do |s|
  s.estado = "ACTIVA"
end

sala_2 = Sala.find_or_create_by!(nombre: "Sala 2") do |s|
  s.estado = "ACTIVA"
end

# ==================================================
# SECCIONES
# Cada sala tiene VIP, DBOX y GENERAL.
# Cada sección tiene 2 filas x 2 asientos.
# ==================================================

configuracion_secciones = [
  {
    sala: sala_1,
    nombre: "VIP",
    tipo: "VIP",
    precio: 15.00
  },
  {
    sala: sala_1,
    nombre: "DBOX",
    tipo: "DBOX",
    precio: 10.00
  },
  {
    sala: sala_1,
    nombre: "GENERAL",
    tipo: "GENERAL",
    precio: 5.00
  },
  {
    sala: sala_2,
    nombre: "VIP",
    tipo: "VIP",
    precio: 15.00
  },
  {
    sala: sala_2,
    nombre: "DBOX",
    tipo: "DBOX",
    precio: 10.00
  },
  {
    sala: sala_2,
    nombre: "GENERAL",
    tipo: "GENERAL",
    precio: 5.00
  }
]

configuracion_secciones.each do |datos|
  sala = datos.fetch(:sala)

  seccion = Seccion.find_or_create_by!(
    sala_id: sala.id,
    nombre: datos.fetch(:nombre)
  ) do |s|
    s.tipo = datos.fetch(:tipo)
    s.precio = datos.fetch(:precio)
    s.descripcion = "Sección #{datos.fetch(:nombre)} de #{sala.nombre}"
    s.num_filas = 2
    s.asientos_por_fila = 2
    s.capacidad = 4
  end

  # Crear dos filas: A y B.
  ["A", "B"].each do |letra|
    fila = Fila.find_or_create_by!(
      seccion_id: seccion.id,
      letra: letra
    )

    # Crear dos asientos por fila.
    [1, 2].each do |numero|
      Asiento.find_or_create_by!(
        fila_id: fila.id,
        numero: numero
      ) do |asiento|
        asiento.estado = "ACTIVO"
      end
    end
  end
end

# ==================================================
# FUNCIONES
# Fechas futuras, respetando los horarios existentes.
# ==================================================

peliculas_por_nombre = Pelicula.all.index_by(&:nombre)

programacion = [
  {
    pelicula: "La aventura espacial",
    sala: sala_1,
    dias: 1,
    hora_inicio: "15:00"
  },
  {
    pelicula: "Misterio en la ciudad",
    sala: sala_2,
    dias: 1,
    hora_inicio: "18:00"
  },
  {
    pelicula: "Aventura en el bosque",
    sala: sala_1,
    dias: 1,
    hora_inicio: "18:00"
  }
]

programacion.each do |datos|
  pelicula = peliculas_por_nombre.fetch(datos.fetch(:pelicula))
  sala = datos.fetch(:sala)
  fecha = Date.current + datos.fetch(:dias)

  inicio = Time.zone.parse(
    "#{fecha} #{datos.fetch(:hora_inicio)}"
  )

  fin = inicio + pelicula.duracion_min.minutes

  # Las columnas hora_inicio y hora_fin son de tipo TIME.
  hora_inicio = inicio.strftime("%H:%M:%S")
  hora_fin = fin.strftime("%H:%M:%S")

  # No duplicar una función ya creada.
  existente = Funcion.find_by(
    pelicula_id: pelicula.id,
    sala_id: sala.id,
    fecha: fecha,
    hora_inicio: hora_inicio
  )

  next if existente

  # Impedir solapamientos en la misma sala y fecha.
  conflicto = Funcion.where(
    sala_id: sala.id,
    fecha: fecha,
    estado: "ACTIVA"
  ).where(
    "hora_inicio < ? AND hora_fin > ?",
    hora_fin,
    hora_inicio
  ).exists?

  if conflicto
    puts "Horario ocupado: #{pelicula.nombre}, #{sala.nombre}, #{fecha}"
    next
  end

  Funcion.create!(
    pelicula_id: pelicula.id,
    sala_id: sala.id,
    fecha: fecha,
    hora_inicio: hora_inicio,
    hora_fin: hora_fin,
    estado: "ACTIVA"
  )
end

puts "Semillas ejecutadas correctamente."
