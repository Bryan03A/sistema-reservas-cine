import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const asyncH = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Formato de error común a los tres microservicios (ver docs/contrato.md)
function body(status, code, message, req, details) {
  return { status, code, message, details: details ?? [], path: req.originalUrl, timestamp: new Date().toISOString() };
}

export function notFound(req, res) {
  res.status(404).json(body(404, 'NO_ENCONTRADO', `Ruta no encontrada: ${req.method} ${req.path}`, req));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof ZodError) {
    const details = err.issues.map((i) => ({ campo: i.path.join('.'), mensaje: i.message }));
    return res.status(400).json(body(400, 'VALIDACION', 'Datos de entrada inválidos', req, details));
  }
  if (err instanceof AppError) {
    return res.status(err.status).json(body(err.status, err.code, err.message, req, err.details));
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json(body(400, 'JSON_INVALIDO', 'El cuerpo no es un JSON válido', req));
  }
  console.error('[reservas] error no controlado:', err);
  return res.status(500).json(body(500, 'ERROR_INTERNO', 'Error interno del servidor', req));
}
