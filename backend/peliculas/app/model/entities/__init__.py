"""Capa model/entities: cada entidad se mapea a su tabla espejo mediante el ORM (SQLAlchemy)."""
from datetime import date, time, datetime
from decimal import Decimal
from sqlalchemy import String, Text, Integer, Numeric, Date, Time, DateTime, ForeignKey, UniqueConstraint, Index, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ...db import Base


class Pelicula(Base):
    __tablename__ = "pelicula"
    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(150), nullable=False)
    descripcion: Mapped[str | None] = mapped_column(Text)
    genero: Mapped[str] = mapped_column(String(40), nullable=False)
    duracion_min: Mapped[int] = mapped_column(Integer, nullable=False)
    clasificacion: Mapped[str] = mapped_column(String(10), nullable=False)  # TP | +12 | +15 | +18
    estado: Mapped[str] = mapped_column(String(10), nullable=False, default="ACTIVA")  # ACTIVA | INACTIVA | RETIRADA
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())
    funciones: Mapped[list["Funcion"]] = relationship(back_populates="pelicula")


class Sala(Base):
    __tablename__ = "sala"
    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    estado: Mapped[str] = mapped_column(String(10), nullable=False, default="ACTIVA")
    secciones: Mapped[list["Seccion"]] = relationship(back_populates="sala", order_by="Seccion.id")


class Seccion(Base):
    __tablename__ = "seccion"
    __table_args__ = (UniqueConstraint("sala_id", "nombre"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    sala_id: Mapped[int] = mapped_column(ForeignKey("sala.id"), nullable=False)
    nombre: Mapped[str] = mapped_column(String(50), nullable=False)
    descripcion: Mapped[str | None] = mapped_column(String(150))
    tipo: Mapped[str] = mapped_column(String(10), nullable=False)  # VIP | DBOX | GENERAL
    precio: Mapped[Decimal] = mapped_column(Numeric(6, 2), nullable=False)
    capacidad: Mapped[int] = mapped_column(Integer, nullable=False)
    num_filas: Mapped[int | None] = mapped_column(Integer)
    asientos_por_fila: Mapped[int | None] = mapped_column(Integer)
    sala: Mapped[Sala] = relationship(back_populates="secciones")
    filas: Mapped[list["Fila"]] = relationship(back_populates="seccion", order_by="Fila.letra")


class Fila(Base):
    __tablename__ = "fila"
    __table_args__ = (UniqueConstraint("seccion_id", "letra"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    seccion_id: Mapped[int] = mapped_column(ForeignKey("seccion.id"), nullable=False)
    letra: Mapped[str] = mapped_column(String(1), nullable=False)
    seccion: Mapped[Seccion] = relationship(back_populates="filas")
    asientos: Mapped[list["Asiento"]] = relationship(back_populates="fila", order_by="Asiento.numero")


class Asiento(Base):
    __tablename__ = "asiento"
    __table_args__ = (UniqueConstraint("fila_id", "numero"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    fila_id: Mapped[int] = mapped_column(ForeignKey("fila.id"), nullable=False)
    numero: Mapped[int] = mapped_column(Integer, nullable=False)
    # ACTIVO | BLOQUEADO (bloqueo físico por mantenimiento; ajuste sobre el ER original)
    estado: Mapped[str] = mapped_column(String(10), nullable=False, default="ACTIVO")
    fila: Mapped[Fila] = relationship(back_populates="asientos")


class Funcion(Base):
    __tablename__ = "funcion"
    __table_args__ = (Index("ix_funcion_sala_fecha", "sala_id", "fecha", "hora_inicio"), Index("ix_funcion_pelicula_fecha", "pelicula_id", "fecha"))
    id: Mapped[int] = mapped_column(primary_key=True)
    pelicula_id: Mapped[int] = mapped_column(ForeignKey("pelicula.id"), nullable=False)
    sala_id: Mapped[int] = mapped_column(ForeignKey("sala.id"), nullable=False)
    fecha: Mapped[date] = mapped_column(Date, nullable=False)
    hora_inicio: Mapped[time] = mapped_column(Time, nullable=False)
    hora_fin: Mapped[time] = mapped_column(Time, nullable=False)
    estado: Mapped[str] = mapped_column(String(15), nullable=False, default="ACTIVA")  # ACTIVA | CANCELADA | FINALIZADA
    pelicula: Mapped[Pelicula] = relationship(back_populates="funciones")
    sala: Mapped[Sala] = relationship()
