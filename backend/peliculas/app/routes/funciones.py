from datetime import date, datetime, time, timedelta
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload, selectinload
from .. import config, clients
from ..db import get_db
from ..errors import AppError
from ..model.entities import Funcion, Pelicula, Sala, Seccion, Fila
from ..schemas import FuncionIn
from ..security import Auth, auth_required, require_roles, STAFF
from ..seed import generar_funciones, hoy_local

router = APIRouter(prefix="/api/v1", tags=["Funciones"])
hm = lambda t: t.strftime("%H:%M")  # noqa: E731


def out(f: Funcion) -> dict:
    precios = {s.tipo: float(s.precio) for s in f.sala.secciones}
    return {
        "id": f.id, "pelicula_id": f.pelicula_id, "sala_id": f.sala_id, "fecha": f.fecha.isoformat(),
        "hora_inicio": hm(f.hora_inicio), "hora_fin": hm(f.hora_fin), "estado": f.estado,
        "pelicula": {"nombre": f.pelicula.nombre, "genero": f.pelicula.genero, "clasificacion": f.pelicula.clasificacion, "duracion_min": f.pelicula.duracion_min},
        "sala": f.sala.nombre, "precios": precios, "precio_desde": min(precios.values()) if precios else None,
    }


def base_query(db: Session):
    return db.query(Funcion).options(joinedload(Funcion.pelicula), joinedload(Funcion.sala).selectinload(Sala.secciones))


def get_or_404(db: Session, fid: int) -> Funcion:
    f = base_query(db).filter(Funcion.id == fid).first()
    if not f:
        raise AppError(404, "NO_ENCONTRADO", f"Función {fid} no existe")
    return f


def validar_horario(db: Session, sala_id: int, fecha: date, ini: time, fin: time, excluir: int | None = None):
    if fin <= ini:
        raise AppError(422, "HORARIO_INVALIDO", "La función debe terminar el mismo día y después de su hora de inicio")
    buf = timedelta(minutes=config.MINUTOS_LIMPIEZA)
    dt = lambda t: datetime.combine(fecha, t)  # noqa: E731
    q = db.query(Funcion).filter(Funcion.sala_id == sala_id, Funcion.fecha == fecha, Funcion.estado == "ACTIVA")
    if excluir:
        q = q.filter(Funcion.id != excluir)
    for o in q.all():
        if dt(o.hora_inicio) < dt(fin) + buf and dt(o.hora_fin) + buf > dt(ini):
            raise AppError(409, "FUNCION_SOLAPADA",
                           f"La sala ya tiene la función #{o.id} de {hm(o.hora_inicio)} a {hm(o.hora_fin)} (se exigen {config.MINUTOS_LIMPIEZA} min de limpieza entre funciones)")


def preparar(db: Session, body: FuncionIn, excluir: int | None = None) -> time:
    peli = db.get(Pelicula, body.pelicula_id)
    sala = db.get(Sala, body.sala_id)
    if not peli or peli.estado != "ACTIVA":
        raise AppError(422, "PELICULA_NO_HABILITADA", "La película no existe o no está activa")
    if not sala or sala.estado != "ACTIVA":
        raise AppError(422, "SALA_NO_DISPONIBLE", "La sala no existe o no está activa")
    if body.fecha < hoy_local():
        raise AppError(422, "FECHA_INVALIDA", "No se pueden programar funciones en fechas pasadas")
    fin = body.hora_fin or (datetime.combine(body.fecha, body.hora_inicio) + timedelta(minutes=peli.duracion_min)).time()
    if body.hora_fin is None and datetime.combine(body.fecha, body.hora_inicio) + timedelta(minutes=peli.duracion_min) >= datetime.combine(body.fecha + timedelta(days=1), time(0, 0)):
        raise AppError(422, "HORARIO_INVALIDO", "La función terminaría después de medianoche")
    validar_horario(db, body.sala_id, body.fecha, body.hora_inicio, fin, excluir)
    return fin


@router.get("/funciones", summary="Consultar funciones (público): por fecha, rango, película o sala")
def listar(fecha: date | None = None, desde: date | None = None, hasta: date | None = None, pelicula_id: int | None = None,
           sala_id: int | None = None, estado: str | None = None, db: Session = Depends(get_db)):
    q = base_query(db)
    if fecha:
        q = q.filter(Funcion.fecha == fecha)
    if desde:
        q = q.filter(Funcion.fecha >= desde)
    if hasta:
        q = q.filter(Funcion.fecha <= hasta)
    if pelicula_id:
        q = q.filter(Funcion.pelicula_id == pelicula_id)
    if sala_id:
        q = q.filter(Funcion.sala_id == sala_id)
    q = q.filter(Funcion.estado == (estado or "ACTIVA")) if estado != "TODAS" else q
    return [out(f) for f in q.order_by(Funcion.fecha, Funcion.hora_inicio, Funcion.id).all()]


