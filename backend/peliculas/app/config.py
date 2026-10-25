import os

PORT = int(os.getenv("PORT", "3002"))
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+psycopg2://postgres:postgres@localhost:5432/db_peliculas")
USUARIOS_URL = os.getenv("USUARIOS_URL", "http://localhost:3001")
RESERVAS_URL = os.getenv("RESERVAS_URL", "http://localhost:3003")
JWKS_URL = os.getenv("JWKS_URL", f"{USUARIOS_URL}/.well-known/jwks.json")
JWT_ISSUER = os.getenv("JWT_ISSUER", "cine-usuarios")
SERVICE_CLIENT_ID = os.getenv("SERVICE_CLIENT_ID", "peliculas")
SERVICE_CLIENT_SECRET = os.getenv("SERVICE_CLIENT_SECRET", "peliculas-secret")
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
TIMEZONE = os.getenv("TIMEZONE", "America/Guayaquil")
# Minutos de limpieza/preparación entre funciones de una misma sala (RN-07)
MINUTOS_LIMPIEZA = int(os.getenv("MINUTOS_LIMPIEZA", "15"))
