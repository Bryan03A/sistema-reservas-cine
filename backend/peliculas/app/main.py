from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from . import config
from .db import connect_with_retry
from .errors import register_handlers
from .routes import peliculas, funciones, salas
from .seed import seed


@asynccontextmanager
async def lifespan(app: FastAPI):
    connect_with_retry()
    seed()
    yield


app = FastAPI(
    title="Cine · Microservicio de Películas",
    version="0.1.0",
    description="Películas, funciones, salas, secciones, filas y asientos. Los endpoints de consulta de cartelera son públicos; "
                "el resto exige JWT emitido por el microservicio de Usuarios (botón Authorize).",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_origin_regex=config.CORS_LAN_REGEX if config.CORS_ALLOW_LAN else None,
    allow_methods=["*"],
    allow_headers=["*"],
)
register_handlers(app)
app.include_router(peliculas.router)
app.include_router(funciones.router)
app.include_router(salas.router)


@app.get("/health", tags=["Sistema"])
def health():
    return {"servicio": "peliculas", "estado": "ok"}
