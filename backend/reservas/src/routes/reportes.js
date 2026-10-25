import { Router } from 'express';
import { z } from 'zod';
import { AppError, asyncH } from '../errors.js';
import { autenticar, autorizar, esStaff } from '../security.js';
import { reporteCliente, reporteGeneral } from '../reportes.js';

const router = Router();
const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Usa el formato AAAA-MM-DD').optional();
const rango = z.object({ desde: fecha, hasta: fecha, funcion_id: z.coerce.number().int().positive().optional(), pelicula_id: z.coerce.number().int().positive().optional() });

function validarRango({ desde, hasta }) {
  if (desde && hasta && desde > hasta) throw new AppError(422, 'RANGO_INVALIDO', '"desde" no puede ser posterior a "hasta"');
}

router.get('/reportes/cliente/:clienteId', autenticar, asyncH(async (req, res) => {
  const clienteId = Number(req.params.clienteId);
  if (!esStaff(req.auth) && clienteId !== req.auth.cliente_id) throw new AppError(403, 'SIN_PERMISO', 'Solo puedes consultar tu propio historial');
  const q = rango.parse(req.query);
  validarRango(q);
  res.json(await reporteCliente(clienteId, q, req.auth.token));
}));

router.get('/reportes/general', autenticar, autorizar('ADMINISTRADOR', 'OPERADOR'), asyncH(async (req, res) => {
  const q = rango.parse(req.query);
  validarRango(q);
  res.json(await reporteGeneral(q, req.auth.token));
}));

export default router;
