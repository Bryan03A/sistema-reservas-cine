import fs from 'node:fs';
import path from 'node:path';
import {
  generateKeyPair, exportPKCS8, exportSPKI, importPKCS8, importSPKI,
  exportJWK, calculateJwkThumbprint, SignJWT, jwtVerify,
} from 'jose';
import { config } from './config.js';
import { AppError, asyncH } from './errors.js';
import { Usuario } from './model/entities/index.js';

let privateKey;
let publicKey;
let publicJwk;
let kid;

// Claves RS256: se generan la primera vez y se guardan en KEYS_DIR (volumen en Docker).
export async function initKeys() {
  fs.mkdirSync(config.keysDir, { recursive: true });
  const privPath = path.join(config.keysDir, 'private.pem');
  const pubPath = path.join(config.keysDir, 'public.pem');
  if (!fs.existsSync(privPath) || !fs.existsSync(pubPath)) {
    const pair = await generateKeyPair('RS256', { extractable: true, modulusLength: 2048 });
    fs.writeFileSync(privPath, await exportPKCS8(pair.privateKey), { mode: 0o600 });
    fs.writeFileSync(pubPath, await exportSPKI(pair.publicKey));
    console.log('[usuarios] par de claves RS256 generado');
  }
  privateKey = await importPKCS8(fs.readFileSync(privPath, 'utf8'), 'RS256');
  publicKey = await importSPKI(fs.readFileSync(pubPath, 'utf8'), 'RS256', { extractable: true });
  const jwk = await exportJWK(publicKey);
  kid = await calculateJwkThumbprint(jwk);
  publicJwk = { ...jwk, kid, alg: 'RS256', use: 'sig' };
}

export const jwks = () => ({ keys: [publicJwk] });

export async function signToken({ sub, claims = {}, ttl, typ = 'access' }) {
  return new SignJWT({ ...claims, typ })
    .setProtectedHeader({ alg: 'RS256', kid })
    .setSubject(String(sub))
    .setIssuer(config.issuer)
    .setIssuedAt()
    .setExpirationTime(ttl)
    .sign(privateKey);
}

export async function verifyToken(token) {
  const { payload } = await jwtVerify(token, publicKey, { issuer: config.issuer });
  return payload;
}

// Middleware: exige un access token válido y deja los datos en req.auth
export const autenticar = asyncH(async (req, res, next) => {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) throw new AppError(401, 'NO_AUTENTICADO', 'Falta el token de acceso (Authorization: Bearer ...)');
  let payload;
  try {
    payload = await verifyToken(header.slice(7));
  } catch {
    throw new AppError(401, 'TOKEN_INVALIDO', 'El token es inválido o expiró');
  }
  if (payload.typ !== 'access') throw new AppError(401, 'TOKEN_INVALIDO', 'Tipo de token no permitido');
  if (payload.rol !== 'SERVICIO') {
    const u = await Usuario.findByPk(Number(payload.sub));
    if (!u || u.estado !== 'ACTIVO') throw new AppError(403, 'CUENTA_INACTIVA', 'La cuenta está inactiva o bloqueada');
  }
  req.auth = { sub: Number(payload.sub) || payload.sub, username: payload.username, rol: payload.rol, cliente_id: payload.cliente_id ?? null };
  next();
});

// Middleware: token limitado ("setup") que se entrega solo al registrarse; sirve únicamente para elegir usuario y foto
export const autenticarSetup = asyncH(async (req, res, next) => {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) throw new AppError(401, 'NO_AUTENTICADO', 'Falta el token de configuración inicial');
  let payload;
  try { payload = await verifyToken(header.slice(7)); } catch { throw new AppError(401, 'TOKEN_INVALIDO', 'El plazo para configurar tu cuenta venció. Ingresa con las credenciales que te enviamos.'); }
  if (payload.typ !== 'setup') throw new AppError(401, 'TOKEN_INVALIDO', 'Este token no sirve para configurar la cuenta');
  req.setupUserId = Number(payload.sub);
  next();
});

// Middleware: restringe por rol (validado siempre en el servidor)
export const autorizar = (...roles) => (req, res, next) => {
  if (!req.auth || !roles.includes(req.auth.rol)) {
    return next(new AppError(403, 'SIN_PERMISO', `Tu rol no tiene acceso a este recurso (se requiere: ${roles.join(' o ')})`));
  }
  next();
};
