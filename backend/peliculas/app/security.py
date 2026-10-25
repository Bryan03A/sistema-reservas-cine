from dataclasses import dataclass
import jwt
from jwt import PyJWKClient
from fastapi import Depends, Request
from . import config
from .errors import AppError

# Valida tokens RS256 emitidos por el microservicio de Usuarios usando su JWKS (sin compartir secretos)
_jwks = PyJWKClient(config.JWKS_URL, cache_keys=True, lifespan=300)


@dataclass
class Auth:
    sub: str
    username: str | None
    rol: str
    cliente_id: int | None
    token: str


def _decode(token: str) -> Auth:
    try:
        key = _jwks.get_signing_key_from_jwt(token).key
        p = jwt.decode(token, key, algorithms=["RS256"], issuer=config.JWT_ISSUER, options={"require": ["exp", "iss", "sub"]})
    except Exception as e:  # noqa: BLE001
        print(f"[peliculas] token rechazado: {e.__class__.__name__}: {e}", flush=True)
        raise AppError(401, "TOKEN_INVALIDO", "El token es inválido, expiró o Usuarios no está disponible")
    if p.get("typ") != "access":
        raise AppError(401, "TOKEN_INVALIDO", "Tipo de token no permitido")
    return Auth(sub=str(p["sub"]), username=p.get("username"), rol=p.get("rol", ""), cliente_id=p.get("cliente_id"), token=token)


def _bearer(request: Request) -> str | None:
    h = request.headers.get("authorization", "")
    return h[7:] if h.startswith("Bearer ") else None


def auth_required(request: Request) -> Auth:
    token = _bearer(request)
    if not token:
        raise AppError(401, "NO_AUTENTICADO", "Falta el token de acceso (Authorization: Bearer ...)")
    return _decode(token)


def require_roles(*roles: str):
    def dep(auth: Auth = Depends(auth_required)) -> Auth:
        if auth.rol not in roles:
            raise AppError(403, "SIN_PERMISO", f"Tu rol no tiene acceso a este recurso (se requiere: {' o '.join(roles)})")
        return auth
    return dep


STAFF = ("ADMINISTRADOR", "OPERADOR")


def auth_optional(request: Request) -> Auth | None:
    """Para endpoints públicos: si llega un token válido se usa (p. ej. para ver más datos); si no, es invitado."""
    token = _bearer(request)
    if not token:
        return None
    try:
        return _decode(token)
    except AppError:
        return None
