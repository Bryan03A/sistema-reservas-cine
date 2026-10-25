from datetime import date
from fastapi import APIRouter, Depends
from sqlalchemy import exists
from sqlalchemy.orm import Session
from ..db import get_db
from ..errors import AppError
from ..model.entities import Pelicula, Funcion
from ..schemas import PeliculaIn, EstadoPeliculaIn
from ..security import Auth, auth_optional, require_roles, STAFF
from .. import clients

router = APIRouter(prefix="/api/v1", tags=["Películas"])


def out(p: Pelicula) -> dict:
    return {"id": p.id, "nombre": p.nombre, "descripcion": p.descripcion, "genero": p.genero, "duracion_min": p.duracion_min,
            "clasificacion": p.clasificacion, "estado": p.estado}


def get_or_404(db: Session, pid: int) -> Pelicula:
    p = db.get(Pelicula, pid)
    if not p:
        raise AppError(404, "NO_ENCONTRADO", f"Película {pid} no existe")
    return p


@router.get("/peliculas", summary="Consultar cartelera (público): por nombre, género, clasificación y fecha")
def listar(nombre: str | None = None, genero: str | None = None, clasificacion: str | None = None,
           fecha: date | None = None, estado: str | None = None,
           db: Session = Depends(get_db), auth: Auth | None = Depends(auth_optional)):
    es_staff = auth is not None and auth.rol in STAFF
    q = db.query(Pelicula)
    # El público solo ve películas activas; el personal puede filtrar por cualquier estado
    if not es_staff or estado is None:
        q = q.filter(Pelicula.estado == "ACTIVA")
    elif estado != "TODAS":
        q = q.filter(Pelicula.estado == estado)
    if nombre:
        q = q.filter(Pelicula.nombre.ilike(f"%{nombre}%"))
    if genero:
        q = q.filter(Pelicula.genero.ilike(f"%{genero}%"))
    if clasificacion:
        q = q.filter(Pelicula.clasificacion == clasificacion)
    if fecha:
        q = q.filter(exists().where(Funcion.pelicula_id == Pelicula.id, Funcion.fecha == fecha, Funcion.estado == "ACTIVA"))
    return [out(p) for p in q.order_by(Pelicula.nombre).all()]


@router.get("/peliculas/{pid}", summary="Detalle de una película")
def detalle(pid: int, db: Session = Depends(get_db)):
    return out(get_or_404(db, pid))


@router.post("/peliculas", status_code=201, summary="Crear película (operador/administrador)")
def crear(body: PeliculaIn, db: Session = Depends(get_db), auth: Auth = Depends(require_roles(*STAFF))):
    p = Pelicula(**body.model_dump())
    db.add(p)
    db.commit()
    clients.audit(auth.sub, "CREAR", "pelicula", p.id, f"Película «{p.nombre}» creada")
    return out(p)


@router.put("/peliculas/{pid}", summary="Modificar película")
def modificar(pid: int, body: PeliculaIn, db: Session = Depends(get_db), auth: Auth = Depends(require_roles(*STAFF))):
    p = get_or_404(db, pid)
    for k, v in body.model_dump().items():
        setattr(p, k, v)
    db.commit()
    clients.audit(auth.sub, "MODIFICAR", "pelicula", p.id, f"Película «{p.nombre}» modificada")
    return out(p)


@router.patch("/peliculas/{pid}/estado", summary="Activar, desactivar o retirar de cartelera (no se borra, se conserva el historial)")
def cambiar_estado(pid: int, body: EstadoPeliculaIn, db: Session = Depends(get_db), auth: Auth = Depends(require_roles(*STAFF))):
    p = get_or_404(db, pid)
    p.estado = body.estado
    db.commit()
    accion = "ACTIVAR" if body.estado == "ACTIVA" else "DESACTIVAR"
    clients.audit(auth.sub, accion, "pelicula", p.id, f"Película «{p.nombre}» → {body.estado}")
    return out(p)
