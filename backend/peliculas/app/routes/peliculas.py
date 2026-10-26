import unicodedata
from datetime import date
from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy import exists
from sqlalchemy.orm import Session
from ..db import get_db
from ..errors import AppError
from ..model.entities import Pelicula, PeliculaImagen, Funcion
from ..schemas import PeliculaIn, EstadoPeliculaIn
from ..security import Auth, auth_optional, require_roles, STAFF
from .. import clients

router = APIRouter(prefix="/api/v1", tags=["Películas"])


def norm(texto: str) -> str:
    """Normaliza para buscar: sin tildes y sin distinguir mayúsculas ("Código Cuántico" → "codigo cuantico")."""
    sin_marcas = "".join(c for c in unicodedata.normalize("NFD", texto) if unicodedata.category(c) != "Mn")
    return sin_marcas.casefold().strip()


MAX_IMAGEN = 2 * 1024 * 1024  # 2 MB (el frontend la reduce antes de subirla)


def versiones(db: Session) -> dict[int, int]:
    """Versión de la imagen de cada película que tiene póster (consulta solo columnas livianas, sin los bytes)."""
    return {pid: v for pid, v in db.query(PeliculaImagen.pelicula_id, PeliculaImagen.version).all()}


def out(p: Pelicula, vers: dict[int, int] | None = None) -> dict:
    v = (vers or {}).get(p.id)
    return {"id": p.id, "nombre": p.nombre, "descripcion": p.descripcion, "genero": p.genero, "duracion_min": p.duracion_min,
            "clasificacion": p.clasificacion, "estado": p.estado,
            # Ruta relativa a la API; el parámetro v cambia cuando se sube otro póster
            "imagen_url": f"/peliculas/{p.id}/imagen?v={v}" if v else None}


