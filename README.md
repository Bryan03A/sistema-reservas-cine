# Cine Andino: sistema de reservas de películas (demo funcional)

Aplicación distribuida con **3 microservicios heterogéneos**, una base PostgreSQL por servicio y un frontend. Es un solo programa: los servicios se validan tokens entre sí, comparten un contrato (`docs/contrato.md`) y el frontend los consume por REST.

```
                     ┌──────────────── Frontend (5173) ────────────────┐
                     │  HTML + JS: cartelera, mapa de asientos, QR,    │
                     │  panel del personal, reportes                   │
                     └──────┬───────────────┬───────────────┬──────────┘
                            ▼               ▼               ▼
              ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
              │ Usuarios 3001   │  │ Películas 3002  │  │ Reservas 3003   │
              │ Node + Express  │  │ Python+FastAPI  │  │ Node + Express  │
              │ OAuth2 · JWT    │◄─┤ JWKS, auditoría │◄─┤ JWKS, auditoría │
              │ roles · auditoría│  │ funciones, salas│──►│ estructura/precios│
              └───────┬─────────┘  └───────┬─────────┘  └───────┬─────────┘
                 db_usuarios           db_peliculas          db_reservas
```

## Ejecutar con Docker (recomendado)
```bash
cp .env.example .env
docker compose up --build
```
- Aplicación: http://localhost:5173
- Swagger: http://localhost:3001/docs · http://localhost:3002/docs · http://localhost:3003/docs

> Los `Dockerfile` y `docker-compose.yml` están escritos pero **no pude ejecutarlos en el entorno donde generé el demo** (no tenía Docker). La lógica sí se probó ejecutando los servicios directamente. Si algo falla al construir, dime el mensaje y lo corregimos.

## Ejecutar sin Docker
Requisitos: Node 20+, Python 3.11+ y PostgreSQL con tres bases vacías: `db_usuarios`, `db_peliculas`, `db_reservas`.
```bash
cd backend/usuarios  && npm install && cd ../reservas && npm install && cd ..
cd peliculas && python -m venv .venv && .venv/bin/pip install -r requirements.txt && cd ../..
PG_BASE=usuario:clave@localhost:5432 ./scripts/start-local.sh      # arranca los 3 servicios
cd frontend && python -m http.server 5173                         # sirve el frontend
./scripts/start-local.sh stop                                     # detiene los servicios
```
Al arrancar por primera vez, cada servicio crea sus tablas y carga su **archivo semilla** (`seed.js` / `seed.py`).
Si la semilla falla, usa los scripts de respaldo de `sql/` (crean y pueblan cada base).

## Usuarios de demostración y acceso de desarrollo
La pantalla de ingreso **no muestra** accesos de demostración. Quien conoce el comando secreto lo escribe en el campo **Usuario** y pulsa «Ingresar»: aparecen botones para entrar como administrador, operador o cliente.

- El comando se define en el servicio de Usuarios (`DEV_ACCESS_COMMAND`, por defecto `/dev`). **Cámbialo en tu `.env`.**
- Empieza con `/`, así que nunca puede ser un nombre de usuario válido (los usuarios deben empezar con letra o número).
- Con un comando incorrecto la respuesta es idéntica a un login fallido (no revela que la función existe) y se bloquea tras 5 intentos.
- Las cuentas y contraseñas no están en el código del frontend: las entrega el servidor solo si el comando es correcto. Con `DEMO_MODE=false` la función se desactiva por completo (úsalo fuera de desarrollo).

| Usuario | Contraseña | Rol |
|---|---|---|
| `admin` | `Admin123*` | Administrador |
| `operador` | `Operador123*` | Operador |
| `cliente1` | `Cliente123*` | Cliente |
| `cliente2` | `Cliente123*` | Cliente |

## Probar el flujo completo (3 minutos)
1. Abre http://localhost:5173, elige el día «Mañana» y una función.
2. Ingresa como `cliente1` (escribe el comando de desarrollo en «Usuario» para ver los accesos, o usa tu propia cuenta).
3. Elige hasta 6 asientos en el mapa y pulsa **Reservar**. Tienes 5 minutos (cuenta regresiva) para **Confirmar**.
4. Se emiten los boletos con QR. Mira «Mis reservas» (reporte individual).
5. Con `operador` valida un boleto (Panel → Validar boletos), escribiendo el código o **escaneando el QR con la cámara**. Revisa también Reservas y el Reporte general por rango de fechas.
6. Con `admin` gestiona usuarios (activar/desactivar) y revisa la Auditoría. Solo el administrador ve el botón **Llamadas API** (abajo a la derecha, evidencia el consumo de cada microservicio) y la pestaña **Conexiones**.

