// Prueba de humo de punta a punta: node scripts/smoke.mjs
// Requiere los 3 servicios levantados. Para probar la expiración rápido: RESERVA_TTL_SECONDS=20 en Reservas.
const U = process.env.USUARIOS_URL || 'http://localhost:3001/api/v1';
const P = process.env.PELICULAS_URL || 'http://localhost:3002/api/v1';
const R = process.env.RESERVAS_URL || 'http://localhost:3003/api/v1';
const TTL = Number(process.env.RESERVA_TTL_SECONDS || 20);

let ok = 0, fail = 0;
const check = (name, cond, extra = '') => { cond ? ok++ : fail++; console.log(`${cond ? '  ✔' : '  ✘'} ${name}${cond ? '' : '  → ' + extra}`); };
const section = (t) => console.log(`\n${t}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(base, method, path, { token, body } = {}) {
  const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, body: json };
}
const login = async (username, password) => (await call(U, 'POST', '/oauth/token', { body: { grant_type: 'password', username, password } })).body;
const isoDate = (d) => d.toISOString().slice(0, 10);

section('1. Servicios y autenticación');
for (const [n, b] of [['usuarios', U], ['peliculas', P], ['reservas', R]]) {
  const h = await fetch(b.replace('/api/v1', '') + '/health').then((r) => r.json()).catch(() => null);
  check(`${n} responde /health`, h?.estado === 'ok');
}
const admin = await login('admin', 'Admin123*');
const oper = await login('operador', 'Operador123*');
const c1 = await login('cliente1', 'Cliente123*');
const c2 = await login('cliente2', 'Cliente123*');
check('login de los 4 usuarios semilla (JWT RS256)', [admin, oper, c1, c2].every((x) => x.access_token));
check('el token lleva rol y cliente_id', c1.rol === 'CLIENTE' && c1.cliente_id === 3);
check('credenciales incorrectas → 401', (await call(U, 'POST', '/oauth/token', { body: { grant_type: 'password', username: 'admin', password: 'mala' } })).status === 401);
check('sin token → 401 en Reservas', (await call(R, 'GET', '/reservas/mis-reservas')).status === 401);
check('token falso → 401 en Películas', (await call(P, 'GET', '/funciones/1/estructura', { token: 'abc.def.ghi' })).status === 401);
const reg = await call(U, 'POST', '/auth/register', { body: { primer_nombre: 'Prueba', apellido: 'Smoke', dni: String(1800000000 + Math.floor(Math.random() * 99999999)), correo: `smoke${Date.now()}@correo.test` } });
check('registro de cliente genera usuario y contraseña', reg.status === 201 && reg.body.credenciales_demo?.username, JSON.stringify(reg.body));
const nuevo = reg.body.credenciales_demo && await login(reg.body.credenciales_demo.username, reg.body.credenciales_demo.password);
check('el cliente recién registrado puede iniciar sesión', !!nuevo?.access_token);
check('cliente no puede listar usuarios → 403', (await call(U, 'GET', '/usuarios', { token: c1.access_token })).status === 403);
const crearAdmin = await call(U, 'POST', '/usuarios', { token: oper.access_token, body: { rol: 'ADMINISTRADOR', primer_nombre: 'X', apellido: 'Y', dni: '1999999999', correo: 'x@y.test' } });
check('operador no puede crear administradores → 403', crearAdmin.status === 403, JSON.stringify(crearAdmin.body));

section('2. Cartelera y funciones (Películas)');
const peliculas = (await call(P, 'GET', '/peliculas')).body;
check('cartelera pública con películas activas', peliculas.length >= 3);
check('filtro por género', (await call(P, 'GET', '/peliculas?genero=drama')).body.every((p) => p.genero === 'Drama'));
const nombres = async (q) => (await call(P, 'GET', `/peliculas?${q}`)).body.map((p) => p.nombre);
check('búsqueda sin tildes: "codigo cuantico" encuentra «Código Cuántico»', (await nombres('nombre=codigo%20cuantico')).includes('Código Cuántico'));
check('búsqueda con mayúsculas y tildes: "CÓDIGO" también', (await nombres('nombre=C%C3%93DIGO')).includes('Código Cuántico'));
check('"ultimo faro" encuentra «El Último Faro»', (await nombres('nombre=ultimo%20faro')).includes('El Último Faro'));
check('género sin tilde: "animacion"', (await nombres('genero=animacion')).includes('Los Guardianes del Bosque'));
check('nombre con tilde encuentra sin tilde: "Código" → "codigo"', (await nombres('nombre=C%C3%B3digo')).length === 1);
const buscaU = async (q) => (await call(U, 'GET', `/usuarios?q=${encodeURIComponent(q)}`, { token: admin.access_token })).body.map((u) => u.username);
check('usuarios: "perez" encuentra a Luis Pérez', (await buscaU('perez')).includes('cliente2'));
check('usuarios: "MARIA" encuentra a Ana María Torres', (await buscaU('MARIA')).includes('cliente1'));
const manana = isoDate(new Date(Date.now() - 5 * 3600000 + 86400000));
const funciones = (await call(P, 'GET', `/funciones?fecha=${manana}`)).body;
check('funciones del día siguiente', funciones.length >= 4);
const F = funciones[0];
const est = (await call(P, 'GET', `/funciones/${F.id}/estructura`, { token: c1.access_token })).body;
check('estructura: 48 asientos y precios VIP 15 / DBOX 10 / GENERAL 5', est.total_asientos === 48 && est.secciones.map((s) => s.precio).join() === '15,10,5');

section('3. Reserva con bloqueo de asientos (Reservas ↔ Películas)');
const disp = async (token = c1.access_token) => (await call(R, 'GET', `/funciones/${F.id}/asientos`, { token })).body;
let mapa = await disp();
const libres = (tipo) => mapa.asientos.filter((a) => a.estado === 'DISPONIBLE' && a.tipo === tipo);
const [g1, g2, g3, g4] = libres('GENERAL');
const vip = libres('VIP')[0];
const r1 = await call(R, 'POST', '/reservas', { token: c1.access_token, body: { funcion_id: F.id, asiento_ids: [g1.asiento_id, vip.asiento_id] } });
check('crear reserva → 201 PENDIENTE', r1.status === 201 && r1.body.estado === 'PENDIENTE', JSON.stringify(r1.body));
check('total calculado en el servidor (5 + 15 = 20)', r1.body.total === 20);
check('expira en ~TTL segundos', r1.body.segundos_restantes > TTL - 5 && r1.body.segundos_restantes <= TTL);
mapa = await disp();
check('los asientos pasan a RESERVADO y son "míos" para el cliente', mapa.asientos.find((a) => a.asiento_id === g1.asiento_id)?.estado === 'RESERVADO' && mapa.asientos.find((a) => a.asiento_id === g1.asiento_id)?.mio);
const visto2 = await disp(c2.access_token);
check('otro cliente ve esos asientos RESERVADO (no míos)', visto2.asientos.find((a) => a.asiento_id === g1.asiento_id)?.estado === 'RESERVADO' && !visto2.asientos.find((a) => a.asiento_id === g1.asiento_id)?.mio);
const dup = await call(R, 'POST', '/reservas', { token: c2.access_token, body: { funcion_id: F.id, asiento_ids: [g1.asiento_id] } });
check('mismo asiento por otro cliente → 409', dup.status === 409 && dup.body.code === 'ASIENTO_NO_DISPONIBLE');
const siete = await call(R, 'POST', '/reservas', { token: c2.access_token, body: { funcion_id: F.id, asiento_ids: libres('GENERAL').slice(0, 7).map((a) => a.asiento_id) } });
check('7 boletos → 422 LIMITE_BOLETOS', siete.status === 422 && siete.body.code === 'LIMITE_BOLETOS');
check('asiento de otra sala → 422', (await call(R, 'POST', '/reservas', { token: c2.access_token, body: { funcion_id: F.id, asiento_ids: [999999] } })).status === 422);

section('4. Concurrencia: dos clientes, el mismo asiento, al mismo tiempo');
const [a, b] = await Promise.all([c1, c2].map((c) => call(R, 'POST', '/reservas', { token: c.access_token, body: { funcion_id: F.id, asiento_ids: [g2.asiento_id] } })));
const estados = [a.status, b.status].sort().join();
check('exactamente una reserva gana (201) y la otra recibe 409', estados === '201,409', estados);
const ganadora = a.status === 201 ? a : b;
const clienteGanador = a.status === 201 ? c1 : c2;

section('5. Confirmación, boletos con QR y control de acceso');
check('otro cliente no puede confirmar mi reserva → 403', (await call(R, 'POST', `/reservas/${r1.body.id}/confirmar`, { token: c2.access_token })).status === 403);
const conf = await call(R, 'POST', `/reservas/${r1.body.id}/confirmar`, { token: c1.access_token });
check('confirmar → CONFIRMADA con un boleto por asiento', conf.status === 200 && conf.body.estado === 'CONFIRMADA' && conf.body.boletos.length === 2, JSON.stringify(conf.body).slice(0, 200));
const tokens = conf.body.boletos.map((x) => x.codigo_qr);
check('cada boleto tiene un QR único (imagen PNG) y firmado', new Set(tokens).size === 2 && conf.body.boletos.every((x) => x.qr_data_url.startsWith('data:image/png;base64,')));
check('confirmar dos veces → 422', (await call(R, 'POST', `/reservas/${r1.body.id}/confirmar`, { token: c1.access_token })).status === 422);
mapa = await disp();
check('los asientos confirmados quedan OCUPADO', mapa.asientos.find((x) => x.asiento_id === g1.asiento_id).estado === 'OCUPADO');
check('cliente ajeno no ve mi reserva → 403', (await call(R, 'GET', `/reservas/${r1.body.id}`, { token: c2.access_token })).status === 403);
const qrPng = await fetch(`${R}/boletos/${conf.body.boletos[0].id}/qr.png`, { headers: { Authorization: `Bearer ${c1.access_token}` } });
check('GET /boletos/:id/qr.png devuelve imagen', qrPng.headers.get('content-type') === 'image/png');
check('cliente no puede validar boletos → 403', (await call(R, 'POST', '/boletos/validar', { token: c1.access_token, body: { codigo: tokens[0] } })).status === 403);
check('QR adulterado → 422', (await call(R, 'POST', '/boletos/validar', { token: oper.access_token, body: { codigo: tokens[0].slice(0, -3) + 'xyz' } })).status === 422);
const v1 = await call(R, 'POST', '/boletos/validar', { token: oper.access_token, body: { codigo: tokens[0] } });
check('el operador valida el boleto → 200', v1.status === 200 && v1.body.valido === true);
check('el mismo boleto no entra dos veces → 409', (await call(R, 'POST', '/boletos/validar', { token: oper.access_token, body: { codigo: tokens[0] } })).status === 409);
const v2 = await call(R, 'POST', '/boletos/validar', { token: oper.access_token, body: { codigo: tokens[1] } });
const det = await call(R, 'GET', `/reservas/${r1.body.id}`, { token: c1.access_token });
check('con todos los boletos usados la reserva pasa a USADA', v2.status === 200 && det.body.estado === 'USADA');
check('no se puede cancelar una reserva utilizada → 422', (await call(R, 'POST', `/reservas/${r1.body.id}/cancelar`, { token: c1.access_token })).status === 422);

section('6. Cancelación y reserva a nombre de un cliente (personal)');
const conf2 = await call(R, 'POST', `/reservas/${ganadora.body.id}/confirmar`, { token: clienteGanador.access_token });
check('la reserva ganadora se confirma', conf2.status === 200);
const canc = await call(R, 'POST', `/reservas/${ganadora.body.id}/cancelar`, { token: clienteGanador.access_token });
check('cancelar reserva confirmada → CANCELADA', canc.status === 200 && canc.body.estado === 'CANCELADA');
mapa = await disp();
check('los asientos se liberan al cancelar', mapa.asientos.find((x) => x.asiento_id === g2.asiento_id).estado === 'DISPONIBLE');
check('cancelar de nuevo → 422', (await call(R, 'POST', `/reservas/${ganadora.body.id}/cancelar`, { token: clienteGanador.access_token })).status === 422);
const porStaff = await call(R, 'POST', '/reservas', { token: oper.access_token, body: { funcion_id: F.id, asiento_ids: [g3.asiento_id], cliente_id: 4 } });
check('el operador reserva a nombre del cliente 4 y queda registrado quién la gestionó', porStaff.status === 201 && porStaff.body.cliente_id === 4 && porStaff.body.gestionado_por === oper.usuario_id, JSON.stringify(porStaff.body));
check('un cliente no puede reservar a nombre de otro → 403', (await call(R, 'POST', '/reservas', { token: c1.access_token, body: { funcion_id: F.id, asiento_ids: [g4.asiento_id], cliente_id: 4 } })).status === 403);
await call(R, 'POST', `/reservas/${porStaff.body.id}/cancelar`, { token: oper.access_token });

section(`7. Expiración automática (TTL de ${TTL} s)`);
const rexp = await call(R, 'POST', '/reservas', { token: c1.access_token, body: { funcion_id: F.id, asiento_ids: [g4.asiento_id] } });
check('reserva pendiente creada', rexp.status === 201);
process.stdout.write(`  … esperando ${TTL + 2} s a que expire\n`);
await sleep((TTL + 2) * 1000);
mapa = await disp();
check('pasado el plazo, el asiento vuelve a DISPONIBLE', mapa.asientos.find((x) => x.asiento_id === g4.asiento_id).estado === 'DISPONIBLE');
const tarde = await call(R, 'POST', `/reservas/${rexp.body.id}/confirmar`, { token: c1.access_token });
check('confirmar tarde → 422 RESERVA_EXPIRADA', tarde.status === 422 && tarde.body.code === 'RESERVA_EXPIRADA', JSON.stringify(tarde.body));
check('la reserva quedó EXPIRADA', (await call(R, 'GET', `/reservas/${rexp.body.id}`, { token: c1.access_token })).body.estado === 'EXPIRADA');

section('8. Reportes');
const hoy = isoDate(new Date(Date.now() - 5 * 3600000));
const rc = await call(R, 'GET', `/reportes/cliente/${c1.cliente_id}`, { token: c1.access_token });
check('reporte individual del cliente con su historial', rc.status === 200 && rc.body.total_reservas >= 3 && rc.body.por_estado.USADA >= 1, JSON.stringify(rc.body).slice(0, 200));
check('un cliente no puede ver el historial de otro → 403', (await call(R, 'GET', `/reportes/cliente/${c2.cliente_id}`, { token: c1.access_token })).status === 403);
check('filtro por función en el reporte individual', (await call(R, 'GET', `/reportes/cliente/${c1.cliente_id}?funcion_id=${F.id}`, { token: c1.access_token })).body.reservas.every((x) => x.funcion.id === F.id));
const rg = await call(R, 'GET', `/reportes/general?desde=${hoy}&hasta=${manana}`, { token: admin.access_token });
check('reporte general consolidado (rango de fechas)', rg.status === 200 && rg.body.funciones.length >= 6, JSON.stringify(rg.body).slice(0, 200));
const fRep = rg.body.funciones.find((x) => x.funcion_id === F.id);
mapa = await disp();
check('ocupados del reporte = asientos OCUPADO del mapa', fRep.ocupados === mapa.resumen.OCUPADO, `${fRep.ocupados} vs ${mapa.resumen.OCUPADO}`);
check('capacidad = disponibles + ocupados + reservados', fRep.capacidad === fRep.disponibles + fRep.ocupados + fRep.reservados);
check('el reporte desglosa secciones y estados', fRep.secciones.length === 3 && Object.keys(fRep.reservas_por_estado).length === 5);
check('suma de estados = total de reservas', Object.values(rg.body.por_estado).reduce((s, n) => s + n, 0) === rg.body.total_reservas);
check('cliente no puede ver el reporte general → 403', (await call(R, 'GET', `/reportes/general?desde=${hoy}&hasta=${manana}`, { token: c1.access_token })).status === 403);
check('rango inválido → 422', (await call(R, 'GET', `/reportes/general?desde=${manana}&hasta=${hoy}`, { token: admin.access_token })).status === 422);

section('9. Integraciones entre microservicios');
const nf = await call(P, 'POST', '/funciones', { token: oper.access_token, body: { pelicula_id: 3, sala_id: 2, fecha: manana, hora_inicio: '10:00:00' } });
check('Películas: el operador programa una función nueva', nf.status === 201, JSON.stringify(nf.body));
const asN = (await call(R, 'GET', `/funciones/${nf.body.id}/asientos`, { token: c2.access_token })).body.asientos[0];
const rN = await call(R, 'POST', '/reservas', { token: c2.access_token, body: { funcion_id: nf.body.id, asiento_ids: [asN.asiento_id] } });
check('Reservas consulta a Películas y reserva en la función nueva', rN.status === 201);
await call(P, 'PATCH', `/funciones/${nf.body.id}/cancelar`, { token: oper.access_token });
await sleep(1500);
check('Películas → Reservas: al cancelar la función se cancelan sus reservas', (await call(R, 'GET', `/reservas/${rN.body.id}`, { token: c2.access_token })).body.estado === 'CANCELADA');
const aud = (await call(U, 'GET', '/auditoria?limit=50', { token: admin.access_token })).body;
check('Usuarios recibe auditoría de Películas (CREAR funcion)', aud.some((x) => x.entidad === 'funcion' && x.accion === 'CREAR'));
check('Usuarios recibe auditoría de Reservas (VALIDAR boleto)', aud.some((x) => x.entidad === 'boleto' && x.accion === 'VALIDAR'));
check('operador no accede a la auditoría → 403', (await call(U, 'GET', '/auditoria', { token: oper.access_token })).status === 403);
const off = await call(U, 'PATCH', `/usuarios/${reg.body.usuario_id}/estado`, { token: admin.access_token, body: { estado: 'INACTIVO' } });
check('el administrador desactiva una cuenta', off.status === 200);
check('la cuenta desactivada ya no inicia sesión (403)', (await call(U, 'POST', '/oauth/token', { body: { grant_type: 'password', username: reg.body.credenciales_demo.username, password: reg.body.credenciales_demo.password } })).status === 403);

console.log(`\nResultado: ${ok} correctas, ${fail} fallidas`);
process.exit(fail ? 1 : 0);
