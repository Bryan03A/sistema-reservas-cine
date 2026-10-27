const env = process.env;

function parseClients() {
  try {
    if (env.SERVICE_CLIENTS) return JSON.parse(env.SERVICE_CLIENTS);
  } catch { /* usa el valor por defecto */ }
  return { peliculas: 'peliculas-secret', reservas: 'reservas-secret' };
}

const LAN_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|[a-z0-9-]+\.local)(:\d+)?$/i;

export const config = {
  port: Number(env.PORT) || 3001,
  databaseUrl: env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/db_usuarios',
  issuer: env.JWT_ISSUER || 'cine-usuarios',
  accessTtl: env.ACCESS_TOKEN_TTL || '1h',
  refreshTtl: env.REFRESH_TOKEN_TTL || '7d',
  keysDir: env.KEYS_DIR || './keys',
  // En DEMO_MODE las credenciales generadas también se devuelven en la respuesta del registro
  // (útil mientras no haya SMTP). Ponlo en "false" para producción.
  demoMode: env.DEMO_MODE !== 'false',
  // CORS_ALLOW_LAN=true acepta además cualquier origen de red local (192.168.x.x, 10.x.x.x, 172.16-31.x.x, *.local)
  // para abrir el frontend desde el celular o la laptop de la misma red Wi-Fi. Ponlo en "false" fuera de la demostración.
  corsOrigins: [
    ...(env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173').split(','),
    ...(env.CORS_ALLOW_LAN === 'true' ? [LAN_ORIGIN] : []),
  ],
  smtp: {
    host: env.SMTP_HOST || '',
    port: Number(env.SMTP_PORT) || 587,
    user: env.SMTP_USER || '',
    pass: env.SMTP_PASS || '',
    from: env.MAIL_FROM || 'Cine Reservas <no-reply@cine.local>',
  },
  serviceClients: parseClients(),
  // Comando secreto (solo administrador/desarrollador): escrito en el campo "Usuario" del login muestra los accesos de demostración.
  // Empieza con "/" para que NUNCA sea un nombre de usuario válido. Cámbialo en .env (DEV_ACCESS_COMMAND).
  devCommand: env.DEV_ACCESS_COMMAND || '/dev',
  setupTtl: env.SETUP_TOKEN_TTL || '15m',
  maxFotoBytes: Number(env.MAX_FOTO_BYTES) || 1024 * 1024,
  maxLoginFailures: 5,
  lockMinutes: 5,
};
