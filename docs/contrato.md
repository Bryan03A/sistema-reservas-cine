# Contrato común entre microservicios

Los tres servicios y el frontend forman **un solo programa**. Lo que sigue se cumple en todos; si algo cambia, se actualiza aquí y en el OpenAPI (Swagger) el mismo día.

Documentos relacionados: [`README.md`](../README.md) (arquitectura, ejecución y flujo de reserva) · [`Sistema_Reservas_Cine.dbml`](Sistema_Reservas_Cine.dbml) (modelo de datos).

## Servicios y puertos

| Servicio | Puerto | Tecnología | Base de datos | Swagger |
|---|:---:|---|---|---|
| Usuarios | 3001 | Node.js · Express · Sequelize | `db_usuarios` | `/docs` |
| Películas | 3002 | Python · FastAPI · SQLAlchemy | `db_peliculas` | `/docs` |
| Reservas | 3003 | Node.js · Express · Sequelize | `db_reservas` | `/docs` |
| Frontend (Nginx) | 5173 HTTP · 5443 HTTPS | HTML + JavaScript | no tiene | no aplica |

Cada servicio tiene su **propia base PostgreSQL**. Ningún servicio lee la base de otro: toda consulta entre servicios va por REST.

### Cómo llega el frontend a cada servicio

| Acceso | Ruta que usa el navegador | Cómo se resuelve |
|---|---|---|
| HTTP (`http://host:5173`) | `http://host:3001/api/v1`, `:3002/api/v1`, `:3003/api/v1` | Llamada directa a cada puerto |
| HTTPS (`https://host:5443`) | `/api/usuarios/*`, `/api/peliculas/*`, `/api/reservas/*` | Nginx reenvía a `/api/v1/*` del servicio, en el mismo origen (sin CORS) |

En ambos casos `/health` y `/.well-known/jwks.json` se reenvían a la raíz del servicio. La cámara para leer QR exige HTTPS.

## Dueño único de cada dato

| Dato | Microservicio | Tablas |
|---|---|---|
| Identidad, roles, perfil del cliente, foto de perfil, auditoría | Usuarios (3001) | `rol`, `usuario`, `cliente`, `cliente_foto`, `registro_auditoria` |
| Películas, pósters, funciones, salas, secciones, filas, asientos, precios | Películas (3002) | `pelicula`, `pelicula_imagen`, `funcion`, `sala`, `seccion`, `fila`, `asiento` |
| Reservas, disponibilidad por función, boletos | Reservas (3003) | `reserva`, `asiento_funcion`, `boleto` |

### Referencias entre servicios

Son **IDs lógicos sin clave foránea física**. Cada servicio es responsable de validarlos por API.

| Campo | Apunta a |
|---|---|
| `reserva.cliente_id` | `usuarios.cliente.id` |
| `reserva.gestionado_por` | `usuarios.usuario.id` (personal que creó la reserva; vacío si la hizo el cliente) |
| `reserva.funcion_id` | `peliculas.funcion.id` |
| `asiento_funcion.funcion_id` | `peliculas.funcion.id` |
| `asiento_funcion.asiento_id` | `peliculas.asiento.id` |
| `boleto.asiento_id` | `peliculas.asiento.id` |

`boleto.etiqueta` (por ejemplo `A5`) y `boleto.seccion_tipo` son una **copia** de datos del asiento al emitir el boleto, para mostrarlo sin consultar a Películas.

## Valores permitidos (idénticos en BD, código, Swagger y frontend)

| Elemento | Valores |
|---|---|
| Rol | `ADMINISTRADOR`, `OPERADOR`, `CLIENTE` (y `SERVICIO` solo en tokens servicio a servicio; no existe en la tabla `rol`) |
| Estado de cuenta | `ACTIVO`, `INACTIVO`, `BLOQUEADO` |
| Película | `ACTIVA`, `INACTIVA`, `RETIRADA` |
| Clasificación | `TP`, `+12`, `+15`, `+18` |
| Función | `ACTIVA`, `CANCELADA`, `FINALIZADA` |
| Sección | `VIP` ($15), `DBOX` ($10), `GENERAL` ($5) |
| Asiento físico | `ACTIVO`, `BLOQUEADO` (mantenimiento) |
| Asiento en una función | `DISPONIBLE`, `RESERVADO`, `OCUPADO` |
| Reserva | `PENDIENTE`, `CONFIRMADA`, `CANCELADA`, `EXPIRADA`, `USADA` |
| Boleto | `ACTIVO`, `USADO`, `ANULADO` |
| Acción de auditoría | `CREAR`, `MODIFICAR`, `ACTIVAR`, `DESACTIVAR`, `CANCELAR`, `VALIDAR` |
| Imagen | `image/jpeg`, `image/png`, `image/webp` |

