const env = process.env;

const LAN_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|[a-z0-9-]+\.local)(:\d+)?$/i;

export const config = {
  port: Number(env.PORT) || 3003,
  databaseUrl: env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/db_reservas',
  usuariosUrl: env.USUARIOS_URL || 'http://localhost:3001',
  peliculasUrl: env.PELICULAS_URL || 'http://localhost:3002',
  jwksUrl: env.JWKS_URL || `${env.USUARIOS_URL || 'http://localhost:3001'}/.well-known/jwks.json`,
  issuer: env.JWT_ISSUER || 'cine-usuarios',
  serviceClientId: env.SERVICE_CLIENT_ID || 'reservas',
  serviceClientSecret: env.SERVICE_CLIENT_SECRET || 'reservas-secret',
  // CORS_ALLOW_LAN=true acepta además cualquier origen de red local (192.168.x.x, 10.x.x.x, 172.16-31.x.x, *.local)
  // para abrir el frontend desde el celular o la laptop de la misma red Wi-Fi. Ponlo en "false" fuera de la demostración.
  corsOrigins: [
    ...(env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173').split(','),
    ...(env.CORS_ALLOW_LAN === 'true' ? [LAN_ORIGIN] : []),
  ],
  // Una reserva sin confirmar se cancela sola a los 5 minutos (300 s). Para pruebas: RESERVA_TTL_SECONDS=20
  reservaTtlSeconds: Number(env.RESERVA_TTL_SECONDS) || 300,
  expiracionCadaSegundos: Number(env.EXPIRACION_CADA_SEGUNDOS) || 15,
  maxBoletosPorCompra: 6,
  qrSecret: env.QR_SECRET || 'cambia-este-secreto-del-qr',
  timezoneOffset: env.TIMEZONE_OFFSET || '-05:00', // America/Guayaquil
  permitirFuncionesIniciadas: env.PERMITIR_FUNCIONES_INICIADAS === 'true',
};
