// Lógica de negocio de Reservas. Las reglas críticas (máximo 6, misma función, no duplicar asientos,
// expiración a 5 min, boleto único) se validan SIEMPRE en el servidor, nunca en el navegador.
import crypto from 'node:crypto';
import QRCode from 'qrcode';
import { Op } from 'sequelize';
import { sequelize } from './db.js';
import { config } from './config.js';
import { AppError } from './errors.js';
import { Reserva, AsientoFuncion, Boleto } from './model/entities/index.js';
import { getEstructura, indexar, audit } from './clients.js';
import { esStaff } from './security.js';

// ---------- QR firmado: <código aleatorio>.<firma HMAC>. No contiene datos personales.
const firmar = (c) => crypto.createHmac('sha256', config.qrSecret).update(c).digest('base64url').slice(0, 22);
export const nuevoTokenQr = () => { const c = crypto.randomBytes(12).toString('base64url'); return `${c}.${firmar(c)}`; };
export function verificarTokenQr(token) {
  const [c, sig] = String(token ?? '').trim().split('.');
  if (!c || !sig) return false;
  const esperado = firmar(c);
  return sig.length === esperado.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(esperado));
}

const codigoReserva = () => `RSV-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
export const hoyLocal = () => new Date(Date.now() + Number(config.timezoneOffset.slice(0, 3)) * 3600000).toISOString().slice(0, 10);
export const inicioFuncion = (f) => new Date(`${f.fecha}T${f.hora_inicio}:00${config.timezoneOffset}`);

// ---------- Vistas
export const vistaReserva = (r, extra = {}) => ({
  id: r.id, codigo: r.codigo, cliente_id: r.cliente_id, funcion_id: r.funcion_id, gestionado_por: r.gestionado_por,
  fecha_reserva: r.fecha_reserva, expira_en: r.expira_en, estado: r.estado, cantidad_boletos: r.cantidad_boletos,
  total: Number(r.total), moneda: r.moneda, confirmada_en: r.confirmada_en, cancelada_en: r.cancelada_en,
  segundos_restantes: r.estado === 'PENDIENTE' ? Math.max(0, Math.round((new Date(r.expira_en) - Date.now()) / 1000)) : null,
  ...extra,
});

export async function vistaBoleto(b, conQr = true) {
  return {
    id: b.id, reserva_id: b.reserva_id, etiqueta: b.etiqueta, seccion_tipo: b.seccion_tipo, precio: Number(b.precio),
    estado: b.estado, emitido_en: b.emitido_en, usado_en: b.usado_en, codigo_qr: b.codigo_qr,
    qr_data_url: conQr ? await QRCode.toDataURL(b.codigo_qr, { margin: 1, width: 260 }) : undefined,
  };
}

export function exigirAcceso(auth, reserva) {
  if (!esStaff(auth) && reserva.cliente_id !== auth.cliente_id) {
    throw new AppError(403, 'SIN_PERMISO', 'Esta reserva pertenece a otro cliente');
  }
}

async function cargarReserva(id) {
  const r = await Reserva.findByPk(id);
  if (!r) throw new AppError(404, 'NO_ENCONTRADO', `Reserva ${id} no existe`);
  return r;
}

// ---------- Expiración (RN-06): reservas PENDIENTE vencidas → EXPIRADA y asientos liberados
export async function expirarVencidas() {
  return sequelize.transaction(async (t) => {
    const vencidas = await Reserva.findAll({
      where: { estado: 'PENDIENTE', expira_en: { [Op.lt]: new Date() } }, lock: t.LOCK.UPDATE, skipLocked: true, transaction: t,
    });
    if (!vencidas.length) return 0;
    const ids = vencidas.map((r) => r.id);
    await Reserva.update({ estado: 'EXPIRADA' }, { where: { id: ids }, transaction: t });
    await AsientoFuncion.update({ estado: 'DISPONIBLE', reserva_id: null, bloqueado_hasta: null }, { where: { reserva_id: ids }, transaction: t });
    console.log(`[reservas] ${ids.length} reserva(s) expirada(s) y asientos liberados`);
    return ids.length;
  });
}

async function liberar(reserva, estadoFinal, t) {
  await AsientoFuncion.update({ estado: 'DISPONIBLE', reserva_id: null, bloqueado_hasta: null }, { where: { reserva_id: reserva.id }, transaction: t });
  await Boleto.update({ estado: 'ANULADO' }, { where: { reserva_id: reserva.id, estado: 'ACTIVO' }, transaction: t });
  reserva.estado = estadoFinal;
  reserva.cancelada_en = new Date();
  await reserva.save({ transaction: t });
}

// ---------- Disponibilidad en tiempo real de una función
export async function disponibilidad(funcionId, auth) {
  await expirarVencidas();
  const est = await getEstructura(funcionId, auth.token);
  const idx = indexar(est);
  const rows = await AsientoFuncion.findAll({ where: { funcion_id: funcionId, estado: { [Op.in]: ['RESERVADO', 'OCUPADO'] } } });
  const reservaIds = [...new Set(rows.map((r) => r.reserva_id).filter(Boolean))];
  const mias = new Set(reservaIds.length && auth.cliente_id
    ? (await Reserva.findAll({ where: { id: reservaIds, cliente_id: auth.cliente_id }, attributes: ['id'] })).map((r) => r.id) : []);
  const porAsiento = new Map(rows.map((r) => [r.asiento_id, r]));
  const ahora = Date.now();
  const resumen = { DISPONIBLE: 0, RESERVADO: 0, OCUPADO: 0, BLOQUEADO: 0 };
  const asientos = [...idx.values()].map((a) => {
    const row = porAsiento.get(a.id);
    let estado = 'DISPONIBLE';
    if (a.estadoFisico === 'BLOQUEADO') estado = 'BLOQUEADO';
    else if (row?.estado === 'OCUPADO') estado = 'OCUPADO';
    else if (row?.estado === 'RESERVADO' && (!row.bloqueado_hasta || new Date(row.bloqueado_hasta) > ahora)) estado = 'RESERVADO';
    resumen[estado]++;
    return { asiento_id: a.id, etiqueta: a.etiqueta, seccion_id: a.seccion_id, seccion: a.seccion, tipo: a.tipo, precio: a.precio, estado, mio: estado === 'RESERVADO' && mias.has(row.reserva_id) };
  });
  return { funcion: est.funcion, sala: est.sala, max_boletos: config.maxBoletosPorCompra, ttl_segundos: config.reservaTtlSeconds, resumen, asientos };
}

// ---------- Crear reserva (bloqueo transaccional de asientos)
export async function crearReserva({ auth, funcion_id, asiento_ids, cliente_id }) {
  const ids = [...new Set(asiento_ids)];
  if (ids.length !== asiento_ids.length) throw new AppError(422, 'ASIENTOS_REPETIDOS', 'No repitas asientos en la misma reserva');
  if (ids.length > config.maxBoletosPorCompra) {
    throw new AppError(422, 'LIMITE_BOLETOS', `Máximo ${config.maxBoletosPorCompra} boletos por compra (solicitaste ${ids.length})`);
  }
  // Un cliente reserva siempre para sí mismo; el personal puede reservar para un cliente indicado
  const staff = esStaff(auth);
  const clienteId = staff && cliente_id ? cliente_id : auth.cliente_id;
  if (!clienteId) throw new AppError(422, 'CLIENTE_REQUERIDO', 'No se pudo determinar el cliente de la reserva');
  if (!staff && cliente_id && cliente_id !== auth.cliente_id) throw new AppError(403, 'SIN_PERMISO', 'Solo el personal puede reservar a nombre de otro cliente');

  await expirarVencidas();
  const est = await getEstructura(funcion_id, auth.token);
  const f = est.funcion;
  if (f.estado !== 'ACTIVA') throw new AppError(422, 'FUNCION_NO_DISPONIBLE', 'La función no está activa');
  if (!config.permitirFuncionesIniciadas && inicioFuncion(f) <= new Date()) {
    throw new AppError(422, 'FUNCION_INICIADA', 'La función ya comenzó; la fecha límite para reservar venció');
  }
  const idx = indexar(est);
  let total = 0;
  for (const id of ids) {
    const a = idx.get(id);
    if (!a) throw new AppError(422, 'ASIENTO_INVALIDO', `El asiento ${id} no pertenece a la sala de esta función`);
    if (a.estadoFisico === 'BLOQUEADO') throw new AppError(422, 'ASIENTO_BLOQUEADO', `El asiento ${a.etiqueta} está fuera de servicio`);
    total += a.precio; // el total se calcula en el servidor con los precios de Películas
  }

  const expira = new Date(Date.now() + config.reservaTtlSeconds * 1000);
  const reserva = await sequelize.transaction(async (t) => {
    // Crea (si faltan) las filas de estos asientos y las bloquea en orden para evitar interbloqueos
    await AsientoFuncion.bulkCreate(ids.map((asiento_id) => ({ funcion_id, asiento_id, estado: 'DISPONIBLE' })), { ignoreDuplicates: true, transaction: t });
    const rows = await AsientoFuncion.findAll({ where: { funcion_id, asiento_id: ids }, order: [['asiento_id', 'ASC']], lock: t.LOCK.UPDATE, transaction: t });
    const ahora = new Date();
    const ocupados = rows.filter((r) => !(r.estado === 'DISPONIBLE' || (r.estado === 'RESERVADO' && r.bloqueado_hasta && r.bloqueado_hasta < ahora)));
    if (ocupados.length) {
      throw new AppError(409, 'ASIENTO_NO_DISPONIBLE', 'Uno o más asientos ya no están disponibles. Actualiza el mapa y elige otros.',
        ocupados.map((r) => ({ asiento_id: r.asiento_id, etiqueta: idx.get(r.asiento_id)?.etiqueta, estado: r.estado })));
    }
    const r = await Reserva.create({
      codigo: codigoReserva(), cliente_id: clienteId, funcion_id, gestionado_por: staff ? auth.sub : null,
      expira_en: expira, estado: 'PENDIENTE', cantidad_boletos: ids.length, total,
    }, { transaction: t });
    await AsientoFuncion.update({ estado: 'RESERVADO', reserva_id: r.id, bloqueado_hasta: expira }, { where: { id: rows.map((x) => x.id) }, transaction: t });
    return r;
  });
  if (staff && clienteId !== auth.cliente_id) audit(auth.sub, 'CREAR', 'reserva', reserva.id, `Reserva ${reserva.codigo} creada para el cliente ${clienteId}`);
  return vistaReserva(reserva, { asientos: ids.map((id) => idx.get(id).etiqueta), funcion: f });
}

// ---------- Confirmar: asientos → OCUPADO y un boleto con QR por asiento
export async function confirmarReserva(id, auth) {
  await expirarVencidas();
  const r0 = await cargarReserva(id);
  exigirAcceso(auth, r0);
  const idx = indexar(await getEstructura(r0.funcion_id, auth.token));
  const { r, boletos } = await sequelize.transaction(async (t) => {
    const r = await Reserva.findByPk(id, { lock: t.LOCK.UPDATE, transaction: t });
    if (r.estado === 'EXPIRADA') throw new AppError(422, 'RESERVA_EXPIRADA', 'La reserva expiró (pasaron más de 5 minutos). Crea una nueva.');
    if (r.estado !== 'PENDIENTE') throw new AppError(422, 'ESTADO_INVALIDO', `La reserva está ${r.estado}; solo se confirman las PENDIENTE`);
    if (new Date(r.expira_en) < new Date()) throw new AppError(422, 'RESERVA_EXPIRADA', 'La reserva expiró (pasaron más de 5 minutos). Crea una nueva.');
    const rows = await AsientoFuncion.findAll({ where: { reserva_id: r.id }, order: [['asiento_id', 'ASC']], lock: t.LOCK.UPDATE, transaction: t });
    const boletos = [];
    for (const row of rows) {
      const a = idx.get(row.asiento_id);
      row.estado = 'OCUPADO';
      row.bloqueado_hasta = null;
      await row.save({ transaction: t });
      boletos.push(await Boleto.create({
        reserva_id: r.id, asiento_funcion_id: row.id, asiento_id: row.asiento_id, precio: a?.precio ?? 0,
        codigo_qr: nuevoTokenQr(), etiqueta: a?.etiqueta ?? `#${row.asiento_id}`, seccion_tipo: a?.tipo ?? 'GENERAL',
      }, { transaction: t }));
    }
    r.estado = 'CONFIRMADA';
    r.confirmada_en = new Date();
    await r.save({ transaction: t });
    return { r, boletos };
  });
  return vistaReserva(r, { boletos: await Promise.all(boletos.map((b) => vistaBoleto(b))) });
}