## Cuentas, perfil y foto
- **Registro:** el sistema crea la cuenta con un usuario único asignado y envía las credenciales al correo. Justo después se ofrece **elegir un nombre de usuario propio** (4 a 30 caracteres; no se aceptan nombres reservados ni ocupados). Si el cliente cancela, conserva el asignado. Solo se puede elegir antes del primer ingreso y durante 15 minutos (token de configuración de un solo propósito). Al elegir otro se envía un aviso al correo.
- **Foto de perfil (opcional):** se puede subir al registrarse y luego editarla. Si no hay foto, la barra muestra las iniciales (Bryan Aguirre → **BA**). La imagen se reduce en el navegador (256×256) y se guarda en PostgreSQL.
- **Barra superior:** solo el nombre de usuario y un cuadro con la foto o las iniciales. Al hacer clic se abre un menú con el rol, **Editar perfil** y **Cerrar sesión**.
- **Editar perfil (cada usuario, solo el suyo):** nombre, segundo nombre, apellido, nacionalidad, teléfono, dirección, correo y foto. El **DNI está bloqueado**. El botón «Cambiar contraseña» abre otra ventana que pide la contraseña actual, la nueva y su confirmación.
- **Editar a cualquier persona (solo administrador):** Panel → Usuarios → **Editar** (junto a Desactivar). Puede cambiar datos, DNI, foto, **rol** (incluido Administrador) y fijar una **contraseña nueva sin pedir la anterior**. No puede cambiar su propio rol. El operador no puede editar a nadie.

## Pósters de películas
Los pósters se guardan en **PostgreSQL** (columna binaria en la tabla `pelicula_imagen`, separada de `pelicula` para que la cartelera no cargue los bytes). No hace falta otra base de datos: para un cine con decenas de películas es lo más simple, entra en los respaldos y es transaccional. Si algún día hubiera miles de imágenes, la alternativa es guardarlas en un almacenamiento de objetos (S3, MinIO) y dejar solo la URL en la base.
- Son **opcionales** al crear una película y se pueden agregar, cambiar o quitar después.
- El administrador y el operador pueden **editar título, descripción, género, duración, clasificación y póster** (Panel → Películas y funciones → Editar).
- Editar una película **no toca** funciones, reservas, asientos ni boletos: las funciones conservan su horario (no se recalcula con la nueva duración), las reservas siguen confirmadas y los boletos siguen siendo válidos. Lo único que cambia es el título que se muestra (útil para corregir errores).
- Formatos: JPG, PNG o WEBP, hasta 2 MB (fotos de perfil: 1 MB). Se valida el contenido real del archivo, no solo su extensión.

## Validar boletos con la cámara
En Panel → Validar boletos hay dos modos: **Ingresar código** y **Escanear con cámara**. Al leer un QR se valida de inmediato y se muestra el resultado.
- La cámara solo funciona en `localhost` o con `https` (regla de los navegadores). Si abres la app desde otro equipo con `http://IP`, usa el modo manual o publica con https.
- Chrome y Edge en Android o macOS usan el lector nativo del navegador; el resto (Firefox, Safari, Chrome en Windows o Linux) usa la librería jsQR, que va incluida en `frontend/vendor/` (Apache-2.0), así que **no necesita internet**. Si cambias el servidor del frontend, asegúrate de publicar también esa carpeta.
- Se apaga la cámara al cambiar de pantalla o al detener el escaneo.

## Búsquedas sin tildes
Todas las búsquedas ignoran tildes y mayúsculas: «codigo cuantico» encuentra «Código Cuántico». Aplica a la cartelera (nombre y género, filtrado en Películas), a la búsqueda `q` de usuarios (en Usuarios) y a los buscadores de las tablas del panel (usuarios, reservas, películas y auditoría).

