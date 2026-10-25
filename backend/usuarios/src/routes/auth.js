import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { config } from '../config.js';
import { AppError, asyncH } from '../errors.js';
import { autenticar, signToken, verifyToken } from '../security.js';
import { Usuario, Rol, Cliente } from '../model/entities/index.js';
import { sequelize } from '../db.js';
import { crearCuenta, notificarCredenciales } from '../cuentas.js';
import { datosPersonales, cambioPasswordSchema } from '../schemas.js';

const router = Router();
const fallos = new Map(); // username -> { n, hasta }   (bloqueo simple por intentos fallidos)

async function emitirTokens(usuario) {
  const rol = usuario.Rol?.nombre ?? (await Rol.findByPk(usuario.rol_id)).nombre;
  const cliente = usuario.Cliente ?? (await Cliente.findOne({ where: { usuario_id: usuario.id } }));
  const claims = { username: usuario.username, rol, cliente_id: cliente?.id ?? null };
  const access_token = await signToken({ sub: usuario.id, claims, ttl: config.accessTtl });
  const refresh_token = await signToken({ sub: usuario.id, claims: { username: usuario.username }, ttl: config.refreshTtl, typ: 'refresh' });
  return { access_token, refresh_token, token_type: 'Bearer', expires_in: config.accessTtl, rol, username: usuario.username, usuario_id: usuario.id, cliente_id: cliente?.id ?? null };
}

// OAuth 2.0: grants "password", "refresh_token" y "client_credentials" (servicio a servicio)
router.post('/oauth/token', asyncH(async (req, res) => {
  const { grant_type } = req.body ?? {};
  if (grant_type === 'client_credentials') {
    const { client_id, client_secret } = req.body;
    if (!client_id || config.serviceClients[client_id] !== client_secret) {
      throw new AppError(401, 'CLIENTE_INVALIDO', 'client_id o client_secret incorrectos');
    }
    const access_token = await signToken({ sub: client_id, claims: { rol: 'SERVICIO', username: client_id }, ttl: '15m' });
    return res.json({ access_token, token_type: 'Bearer', expires_in: '15m' });
  }
  if (grant_type === 'refresh_token') {
    let payload;
    try { payload = await verifyToken(req.body.refresh_token ?? ''); } catch { throw new AppError(401, 'TOKEN_INVALIDO', 'Refresh token inválido o expirado'); }
    if (payload.typ !== 'refresh') throw new AppError(401, 'TOKEN_INVALIDO', 'No es un refresh token');
    const u = await Usuario.findByPk(Number(payload.sub), { include: [Rol, Cliente] });
    if (!u || u.estado !== 'ACTIVO') throw new AppError(403, 'CUENTA_INACTIVA', 'La cuenta está inactiva o bloqueada');
    return res.json(await emitirTokens(u));
  }
  if (grant_type !== 'password') throw new AppError(400, 'GRANT_NO_SOPORTADO', 'grant_type debe ser password, refresh_token o client_credentials');

  const { username, password } = req.body;
  if (!username || !password) throw new AppError(400, 'VALIDACION', 'username y password son obligatorios');
  const f = fallos.get(username);
  if (f?.hasta > Date.now()) throw new AppError(429, 'CUENTA_BLOQUEADA_TEMPORAL', `Demasiados intentos fallidos. Intenta de nuevo en ${config.lockMinutes} minutos`);

  const u = await Usuario.findOne({ where: { username }, include: [Rol, Cliente] });
  const ok = u && (await bcrypt.compare(password, u.password_hash));
  if (!ok) {
    const n = (f?.n ?? 0) + 1;
    fallos.set(username, { n, hasta: n >= config.maxLoginFailures ? Date.now() + config.lockMinutes * 60000 : 0 });
    throw new AppError(401, 'CREDENCIALES_INVALIDAS', 'Usuario o contraseña incorrectos');
  }
  if (u.estado !== 'ACTIVO') throw new AppError(403, 'CUENTA_INACTIVA', 'La cuenta está inactiva o bloqueada');
  fallos.delete(username);
  u.ultima_conexion = new Date();
  await u.save();
  res.json(await emitirTokens(u));
}));

// Registro de clientes: genera username y contraseña y los envía al correo
router.post('/auth/register', asyncH(async (req, res) => {
  const datos = datosPersonales.parse(req.body);
  const r = await sequelize.transaction((transaction) => crearCuenta(datos, 'CLIENTE', { transaction }));
  const enviado = await notificarCredenciales(r);
  const out = {
    mensaje: enviado
      ? `Cuenta creada. Enviamos tu usuario y contraseña a ${r.cliente.correo}.`
      : 'Cuenta creada. El correo no está configurado en este entorno; usa las credenciales de demostración.',
    usuario_id: r.usuario.id,
    correo_enviado: enviado,
  };
  if (config.demoMode) out.credenciales_demo = { username: r.usuario.username, password: r.passwordPlano };
  res.status(201).json(out);
}));

router.post('/auth/change-password', autenticar, asyncH(async (req, res) => {
  const { password_actual, password_nueva } = cambioPasswordSchema.parse(req.body);
  const u = await Usuario.findByPk(req.auth.sub);
  if (!(await bcrypt.compare(password_actual, u.password_hash))) throw new AppError(401, 'CREDENCIALES_INVALIDAS', 'La contraseña actual no es correcta');
  u.password_hash = await bcrypt.hash(password_nueva, 10);
  await u.save();
  res.json({ mensaje: 'Contraseña actualizada' });
}));

export default router;
