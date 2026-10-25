from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from .. import clients
from ..db import get_db
from ..errors import AppError
from ..model.entities import Sala, Seccion, Fila, Asiento
from ..schemas import EstadoAsientoIn
from ..security import Auth, require_roles, STAFF

router = APIRouter(prefix="/api/v1", tags=["Salas y asientos"])
consulta = require_roles(*STAFF)


@router.get("/salas", summary="Consultar salas con sus secciones")
def salas(db: Session = Depends(get_db), auth: Auth = Depends(consulta)):
    return [{"id": s.id, "nombre": s.nombre, "estado": s.estado,
             "secciones": [{"id": x.id, "nombre": x.nombre, "tipo": x.tipo, "precio": float(x.precio), "capacidad": x.capacidad,
                            "num_filas": x.num_filas, "asientos_por_fila": x.asientos_por_fila} for x in s.secciones]}
            for s in db.query(Sala).order_by(Sala.id).all()]


@router.get("/secciones", summary="Consultar secciones (opcional: ?sala_id=)")
def secciones(sala_id: int | None = None, db: Session = Depends(get_db), auth: Auth = Depends(consulta)):
    q = db.query(Seccion)
    if sala_id:
        q = q.filter(Seccion.sala_id == sala_id)
    return [{"id": x.id, "sala_id": x.sala_id, "nombre": x.nombre, "tipo": x.tipo, "precio": float(x.precio), "capacidad": x.capacidad} for x in q.order_by(Seccion.id).all()]


@router.get("/filas", summary="Consultar filas (opcional: ?seccion_id=)")
def filas(seccion_id: int | None = None, db: Session = Depends(get_db), auth: Auth = Depends(consulta)):
    q = db.query(Fila)
    if seccion_id:
        q = q.filter(Fila.seccion_id == seccion_id)
    return [{"id": x.id, "seccion_id": x.seccion_id, "letra": x.letra} for x in q.order_by(Fila.id).all()]


@router.get("/asientos", summary="Consultar asientos (opcional: ?fila_id=)")
def asientos(fila_id: int | None = None, db: Session = Depends(get_db), auth: Auth = Depends(consulta)):
    q = db.query(Asiento)
    if fila_id:
        q = q.filter(Asiento.fila_id == fila_id)
    return [{"id": x.id, "fila_id": x.fila_id, "numero": x.numero, "estado": x.estado} for x in q.order_by(Asiento.id).all()]


@router.patch("/asientos/{aid}/estado", summary="Bloquear / habilitar un asiento por mantenimiento")
def estado_asiento(aid: int, body: EstadoAsientoIn, db: Session = Depends(get_db), auth: Auth = Depends(consulta)):
    a = db.get(Asiento, aid)
    if not a:
        raise AppError(404, "NO_ENCONTRADO", f"Asiento {aid} no existe")
    a.estado = body.estado
    db.commit()
    clients.audit(auth.sub, "MODIFICAR", "asiento", a.id, f"Asiento #{a.id} → {a.estado}")
    return {"id": a.id, "fila_id": a.fila_id, "numero": a.numero, "estado": a.estado}
