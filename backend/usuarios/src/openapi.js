const sec = [{ bearerAuth: [] }];
const op = (summary, tag, extra = {}) => ({ summary, tags: [tag], security: sec, responses: { 200: { description: 'OK' }, 401: { description: 'Sin token' }, 403: { description: 'Sin permiso' } }, ...extra });
const body = (props, required = []) => ({ requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required, properties: props } } } } });
const s = { type: 'string' };

export const openapi = {
  openapi: '3.0.3',
  info: { title: 'Cine · Microservicio de Usuarios', version: '0.1.0', description: 'Autenticación OAuth 2.0 + JWT (RS256), usuarios, roles, clientes y auditoría. Para probar: POST /api/v1/oauth/token y pega el access_token en "Authorize".' },
  servers: [{ url: '/' }],
  components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } } },
  paths: {
    '/.well-known/jwks.json': { get: { summary: 'Clave pública para validar tokens (JWKS)', tags: ['OAuth'], responses: { 200: { description: 'OK' } } } },
    '/api/v1/oauth/token': { post: { summary: 'Obtener token (grant_type: password | refresh_token | client_credentials)', tags: ['OAuth'], responses: { 200: { description: 'Token emitido' }, 401: { description: 'Credenciales inválidas' } }, ...body({ grant_type: s, username: s, password: s, refresh_token: s, client_id: s, client_secret: s }, ['grant_type']) } },
    '/api/v1/auth/register': { post: { summary: 'Registro de cliente (genera username y contraseña)', tags: ['Auth'], responses: { 201: { description: 'Cuenta creada' } }, ...body({ primer_nombre: s, segundo_nombre: s, apellido: s, dni: s, nacionalidad: s, direccion: s, telefono: s, correo: s }, ['primer_nombre', 'apellido', 'dni', 'correo']) } },
    '/api/v1/auth/change-password': { post: op('Cambiar contraseña', 'Auth', body({ password_actual: s, password_nueva: s }, ['password_actual', 'password_nueva'])) },
    '/api/v1/usuarios': { get: op('Listar usuarios (operador: solo clientes)', 'Usuarios'), post: op('Crear usuario (operador: solo clientes)', 'Usuarios', body({ rol: s, primer_nombre: s, apellido: s, dni: s, correo: s }, ['primer_nombre', 'apellido', 'dni', 'correo'])) },
    '/api/v1/usuarios/{id}': { get: op('Detalle de usuario', 'Usuarios'), put: op('Modificar usuario', 'Usuarios') },
    '/api/v1/usuarios/{id}/estado': { patch: op('Activar / desactivar / bloquear', 'Usuarios', body({ estado: { type: 'string', enum: ['ACTIVO', 'INACTIVO', 'BLOQUEADO'] } }, ['estado'])) },
    '/api/v1/clientes': { get: op('Listar clientes', 'Clientes') },
    '/api/v1/clientes/me': { get: op('Mi perfil', 'Clientes'), put: op('Actualizar mi perfil', 'Clientes') },
    '/api/v1/roles': { get: op('Listar roles (administrador)', 'Roles') },
    '/api/v1/auditoria': { get: op('Consultar auditoría (administrador)', 'Auditoría'), post: op('Registrar evento (servicios y personal)', 'Auditoría', body({ usuario_id: { type: 'integer' }, accion: s, entidad: s, entidad_id: { type: 'integer' }, descripcion: s }, ['usuario_id', 'accion', 'entidad'])) },
  },
};
