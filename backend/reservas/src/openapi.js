const sec = [{ bearerAuth: [] }];
const op = (summary, tag, extra = {}) => ({ summary, tags: [tag], security: sec, responses: { 200: { description: 'OK' }, 401: { description: 'Sin token' }, 403: { description: 'Sin permiso' }, 409: { description: 'Conflicto' }, 422: { description: 'Regla de negocio' } }, ...extra });
const body = (props, required = []) => ({ requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required, properties: props } } } } });
const id = [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }];
const fechas = [{ name: 'desde', in: 'query', schema: { type: 'string', example: '2026-10-24' } }, { name: 'hasta', in: 'query', schema: { type: 'string', example: '2026-10-30' } }];

export const openapi = {
  openapi: '3.0.3',
  info: { title: 'Cine · Microservicio de Reservas', version: '0.1.0', description: 'Disponibilidad, reservas con bloqueo transaccional, boletos con QR y reportes. Obtén un token en Usuarios (POST /api/v1/oauth/token) y pégalo en "Authorize".' },
  servers: [{ url: '/' }],
  components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } } },
  paths: {
    '/api/v1/funciones/{id}/asientos': { get: op('Disponibilidad de asientos de una función (tiempo real)', 'Disponibilidad', { parameters: id }) },
    '/api/v1/reservas': {
      post: op('Crear reserva (máx. 6 boletos, una sola función, expira en 5 min)', 'Reservas', body({ funcion_id: { type: 'integer' }, asiento_ids: { type: 'array', items: { type: 'integer' } }, cliente_id: { type: 'integer', description: 'Solo personal' } }, ['funcion_id', 'asiento_ids'])),
      get: op('Todas las reservas (personal). Filtros: funcion_id, pelicula_id, estado, cliente_id', 'Reservas'),
    },
    '/api/v1/reservas/mis-reservas': { get: op('Mis reservas', 'Reservas') },
    '/api/v1/reservas/{id}': { get: op('Detalle de reserva con boletos y QR', 'Reservas', { parameters: id }) },
    '/api/v1/reservas/{id}/confirmar': { post: op('Confirmar reserva y emitir boletos con QR', 'Reservas', { parameters: id }) },
    '/api/v1/reservas/{id}/cancelar': { post: op('Cancelar reserva activa', 'Reservas', { parameters: id }) },
    '/api/v1/reservas/{id}/boletos': { get: op('Boletos de una reserva', 'Boletos', { parameters: id }) },
    '/api/v1/boletos/{id}/qr.png': { get: op('Imagen PNG del QR', 'Boletos', { parameters: id }) },
    '/api/v1/boletos/validar': { post: op('Validar boleto por QR (personal)', 'Boletos', body({ codigo: { type: 'string' } }, ['codigo'])) },
    '/api/v1/reportes/cliente/{clienteId}': { get: op('Historial de reservas de un cliente', 'Reportes', { parameters: [{ name: 'clienteId', in: 'path', required: true, schema: { type: 'integer' } }, { name: 'funcion_id', in: 'query', schema: { type: 'integer' } }, ...fechas] }) },
    '/api/v1/reportes/general': { get: op('Reporte consolidado por película, función y sección (rango de fechas)', 'Reportes', { parameters: [...fechas, { name: 'pelicula_id', in: 'query', schema: { type: 'integer' } }] }) },
    '/api/v1/internal/funciones/{id}/cancelada': { post: op('Interno: Películas avisa que se canceló una función', 'Interno', { parameters: id }) },
  },
};
