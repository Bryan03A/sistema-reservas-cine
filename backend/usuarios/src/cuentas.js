import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import { config } from './config.js';
import { AppError } from './errors.js';
import { Rol, Usuario, Cliente, ClienteFoto, RegistroAuditoria } from './model/entities/index.js';

const quitarAcentos = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
// Para buscar: sin tildes y sin distinguir mayúsculas
export const normalizar = (s) => quitarAcentos(String(s ?? '')).toLowerCase().trim();

export async function generarUsername(primerNombre, apellido) {
  const base = quitarAcentos(`${primerNombre[0]}${apellido}`).toLowerCase().replace(/[^a-z0-9]/g, '') || 'usuario';
  for (let i = 0; i < 20; i++) {
    const candidato = `${base}${crypto.randomInt(10, 99)}`;
    if (!(await Usuario.findOne({ where: { username: candidato } }))) return candidato;
  }
  return `${base}${Date.now() % 100000}`;
}

export function generarPassword() {
  const pick = (set) => set[crypto.randomInt(set.length)];
  const U = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; const L = 'abcdefghijkmnpqrstuvwxyz'; const D = '23456789'; const S = '*#$%&';
  const chars = [pick(U), pick(L), pick(D), pick(S)];
  const all = U + L + D;
  while (chars.length < 10) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [chars[i], chars[j]] = [chars[j], chars[i]]; }
  return chars.join('');
}

let transporter;
async function enviarCredenciales(correo, username, password) {
  const texto = `Bienvenido a Cine Reservas.\n\nUsuario: ${username}\nContraseña inicial: ${password}\n\nCambia tu contraseña en el primer acceso.`;
  if (!config.smtp.host) {
    console.log(`[usuarios] (SMTP no configurado) correo simulado a ${correo}\n${texto}`);
    return false;
  }
  transporter ??= nodemailer.createTransport({
    host: config.smtp.host, port: config.smtp.port,
    auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
  });
  await transporter.sendMail({ from: config.smtp.from, to: correo, subject: 'Tus credenciales de acceso', text: texto });
  return true;
}

// Crea usuario + cliente (también para el personal, para guardar sus datos personales).
export async function crearCuenta(datos, rolNombre, { password, transaction } = {}) {
  const rol = await Rol.findOne({ where: { nombre: rolNombre, estado: 'ACTIVO' } });
  if (!rol) throw new AppError(422, 'ROL_INVALIDO', `El rol ${rolNombre} no existe o está inactivo`);
  const dup = await Cliente.findOne({ where: { dni: datos.dni }, transaction });
  if (dup) throw new AppError(409, 'DNI_DUPLICADO', 'Ya existe un usuario con ese DNI');
  const dupMail = await Cliente.findOne({ where: { correo: datos.correo }, transaction });
  if (dupMail) throw new AppError(409, 'CORREO_DUPLICADO', 'Ya existe un usuario con ese correo');

  const username = await generarUsername(datos.primer_nombre, datos.apellido);
  const passwordPlano = password ?? generarPassword();
  const usuario = await Usuario.create({
    username, password_hash: await bcrypt.hash(passwordPlano, 10), rol_id: rol.id,
  }, { transaction });
  const limpio = Object.fromEntries(Object.entries(datos).map(([k, v]) => [k, v === '' ? null : v]));
  const cliente = await Cliente.create({ ...limpio, usuario_id: usuario.id }, { transaction });
  return { usuario, cliente, rol, passwordPlano };
}

export async function notificarCredenciales({ cliente, usuario, passwordPlano }) {
  try {
    return await enviarCredenciales(cliente.correo, usuario.username, passwordPlano);
  } catch (e) {
    console.error('[usuarios] no se pudo enviar el correo:', e.message);
    return false;
  }
}

export async function enviarAvisoUsername(correo, nuevoUsername) {
  const texto = `Tu nombre de usuario en Cine Andino ahora es: ${nuevoUsername}\n\nLa contraseña no cambió. Si no fuiste tú, contacta al administrador.`;
  if (!config.smtp.host) { console.log(`[usuarios] (SMTP no configurado) aviso simulado a ${correo}\n${texto}`); return; }
  try {
    transporter ??= nodemailer.createTransport({ host: config.smtp.host, port: config.smtp.port, auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined });
    await transporter.sendMail({ from: config.smtp.from, to: correo, subject: 'Tu nombre de usuario fue actualizado', text: texto });
  } catch (e) { console.error('[usuarios] no se pudo enviar el aviso:', e.message); }
}

// ---- Foto de perfil (tabla cliente_foto)
export async function guardarFoto(clienteId, { buffer, tipo }) {
  const f = await ClienteFoto.findByPk(clienteId);
  if (f) {
    f.contenido = buffer; f.tipo = tipo; f.version += 1; f.actualizado_en = new Date();
    await f.save();
    return f.version;
  }
  return (await ClienteFoto.create({ cliente_id: clienteId, contenido: buffer, tipo })).version;
}
export const borrarFoto = (clienteId) => ClienteFoto.destroy({ where: { cliente_id: clienteId } });
export async function infoFoto(clienteId) {
  const f = await ClienteFoto.findByPk(clienteId, { attributes: ['version'] });
  return f ? f.version : null;
}
export const vistaCompleta = async (u) => ({ ...vistaUsuario(u), foto_version: u.Cliente ? await infoFoto(u.Cliente.id) : null });

export async function auditar(usuarioId, accion, entidad, entidadId, descripcion) {
  await RegistroAuditoria.create({ usuario_id: usuarioId, accion, entidad, entidad_id: entidadId ?? null, descripcion });
}

export const vistaUsuario = (u) => ({
  id: u.id, username: u.username, rol: u.Rol?.nombre, estado: u.estado,
  ultima_conexion: u.ultima_conexion, created_at: u.created_at,
  cliente: u.Cliente ? {
    id: u.Cliente.id, primer_nombre: u.Cliente.primer_nombre, segundo_nombre: u.Cliente.segundo_nombre,
    apellido: u.Cliente.apellido, dni: u.Cliente.dni, nacionalidad: u.Cliente.nacionalidad,
    direccion: u.Cliente.direccion, telefono: u.Cliente.telefono, correo: u.Cliente.correo,
  } : null,
});
