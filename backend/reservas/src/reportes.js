import { Op, fn, col } from 'sequelize';
import { Reserva, AsientoFuncion, Boleto } from './model/entities/index.js';
import { listarFunciones, detalleFunciones, getEstructuraDeFuncion, indexar } from './clients.js';
import { expirarVencidas, hoyLocal } from './servicio.js';

const ESTADOS = ['PENDIENTE', 'CONFIRMADA', 'CANCELADA', 'EXPIRADA', 'USADA'];
const ceros = () => Object.fromEntries(ESTADOS.map((e) => [e, 0]));
const suma = (d, dias) => new Date(new Date(`${d}T12:00:00Z`).getTime() + dias * 86400000).toISOString().slice(0, 10);

// Reporte individual: historial de reservas de un cliente (filtros opcionales: función y rango de fechas de la función)
export async function reporteCliente(clienteId, { funcion_id, desde, hasta }, token) {
  const where = { cliente_id: clienteId };
  if (funcion_id) where.funcion_id = funcion_id;
  const reservas = await Reserva.findAll({ where, order: [['fecha_reserva', 'DESC']], include: [Boleto] });
  let funciones = new Map();
  try { funciones = new Map((await detalleFunciones([...new Set(reservas.map((r) => r.funcion_id))], token)).map((f) => [f.id, f])); } catch { /* sin detalle */ }
  const items = reservas
    .map((r) => ({ r, f: funciones.get(r.funcion_id) }))
    .filter(({ f }) => !(desde || hasta) || (f && (!desde || f.fecha >= desde) && (!hasta || f.fecha <= hasta)))
    .map(({ r, f }) => ({
      id: r.id, codigo: r.codigo, estado: r.estado, fecha_reserva: r.fecha_reserva, cantidad_boletos: r.cantidad_boletos, total: Number(r.total),
      funcion: f ? { id: f.id, pelicula: f.pelicula.nombre, fecha: f.fecha, hora_inicio: f.hora_inicio, sala: f.sala } : { id: r.funcion_id },
      asientos: r.Boletos.map((b) => b.etiqueta),
    }));
  const por_estado = ceros();
  items.forEach((i) => { por_estado[i.estado]++; });
  return {
    cliente_id: clienteId, filtros: { funcion_id: funcion_id ?? null, desde: desde ?? null, hasta: hasta ?? null },
    total_reservas: items.length, por_estado,
    boletos_emitidos: items.filter((i) => ['CONFIRMADA', 'USADA'].includes(i.estado)).reduce((s, i) => s + i.cantidad_boletos, 0),
    reservas: items,
  };
}

// Reporte general consolidado: reservas, disponibilidad y ocupación por película, función y sección + estados
export async function reporteGeneral({ desde, hasta, pelicula_id }, token) {
  desde ??= hoyLocal();
  hasta ??= suma(desde, 6);
  await expirarVencidas();
  const q = { desde, hasta, estado: 'TODAS' };
  if (pelicula_id) q.pelicula_id = pelicula_id;
  const funciones = await listarFunciones(q, token);
  const ids = funciones.map((f) => f.id);

  const porEstadoRows = ids.length ? await Reserva.findAll({
    attributes: ['funcion_id', 'estado', [fn('count', col('id')), 'n']], where: { funcion_id: ids }, group: ['funcion_id', 'estado'], raw: true,
  }) : [];
  const asientoRows = ids.length ? await AsientoFuncion.findAll({ where: { funcion_id: ids, estado: { [Op.in]: ['RESERVADO', 'OCUPADO'] } }, raw: true }) : [];
  const ahora = Date.now();

  const detalle = [];
  for (const f of funciones) {
    const idx = indexar(await getEstructuraDeFuncion(f, token));
    const secciones = new Map();
    for (const a of idx.values()) {
      const s = secciones.get(a.seccion_id) ?? { seccion: a.seccion, tipo: a.tipo, capacidad: 0, bloqueados: 0, ocupados: 0, reservados: 0 };
      s.capacidad++;
      if (a.estadoFisico === 'BLOQUEADO') s.bloqueados++;
      secciones.set(a.seccion_id, s);
    }
    for (const r of asientoRows.filter((x) => x.funcion_id === f.id)) {
      const a = idx.get(r.asiento_id);
      const s = a && secciones.get(a.seccion_id);
      if (!s) continue;
      if (r.estado === 'OCUPADO') s.ocupados++;
      else if (!r.bloqueado_hasta || new Date(r.bloqueado_hasta) > ahora) s.reservados++;
    }
    const secs = [...secciones.values()].map((s) => ({ ...s, disponibles: s.capacidad - s.bloqueados - s.ocupados - s.reservados }));
    const tot = secs.reduce((t, s) => ({ capacidad: t.capacidad + s.capacidad - s.bloqueados, ocupados: t.ocupados + s.ocupados, reservados: t.reservados + s.reservados }), { capacidad: 0, ocupados: 0, reservados: 0 });
    const reservas_por_estado = ceros();
    porEstadoRows.filter((x) => x.funcion_id === f.id).forEach((x) => { reservas_por_estado[x.estado] = Number(x.n); });
    detalle.push({
      funcion_id: f.id, pelicula_id: f.pelicula_id, pelicula: f.pelicula.nombre, fecha: f.fecha, hora_inicio: f.hora_inicio, sala: f.sala, estado_funcion: f.estado,
      reservas_total: Object.values(reservas_por_estado).reduce((a, b) => a + b, 0), reservas_por_estado,
      capacidad: tot.capacidad, ocupados: tot.ocupados, reservados: tot.reservados, disponibles: tot.capacidad - tot.ocupados - tot.reservados,
      ocupacion_pct: tot.capacidad ? Math.round(((tot.ocupados + tot.reservados) / tot.capacidad) * 1000) / 10 : 0,
      secciones: secs,
    });
  }

  const por_estado = ceros();
  const peliculas = new Map();
  for (const d of detalle) {
    ESTADOS.forEach((e) => { por_estado[e] += d.reservas_por_estado[e]; });
    const p = peliculas.get(d.pelicula_id) ?? { pelicula_id: d.pelicula_id, pelicula: d.pelicula, funciones: 0, reservas: 0, capacidad: 0, ocupados: 0, reservados: 0 };
    p.funciones++; p.reservas += d.reservas_total; p.capacidad += d.capacidad; p.ocupados += d.ocupados; p.reservados += d.reservados;
    peliculas.set(d.pelicula_id, p);
  }
  return {
    filtros: { desde, hasta, pelicula_id: pelicula_id ?? null },
    total_funciones: detalle.length, total_reservas: Object.values(por_estado).reduce((a, b) => a + b, 0), por_estado,
    por_pelicula: [...peliculas.values()].map((p) => ({ ...p, disponibles: p.capacidad - p.ocupados - p.reservados, ocupacion_pct: p.capacidad ? Math.round(((p.ocupados + p.reservados) / p.capacidad) * 1000) / 10 : 0 })),
    funciones: detalle,
  };
}
