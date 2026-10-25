import { createRemoteJWKSet, jwtVerify } from 'jose';
import { config } from './config.js';
import { AppError, asyncH } from './errors.js';

// Valida tokens RS256 emitidos por Usuarios consultando su JWKS (sin compartir secretos)
const jwks = createRemoteJWKSet(new URL(config.jwksUrl), { cooldownDuration: 5000, cacheMaxAge: 300000 });

export const autenticar = asyncH(async (req, res, next) => {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) throw new AppError(401, 'NO_AUTENTICADO', 'Falta el token de acceso (Authorization: Bearer ...)');
  const token = header.slice(7);
  let payload;
  try {
    ({ payload } = await jwtVerify(token, jwks, { issuer: config.issuer }));
  } catch (e) {
    console.log(`[reservas] token rechazado: ${e.code || e.message}`);
    throw new AppError(401, 'TOKEN_INVALIDO', 'El token es inválido, expiró o Usuarios no está disponible');
  }
  if (payload.typ !== 'access') throw new AppError(401, 'TOKEN_INVALIDO', 'Tipo de token no permitido');
  req.auth = { sub: Number(payload.sub) || payload.sub, username: payload.username, rol: payload.rol, cliente_id: payload.cliente_id ?? null, token };
  next();
});

export const autorizar = (...roles) => (req, res, next) => {
  if (!req.auth || !roles.includes(req.auth.rol)) {
    return next(new AppError(403, 'SIN_PERMISO', `Tu rol no tiene acceso a este recurso (se requiere: ${roles.join(' o ')})`));
  }
  next();
};

export const esStaff = (auth) => auth.rol === 'ADMINISTRADOR' || auth.rol === 'OPERADOR';