## Ciclo de vida de una reserva

| De | A | Cuándo |
|---|---|---|
| (nueva) | `PENDIENTE` | Se crea la reserva: los asientos pasan a `RESERVADO` con `bloqueado_hasta` |
| `PENDIENTE` | `CONFIRMADA` | El cliente confirma antes de `expira_en`: los asientos pasan a `OCUPADO` y se emite un boleto con QR por asiento |
| `PENDIENTE` | `EXPIRADA` | Pasan 5 minutos sin confirmar: se liberan los asientos |
| `PENDIENTE` · `CONFIRMADA` | `CANCELADA` | Cancelación manual, o cancelación de la función. Los boletos pasan a `ANULADO` y los asientos se liberan |
| `CONFIRMADA` | `USADA` | Se valida el boleto en el cine |

- Una reserva `CONFIRMADA` solo se puede cancelar **antes de que empiece la función** (salvo que el servicio arranque con `PERMITIR_FUNCIONES_INICIADAS=true`).
- Una reserva ya `USADA` no se puede cancelar (`RESERVA_UTILIZADA`).
- No se puede reservar una función que ya comenzó (`FUNCION_INICIADA`).
- Los boletos `ANULADO` se conservan como historial. Por eso la unicidad de `boleto.asiento_funcion_id` es **parcial** (solo entre boletos no anulados) y el asiento puede volver a venderse.

## Seguridad

### OAuth 2.0 y JWT

- `POST /api/v1/oauth/token` en Usuarios con `grant_type` = `password`, `refresh_token` o `client_credentials`.
- JWT firmado con **RS256**. La clave pública se publica en `GET /.well-known/jwks.json`; Películas y Reservas validan la firma con ella (la guardan en caché 5 minutos), **sin compartir secretos**.
- El emisor (`iss`) es el mismo en los tres servicios (`JWT_ISSUER`, por defecto `cine-usuarios`).
- Claims del token de acceso: `sub` (id de usuario), `username`, `rol`, `cliente_id`, `typ`, `iss`, `iat`, `exp`.

### Tipos de token

| `typ` | Duración | Para qué sirve |
|---|---|---|
| `access` | 1 h (`ACCESS_TOKEN_TTL`) | Llamar a las APIs. Es el único tipo que aceptan los tres servicios |
| `refresh` | 7 d (`REFRESH_TOKEN_TTL`) | Obtener un access nuevo con `grant_type=refresh_token` |
| `setup` | 15 min (`SETUP_TOKEN_TTL`) | Configuración inicial tras el registro: solo permite elegir usuario y subir la foto, y solo antes del primer ingreso |
| `access` con rol `SERVICIO` | 15 min | Token `client_credentials` para llamadas internas entre servicios |

### Reglas

- Llamadas de un usuario entre servicios: se reenvía su JWT.
- Operaciones internas (auditoría, cancelación por función): token `client_credentials` con rol `SERVICIO`. Cada servicio tiene su `client_id` y su secreto (`SERVICE_CLIENT_ID` / `SERVICE_CLIENT_SECRET`), registrados en Usuarios (`SERVICE_CLIENTS`).
- Usuarios comprueba en su base que la cuenta siga `ACTIVO` en cada petición. Películas y Reservas solo validan la firma, por eso reconocen una cuenta desactivada hasta que expire el token (1 h).
- Contraseñas con **bcrypt**. Tras 5 intentos de ingreso fallidos la cuenta se bloquea 5 minutos (`429 CUENTA_BLOQUEADA_TEMPORAL`).
- Boleto con **QR firmado**: `<código aleatorio>.<firma HMAC-SHA256>`, sin datos personales. Se verifica con `QR_SECRET` antes de consultar la base.
- Imágenes: cuerpo binario (`image/jpeg|png|webp`); foto de perfil ≤ 1 MB, póster ≤ 2 MB. Se valida la firma real del archivo, no solo la extensión.

## Permisos por rol

