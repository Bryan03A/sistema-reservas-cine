import time
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from . import config


class Base(DeclarativeBase):
    pass


engine = create_engine(config.DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def connect_with_retry(retries: int = 30, delay: float = 2.0):
    for i in range(1, retries + 1):
        try:
            with engine.connect():
                return
        except Exception as e:  # noqa: BLE001
            print(f"[peliculas] esperando base de datos ({i}/{retries}): {e.__class__.__name__}", flush=True)
            time.sleep(delay)
    raise RuntimeError("No se pudo conectar a la base de datos")
