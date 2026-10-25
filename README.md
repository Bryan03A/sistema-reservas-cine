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

## Usuarios de demostración
| Usuario | Contraseña | Rol |
|---|---|---|
| `admin` | `Admin123*` | Administrador |
| `operador` | `Operador123*` | Operador |
| `cliente1` | `Cliente123*` | Cliente |
| `cliente2` | `Cliente123*` | Cliente |

## Probar el flujo completo (3 minutos)
1. Abre http://localhost:5173, elige el día «Mañana» y una función.
2. Ingresa como `cliente1` (botones de demostración en la pantalla de ingreso).
3. Elige hasta 6 asientos en el mapa y pulsa **Reservar**. Tienes 5 minutos (cuenta regresiva) para **Confirmar**.
4. Se emiten los boletos con QR. Mira «Mis reservas» (reporte individual).
5. Abre **Llamadas API** (abajo a la derecha) para evidenciar el consumo de cada microservicio, o la pestaña **Conexiones**.
6. Con `operador` valida un boleto (Panel → Validar boletos), revisa Reservas y el Reporte general por rango de fechas.
7. Con `admin` gestiona usuarios (activar/desactivar) y revisa la Auditoría.

## Pruebas automáticas
```bash
RESERVA_TTL_SECONDS=20 ./scripts/start-local.sh   # TTL corto para probar la expiración
node scripts/smoke.mjs                            # 66 comprobaciones de punta a punta (requiere Node 18+)
```
Prueba de interfaz (navegador simulado, recorre cliente, operador y administrador; 33 comprobaciones):
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
| Reporte individual y reporte general con rango de fechas | Hecho |
| Auditoría de acciones del personal | Hecho |
| Semillas por servicio y scripts SQL de respaldo | Hecho |
| Frontend en React | **Pendiente**: el actual es HTML+JS sin compilación, pensado para probar conexiones; consume los mismos contratos |
| Diagrama ER final | **Pendiente de actualizar** con los ajustes de abajo |
| DevSecOps (GitHub Actions: lint y auditoría de dependencias) | Pendiente |
| Pruebas unitarias por servicio | Pendiente (hay pruebas de integración) |
| Recuperación de contraseña, paginación, HTTPS | Pendiente |

## Ajustes respecto al ER original (actualiza el diagrama)
- `asiento.estado` (`ACTIVO`/`BLOQUEADO`): bloqueo físico por mantenimiento.
- `reserva.gestionado_por`: usuario del personal que creó la reserva a nombre de un cliente.
- `boleto.etiqueta` y `boleto.seccion_tipo`: copia de datos del asiento para mostrar el boleto sin depender de Películas.
- `boleto.asiento_funcion_id`: la unicidad es **parcial** (solo boletos no anulados), si no un asiento cancelado no podría volver a venderse.
- Administrador y operador también tienen registro en `cliente` (datos personales obligatorios para todos los usuarios).
- Estados de asiento por función: `DISPONIBLE`, `RESERVADO`, `OCUPADO` (los del enunciado) en lugar de `BLOQUEADO`/`VENDIDO`.

## Limitaciones conocidas
- Las contraseñas se guardan con **bcrypt** (hash). El enunciado menciona AES256 como ejemplo: confirma con el docente cuál exige.
- Al desactivar una cuenta, Usuarios la bloquea de inmediato; Películas y Reservas la reconocen hasta que expire el token (1 h).
- Las funciones de la semilla se generan para 4 días desde el primer arranque. Para crear más: `POST /api/v1/funciones/generar-demo` (administrador) en el Swagger de Películas.
- Los valores por defecto (`estado`, fechas de creación) los pone el código de cada servicio, no la base: si insertas filas a mano en SQL, indica esas columnas.
- Cambia `QR_SECRET`, `*_CLIENT_SECRET` y `DEMO_MODE` antes de cualquier uso fuera de demostración.

## Estructura
```
backend/usuarios   Node: model/entities, routes, security (JWKS), seed
backend/peliculas  Python: model/entities, routes, security, seed
backend/reservas   Node: model/entities, servicio.js (reglas), reportes.js, seed
frontend           index.html, app.js, styles.css, config.js
sql                respaldo: crea y puebla cada base (generados desde las semillas)
scripts            start-local.sh, smoke.mjs
docs               contrato.md (contrato común entre servicios)
```