| Acción | Cliente | Operador | Administrador |
|---|:---:|:---:|:---:|
| Ver cartelera, funciones y pósters | Sí | Sí | Sí |
| Ver estructura de sala de una función y su disponibilidad | Sí | Sí | Sí |
| Crear, confirmar y cancelar reservas propias | Sí | Sí | Sí |
| Crear reservas a nombre de otro cliente | No | Sí | Sí |
| Ver reservas y boletos propios, reporte individual | Sí | Sí | Sí |
| Listar todas las reservas y reporte general | No | Sí | Sí |
| Validar boletos | No | Sí | Sí |
| Crear y editar películas, funciones y pósters; bloquear asientos | No | Sí | Sí |
| Consultar salas, secciones, filas y asientos | No | Sí | Sí |
| Crear usuarios y activar, desactivar o bloquear cuentas | No | Sí (solo clientes) | Sí |
| Editar a cualquier usuario (datos, rol, contraseña) | No | No | Sí |
| Consultar auditoría y catálogo de roles | No | No | Sí |
| Generar funciones de demostración | No | No | Sí |
| Editar su propio perfil y cambiar su contraseña | Sí | Sí | Sí |

## Comunicación entre servicios

| Origen | Destino | Llamada | Autenticación | ¿Bloquea la operación? |
|---|---|---|---|---|
| Películas · Reservas | Usuarios | `GET /.well-known/jwks.json` | Ninguna (pública) | Sí, si no hay clave no se valida el token |
| Películas · Reservas | Usuarios | `POST /api/v1/oauth/token` (`client_credentials`) | `client_id` + `client_secret` | No |
| Películas · Reservas | Usuarios | `POST /api/v1/auditoria` | Token `SERVICIO` | No: si falla, solo se registra en el log |
| Reservas | Películas | `GET /api/v1/funciones/:id/estructura` | JWT | Sí (`503 SERVICIO_NO_DISPONIBLE` si no responde) |
| Reservas | Películas | `GET /api/v1/funciones` y `/internal/funciones/detalle?ids=` | JWT | Sí |
| Películas | Reservas | `POST /api/v1/internal/funciones/:id/cancelada` | Token `SERVICIO` | No (se envía en segundo plano) |
| Usuarios | Servidor SMTP | Correo con credenciales y avisos | Configuración `SMTP_*` | No (sin SMTP se simula en el log) |

Reservas guarda en caché 60 segundos la estructura y los precios de una sala.

## Reglas de cuentas y perfil

- Nombre de usuario: `^[a-z0-9][a-z0-9._-]{3,29}$`. Por empezar con letra o número, un comando de desarrollo (que empieza con `/`) jamás es un usuario válido. No se admiten nombres reservados (admin, operador, soporte…).
- Registro: el sistema asigna un usuario único y envía las credenciales por correo. El cliente puede elegir un usuario propio con el token `setup`, una sola vez y antes del primer ingreso.
- Edición propia (`PUT /clientes/me`): nombres, apellido, nacionalidad, teléfono, dirección y correo. El DNI, el usuario y el rol no se pueden cambiar por esta vía (`CAMPO_NO_EDITABLE`).
- Edición por el administrador (`PUT /usuarios/:id`): cualquier dato personal, rol y contraseña nueva sin pedir la anterior. No puede cambiar su propio rol.
- Cambio de contraseña propio: actual + nueva + confirmación.
- El DNI y el correo son únicos (`DNI_DUPLICADO`, `CORREO_DUPLICADO`).

## Formato de error (los tres servicios)

```json
{ "status": 409, "code": "ASIENTO_NO_DISPONIBLE", "message": "…", "details": [], "path": "/api/v1/reservas", "timestamp": "2026-10-24T17:00:00Z" }
```

