"""Llamadas a otros microservicios (REST): auditoría hacia Usuarios y avisos hacia Reservas."""
import threading
import time
import httpx
from . import config

_token = {"value": None, "exp": 0.0}
_lock = threading.Lock()


def service_token() -> str | None:
    with _lock:
        if _token["value"] and time.time() < _token["exp"]:
            return _token["value"]
        try:
            r = httpx.post(f"{config.USUARIOS_URL}/api/v1/oauth/token", timeout=4, json={
                "grant_type": "client_credentials", "client_id": config.SERVICE_CLIENT_ID, "client_secret": config.SERVICE_CLIENT_SECRET})
            r.raise_for_status()
            _token["value"] = r.json()["access_token"]
            _token["exp"] = time.time() + 14 * 60
            return _token["value"]
        except Exception as e:  # noqa: BLE001
            print(f"[peliculas] no se pudo obtener token de servicio: {e!r}", flush=True)
            return None


def _post(url: str, payload: dict | None):
    try:
        tk = service_token()
        if tk:
            httpx.post(url, json=payload or {}, headers={"Authorization": f"Bearer {tk}"}, timeout=5)
    except Exception as e:  # noqa: BLE001
        print(f"[peliculas] llamada a {url} falló: {e!r}", flush=True)


def audit(usuario_id, accion: str, entidad: str, entidad_id: int | None, descripcion: str):
    """Registra la acción en Usuarios (no bloquea la respuesta)."""
    try:
        uid = int(usuario_id)
    except (TypeError, ValueError):
        return
    payload = {"usuario_id": uid, "accion": accion, "entidad": entidad, "entidad_id": entidad_id, "descripcion": descripcion}
    threading.Thread(target=_post, args=(f"{config.USUARIOS_URL}/api/v1/auditoria", payload), daemon=True).start()


def notify_funcion_cancelada(funcion_id: int):
    threading.Thread(target=_post, args=(f"{config.RESERVAS_URL}/api/v1/internal/funciones/{funcion_id}/cancelada", {}), daemon=True).start()
