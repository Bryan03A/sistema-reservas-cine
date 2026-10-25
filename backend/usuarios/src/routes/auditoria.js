import { Router } from 'express';
import { asyncH } from '../errors.js';
import { autenticar, autorizar } from '../security.js';
import { RegistroAuditoria, Usuario } from '../model/entities/index.js';
import { auditoriaSchema } from '../schemas.js';

const router = Router();

// Los otros microservicios (con token client_credentials) y el personal registran eventos aquí
router.post('/auditoria', autenticar, autorizar('SERVICIO', 'ADMINISTRADOR', 'OPERADOR'), asyncH(async (req, res) => {
  const d = auditoriaSchema.parse(req.body);
  const r = await RegistroAuditoria.create({ ...d, entidad_id: d.entidad_id ?? null });
  res.status(201).json(r);
}));

router.get('/auditoria', autenticar, autorizar('ADMINISTRADOR'), asyncH(async (req, res) => {
  const where = {};
  if (req.query.entidad) where.entidad = req.query.entidad;
  if (req.query.usuario_id) where.usuario_id = Number(req.query.usuario_id);
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const rows = await RegistroAuditoria.findAll({ where, order: [['id', 'DESC']], limit, include: [{ model: Usuario, attributes: ['username'] }] });
  res.json(rows.map((r) => ({ ...r.toJSON(), username: r.Usuario?.username, Usuario: undefined })));
}));

export default router;
