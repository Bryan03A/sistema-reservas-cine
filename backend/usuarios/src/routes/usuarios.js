import { Router } from 'express';
import { AppError, asyncH } from '../errors.js';
import { autenticar, autorizar } from '../security.js';
import { Usuario, Rol, Cliente } from '../model/entities/index.js';
import { sequelize } from '../db.js';
import { config } from '../config.js';
import bcrypt from 'bcryptjs';
import { crearCuenta, notificarCredenciales, auditar, vistaUsuario, vistaCompleta, normalizar, guardarFoto, borrarFoto } from '../cuentas.js';
import { ClienteFoto } from '../model/entities/index.js';
import { rawImagen, leerImagen } from '../imagen.js';
import { crearUsuarioSchema, actualizarUsuarioSchema, estadoSchema, perfilSchema } from '../schemas.js';

const router = Router();
const staff = autorizar('ADMINISTRADOR', 'OPERADOR');
const include = [Rol, Cliente];

// RN: el operador solo puede gestionar cuentas de clientes (nunca operadores ni administradores)
function verificarAlcance(req, rolObjetivo) {
  if (req.auth.rol === 'OPERADOR' && rolObjetivo !== 'CLIENTE') {
    throw new AppError(403, 'SIN_PERMISO', 'El operador solo puede gestionar cuentas de clientes');
  }
}

async function cargar(id) {
  const u = await Usuario.findByPk(id, { include });
  if (!u) throw new AppError(404, 'NO_ENCONTRADO', `Usuario ${id} no existe`);
  return u;
}

router.get('/usuarios', autenticar, staff, asyncH(async (req, res) => {
  const where = {};
  if (req.query.estado) where.estado = req.query.estado;
  const rolWhere = req.auth.rol === 'OPERADOR' ? { nombre: 'CLIENTE' } : req.query.rol ? { nombre: req.query.rol } : undefined;
  const q = normalizar(req.query.q);
  const rows = await Usuario.findAll({ where, order: [['id', 'ASC']], include: [{ model: Rol, where: rolWhere }, Cliente] });
  let lista = rows.map(vistaUsuario);
  // Búsqueda sin tildes ni mayúsculas sobre usuario, nombres, DNI y correo
  if (q) {
    lista = lista.filter((u) => normalizar([u.username, u.cliente?.primer_nombre, u.cliente?.segundo_nombre, u.cliente?.apellido, u.cliente?.dni, u.cliente?.correo].join(' ')).includes(q));
  }
  res.json(lista);
}));

router.get('/usuarios/:id', autenticar, staff, asyncH(async (req, res) => {
  const u = await cargar(Number(req.params.id));
  verificarAlcance(req, u.Rol.nombre);
  res.json(await vistaCompleta(u));
}));

router.post('/usuarios', autenticar, staff, asyncH(async (req, res) => {
  const { rol, ...datos } = crearUsuarioSchema.parse(req.body);
  verificarAlcance(req, rol);
  const r = await sequelize.transaction((transaction) => crearCuenta(datos, rol, { transaction }));
  const enviado = await notificarCredenciales(r);
  await auditar(req.auth.sub, 'CREAR', 'usuario', r.usuario.id, `Cuenta ${r.usuario.username} (${rol}) creada`);
  const out = { ...vistaUsuario(await cargar(r.usuario.id)), correo_enviado: enviado };
  if (config.demoMode) out.credenciales_demo = { username: r.usuario.username, password: r.passwordPlano };
  res.status(201).json(out);
}));

// Solo el ADMINISTRADOR edita a cualquier persona: datos personales (incluido DNI), rol y contraseña nueva sin pedir la anterior
router.put('/usuarios/:id', autenticar, autorizar('ADMINISTRADOR'), asyncH(async (req, res) => {
  const { rol, password_nueva, password_confirmacion, ...datos } = actualizarUsuarioSchema.parse(req.body);
  const u = await cargar(Number(req.params.id));
  const cambios = [];
  if (rol && rol !== u.Rol.nombre) {
    if (u.id === req.auth.sub) throw new AppError(422, 'REGLA_NEGOCIO', 'No puedes cambiar tu propio rol (otro administrador debe hacerlo)');
    const nuevo = await Rol.findOne({ where: { nombre: rol, estado: 'ACTIVO' } });
    if (!nuevo) throw new AppError(422, 'ROL_INVALIDO', 'Rol inexistente o inactivo');
    u.rol_id = nuevo.id;
    cambios.push(`rol ${u.Rol.nombre} → ${rol}`);
  }
  if (password_nueva) {
    u.password_hash = await bcrypt.hash(password_nueva, 10);
    cambios.push('contraseña restablecida');
  }
  const limpio = Object.fromEntries(Object.entries(datos).map(([k, v]) => [k, v === '' ? null : v]));
  if (limpio.dni && limpio.dni !== u.Cliente.dni && (await Cliente.findOne({ where: { dni: limpio.dni } }))) throw new AppError(409, 'DNI_DUPLICADO', 'Ya existe un usuario con ese DNI');
  if (limpio.correo && limpio.correo !== u.Cliente.correo && (await Cliente.findOne({ where: { correo: limpio.correo } }))) throw new AppError(409, 'CORREO_DUPLICADO', 'Ya existe un usuario con ese correo');
  await sequelize.transaction(async (transaction) => {
    await u.save({ transaction });
    if (Object.keys(limpio).length) await u.Cliente.update(limpio, { transaction });
  });
  if (Object.keys(limpio).length) cambios.push('datos personales');
  await auditar(req.auth.sub, 'MODIFICAR', 'usuario', u.id, `${u.username}: ${cambios.join(', ') || 'sin cambios'}`);
  res.json(await vistaCompleta(await cargar(u.id)));
}));

