import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { config } from './config.js';
import { errorHandler, notFound } from './errors.js';
import { openapi } from './openapi.js';
import reservasRoutes from './routes/reservas.js';
import boletosRoutes from './routes/boletos.js';
import reportesRoutes from './routes/reportes.js';
import internalRoutes from './routes/internal.js';

export function buildApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({ origin: config.corsOrigins }));
  app.use(express.json({ limit: '100kb' }));
  app.get('/health', (req, res) => res.json({ servicio: 'reservas', estado: 'ok', ttl_segundos: config.reservaTtlSeconds }));
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapi));
  for (const r of [reservasRoutes, boletosRoutes, reportesRoutes, internalRoutes]) app.use('/api/v1', r);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
