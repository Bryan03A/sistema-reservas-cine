from datetime import datetime, timezone
from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


class AppError(Exception):
    def __init__(self, status: int, code: str, message: str, details=None):
        self.status, self.code, self.message, self.details = status, code, message, details or []


def _body(status, code, message, request: Request, details=None):
    return {"status": status, "code": code, "message": message, "details": details or [],
            "path": request.url.path, "timestamp": datetime.now(timezone.utc).isoformat()}


def register_handlers(app):
    @app.exception_handler(AppError)
    async def _app_error(request: Request, exc: AppError):
        return JSONResponse(_body(exc.status, exc.code, exc.message, request, exc.details), status_code=exc.status)

    @app.exception_handler(RequestValidationError)
    async def _validation(request: Request, exc: RequestValidationError):
        details = [{"campo": ".".join(str(p) for p in e["loc"] if p != "body"), "mensaje": e["msg"]} for e in exc.errors()]
        return JSONResponse(_body(400, "VALIDACION", "Datos de entrada inválidos", request, details), status_code=400)

    @app.exception_handler(StarletteHTTPException)
    async def _http(request: Request, exc: StarletteHTTPException):
        code = "NO_ENCONTRADO" if exc.status_code == 404 else "ERROR_HTTP"
        return JSONResponse(_body(exc.status_code, code, str(exc.detail), request), status_code=exc.status_code)

    @app.exception_handler(Exception)
    async def _unhandled(request: Request, exc: Exception):
        print(f"[peliculas] error no controlado: {exc!r}", flush=True)
        return JSONResponse(_body(500, "ERROR_INTERNO", "Error interno del servidor", request), status_code=500)