// ---------- Cancelar (solo reservas activas: ni expiradas ni utilizadas)
export async function cancelarReserva(id, auth) {
  await expirarVencidas();
  const r0 = await cargarReserva(id);
  exigirAcceso(auth, r0);
  if (!['PENDIENTE', 'CONFIRMADA'].includes(r0.estado)) {
    throw new AppError(422, 'ESTADO_INVALIDO', `No se puede cancelar una reserva ${r0.estado}`);
  }
  if (r0.estado === 'CONFIRMADA' && !config.permitirFuncionesIniciadas) {
    const { funcion } = await getEstructura(r0.funcion_id, auth.token);
    if (inicioFuncion(funcion) <= new Date()) throw new AppError(422, 'FUNCION_INICIADA', 'La función ya comenzó; no se puede cancelar');
  }
  const r = await sequelize.transaction(async (t) => {
    const r = await Reserva.findByPk(id, { lock: t.LOCK.UPDATE, transaction: t });
    if (!['PENDIENTE', 'CONFIRMADA'].includes(r.estado)) throw new AppError(422, 'ESTADO_INVALIDO', `No se puede cancelar una reserva ${r.estado}`);
    if (await Boleto.count({ where: { reserva_id: r.id, estado: 'USADO' }, transaction: t })) {
      throw new AppError(422, 'RESERVA_UTILIZADA', 'La reserva ya fue utilizada en el cine');
    }
    await liberar(r, 'CANCELADA', t);
    return r;
  });
  if (esStaff(auth)) audit(auth.sub, 'CANCELAR', 'reserva', r.id, `Reserva ${r.codigo} cancelada por el personal`);
  return vistaReserva(r);
}