def tipo_imagen(b: bytes) -> str | None:
    """Valida el contenido real del archivo (firma), no solo el Content-Type que declare el cliente."""
    if b[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if b[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if b[:4] == b"RIFF" and b[8:12] == b"WEBP":
        return "image/webp"
    return None


def get_or_404(db: Session, pid: int) -> Pelicula:
    p = db.get(Pelicula, pid)
    if not p:
        raise AppError(404, "NO_ENCONTRADO", f"Película {pid} no existe")
    return p


@router.get("/peliculas", summary="Consultar cartelera (público): por nombre, género, clasificación y fecha. La búsqueda ignora tildes y mayúsculas")
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
    if clasificacion:
        q = q.filter(Pelicula.clasificacion == clasificacion)
    if fecha:
        q = q.filter(exists().where(Funcion.pelicula_id == Pelicula.id, Funcion.fecha == fecha, Funcion.estado == "ACTIVA"))
    peliculas = q.order_by(Pelicula.nombre).all()
    # La cartelera es pequeña: se filtra aquí para ignorar tildes (no depende de extensiones de PostgreSQL)
    if nombre and norm(nombre):
        peliculas = [p for p in peliculas if norm(nombre) in norm(p.nombre)]
    if genero and norm(genero):
        peliculas = [p for p in peliculas if norm(genero) in norm(p.genero)]
    vers = versiones(db)
    return [out(p, vers) for p in peliculas]


@router.get("/peliculas/{pid}", summary="Detalle de una película")
def detalle(pid: int, db: Session = Depends(get_db)):
    return out(get_or_404(db, pid), versiones(db))


@router.post("/peliculas", status_code=201, summary="Crear película (operador/administrador)")
def crear(body: PeliculaIn, db: Session = Depends(get_db), auth: Auth = Depends(require_roles(*STAFF))):
    p = Pelicula(**body.model_dump())
    db.add(p)
    db.commit()
    clients.audit(auth.sub, "CREAR", "pelicula", p.id, f"Película «{p.nombre}» creada")
    return out(p, versiones(db))


@router.put("/peliculas/{pid}", summary="Editar título, descripción, género, duración y clasificación (no altera funciones, reservas ni boletos ya existentes)")
def modificar(pid: int, body: PeliculaIn, db: Session = Depends(get_db), auth: Auth = Depends(require_roles(*STAFF))):
    p = get_or_404(db, pid)
    for k, v in body.model_dump().items():
        setattr(p, k, v)
    db.commit()
    clients.audit(auth.sub, "MODIFICAR", "pelicula", p.id, f"Película «{p.nombre}» modificada")
    return out(p, versiones(db))


@router.patch("/peliculas/{pid}/estado", summary="Activar, desactivar o retirar de cartelera (no se borra, se conserva el historial)")
def cambiar_estado(pid: int, body: EstadoPeliculaIn, db: Session = Depends(get_db), auth: Auth = Depends(require_roles(*STAFF))):
    p = get_or_404(db, pid)
    p.estado = body.estado
    db.commit()
    accion = "ACTIVAR" if body.estado == "ACTIVA" else "DESACTIVAR"
    clients.audit(auth.sub, accion, "pelicula", p.id, f"Película «{p.nombre}» → {body.estado}")
    return out(p, versiones(db))


_BINARIO = {"required": True, "content": {t: {"schema": {"type": "string", "format": "binary"}} for t in ("image/jpeg", "image/png", "image/webp")}}


@router.get("/peliculas/{pid}/imagen", summary="Póster de la película (público, con caché)")
def ver_imagen(pid: int, request: Request, db: Session = Depends(get_db)):
    img = db.get(PeliculaImagen, pid)
    if not img:
        raise AppError(404, "SIN_IMAGEN", "La película no tiene imagen")
    etag = f'"{img.version}"'
    if request.headers.get("if-none-match") == etag:
        return Response(status_code=304, headers={"ETag": etag})
    return Response(content=img.contenido, media_type=img.tipo, headers={"ETag": etag, "Cache-Control": "public, max-age=3600"})


@router.put("/peliculas/{pid}/imagen", summary="Subir o reemplazar el póster (cuerpo binario JPG/PNG/WEBP, máx. 2 MB)", openapi_extra={"requestBody": _BINARIO})
async def subir_imagen(pid: int, request: Request, db: Session = Depends(get_db), auth: Auth = Depends(require_roles(*STAFF))):
    p = get_or_404(db, pid)
    if int(request.headers.get("content-length") or 0) > MAX_IMAGEN:
        raise AppError(413, "ARCHIVO_MUY_GRANDE", "La imagen supera los 2 MB")
    data = await request.body()
    if not data:
        raise AppError(415, "IMAGEN_REQUERIDA", "Envía la imagen como cuerpo de la petición (Content-Type: image/jpeg, image/png o image/webp)")
    if len(data) > MAX_IMAGEN:
        raise AppError(413, "ARCHIVO_MUY_GRANDE", "La imagen supera los 2 MB")
    tipo = tipo_imagen(data)
    if not tipo:
        raise AppError(422, "IMAGEN_INVALIDA", "El archivo no es una imagen JPG, PNG o WEBP válida")
    img = db.get(PeliculaImagen, pid)
    if img:
        img.contenido, img.tipo, img.version = data, tipo, img.version + 1
    else:
        db.add(PeliculaImagen(pelicula_id=pid, contenido=data, tipo=tipo, version=1))
    db.commit()
    clients.audit(auth.sub, "MODIFICAR", "pelicula", p.id, f"Imagen de «{p.nombre}» actualizada")
    return out(p, versiones(db))


@router.delete("/peliculas/{pid}/imagen", summary="Quitar el póster")
def quitar_imagen(pid: int, db: Session = Depends(get_db), auth: Auth = Depends(require_roles(*STAFF))):
    p = get_or_404(db, pid)
    img = db.get(PeliculaImagen, pid)
    if img:
        db.delete(img)
        db.commit()
        clients.audit(auth.sub, "MODIFICAR", "pelicula", p.id, f"Imagen de «{p.nombre}» eliminada")
    return out(p, versiones(db))
