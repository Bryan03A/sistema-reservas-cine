import { Router } from 'express';
import { Op } from 'sequelize';
import { AppError, asyncH } from '../errors.js';
import { autenticar, autorizar } from '../security.js';
import { Usuario, Rol, Cliente } from '../model/entities/index.js';
import { sequelize } from '../db.js';
import { config } from '../config.js';
import { crearCuenta, notificarCredenciales, auditar, vistaUsuario } from '../cuentas.js';
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
  const q = req.query.q?.toString().trim();
  const clienteWhere = q ? { [Op.or]: [
    { primer_nombre: { [Op.iLike]: `%${q}%` } }, { apellido: { [Op.iLike]: `%${q}%` } },
    { dni: { [Op.iLike]: `%${q}%` } }, { correo: { [Op.iLike]: `%${q}%` } },
  ] } : undefined;
  const rows = await Usuario.findAll({
    where, order: [['id', 'ASC']],
    include: [{ model: Rol, where: rolWhere }, { model: Cliente, where: clienteWhere }],
  });
  res.json(rows.map(vistaUsuario));
}));

router.get('/usuarios/:id', autenticar, staff, asyncH(async (req, res) => {
  const u = await cargar(Number(req.params.id));
  verificarAlcance(req, u.Rol.nombre);
  res.json(vistaUsuario(u));
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

router.put('/usuarios/:id', autenticar, staff, asyncH(async (req, res) => {
  const { rol, ...datos } = actualizarUsuarioSchema.parse(req.body);
  const u = await cargar(Number(req.params.id));
  verificarAlcance(req, u.Rol.nombre);
  if (rol && rol !== u.Rol.nombre) {
    if (req.auth.rol !== 'ADMINISTRADOR') throw new AppError(403, 'SIN_PERMISO', 'Solo el administrador puede cambiar roles');
    if (u.id === req.auth.sub) throw new AppError(422, 'REGLA_NEGOCIO', 'No puedes cambiar tu propio rol');
    const nuevo = await Rol.findOne({ where: { nombre: rol, estado: 'ACTIVO' } });
    if (!nuevo) throw new AppError(422, 'ROL_INVALIDO', 'Rol inexistente o inactivo');
    u.rol_id = nuevo.id;
    await u.save();
  }
  const limpio = Object.fromEntries(Object.entries(datos).map(([k, v]) => [k, v === '' ? null : v]));
  if (Object.keys(limpio).length) await u.Cliente.update(limpio);
  await auditar(req.auth.sub, 'MODIFICAR', 'usuario', u.id, `Datos de ${u.username} modificados`);
  res.json(vistaUsuario(await cargar(u.id)));
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
  res.json(vistaUsuario(await cargar(req.auth.sub)));
}));

router.put('/clientes/me', autenticar, asyncH(async (req, res) => {
  const datos = perfilSchema.parse(req.body);
  const u = await cargar(req.auth.sub);
  await u.Cliente.update(datos);
  res.json(vistaUsuario(await cargar(req.auth.sub)));
}));

router.get('/roles', autenticar, autorizar('ADMINISTRADOR'), asyncH(async (req, res) => {
  res.json(await Rol.findAll({ order: [['id', 'ASC']] }));
}));

export default router;
