# Contrato común entre microservicios

Los tres servicios y el frontend forman **un solo programa**. Lo que sigue se cumple en todos; si algo cambia, se actualiza aquí y en el OpenAPI el mismo día.

## Dueño único de cada dato
| Dato | Microservicio | Tablas |
|---|---|---|
| Identidad, roles, perfil del cliente, foto de perfil, auditoría | Usuarios (3001) | `rol`, `usuario`, `cliente`, `cliente_foto`, `registro_auditoria` |
| Películas, pósters, funciones, salas, secciones, filas, asientos, precios | Películas (3002) | `pelicula`, `pelicula_imagen`, `funcion`, `sala`, `seccion`, `fila`, `asiento` |
| Reservas, disponibilidad por función, boletos | Reservas (3003) | `reserva`, `asiento_funcion`, `boleto` |

Las referencias entre servicios (`reserva.cliente_id`, `reserva.funcion_id`, `asiento_funcion.asiento_id`, `reserva.gestionado_por`) son **IDs lógicos sin clave foránea física**.

## Valores permitidos (idénticos en BD, código, Swagger y frontend)
- Rol: `ADMINISTRADOR`, `OPERADOR`, `CLIENTE` (y `SERVICIO` solo en tokens servicio a servicio).
- Estado de cuenta: `ACTIVO`, `INACTIVO`, `BLOQUEADO`.
- Película: `ACTIVA`, `INACTIVA`, `RETIRADA`. Clasificación: `TP`, `+12`, `+15`, `+18`.
- Función: `ACTIVA`, `CANCELADA`, `FINALIZADA`. Sección: `VIP` ($15), `DBOX` ($10), `GENERAL` ($5).
- Asiento físico: `ACTIVO`, `BLOQUEADO` (mantenimiento).
- Asiento en una función: `DISPONIBLE`, `RESERVADO`, `OCUPADO`.
- Reserva: `PENDIENTE`, `CONFIRMADA`, `CANCELADA`, `EXPIRADA`, `USADA`. Boleto: `ACTIVO`, `USADO`, `ANULADO`.

## Seguridad
- OAuth 2.0 en Usuarios: `POST /api/v1/oauth/token` con `grant_type` = `password`, `refresh_token` o `client_credentials`.
- JWT firmado con **RS256**. La clave pública se publica en `GET /.well-known/jwks.json`; Películas y Reservas validan la firma sin compartir secretos.
- Claims: `sub` (id de usuario), `username`, `rol`, `cliente_id`, `typ` (`access`), `iss`, `iat`, `exp`.
- Llamadas de un usuario entre servicios: se reenvía su JWT. Operaciones internas (auditoría, cancelación por función): token `client_credentials` con rol `SERVICIO`.

## Reglas de cuentas y perfil
- Nombre de usuario: `^[a-z0-9][a-z0-9._-]{3,29}$`. Por empezar con letra o número, un comando de desarrollo (que empieza con `/`) jamás es un usuario válido. No se admiten nombres reservados (admin, operador, soporte…).
- El token de configuración inicial (`typ: setup`, 15 min) solo permite elegir usuario y subir la foto, y solo antes del primer ingreso.
- Edición propia (`PUT /clientes/me`): nombres, apellido, nacionalidad, teléfono, dirección y correo. El DNI, el usuario y el rol no se pueden cambiar por esta vía.
- Edición por el administrador (`PUT /usuarios/:id`): cualquier dato personal, rol y contraseña nueva sin pedir la anterior.
- Cambio de contraseña propio: actual + nueva + confirmación.
- Imágenes: cuerpo binario (`image/jpeg|png|webp`); foto de perfil ≤ 1 MB, póster ≤ 2 MB; se valida la firma del archivo.

## Formato de error (los tres servicios)
```json
{ "status": 409, "code": "ASIENTO_NO_DISPONIBLE", "message": "…", "details": [], "path": "/api/v1/reservas", "timestamp": "2026-10-24T17:00:00Z" }
```
`400` validación · `401` sin token o inválido · `403` rol sin permiso · `404` no existe · `409` conflicto (asiento tomado, función solapada) · `422` regla de negocio · `503` servicio dependiente no disponible.

## Convenciones
- Prefijo `/api/v1`, JSON en `snake_case`, dinero en USD con 2 decimales.
- `fecha` y `hora` de las funciones en hora de Ecuador (UTC-5); los timestamps van en ISO 8601 UTC.
- Cada servicio expone `GET /health` y su Swagger en `/docs`.

## Reglas de negocio y quién las aplica
| Regla | Dónde se valida |
|---|---|
| Máximo 6 boletos por compra, una sola función por reserva | Reservas (`LIMITE_BOLETOS`) |
| Un asiento no puede reservarse dos veces en la misma función | Reservas: bloqueo transaccional de filas + índice único `(funcion_id, asiento_id)` |
| Total = suma de precios de las secciones | Reservas, con precios obtenidos de Películas |
| Reserva sin confirmar en 5 min → cancelada y asientos liberados | Reservas (tarea cada 15 s + verificación al leer) |
| Sin funciones solapadas en una sala (con 15 min de limpieza) | Películas |
| Boleto con QR único, un solo uso | Reservas (token firmado con HMAC) |
| El operador no gestiona operadores ni administradores | Usuarios |
| Cuentas inactivas no inician sesión | Usuarios |
| Toda acción del personal queda auditada | Usuarios recibe eventos de Películas y Reservas |