// Llamado por Películas cuando se cancela una función
export async function cancelarPorFuncion(funcionId) {
  return sequelize.transaction(async (t) => {
    const rs = await Reserva.findAll({ where: { funcion_id: funcionId, estado: { [Op.in]: ['PENDIENTE', 'CONFIRMADA'] } }, lock: t.LOCK.UPDATE, transaction: t });
    for (const r of rs) await liberar(r, 'CANCELADA', t);
    return rs.length;
  });
}

// ---------- Validar boleto por QR (personal): una sola vez
export async function validarBoleto(token, auth) {
  if (!verificarTokenQr(token)) throw new AppError(422, 'QR_INVALIDO', 'El código QR no es auténtico');
  const { b, r } = await sequelize.transaction(async (t) => {
    const b = await Boleto.findOne({ where: { codigo_qr: String(token).trim() }, lock: t.LOCK.UPDATE, transaction: t });
    if (!b) throw new AppError(404, 'BOLETO_NO_ENCONTRADO', 'No existe un boleto con ese código');
    if (b.estado === 'USADO') throw new AppError(409, 'BOLETO_YA_USADO', `Este boleto ya fue utilizado (${new Date(b.usado_en).toLocaleString('es-EC')})`);
    if (b.estado === 'ANULADO') throw new AppError(422, 'BOLETO_ANULADO', 'El boleto fue anulado (reserva cancelada)');
    const r = await Reserva.findByPk(b.reserva_id, { lock: t.LOCK.UPDATE, transaction: t });
    if (r.estado !== 'CONFIRMADA') throw new AppError(422, 'RESERVA_NO_VALIDA', `La reserva está ${r.estado}`);
    b.estado = 'USADO';
    b.usado_en = new Date();
    await b.save({ transaction: t });
    if ((await Boleto.count({ where: { reserva_id: r.id, estado: 'ACTIVO' }, transaction: t })) === 0) {
      r.estado = 'USADA';
      await r.save({ transaction: t });
    }
    return { b, r };
  });
  audit(auth.sub, 'VALIDAR', 'boleto', b.id, `Boleto ${b.etiqueta} de la reserva ${r.codigo} validado`);
  return { valido: true, boleto: await vistaBoleto(b, false), reserva: vistaReserva(r) };
}
