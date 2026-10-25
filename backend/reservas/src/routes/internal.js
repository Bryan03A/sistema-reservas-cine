import { Router } from 'express';
import { asyncH } from '../errors.js';
import { autenticar, autorizar } from '../security.js';
import { cancelarPorFuncion } from '../servicio.js';

const router = Router();

// Solo para otros microservicios (token client_credentials, rol SERVICIO)
router.post('/internal/funciones/:id/cancelada', autenticar, autorizar('SERVICIO'), asyncH(async (req, res) => {
  const n = await cancelarPorFuncion(Number(req.params.id));
  res.json({ funcion_id: Number(req.params.id), reservas_canceladas: n });
}));

export default router;
