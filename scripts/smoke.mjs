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
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
async function raw(base, method, path, token, bytes, type) {
  const res = await fetch(base + path, { method, headers: { 'Content-Type': type, ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: bytes });
  const buf = Buffer.from(await res.arrayBuffer());
  let json; try { json = JSON.parse(buf.toString()); } catch { json = null; }
  return { status: res.status, type: res.headers.get('content-type'), etag: res.headers.get('etag'), buf, body: json };
}

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


section('10. Acceso de desarrollo, registro y elección de usuario');
const mal = await call(U, 'POST', '/auth/dev-access', { body: { comando: '/incorrecto' } });
check('comando de desarrollo incorrecto responde como un login fallido', mal.status === 401 && mal.body.code === 'CREDENCIALES_INVALIDAS');
const devOk = await call(U, 'POST', '/auth/dev-access', { body: { comando: '/dev' } });
check('el comando correcto devuelve las cuentas de demostración', devOk.status === 200 && devOk.body.cuentas.length === 4 && devOk.body.cuentas.some((c) => c.username === 'admin'));
const dniN = String(1840000000 + Math.floor(Math.random() * 9999999));
const rN2 = await call(U, 'POST', '/auth/register', { body: { primer_nombre: 'Elena', apellido: 'Vaca', dni: dniN, correo: `elena${Date.now()}@correo.test` } });
check('el registro asigna un usuario único y entrega un token de configuración', rN2.status === 201 && rN2.body.username && rN2.body.setup_token);
const ST = rN2.body.setup_token; const pass0 = rN2.body.credenciales_demo.password; const userDef = rN2.body.username;
check('el token de configuración no sirve en otros endpoints → 401', (await call(U, 'GET', '/clientes/me', { token: ST })).status === 401);
check('un usuario como "/dev" nunca es válido → 400', (await call(U, 'POST', '/auth/setup/username', { token: ST, body: { username: '/dev' } })).status === 400);
check('un nombre reservado ("admin") → 422', (await call(U, 'POST', '/auth/setup/username', { token: ST, body: { username: 'admin' } })).status === 422);
check('un nombre ya ocupado → 409', (await call(U, 'POST', '/auth/setup/username', { token: ST, body: { username: 'cliente1' } })).status === 409);
const foto0 = await raw(U, 'PUT', '/auth/setup/foto', ST, PNG, 'image/png');
check('la foto se puede subir al registrarse', foto0.status === 200 && foto0.body.foto_version === 1);
const elegido = `elena.vaca${Date.now() % 100000}`;
const cambio = await call(U, 'POST', '/auth/setup/username', { token: ST, body: { username: elegido.toUpperCase() } });
check('el cliente elige su usuario (se normaliza a minúsculas)', cambio.status === 200 && cambio.body.username === elegido && cambio.body.cambiado === true, JSON.stringify(cambio.body));
check('el usuario asignado por el sistema deja de existir', (await call(U, 'POST', '/oauth/token', { body: { grant_type: 'password', username: userDef, password: pass0 } })).status === 401);
const lg = await login(elegido, pass0);
check('inicia sesión con el usuario elegido y la contraseña inicial', !!lg.access_token && lg.primer_nombre === 'Elena' && lg.foto_version === 1);
check('tras el primer ingreso el usuario ya no se puede cambiar → 403', (await call(U, 'POST', '/auth/setup/username', { token: ST, body: { username: 'otro.nombre' } })).status === 403);

section('11. Perfil propio, contraseña y fotos');
const TK = lg.access_token;
const ed = await call(U, 'PUT', '/clientes/me', { token: TK, body: { primer_nombre: 'Elena', segundo_nombre: 'Sofía', apellido: 'Vaca', nacionalidad: 'Peruana', telefono: '0999111222', direccion: 'Av. Prueba 123', correo: `elena.nueva${Date.now()}@correo.test` } });
check('el usuario edita nombres, nacionalidad, teléfono, dirección y correo', ed.status === 200 && ed.body.cliente.segundo_nombre === 'Sofía' && ed.body.cliente.nacionalidad === 'Peruana');
check('el DNI queda bloqueado (403) y no cambia', (await call(U, 'PUT', '/clientes/me', { token: TK, body: { dni: '1799999999' } })).status === 403 && (await call(U, 'GET', '/clientes/me', { token: TK })).body.cliente.dni === dniN);
check('no puede cambiarse el rol ni el usuario por esta vía → 403', (await call(U, 'PUT', '/clientes/me', { token: TK, body: { rol: 'ADMINISTRADOR' } })).status === 403 && (await call(U, 'PUT', '/clientes/me', { token: TK, body: { username: 'x' } })).status === 403);
check('el correo de otra persona → 409', (await call(U, 'PUT', '/clientes/me', { token: TK, body: { correo: 'ana.torres@correo.test' } })).status === 409);
check('teléfono inválido → 400', (await call(U, 'PUT', '/clientes/me', { token: TK, body: { telefono: 'abc' } })).status === 400);
const cp = (b) => call(U, 'POST', '/auth/change-password', { token: TK, body: b });
check('contraseña: la confirmación debe coincidir → 400', (await cp({ password_actual: pass0, password_nueva: 'ClaveNueva1', password_confirmacion: 'Otra1234' })).status === 400);
check('contraseña: la actual debe ser correcta → 401', (await cp({ password_actual: 'incorrecta', password_nueva: 'ClaveNueva1', password_confirmacion: 'ClaveNueva1' })).status === 401);
check('contraseña: debe cumplir la política → 400', (await cp({ password_actual: pass0, password_nueva: 'corta', password_confirmacion: 'corta' })).status === 400);
check('contraseña: cambio correcto', (await cp({ password_actual: pass0, password_nueva: 'ClaveNueva1', password_confirmacion: 'ClaveNueva1' })).status === 200);
check('la contraseña anterior deja de servir y la nueva sí', (await call(U, 'POST', '/oauth/token', { body: { grant_type: 'password', username: elegido, password: pass0 } })).status === 401 && !!(await login(elegido, 'ClaveNueva1')).access_token);
const fMe = await raw(U, 'GET', '/usuarios/me/foto', TK);
check('la foto se descarga igual que se subió', fMe.status === 200 && fMe.type === 'image/png' && fMe.buf.equals(PNG));
const idElena = lg.usuario_id;
check('otro cliente no puede ver esa foto → 403', (await raw(U, 'GET', `/usuarios/${idElena}/foto`, c1.access_token)).status === 403);
check('el personal sí puede verla', (await raw(U, 'GET', `/usuarios/${idElena}/foto`, oper.access_token)).status === 200);
check('el operador no puede cambiar la foto de otro → 403', (await raw(U, 'PUT', `/usuarios/${idElena}/foto`, oper.access_token, PNG, 'image/png')).status === 403);
check('el administrador sí puede cambiar la foto → versión 2', (await raw(U, 'PUT', `/usuarios/${idElena}/foto`, admin.access_token, PNG, 'image/png')).body?.foto_version === 2);
check('un archivo que no es imagen se rechaza → 422', (await raw(U, 'PUT', '/usuarios/me/foto', TK, Buffer.from('esto no es una imagen'), 'image/png')).status === 422);
check('un tipo no permitido → 415', (await raw(U, 'PUT', '/usuarios/me/foto', TK, Buffer.from('hola'), 'text/plain')).status === 415);
check('una foto de más de 1 MB → 413', (await raw(U, 'PUT', '/usuarios/me/foto', TK, Buffer.concat([PNG, Buffer.alloc(1100000)]), 'image/png')).status === 413);
check('el usuario quita su foto', (await raw(U, 'DELETE', '/usuarios/me/foto', TK)).body?.foto_version === null && (await raw(U, 'GET', '/usuarios/me/foto', TK)).status === 404);

section('12. Edición de cualquier persona (solo administrador)');
check('el operador no puede editar a nadie → 403', (await call(U, 'PUT', `/usuarios/${idElena}`, { token: oper.access_token, body: { primer_nombre: 'X' } })).status === 403);
check('un cliente no puede editar a nadie → 403', (await call(U, 'PUT', `/usuarios/${idElena}`, { token: c1.access_token, body: { primer_nombre: 'X' } })).status === 403);
const ea = await call(U, 'PUT', `/usuarios/${idElena}`, { token: admin.access_token, body: { primer_nombre: 'Elenita', rol: 'OPERADOR', password_nueva: 'ClaveAdmin1', password_confirmacion: 'ClaveAdmin1', telefono: '0987000111' } });
check('el administrador cambia datos, rol y contraseña de otra persona', ea.status === 200 && ea.body.rol === 'OPERADOR' && ea.body.cliente.primer_nombre === 'Elenita', JSON.stringify(ea.body).slice(0, 200));
const lg2 = await login(elegido, 'ClaveAdmin1');
check('esa persona entra con la contraseña nueva (sin que se pidiera la anterior) y con su nuevo rol', lg2.rol === 'OPERADOR');
check('la confirmación de la contraseña nueva debe coincidir → 400', (await call(U, 'PUT', `/usuarios/${idElena}`, { token: admin.access_token, body: { password_nueva: 'ClaveAdmin2', password_confirmacion: 'Otra' } })).status === 400);
check('el administrador puede asignar el rol Administrador', (await call(U, 'PUT', `/usuarios/${idElena}`, { token: admin.access_token, body: { rol: 'ADMINISTRADOR' } })).body.rol === 'ADMINISTRADOR');
check('el DNI duplicado se rechaza → 409', (await call(U, 'PUT', `/usuarios/${idElena}`, { token: admin.access_token, body: { dni: '1712345678' } })).status === 409);
check('un administrador no cambia su propio rol → 422', (await call(U, 'PUT', `/usuarios/${admin.usuario_id}`, { token: admin.access_token, body: { rol: 'CLIENTE' } })).status === 422);

section('13. Películas: póster y edición sin afectar boletos ni asientos');
const nPel = await call(P, 'POST', '/peliculas', { token: oper.access_token, body: { nombre: 'Película con póster', genero: 'Drama', duracion_min: 100, clasificacion: 'TP' } });
const pid = nPel.body.id;
check('una película nueva puede crearse sin imagen', nPel.status === 201 && nPel.body.imagen_url === null);
check('un cliente no puede subir pósters → 403', (await raw(P, 'PUT', `/peliculas/${pid}/imagen`, c1.access_token, PNG, 'image/png')).status === 403);
check('una imagen inválida se rechaza → 422', (await raw(P, 'PUT', `/peliculas/${pid}/imagen`, oper.access_token, Buffer.from('no soy imagen'), 'image/png')).status === 422);
check('una imagen de más de 2 MB → 413', (await raw(P, 'PUT', `/peliculas/${pid}/imagen`, oper.access_token, Buffer.concat([PNG, Buffer.alloc(2200000)]), 'image/png')).status === 413);
const up = await raw(P, 'PUT', `/peliculas/${pid}/imagen`, oper.access_token, PNG, 'image/png');
check('el operador sube el póster', up.status === 200 && /\/imagen\?v=1$/.test(up.body.imagen_url));
const gi = await raw(P, 'GET', `/peliculas/${pid}/imagen`);
check('el póster es público y se descarga idéntico', gi.status === 200 && gi.type === 'image/png' && gi.buf.equals(PNG));
check('usa caché del navegador (ETag → 304)', (await fetch(`${P}/peliculas/${pid}/imagen`, { headers: { 'If-None-Match': gi.etag } })).status === 304);
check('la cartelera incluye la URL del póster', (await call(P, 'GET', '/peliculas')).body.find((p) => p.id === pid)?.imagen_url?.includes(`/peliculas/${pid}/imagen`));

// Una función con la película, una reserva confirmada y un boleto
const fp = await call(P, 'POST', '/funciones', { token: oper.access_token, body: { pelicula_id: pid, sala_id: 2, fecha: isoDate(new Date(Date.now() - 5 * 3600000 + 2 * 86400000)), hora_inicio: '12:00:00' } });
check('se programa una función con esa película', fp.status === 201, JSON.stringify(fp.body));
const asientosF = (await call(R, 'GET', `/funciones/${fp.body.id}/asientos`, { token: c1.access_token })).body.asientos.filter((x) => x.tipo === 'GENERAL').slice(0, 2);
const rv = await call(R, 'POST', '/reservas', { token: c1.access_token, body: { funcion_id: fp.body.id, asiento_ids: asientosF.map((x) => x.asiento_id) } });
const rvc = await call(R, 'POST', `/reservas/${rv.body.id}/confirmar`, { token: c1.access_token });
const tokenBoleto = rvc.body.boletos[0].codigo_qr;
check('reserva confirmada con boletos antes de editar la película', rvc.status === 200 && rvc.body.estado === 'CONFIRMADA' && rvc.body.boletos.length === 2);
const antes = (await call(P, 'GET', `/funciones/${fp.body.id}`)).body;
const edP = await call(P, 'PUT', `/peliculas/${pid}`, { token: oper.access_token, body: { nombre: 'Título corregido', descripcion: 'Nueva sinopsis', genero: 'Comedia', duracion_min: 180, clasificacion: '+18' } });
check('el operador edita título, descripción, género, duración y clasificación', edP.status === 200 && edP.body.nombre === 'Título corregido' && edP.body.duracion_min === 180 && edP.body.clasificacion === '+18');
check('editar la película conserva su póster', edP.body.imagen_url !== null);
const despues = (await call(P, 'GET', `/funciones/${fp.body.id}`)).body;
check('la función conserva su horario (no se recalcula con la nueva duración)', despues.hora_inicio === antes.hora_inicio && despues.hora_fin === antes.hora_fin && despues.estado === 'ACTIVA');
const rvDesp = await call(R, 'GET', `/reservas/${rv.body.id}`, { token: c1.access_token });
check('la reserva sigue CONFIRMADA y los boletos ACTIVOS tras editar la película', rvDesp.body.estado === 'CONFIRMADA' && rvDesp.body.boletos.every((b) => b.estado === 'ACTIVO'));
const dispF = (await call(R, 'GET', `/funciones/${fp.body.id}/asientos`, { token: c1.access_token })).body;
check('los asientos siguen OCUPADOS', asientosF.every((a) => dispF.asientos.find((x) => x.asiento_id === a.asiento_id).estado === 'OCUPADO'));
check('el boleto sigue siendo válido en la puerta', (await call(R, 'POST', '/boletos/validar', { token: oper.access_token, body: { codigo: tokenBoleto } })).status === 200);
check('la reserva muestra el título corregido', rvDesp.body.funcion.pelicula === 'Título corregido');
check('quitar el póster', (await raw(P, 'DELETE', `/peliculas/${pid}/imagen`, oper.access_token)).body?.imagen_url === null && (await raw(P, 'GET', `/peliculas/${pid}/imagen`)).status === 404);
await call(P, 'PATCH', `/peliculas/${pid}/estado`, { token: oper.access_token, body: { estado: 'RETIRADA' } });

console.log(`\nResultado: ${ok} correctas, ${fail} fallidas`);
process.exit(fail ? 1 : 0);
