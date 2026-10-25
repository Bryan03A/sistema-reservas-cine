import { Router } from 'express';
import { Op } from 'sequelize';
import { z } from 'zod';
import { AppError, asyncH } from '../errors.js';
import { autenticar, autorizar, esStaff } from '../security.js';
import { Reserva, Boleto } from '../model/entities/index.js';
import { detalleFunciones, listarFunciones } from '../clients.js';
import * as svc from '../servicio.js';

const router = Router();
const CREAN = ['CLIENTE', 'OPERADOR', 'ADMINISTRADOR'];
const idParam = (req) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new AppError(400, 'VALIDACION', 'El id debe ser un entero positivo');
  return id;
};

const crearSchema = z.object({
  funcion_id: z.number().int().positive(),
  asiento_ids: z.array(z.number().int().positive()).min(1, 'Selecciona al menos un asiento').max(50),
  cliente_id: z.number().int().positive().optional(),
});

// Une cada reserva con los datos de su función (película, fecha, sala) consultando a Películas
async function enriquecer(reservas, token) {
  let mapa = new Map();
  try { mapa = new Map((await detalleFunciones([...new Set(reservas.map((r) => r.funcion_id))], token)).map((f) => [f.id, f])); } catch { /* sin detalle */ }
  return reservas.map((r) => {
    const f = mapa.get(r.funcion_id);
    return svc.vistaReserva(r, {
      funcion: f ? { id: f.id, pelicula: f.pelicula.nombre, clasificacion: f.pelicula.clasificacion, fecha: f.fecha, hora_inicio: f.hora_inicio, hora_fin: f.hora_fin, sala: f.sala } : { id: r.funcion_id },
      asientos: r.Boletos ? r.Boletos.map((b) => b.etiqueta) : undefined,
    });
  });
}

// Mapa de disponibilidad en tiempo real (el frontend lo consulta periódicamente)
router.get('/funciones/:id/asientos', autenticar, asyncH(async (req, res) => {
  res.json(await svc.disponibilidad(idParam(req), req.auth));
}));

router.post('/reservas', autenticar, autorizar(...CREAN), asyncH(async (req, res) => {
  const d = crearSchema.parse(req.body);
  res.status(201).json(await svc.crearReserva({ auth: req.auth, ...d }));
}));

router.post('/reservas/:id/confirmar', autenticar, autorizar(...CREAN), asyncH(async (req, res) => {
  res.json(await svc.confirmarReserva(idParam(req), req.auth));
}));

router.post('/reservas/:id/cancelar', autenticar, autorizar(...CREAN), asyncH(async (req, res) => {
  res.json(await svc.cancelarReserva(idParam(req), req.auth));
}));

router.get('/reservas/mis-reservas', autenticar, asyncH(async (req, res) => {
  if (!req.auth.cliente_id) return res.json([]);
  await svc.expirarVencidas();
  const where = { cliente_id: req.auth.cliente_id };
  if (req.query.estado) where.estado = req.query.estado;
  if (req.query.funcion_id) where.funcion_id = Number(req.query.funcion_id);
  const rs = await Reserva.findAll({ where, order: [['fecha_reserva', 'DESC']], include: [Boleto] });
  res.json(await enriquecer(rs, req.auth.token));
}));

// Consulta del personal: todas las reservas por función y película
router.get('/reservas', autenticar, autorizar('ADMINISTRADOR', 'OPERADOR'), asyncH(async (req, res) => {
  await svc.expirarVencidas();
  const where = {};
  if (req.query.estado) where.estado = req.query.estado;
  if (req.query.cliente_id) where.cliente_id = Number(req.query.cliente_id);
  if (req.query.funcion_id) where.funcion_id = Number(req.query.funcion_id);
  if (req.query.pelicula_id) {
    const fs = await listarFunciones({ pelicula_id: req.query.pelicula_id, estado: 'TODAS' }, req.auth.token);
    where.funcion_id = { [Op.in]: fs.map((f) => f.id) };
  }
  const rs = await Reserva.findAll({ where, order: [['id', 'DESC']], limit: Math.min(Number(req.query.limit) || 200, 500), include: [Boleto] });
  res.json(await enriquecer(rs, req.auth.token));
}));

router.get('/reservas/:id', autenticar, asyncH(async (req, res) => {
  await svc.expirarVencidas();
  const r = await Reserva.findByPk(idParam(req), { include: [Boleto] });
  if (!r) throw new AppError(404, 'NO_ENCONTRADO', 'La reserva no existe');
  svc.exigirAcceso(req.auth, r);
  const [v] = await enriquecer([r], req.auth.token);
  res.json({ ...v, boletos: await Promise.all(r.Boletos.map((b) => svc.vistaBoleto(b))) });
}));

router.get('/reservas/:id/boletos', autenticar, asyncH(async (req, res) => {
  const r = await Reserva.findByPk(idParam(req), { include: [Boleto] });
  if (!r) throw new AppError(404, 'NO_ENCONTRADO', 'La reserva no existe');
  svc.exigirAcceso(req.auth, r);
  res.json(await Promise.all(r.Boletos.map((b) => svc.vistaBoleto(b))));
}));

export default router;
