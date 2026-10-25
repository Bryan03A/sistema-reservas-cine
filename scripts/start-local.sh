#!/usr/bin/env bash
# Arranca los 3 microservicios SIN Docker. Requisitos: Node 20+, Python 3.11+ y PostgreSQL con 3 bases
# (db_usuarios, db_peliculas, db_reservas). Uso:  ./scripts/start-local.sh   |   ./scripts/start-local.sh stop
# Variables opcionales: PG_BASE (usuario:clave@host:puerto), PYTHON_BIN, RESERVA_TTL_SECONDS, LOGS_DIR
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOGS="${LOGS_DIR:-/tmp/cine-logs}"; mkdir -p "$LOGS"
PG="${PG_BASE:-postgres:postgres@localhost:5432}"
PY="${PYTHON_BIN:-$ROOT/backend/peliculas/.venv/bin/python}"

stop_all() {
  for p in $(pgrep -f "node src/server.js"); do kill "$p" 2>/dev/null; done
  pkill -f "uvicorn app.main:app" 2>/dev/null
  echo "servicios detenidos"
}
[ "${1:-}" = "stop" ] && { stop_all; exit 0; }

# lanza un proceso totalmente desacoplado de la terminal: launch <carpeta> <log> <comando...>
launch() { local dir="$1" log="$2"; shift 2; ( cd "$dir" && exec setsid nohup "$@" ) > "$log" 2>&1 < /dev/null & }

COMMON=(JWT_ISSUER=cine-usuarios USUARIOS_URL=http://localhost:3001 PELICULAS_URL=http://localhost:3002 RESERVAS_URL=http://localhost:3003 RESERVA_TTL_SECONDS="${RESERVA_TTL_SECONDS:-300}")
launch "$ROOT/backend/usuarios"  "$LOGS/usuarios.log"  env "${COMMON[@]}" DATABASE_URL="postgres://$PG/db_usuarios" KEYS_DIR="$ROOT/backend/usuarios/keys" PORT=3001 node src/server.js
sleep 2
launch "$ROOT/backend/peliculas" "$LOGS/peliculas.log" env "${COMMON[@]}" DATABASE_URL="postgresql+psycopg2://$PG/db_peliculas" PORT=3002 "$PY" -m uvicorn app.main:app --port 3002
launch "$ROOT/backend/reservas"  "$LOGS/reservas.log"  env "${COMMON[@]}" DATABASE_URL="postgres://$PG/db_reservas" PORT=3003 node src/server.js
echo "Servicios iniciando. Logs en $LOGS. Swagger: http://localhost:3001/docs  :3002/docs  :3003/docs"
