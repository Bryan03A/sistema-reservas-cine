// Llamadas REST a los otros microservicios: Películas (estructura, funciones) y Usuarios (auditoría).
import { config } from './config.js';
import { AppError } from './errors.js';

let svc = { value: null, exp: 0 };
async function serviceToken() {
  if (svc.value && Date.now() < svc.exp) return svc.value;
  const res = await fetch(`${config.usuariosUrl}/api/v1/oauth/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(4000),
    body: JSON.stringify({ grant_type: 'client_credentials', client_id: config.serviceClientId, client_secret: config.serviceClientSecret }),
  });
  if (!res.ok) throw new Error(`token de servicio: HTTP ${res.status}`);
  svc = { value: (await res.json()).access_token, exp: Date.now() + 14 * 60000 };
  return svc.value;
}

async function peliculas(path, token) {
  let res;
  try {
    res = await fetch(`${config.peliculasUrl}/api/v1${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {}, signal: AbortSignal.timeout(6000) });
  } catch {
    throw new AppError(503, 'SERVICIO_NO_DISPONIBLE', 'El microservicio de Películas no responde');
  }
  if (res.status === 404) throw new AppError(404, 'NO_ENCONTRADO', 'La función no existe en Películas');
  if (!res.ok) throw new AppError(502, 'ERROR_SERVICIO_EXTERNO', `Películas respondió HTTP ${res.status}`);
  return res.json();
}

// --- Caché breve de estructura de sala (la sala no cambia entre funciones; precios cambian poco)
const cache = new Map();
const TTL = 60000;
const getCache = (k) => { const c = cache.get(k); return c && c.exp > Date.now() ? c.value : null; };
const setCache = (k, value) => cache.set(k, { value, exp: Date.now() + TTL });

export async function getEstructura(funcionId, token) {
  const hit = getCache(`f:${funcionId}`);
  if (hit) return hit;
  const est = await peliculas(`/funciones/${funcionId}/estructura`, token);
  setCache(`f:${funcionId}`, est);
  setCache(`s:${est.sala.id}`, est);
  return est;
}

// Estructura de la sala de una función conocida (reportes): reutiliza la caché de la sala
export async function getEstructuraDeFuncion(funcion, token) {
  return getCache(`s:${funcion.sala_id}`) ?? getEstructura(funcion.id, token);
}

export const listarFunciones = (query, token) => peliculas(`/funciones?${new URLSearchParams(query)}`, token);
export const detalleFunciones = async (ids, token) => (ids.length ? peliculas(`/internal/funciones/detalle?ids=${ids.join(',')}`, token) : []);

export function indexar(est) {
  const m = new Map();
  for (const s of est.secciones) for (const f of s.filas) for (const a of f.asientos) {
    m.set(a.id, { id: a.id, etiqueta: a.etiqueta, estadoFisico: a.estado, seccion_id: s.id, seccion: s.nombre, tipo: s.tipo, precio: s.precio });
  }
  return m;
}

// Auditoría hacia Usuarios: no bloquea ni rompe la operación si falla
export function audit(usuarioId, accion, entidad, entidadId, descripcion) {
  const uid = Number(usuarioId);
  if (!Number.isInteger(uid)) return;
  serviceToken()
    .then((t) => fetch(`${config.usuariosUrl}/api/v1/auditoria`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` }, signal: AbortSignal.timeout(5000),
      body: JSON.stringify({ usuario_id: uid, accion, entidad, entidad_id: entidadId ?? null, descripcion }),
    }))
    .catch((e) => console.log(`[reservas] auditoría no enviada: ${e.message}`));
}
