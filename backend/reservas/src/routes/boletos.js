import { Router } from 'express';
import QRCode from 'qrcode';
import { z } from 'zod';
import { AppError, asyncH } from '../errors.js';
import { autenticar, autorizar } from '../security.js';
import { Boleto, Reserva } from '../model/entities/index.js';
import * as svc from '../servicio.js';

const router = Router();

// Imagen PNG del QR de un boleto (solo su dueño o el personal)
router.get('/boletos/:id/qr.png', autenticar, asyncH(async (req, res) => {
  const b = await Boleto.findByPk(Number(req.params.id));
  if (!b) throw new AppError(404, 'NO_ENCONTRADO', 'El boleto no existe');
  svc.exigirAcceso(req.auth, await Reserva.findByPk(b.reserva_id));
  res.type('png').send(await QRCode.toBuffer(b.codigo_qr, { margin: 1, width: 300 }));
}));

// Validación de entrada por el personal: el mismo código no permite ingresar dos veces
router.post('/boletos/validar', autenticar, autorizar('ADMINISTRADOR', 'OPERADOR'), asyncH(async (req, res) => {
  const { codigo } = z.object({ codigo: z.string().min(10).max(150) }).parse(req.body);
  res.json(await svc.validarBoleto(codigo, req.auth));
}));

export default router;
