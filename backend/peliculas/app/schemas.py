from datetime import date, time
from typing import Literal
from pydantic import BaseModel, Field, field_validator

SAFE = r"^[^<>]*$"  # sanitización básica: sin etiquetas HTML
Clasificacion = Literal["TP", "+12", "+15", "+18"]


class PeliculaIn(BaseModel):
    nombre: str = Field(min_length=1, max_length=150, pattern=SAFE)
    descripcion: str | None = Field(default=None, max_length=2000, pattern=SAFE)
    genero: str = Field(min_length=1, max_length=40, pattern=SAFE)
    duracion_min: int = Field(gt=0, le=400)
    clasificacion: Clasificacion

    @field_validator("nombre", "genero")
    @classmethod
    def _strip(cls, v: str) -> str:
        return v.strip()


class EstadoPeliculaIn(BaseModel):
    estado: Literal["ACTIVA", "INACTIVA", "RETIRADA"]


class FuncionIn(BaseModel):
    pelicula_id: int
    sala_id: int
    fecha: date
    hora_inicio: time
    hora_fin: time | None = None  # si no se envía, se calcula con la duración de la película


class EstadoAsientoIn(BaseModel):
    estado: Literal["ACTIVO", "BLOQUEADO"]
