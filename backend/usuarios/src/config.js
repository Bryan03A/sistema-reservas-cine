const env = process.env;

function parseClients() {
  try {
    if (env.SERVICE_CLIENTS) return JSON.parse(env.SERVICE_CLIENTS);
  } catch { /* usa el valor por defecto */ }
  return { peliculas: 'peliculas-secret', reservas: 'reservas-secret' };
}

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
  corsOrigins: (env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173').split(','),
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