@router.get("/funciones/{fid}", summary="Detalle de una función")
def detalle(fid: int, db: Session = Depends(get_db)):
    return out(get_or_404(db, fid))


@router.get("/funciones/{fid}/estructura", summary="Sala → secciones → filas → asientos (con precios). La consume el mapa de asientos y Reservas")
def estructura(fid: int, db: Session = Depends(get_db), auth: Auth = Depends(auth_required)):
    f = get_or_404(db, fid)
    sala = (db.query(Sala).options(selectinload(Sala.secciones).selectinload(Seccion.filas).selectinload(Fila.asientos))
            .filter(Sala.id == f.sala_id).one())
    total = 0
    secciones = []
    for s in sala.secciones:
        filas = []
        for fila in s.filas:
            asientos = [{"id": a.id, "numero": a.numero, "etiqueta": f"{fila.letra}{a.numero}", "estado": a.estado} for a in fila.asientos]
            total += len(asientos)
            filas.append({"id": fila.id, "letra": fila.letra, "asientos": asientos})
        secciones.append({"id": s.id, "nombre": s.nombre, "tipo": s.tipo, "precio": float(s.precio), "capacidad": s.capacidad, "filas": filas})
    return {"funcion": out(f), "sala": {"id": sala.id, "nombre": sala.nombre}, "total_asientos": total, "secciones": secciones}


@router.get("/internal/funciones/detalle", summary="Detalle por lote (uso interno entre servicios): ?ids=1,2,3")
def detalle_lote(ids: str = Query(..., description="IDs separados por coma"), db: Session = Depends(get_db), auth: Auth = Depends(auth_required)):
    try:
        lista = [int(x) for x in ids.split(",") if x.strip()][:200]
    except ValueError:
        raise AppError(400, "VALIDACION", "ids debe ser una lista de enteros separados por coma")
    return [out(f) for f in base_query(db).filter(Funcion.id.in_(lista)).all()]


@router.post("/funciones", status_code=201, summary="Programar función (operador/administrador)")
def crear(body: FuncionIn, db: Session = Depends(get_db), auth: Auth = Depends(require_roles(*STAFF))):
    fin = preparar(db, body)
    f = Funcion(pelicula_id=body.pelicula_id, sala_id=body.sala_id, fecha=body.fecha, hora_inicio=body.hora_inicio, hora_fin=fin)
    db.add(f)
    db.commit()
    clients.audit(auth.sub, "CREAR", "funcion", f.id, f"Función #{f.id} programada el {f.fecha} {hm(f.hora_inicio)}")
    return out(get_or_404(db, f.id))


@router.put("/funciones/{fid}", summary="Reprogramar función")
def modificar(fid: int, body: FuncionIn, db: Session = Depends(get_db), auth: Auth = Depends(require_roles(*STAFF))):
    f = get_or_404(db, fid)
    if f.estado != "ACTIVA":
        raise AppError(422, "REGLA_NEGOCIO", "Solo se pueden modificar funciones activas")
    fin = preparar(db, body, excluir=fid)
    f.pelicula_id, f.sala_id, f.fecha, f.hora_inicio, f.hora_fin = body.pelicula_id, body.sala_id, body.fecha, body.hora_inicio, fin
    db.commit()
    clients.audit(auth.sub, "MODIFICAR", "funcion", f.id, f"Función #{f.id} reprogramada al {f.fecha} {hm(f.hora_inicio)}")
    return out(get_or_404(db, fid))


@router.patch("/funciones/{fid}/cancelar", summary="Cancelar función (avisa a Reservas para cancelar sus reservas)")
def cancelar(fid: int, db: Session = Depends(get_db), auth: Auth = Depends(require_roles(*STAFF))):
    f = get_or_404(db, fid)
    if f.estado != "ACTIVA":
        raise AppError(422, "REGLA_NEGOCIO", "La función ya no está activa")
    f.estado = "CANCELADA"
    db.commit()
    clients.audit(auth.sub, "DESACTIVAR", "funcion", f.id, f"Función #{f.id} cancelada")
    clients.notify_funcion_cancelada(f.id)
    return out(get_or_404(db, fid))


@router.post("/funciones/generar-demo", summary="Genera funciones de demostración para los próximos días (administrador)")
def generar_demo(dias: int = Query(4, ge=1, le=14), db: Session = Depends(get_db), auth: Auth = Depends(require_roles("ADMINISTRADOR"))):
    n = generar_funciones(db, dias)
    clients.audit(auth.sub, "CREAR", "funcion", None, f"{n} funciones de demostración generadas")
    return {"funciones_creadas": n}