router.patch('/usuarios/:id/estado', autenticar, staff, asyncH(async (req, res) => {
  const { estado } = estadoSchema.parse(req.body);
  const u = await cargar(Number(req.params.id));
  verificarAlcance(req, u.Rol.nombre);
  if (u.id === req.auth.sub) throw new AppError(422, 'REGLA_NEGOCIO', 'No puedes cambiar el estado de tu propia cuenta');
  u.estado = estado;
  await u.save();
  await auditar(req.auth.sub, estado === 'ACTIVO' ? 'ACTIVAR' : 'DESACTIVAR', 'usuario', u.id, `${u.username} → ${estado}`);
  res.json(vistaUsuario(await cargar(u.id)));
}));

router.get('/clientes', autenticar, staff, asyncH(async (req, res) => {
  const rows = await Cliente.findAll({ order: [['id', 'ASC']], include: [{ model: Usuario, include: [Rol] }] });
  res.json(rows.map((c) => ({
    id: c.id, usuario_id: c.usuario_id, username: c.Usuario.username, rol: c.Usuario.Rol.nombre, estado: c.Usuario.estado,
    nombre: [c.primer_nombre, c.segundo_nombre, c.apellido].filter(Boolean).join(' '), dni: c.dni, correo: c.correo,
  })));
}));

router.get('/clientes/me', autenticar, asyncH(async (req, res) => {
  res.json(await vistaCompleta(await cargar(req.auth.sub)));
}));

// El propio usuario edita su perfil: nombres, apellido, nacionalidad, teléfono, dirección y correo. El DNI y el usuario están bloqueados.
router.put('/clientes/me', autenticar, asyncH(async (req, res) => {
  for (const k of ['dni', 'username', 'rol', 'estado', 'password_nueva']) {
    if (k in (req.body ?? {})) throw new AppError(403, 'CAMPO_NO_EDITABLE', `El campo "${k}" no se puede modificar desde tu perfil`);
  }
  const datos = perfilSchema.parse(req.body);
  const u = await cargar(req.auth.sub);
  const limpio = Object.fromEntries(Object.entries(datos).map(([k, v]) => [k, v === '' ? null : v]));
  if (limpio.correo && limpio.correo !== u.Cliente.correo && (await Cliente.findOne({ where: { correo: limpio.correo } }))) {
    throw new AppError(409, 'CORREO_DUPLICADO', 'Ese correo ya está registrado por otro usuario');
  }
  await u.Cliente.update(limpio);
  res.json(await vistaCompleta(await cargar(req.auth.sub)));
}));

router.get('/roles', autenticar, autorizar('ADMINISTRADOR'), asyncH(async (req, res) => {
  res.json(await Rol.findAll({ order: [['id', 'ASC']] }));
}));

// ---- Foto de perfil: la ve y la cambia su dueño; el personal la ve; solo el administrador cambia la de otros
function destinoFoto(req) {
  const id = req.params.id === 'me' ? req.auth.sub : Number(req.params.id);
  if (!Number.isInteger(id)) throw new AppError(400, 'VALIDACION', 'Id de usuario inválido');
  return id;
}
const puedeVer = (req, id) => id === req.auth.sub || req.auth.rol === 'ADMINISTRADOR' || req.auth.rol === 'OPERADOR';
const puedeEditar = (req, id) => id === req.auth.sub || req.auth.rol === 'ADMINISTRADOR';

router.get('/usuarios/:id/foto', autenticar, asyncH(async (req, res) => {
  const id = destinoFoto(req);
  if (!puedeVer(req, id)) throw new AppError(403, 'SIN_PERMISO', 'No puedes ver la foto de otro usuario');
  const u = await cargar(id);
  const f = await ClienteFoto.findByPk(u.Cliente.id);
  if (!f) throw new AppError(404, 'SIN_FOTO', 'El usuario no tiene foto');
  res.set({ 'Content-Type': f.tipo, 'Cache-Control': 'private, max-age=300' }).send(f.contenido);
}));

router.put('/usuarios/:id/foto', autenticar, rawImagen(), asyncH(async (req, res) => {
  const id = destinoFoto(req);
  if (!puedeEditar(req, id)) throw new AppError(403, 'SIN_PERMISO', 'Solo tú o un administrador pueden cambiar esta foto');
  const u = await cargar(id);
  const version = await guardarFoto(u.Cliente.id, leerImagen(req));
  if (id !== req.auth.sub) await auditar(req.auth.sub, 'MODIFICAR', 'usuario', id, `Foto de ${u.username} actualizada`);
  res.json({ foto_version: version });
}));

router.delete('/usuarios/:id/foto', autenticar, asyncH(async (req, res) => {
  const id = destinoFoto(req);
  if (!puedeEditar(req, id)) throw new AppError(403, 'SIN_PERMISO', 'Solo tú o un administrador pueden quitar esta foto');
  const u = await cargar(id);
  await borrarFoto(u.Cliente.id);
  if (id !== req.auth.sub) await auditar(req.auth.sub, 'MODIFICAR', 'usuario', id, `Foto de ${u.username} eliminada`);
  res.json({ foto_version: null });
}));

export default router;