## Pruebas automáticas
```bash
RESERVA_TTL_SECONDS=20 ./scripts/start-local.sh   # TTL corto para probar la expiración
node scripts/smoke.mjs                            # 130 comprobaciones de punta a punta (requiere Node 18+)
```
Prueba de interfaz (navegador simulado, recorre cliente, operador y administrador; 86 comprobaciones):
```bash
cd scripts && npm install && node ui-test.mjs
```
La prueba de humo cubre: login y roles, reglas de negocio (máx. 6, asiento duplicado, concurrencia de dos clientes por el mismo asiento), confirmación, QR firmado y de un solo uso, expiración, cancelación, reportes (con cruce de cifras) y las integraciones entre servicios (JWKS, auditoría, cancelación de función).

## Lo que ya está y lo que falta
| Requisito | Estado |
|---|---|
| Microservicios Usuarios, Películas y Reservas con REST y Swagger | Hecho |
| Auth OAuth 2.0 + JWT RS256 + roles (Administrador, Operador, Cliente) | Hecho |
| Registro con usuario y contraseña generados y envío por correo | Hecho (el correo real requiere configurar SMTP; sin SMTP se simula y, en modo demo, se muestra en pantalla) |
| Mapa de asientos, reserva (máx. 6), expiración a 5 min, boleto con QR por asiento | Hecho |
| Validación de boletos por código o con la cámara; búsquedas sin tildes | Hecho (la cámara real no pudo probarse en el entorno de desarrollo; sí se verificó que el lector decodifica los QR del sistema) |
| Reporte individual y reporte general con rango de fechas | Hecho |
| Auditoría de acciones del personal | Hecho |
| Semillas por servicio y scripts SQL de respaldo | Hecho |
| Frontend en React | **Pendiente**: el actual es HTML+JS sin compilación, pensado para probar conexiones; consume los mismos contratos |
| Diagrama ER final | **Pendiente de actualizar** con los ajustes de abajo |
| DevSecOps (GitHub Actions: lint y auditoría de dependencias) | Pendiente |
| Pruebas unitarias por servicio | Pendiente (hay pruebas de integración) |
| Recuperación de contraseña por correo (olvidé mi contraseña), paginación, HTTPS | Pendiente |

## Ajustes respecto al ER original (actualiza el diagrama)
- Tabla nueva `cliente_foto` (1 a 1 con `cliente`): foto de perfil (`contenido`, `tipo`, `version`).
- Tabla nueva `pelicula_imagen` (1 a 1 con `pelicula`): póster (`contenido`, `tipo`, `version`).
- `asiento.estado` (`ACTIVO`/`BLOQUEADO`): bloqueo físico por mantenimiento.
- `reserva.gestionado_por`: usuario del personal que creó la reserva a nombre de un cliente.
- `boleto.etiqueta` y `boleto.seccion_tipo`: copia de datos del asiento para mostrar el boleto sin depender de Películas.
- `boleto.asiento_funcion_id`: la unicidad es **parcial** (solo boletos no anulados), si no un asiento cancelado no podría volver a venderse.
- Administrador y operador también tienen registro en `cliente` (datos personales obligatorios para todos los usuarios).
- Estados de asiento por función: `DISPONIBLE`, `RESERVADO`, `OCUPADO` (los del enunciado) en lugar de `BLOQUEADO`/`VENDIDO`.

## Limitaciones conocidas
- Las contraseñas se guardan con **bcrypt** (hash). El enunciado menciona AES256 como ejemplo: confirma con el docente cuál exige.
- El cambio de correo del perfil no se verifica con un enlace de confirmación (queda para una siguiente etapa).
- Al desactivar una cuenta, Usuarios la bloquea de inmediato; Películas y Reservas la reconocen hasta que expire el token (1 h).
- Las funciones de la semilla se generan para 4 días desde el primer arranque. Para crear más: `POST /api/v1/funciones/generar-demo` (administrador) en el Swagger de Películas.
- Los valores por defecto (`estado`, fechas de creación) los pone el código de cada servicio, no la base: si insertas filas a mano en SQL, indica esas columnas.
- Cambia `QR_SECRET`, `*_CLIENT_SECRET` y `DEMO_MODE` antes de cualquier uso fuera de demostración.

## Estructura
```
backend/usuarios   Node: model/entities, routes, security (JWKS), seed
backend/peliculas  Python: model/entities, routes, security, seed
backend/reservas   Node: model/entities, servicio.js (reglas), reportes.js, seed
frontend           index.html, app.js, styles.css, config.js, vendor/ (jsQR para el escáner)
sql                respaldo: crea y puebla cada base (generados desde las semillas)
scripts            start-local.sh, smoke.mjs
docs               contrato.md (contrato común entre servicios)
```
