import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { config } from './config.js';
import { errorHandler, notFound } from './errors.js';
import { jwks } from './security.js';
import { openapi } from './openapi.js';
import authRoutes from './routes/auth.js';
import usuariosRoutes from './routes/usuarios.js';
import auditoriaRoutes from './routes/auditoria.js';

export function buildApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({ origin: config.corsOrigins }));
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: false }));

  app.get('/health', (req, res) => res.json({ servicio: 'usuarios', estado: 'ok', hora: new Date().toISOString() }));
  app.get('/.well-known/jwks.json', (req, res) => res.json(jwks()));
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapi));
  app.use('/api/v1', authRoutes);
  app.use('/api/v1', usuariosRoutes);
  app.use('/api/v1', auditoriaRoutes);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
