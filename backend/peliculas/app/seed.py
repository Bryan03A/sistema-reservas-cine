from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo
from sqlalchemy.orm import Session
from . import config
from .db import Base, engine, SessionLocal
from .model.entities import Pelicula, Sala, Seccion, Fila, Asiento, Funcion

# Estructura física idéntica para todas las salas (letras únicas dentro de la sala)
SECCIONES = [
    ("VIP", "VIP", "Butacas reclinables con servicio", 15, ["A", "B"], 6),
    ("DBOX", "DBOX", "Butacas con movimiento sincronizado", 10, ["C", "D"], 6),
    ("GENERAL", "GENERAL", "Zona general", 5, ["E", "F", "G"], 8),
]
PELICULAS = [
    ("El Último Faro", "Un farero y una científica descubren qué guarda la luz que nunca se apaga.", "Drama", 112, "+12"),
    ("Noche en el Altiplano", "Una periodista queda atrapada en un pueblo andino donde nadie quiere hablar.", "Suspenso", 104, "+15"),
    ("Los Guardianes del Bosque", "Tres amigos protegen un bosque mágico de una constructora misteriosa.", "Animación", 96, "TP"),
    ("Código Cuántico", "Una hacker descubre que su algoritmo puede reescribir el pasado reciente.", "Ciencia ficción", 131, "+12"),
]
# (sala_index, hora_inicio): horarios que no se solapan entre sí
HORARIOS = [(0, time(15, 0)), (0, time(18, 0)), (0, time(21, 0)), (1, time(16, 0)), (1, time(19, 0)), (1, time(21, 45))]


def hoy_local() -> date:
    return datetime.now(ZoneInfo(config.TIMEZONE)).date()


def generar_funciones(db: Session, dias: int = 4) -> int:
    """Crea funciones de demostración desde hoy durante N días (omite las que ya existan)."""
    salas = db.query(Sala).order_by(Sala.id).all()
    peliculas = db.query(Pelicula).filter(Pelicula.estado == "ACTIVA").order_by(Pelicula.id).all()
    if not salas or not peliculas:
        return 0
    creadas = 0
    for d in range(dias):
        fecha = hoy_local() + timedelta(days=d)
        for i, (s_idx, inicio) in enumerate(HORARIOS):
            sala = salas[s_idx % len(salas)]
            peli = peliculas[(i + d) % len(peliculas)]
            existe = db.query(Funcion).filter_by(sala_id=sala.id, fecha=fecha, hora_inicio=inicio).first()
            if existe:
                continue
            fin = (datetime.combine(fecha, inicio) + timedelta(minutes=peli.duracion_min)).time()
            db.add(Funcion(pelicula_id=peli.id, sala_id=sala.id, fecha=fecha, hora_inicio=inicio, hora_fin=fin))
            creadas += 1
    db.commit()
    return creadas


def seed():
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        if db.query(Sala).count() > 0:
            return
        print("[peliculas] cargando datos semilla...", flush=True)
        for nombre in ("Sala 1", "Sala 2"):
            sala = Sala(nombre=nombre)
            db.add(sala)
            db.flush()
            for tipo, nom, desc, precio, letras, por_fila in SECCIONES:
                sec = Seccion(sala_id=sala.id, nombre=nom, descripcion=desc, tipo=tipo, precio=precio,
                              capacidad=len(letras) * por_fila, num_filas=len(letras), asientos_por_fila=por_fila)
                db.add(sec)
                db.flush()
                for letra in letras:
                    fila = Fila(seccion_id=sec.id, letra=letra)
                    db.add(fila)
                    db.flush()
                    db.add_all([Asiento(fila_id=fila.id, numero=n) for n in range(1, por_fila + 1)])
        db.add_all([Pelicula(nombre=n, descripcion=d, genero=g, duracion_min=m, clasificacion=c) for n, d, g, m, c in PELICULAS])
        db.commit()
        n = generar_funciones(db)
        print(f"[peliculas] semilla lista: 2 salas x 48 asientos, {len(PELICULAS)} películas, {n} funciones", flush=True)
