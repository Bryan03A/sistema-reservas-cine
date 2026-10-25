const env = process.env;

export const config = {
  port: Number(env.PORT) || 3003,
  databaseUrl: env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/db_reservas',
  usuariosUrl: env.USUARIOS_URL || 'http://localhost:3001',
  peliculasUrl: env.PELICULAS_URL || 'http://localhost:3002',
  jwksUrl: env.JWKS_URL || `${env.USUARIOS_URL || 'http://localhost:3001'}/.well-known/jwks.json`,
  issuer: env.JWT_ISSUER || 'cine-usuarios',
  serviceClientId: env.SERVICE_CLIENT_ID || 'reservas',
  serviceClientSecret: env.SERVICE_CLIENT_SECRET || 'reservas-secret',
  corsOrigins: (env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173').split(','),
  // Una reserva sin confirmar se cancela sola a los 5 minutos (300 s). Para pruebas: RESERVA_TTL_SECONDS=20
  reservaTtlSeconds: Number(env.RESERVA_TTL_SECONDS) || 300,
  expiracionCadaSegundos: Number(env.EXPIRACION_CADA_SEGUNDOS) || 15,
  maxBoletosPorCompra: 6,
  qrSecret: env.QR_SECRET || 'cambia-este-secreto-del-qr',
  timezoneOffset: env.TIMEZONE_OFFSET || '-05:00', // America/Guayaquil
  permitirFuncionesIniciadas: env.PERMITIR_FUNCIONES_INICIADAS === 'true',
};
