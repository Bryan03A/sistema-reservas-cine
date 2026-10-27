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
# CORS_ALLOW_LAN=true acepta además orígenes de red local (192.168.x.x, 10.x.x.x, 172.16-31.x.x, *.local),
# para abrir el frontend desde el celular en la misma red Wi-Fi. Ponlo en "false" fuera de la demostración.
CORS_ALLOW_LAN = os.getenv("CORS_ALLOW_LAN", "false").lower() == "true"
CORS_LAN_REGEX = r"^https?://(localhost|127\.0\.0\.1|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|[a-z0-9-]+\.local)(:\d+)?$"
TIMEZONE = os.getenv("TIMEZONE", "America/Guayaquil")
# Minutos de limpieza/preparación entre funciones de una misma sala (RN-07)
MINUTOS_LIMPIEZA = int(os.getenv("MINUTOS_LIMPIEZA", "15"))