| HTTP | Significado | Códigos frecuentes |
|:---:|---|---|
| `400` | Validación | `VALIDACION`, `GRANT_NO_SOPORTADO` |
| `401` | Sin token, token inválido o credenciales incorrectas | `NO_AUTENTICADO`, `TOKEN_INVALIDO`, `CREDENCIALES_INVALIDAS`, `CLIENTE_INVALIDO` |
| `403` | Rol o cuenta sin permiso | `SIN_PERMISO`, `CUENTA_INACTIVA`, `CAMPO_NO_EDITABLE`, `CONFIGURACION_CERRADA` |
| `404` | No existe | `NO_ENCONTRADO`, `BOLETO_NO_ENCONTRADO`, `SIN_FOTO`, `SIN_IMAGEN` |
| `409` | Conflicto | `ASIENTO_NO_DISPONIBLE`, `FUNCION_SOLAPADA`, `BOLETO_YA_USADO`, `DNI_DUPLICADO`, `CORREO_DUPLICADO`, `USERNAME_EN_USO` |
| `413` | Archivo demasiado grande | `ARCHIVO_MUY_GRANDE` |
| `415` | Falta o no se reconoce la imagen | `IMAGEN_REQUERIDA` |
| `422` | Regla de negocio | `LIMITE_BOLETOS`, `ASIENTOS_REPETIDOS`, `ASIENTO_INVALIDO`, `ASIENTO_BLOQUEADO`, `FUNCION_NO_DISPONIBLE`, `FUNCION_INICIADA`, `RESERVA_EXPIRADA`, `ESTADO_INVALIDO`, `RESERVA_UTILIZADA`, `QR_INVALIDO`, `BOLETO_ANULADO`, `RESERVA_NO_VALIDA`, `HORARIO_INVALIDO`, `PELICULA_NO_HABILITADA`, `SALA_NO_DISPONIBLE`, `USERNAME_RESERVADO`, `ROL_INVALIDO`, `IMAGEN_INVALIDA`, `RANGO_INVALIDO`, `REGLA_NEGOCIO` |
| `429` | Demasiados intentos | `CUENTA_BLOQUEADA_TEMPORAL`, `DEMASIADOS_INTENTOS` |
| `502` · `503` | Servicio dependiente con error o no disponible | `ERROR_SERVICIO_EXTERNO`, `SERVICIO_NO_DISPONIBLE` |

## Convenciones

- Prefijo `/api/v1`, JSON en `snake_case`, dinero en USD con 2 decimales.
- `fecha` y `hora` de las funciones en **hora de Ecuador (UTC-5)**, sin zona horaria en la base; los timestamps de Usuarios y Reservas se guardan con zona y viajan en ISO 8601 UTC.
- Cada servicio expone `GET /health` y su Swagger en `/docs`.
- CORS: se aceptan los orígenes de `CORS_ORIGINS`; con `CORS_ALLOW_LAN=true` también los de red local (`192.168.x.x`, `10.x.x.x`, `172.16-31.x.x`, `*.local`). Fuera de la demostración debe estar en `false`.
- Los valores por defecto de las columnas (`estado`, fechas de creación) los pone el código de cada servicio, no la base de datos.

## Reglas de negocio y quién las aplica

| Regla | Dónde se valida |
|---|---|
| Máximo 6 boletos por compra, una sola función por reserva | Reservas (`LIMITE_BOLETOS`) |
| Un asiento no puede reservarse dos veces en la misma función | Reservas: bloqueo transaccional de filas + índice único `(funcion_id, asiento_id)` |
| No se reservan asientos bloqueados por mantenimiento | Reservas (`ASIENTO_BLOQUEADO`), con el estado físico que entrega Películas |
| Total = suma de precios de las secciones | Reservas, con precios obtenidos de Películas |
| Reserva sin confirmar en 5 min (`RESERVA_TTL_SECONDS`, 300 s) → expirada y asientos liberados | Reservas (tarea cada 15 s + verificación al leer) |
| Sin funciones solapadas en una sala (con 15 min de limpieza) | Películas (`FUNCION_SOLAPADA`) |
| Cancelar una función cancela sus reservas `PENDIENTE` y `CONFIRMADA` | Películas avisa; Reservas cancela y libera |
| Boleto con QR único, un solo uso | Reservas (token firmado con HMAC) |
| Editar una película no altera funciones, reservas ni boletos existentes | Películas |
| El operador no gestiona operadores ni administradores | Usuarios |
| Cuentas inactivas no inician sesión | Usuarios |
| Toda acción del personal queda auditada | Usuarios recibe eventos de Películas y Reservas |

## Cambios respecto a la versión anterior

- Se agregó la tabla de servicios, puertos y bases, y cómo llega el frontend a cada uno (HTTP directo y HTTPS por Nginx).
- Se documentaron `cliente_foto`, `pelicula_imagen`, `reserva.gestionado_por`, `boleto.etiqueta` y `boleto.seccion_tipo`.
- Se agregaron los estados `INACTIVA` y `RETIRADA` de película, el estado físico del asiento y las acciones `CANCELAR` y `VALIDAR` de auditoría.
- Se agregaron el ciclo de vida de la reserva, los tipos y duración de los tokens, la matriz de permisos por rol y la tabla de comunicación entre servicios.
- El formato de error ahora lista los códigos reales de cada código HTTP.
