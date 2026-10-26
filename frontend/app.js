/* Cine Andino · frontend de demostración (HTML + JS sin compilación).
   Consume los 3 microservicios por REST. Se reemplazará por React respetando los mismos contratos. */
(function () {
  'use strict';
  const C = window.CINE_CONFIG;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (n) => `$${Number(n).toFixed(2)}`;
  // Para buscar: sin tildes ni mayúsculas ("Código Cuántico" coincide con "codigo cuantico")
  const norm = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const main = $('#main');
  const EC = -5 * 3600000; // hora de Ecuador (UTC-5)
  const hoyEC = () => new Date(Date.now() + EC).toISOString().slice(0, 10);
  const sumaDias = (d, n) => new Date(Date.parse(`${d}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
  const fechaLarga = (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
  const inicioMs = (f) => Date.parse(`${f.fecha}T${f.hora_inicio}:00-05:00`);

  // ---------- Sesión
  let ses = JSON.parse(localStorage.getItem('cine_sesion') || 'null');
  const setSes = (s) => { ses = s; s ? localStorage.setItem('cine_sesion', JSON.stringify(s)) : localStorage.removeItem('cine_sesion'); };
  const esStaff = () => !!ses && (ses.rol === 'ADMINISTRADOR' || ses.rol === 'OPERADOR');
  const esAdmin = () => !!ses && ses.rol === 'ADMINISTRADOR';

  // ---------- Registro de llamadas (evidencia del consumo de microservicios)
  const calls = [];
  function addCall(svc, method, path, status, ms) {
    calls.unshift({ t: new Date().toLocaleTimeString('es-EC', { hour12: false }), svc, method, path, status, ms });
    calls.length = Math.min(calls.length, 60);
    $('#logcount').textContent = String(calls.length);
    renderLog();
  }
  function renderLog() {
    const p = $('#logpanel');
    if (p.hidden) return;
    p.innerHTML = calls.length ? calls.map((c) => `<div class="svc-${c.svc}"><span>${c.t}</span><span><i class="dot svc"></i>${c.svc}</span><span>${esc(c.method)} ${esc(c.path)}</span><span class="s${String(c.status)[0]}">${c.status}</span><span>${c.ms}ms</span></div>`).join('') : 'Aún no hay llamadas.';
  }
  $('#logbtn').addEventListener('click', () => { const p = $('#logpanel'); p.hidden = !p.hidden; $('#logbtn').setAttribute('aria-expanded', String(!p.hidden)); renderLog(); });

  // ---------- Cliente REST
  class ApiError extends Error {
    constructor(status, code, message, details) { super(message); this.status = status; this.code = code; this.details = details; }
  }
  async function refresh() {
    if (!ses?.refresh_token) return false;
    try {
      const r = await fetch(`${C.usuarios}/oauth/token`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ grant_type: 'refresh_token', refresh_token: ses.refresh_token }) });
      if (!r.ok) return false;
      setSes(await r.json());
      return true;
    } catch { return false; }
  }
  async function api(svc, method, path, body, { auth = true, retry = true, token } = {}) {
    const t0 = performance.now();
    const binario = typeof Blob !== 'undefined' && body instanceof Blob; // fotos y pósters se envían como cuerpo binario
    const headers = { 'Content-Type': binario ? body.type : 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    else if (auth && ses) headers.Authorization = `Bearer ${ses.access_token}`;
    let res;
    try {
      res = await fetch(C[svc] + path, { method, headers, body: body ? (binario ? body : JSON.stringify(body)) : undefined });
    } catch {
      addCall(svc, method, path, 'ERR', Math.round(performance.now() - t0));
      throw new ApiError(0, 'SIN_CONEXION', `No hay conexión con el servicio de ${svc}. Verifica que esté en ejecución.`);
    }
    const text = await res.text();
    let data; try { data = JSON.parse(text); } catch { data = text; }
    addCall(svc, method, path, res.status, Math.round(performance.now() - t0));
    if (res.status === 401 && auth && retry && !token && data?.code === 'TOKEN_INVALIDO') {
      if (await refresh()) return api(svc, method, path, body, { auth, retry: false });
      setSes(null); renderTopbar(); location.hash = '#/login';
      throw new ApiError(401, 'SESION_EXPIRADA', 'Tu sesión expiró. Inicia sesión de nuevo.');
    }
    if (!res.ok) throw new ApiError(res.status, data?.code, data?.message || `Error ${res.status}`, data?.details);
    return data;
  }
  // Descarga un archivo protegido (foto de perfil) como Blob; devuelve null si no existe
  async function apiBlob(svc, path) {
    const t0 = performance.now();
    try {
      const res = await fetch(C[svc] + path, { headers: ses ? { Authorization: `Bearer ${ses.access_token}` } : {} });
      addCall(svc, 'GET', path, res.status, Math.round(performance.now() - t0));
      return res.ok ? await res.blob() : null;
    } catch { return null; }
  }

  // ---------- Utilidades de interfaz
  function toast(msg, tipo = '', detalle = '') {
    const el = document.createElement('div');
    el.className = `toast ${tipo}`;
    el.innerHTML = `${esc(msg)}${detalle ? `<small>${esc(detalle)}</small>` : ''}`;
    $('#toasts').append(el);
    setTimeout(() => el.remove(), 6500);
  }
  const fail = (e) => {
    const det = Array.isArray(e.details) && e.details.length ? e.details.map((d) => d.mensaje || d.etiqueta || d.campo || JSON.stringify(d)).join('; ') : '';
    toast(e.message || 'Ocurrió un error', 'bad', det);
  };
  async function act(fn) { try { return await fn(); } catch (e) { fail(e); } }
  const formData = (f) => Object.fromEntries([...new FormData(f)].filter(([, v]) => v !== ''));
  const badge = (e) => {
    const cls = { PENDIENTE: 'b-pend', CONFIRMADA: 'b-conf', CANCELADA: 'b-canc', EXPIRADA: 'b-exp', USADA: 'b-usada', ACTIVO: 'b-act', ACTIVA: 'b-act', USADO: 'b-usada', ANULADO: 'b-canc', INACTIVO: 'b-exp', INACTIVA: 'b-exp', BLOQUEADO: 'b-canc', RETIRADA: 'b-canc', CANCELADA_F: 'b-canc' }[e] || '';
    return `<span class="badge ${cls}">${esc(e)}</span>`;
  };
  const timers = [];
  const cleanups = []; // se ejecutan al cambiar de pantalla (p. ej., apagar la cámara)
  const every = (fn, ms) => timers.push(setInterval(fn, ms));
  const buscadorHtml = (ph) => `<div style="margin-bottom:.75rem"><input class="buscar" type="search" placeholder="${esc(ph)}" aria-label="${esc(ph)}" style="max-width:440px"></div>`;
  // Filtra las filas de la primera tabla mientras se escribe, ignorando tildes y mayúsculas
  function enlazarBuscador(box) {
    const inp = $('.buscar', box); const tb = $('table tbody', box);
    if (!inp || !tb) return;
    const texto = (r) => { const c = r.cloneNode(true); c.querySelectorAll('button,.btn').forEach((e) => e.remove()); return norm(c.textContent); };
    const filas = [...tb.rows].map((r) => ({ r, t: texto(r) }));
    inp.addEventListener('input', () => { const q = norm(inp.value); filas.forEach(({ r, t }) => { r.hidden = !!q && !t.includes(q); }); });
  }
  const palettes = [['#0f7c86', '#17252e'], ['#6a52c9', '#2b2160'], ['#c4691b', '#5a2a08'], ['#2f7d4f', '#10341f']];
  const titulo = (t) => { document.title = `${t} · Cine Andino`; };

  // ---------- Imágenes: validar y reducir antes de subir
  const TIPOS_IMG = ['image/jpeg', 'image/png', 'image/webp'];
  function validarImagen(file, maxMB = 5) {
    if (!TIPOS_IMG.includes(file.type)) throw new ApiError(0, 'IMAGEN_INVALIDA', 'Elige una imagen JPG, PNG o WEBP');
    if (file.size > maxMB * 1024 * 1024) throw new ApiError(0, 'IMAGEN_GRANDE', `La imagen supera los ${maxMB} MB`);
  }
  async function reducirImagen(file, { ancho, alto = ancho, cuadrado = false }) {
    validarImagen(file);
    try {
      const bmp = await createImageBitmap(file);
      let sx = 0; let sy = 0; let sw = bmp.width; let sh = bmp.height; let dw; let dh;
      if (cuadrado) { const l = Math.min(sw, sh); sx = (sw - l) / 2; sy = (sh - l) / 2; sw = l; sh = l; dw = Math.min(ancho, l); dh = dw; }
      else { const k = Math.min(1, ancho / sw, alto / sh); dw = Math.round(sw * k); dh = Math.round(sh * k); }
      const cv = document.createElement('canvas'); cv.width = dw; cv.height = dh;
      const cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, dw, dh); cx.drawImage(bmp, sx, sy, sw, sh, 0, 0, dw, dh);
      return (await new Promise((r) => cv.toBlob(r, 'image/jpeg', 0.88))) || file;
    } catch { return file; } // si el navegador no puede reducirla, se sube la original (el servidor limita el tamaño)
  }
  const subirPoster = async (id, file) => api('peliculas', 'PUT', `/peliculas/${id}/imagen`, await reducirImagen(file, { ancho: 600, alto: 900 }));
  const urlPoster = (p) => (p.imagen_url ? C.peliculas + p.imagen_url : null);

  // ---------- Avatar: foto o iniciales (Bryan Aguirre = BA)
  const ROL = { ADMINISTRADOR: 'Administrador', OPERADOR: 'Operador', CLIENTE: 'Cliente' };
  const iniciales = (x) => ((x.primer_nombre && x.apellido) ? x.primer_nombre[0] + x.apellido[0] : String(x.username || '?').slice(0, 2)).toUpperCase();
  let fotoPropia = { v: null, url: null };
  const urlFotoPropia = () => (ses && fotoPropia.url && fotoPropia.v === ses.foto_version ? fotoPropia.url : null);
  async function cargarFotoPropia() { // true si cambió la imagen mostrada
    if (!ses?.foto_version) { const hubo = !!fotoPropia.url; fotoPropia = { v: null, url: null }; return hubo; }
    if (urlFotoPropia()) return false;
    const b = await apiBlob('usuarios', '/usuarios/me/foto');
    try { if (b) { fotoPropia = { v: ses.foto_version, url: URL.createObjectURL(b) }; return true; } } catch { /* sin soporte */ }
    return false;
  }
  const avatarHtml = (x, url, clase = '') => (url ? `<img class="avatar ${clase}" src="${esc(url)}" alt="">` : `<span class="avatar ${clase}" aria-hidden="true">${esc(iniciales(x))}</span>`);
  async function refrescarSesion(forzar = false) {
    if (!ses || (!forzar && ses.primer_nombre !== undefined && ses.foto_version !== undefined)) return;
    try {
      const me = await api('usuarios', 'GET', '/clientes/me');
      setSes({ ...ses, primer_nombre: me.cliente?.primer_nombre ?? null, apellido: me.cliente?.apellido ?? null, foto_version: me.foto_version ?? null });
      await cargarFotoPropia(); renderTopbar();
    } catch { /* se conserva la sesión actual */ }
  }

  // ---------- Ventanas modales
  const pilaModales = [];
  function modal(tituloModal, html, { ancho = '600px' } = {}) {
    const previo = document.activeElement;
    const bg = document.createElement('div');
    bg.className = 'modal-bg';
    bg.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-t" style="max-width:${ancho}"><div class="modal-head"><h2 id="modal-t">${esc(tituloModal)}</h2><button type="button" class="alt sm" data-cerrar>Cerrar</button></div><div class="modal-body">${html}</div></div>`;
    $('#modal-root').append(bg);
    const onKey = (e) => { if (e.key === 'Escape' && pilaModales[pilaModales.length - 1] === cerrar) cerrar(); };
    function cerrar() { document.removeEventListener('keydown', onKey); pilaModales.splice(pilaModales.indexOf(cerrar), 1); bg.remove(); previo?.focus?.(); }
    pilaModales.push(cerrar);
    document.addEventListener('keydown', onKey);
    bg.addEventListener('click', (e) => { if (e.target === bg || e.target.closest('[data-cerrar]')) cerrar(); });
    bg.querySelector('input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea')?.focus();
    return { el: bg, cerrar, q: (sel) => bg.querySelector(sel) };
  }
  function mostrarError(el, e) {
    const det = Array.isArray(e.details) && e.details.length ? `: ${e.details.map((d) => d.mensaje || d.campo).join('; ')}` : '';
    el.hidden = false; el.textContent = `${e.message || 'Ocurrió un error'}${det}`;
  }
  const cerrarModales = () => [...pilaModales].reverse().forEach((c) => c());

  // ---------- Formulario de persona (perfil propio y edición por el administrador)
  function formPersonaHtml(d, { admin = false, propio = false, extra = '' } = {}) {
    const c = d.cliente || {}; const v = (x) => esc(x ?? '');
    return `<form id="pf" class="stack" novalidate>
      <div class="foto-fila"><div id="pf-prev"></div><div><label for="pf-foto">Foto de perfil (opcional)</label><input id="pf-foto" type="file" accept="image/jpeg,image/png,image/webp">
        <label class="checkline"><input id="pf-quitar" type="checkbox"> Quitar la foto actual</label></div></div>
      <div class="grid2">
        <div><label for="pf-pn">Primer nombre</label><input id="pf-pn" name="primer_nombre" value="${v(c.primer_nombre)}" maxlength="50"></div>
        <div><label for="pf-sn">Segundo nombre</label><input id="pf-sn" name="segundo_nombre" value="${v(c.segundo_nombre)}" maxlength="50"></div>
        <div><label for="pf-ap">Apellido</label><input id="pf-ap" name="apellido" value="${v(c.apellido)}" maxlength="50"></div>
        <div><label for="pf-dni">DNI</label><input id="pf-dni" name="dni" value="${v(c.dni)}" ${admin ? 'inputmode="numeric"' : 'disabled aria-describedby="pf-dni-ayuda"'}>${admin ? '' : '<span id="pf-dni-ayuda" class="small muted">El DNI no se puede modificar.</span>'}</div>
        <div><label for="pf-nac">Nacionalidad</label><input id="pf-nac" name="nacionalidad" value="${v(c.nacionalidad)}"></div>
        <div><label for="pf-tel">Teléfono</label><input id="pf-tel" name="telefono" value="${v(c.telefono)}" inputmode="tel"></div>
        <div class="span2"><label for="pf-dir">Dirección</label><input id="pf-dir" name="direccion" value="${v(c.direccion)}"></div>
        <div class="span2"><label for="pf-co">Correo electrónico</label><input id="pf-co" name="correo" type="email" value="${v(c.correo)}"></div>
        ${admin ? `<div class="span2"><label for="pf-rol">Rol</label><select id="pf-rol" name="rol" ${propio ? 'disabled' : ''}>${['CLIENTE', 'OPERADOR', 'ADMINISTRADOR'].map((r) => `<option value="${r}" ${r === d.rol ? 'selected' : ''}>${ROL[r]}</option>`).join('')}</select>${propio ? '<span class="small muted">No puedes cambiar tu propio rol.</span>' : ''}</div>
        <div class="span2 small muted">Para restablecer la contraseña escribe la nueva; no se pide la anterior. Déjala vacía para no cambiarla.</div>
        <div><label for="pf-pw1">Nueva contraseña</label><input id="pf-pw1" name="password_nueva" type="password" autocomplete="new-password"></div>
        <div><label for="pf-pw2">Confirmar contraseña</label><input id="pf-pw2" name="password_confirmacion" type="password" autocomplete="new-password"></div>` : ''}
      </div>
      <div id="pf-err" class="err" role="alert" hidden></div>
      <div class="row end">${extra}<button type="button" class="alt" data-cerrar>Cancelar</button><button type="submit">Guardar cambios</button></div></form>`;
  }
  async function previewFoto(m, d, propio) {
    const x = { primer_nombre: d.cliente?.primer_nombre, apellido: d.cliente?.apellido, username: d.username };
    let url = null;
    try {
      if (d.foto_version) {
        if (propio) { await cargarFotoPropia(); url = urlFotoPropia(); }
        else { const b = await apiBlob('usuarios', `/usuarios/${d.id}/foto`); if (b) url = URL.createObjectURL(b); }
      }
    } catch { /* se muestran las iniciales */ }
    const prev = m.q('#pf-prev'); if (!prev) return;
    prev.innerHTML = avatarHtml(x, url, 'grande');
    m.q('#pf-foto').addEventListener('change', (ev) => {
      const f = ev.target.files?.[0]; if (!f) return;
      try { prev.innerHTML = avatarHtml(x, URL.createObjectURL(f), 'grande'); } catch { /* sin vista previa */ }
    });
  }
  async function aplicarFoto(m, idRef) {
    const f = m.q('#pf-foto').files?.[0];
    if (f) { await api('usuarios', 'PUT', `/usuarios/${idRef}/foto`, await reducirImagen(f, { ancho: 256, cuadrado: true })); return; }
    if (m.q('#pf-quitar').checked) await api('usuarios', 'DELETE', `/usuarios/${idRef}/foto`);
  }
  const CAMPOS_PERFIL = ['primer_nombre', 'segundo_nombre', 'apellido', 'nacionalidad', 'telefono', 'direccion', 'correo'];

  // Editar mi perfil (nombres, apellido, nacionalidad, teléfono, dirección, correo y foto; el DNI queda bloqueado)
  async function abrirPerfil() {
    const d = await api('usuarios', 'GET', '/clientes/me');
    const m = modal('Editar perfil', formPersonaHtml(d, { propio: true, extra: '<button type="button" class="alt" id="pf-clave" style="margin-right:auto">Cambiar contraseña</button>' }));
    previewFoto(m, d, true);
    m.q('#pf-clave').addEventListener('click', abrirPassword);
    m.q('#pf').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const fd = new FormData(ev.target); const datos = {};
      CAMPOS_PERFIL.forEach((k) => { datos[k] = String(fd.get(k) ?? '').trim(); });
      try {
        await api('usuarios', 'PUT', '/clientes/me', datos);
        await aplicarFoto(m, 'me');
        await refrescarSesion(true);
        toast('Perfil actualizado', 'good'); m.cerrar();
      } catch (er) { mostrarError(m.q('#pf-err'), er); }
    });
  }
  // Ventana aparte para cambiar la contraseña: pide la actual, la nueva y su confirmación
  function abrirPassword() {
    const m = modal('Cambiar contraseña', `<form id="pw" class="stack" novalidate><p class="muted">Por seguridad, primero escribe tu contraseña actual.</p>
      <div><label for="pw-a">Contraseña actual</label><input id="pw-a" name="password_actual" type="password" autocomplete="current-password"></div>
      <div><label for="pw-n">Nueva contraseña</label><input id="pw-n" name="password_nueva" type="password" autocomplete="new-password"><span class="small muted">Mínimo 8 caracteres, con mayúscula, minúscula y número.</span></div>
      <div><label for="pw-c">Confirmar nueva contraseña</label><input id="pw-c" name="password_confirmacion" type="password" autocomplete="new-password"></div>
      <div id="pw-err" class="err" role="alert" hidden></div>
      <div class="row end"><button type="button" class="alt" data-cerrar>Cancelar</button><button type="submit">Cambiar contraseña</button></div></form>`, { ancho: '440px' });
    m.q('#pw').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const d = Object.fromEntries(new FormData(ev.target)); const err = m.q('#pw-err');
      if (!d.password_actual) return mostrarError(err, { message: 'Escribe tu contraseña actual' });
      if (!d.password_nueva || d.password_nueva !== d.password_confirmacion) return mostrarError(err, { message: 'La confirmación no coincide con la nueva contraseña' });
      try { await api('usuarios', 'POST', '/auth/change-password', d); toast('Contraseña actualizada', 'good'); m.cerrar(); }
      catch (er) { mostrarError(err, er); }
    });
  }
  // El administrador edita a cualquier persona: datos, DNI, rol y contraseña nueva (sin pedir la anterior)
  async function abrirEdicionAdmin(id, alGuardar) {
    const d = await api('usuarios', 'GET', `/usuarios/${id}`);
    const propio = d.id === ses.usuario_id;
    const m = modal(`Editar a ${d.username}`, formPersonaHtml(d, { admin: true, propio }));
    previewFoto(m, d, propio);
    m.q('#pf').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const fd = new FormData(ev.target); const datos = {};
      [...CAMPOS_PERFIL, 'dni'].forEach((k) => { datos[k] = String(fd.get(k) ?? '').trim(); });
      if (!propio) datos.rol = fd.get('rol');
      const p1 = fd.get('password_nueva'); const p2 = fd.get('password_confirmacion');
      if (p1 || p2) {
        if (p1 !== p2) return mostrarError(m.q('#pf-err'), { message: 'La confirmación no coincide con la nueva contraseña' });
        datos.password_nueva = p1; datos.password_confirmacion = p2;
      }
      try {
        await api('usuarios', 'PUT', `/usuarios/${id}`, datos);
        await aplicarFoto(m, id);
        if (propio) await refrescarSesion(true);
        toast('Usuario actualizado', 'good'); m.cerrar(); alGuardar?.();
      } catch (er) { mostrarError(m.q('#pf-err'), er); }
    });
  }

  function renderTopbar() {
    const hash = location.hash || '#/';
    const adm = esAdmin();
    $('#logbtn').hidden = !adm;
    if (!adm) { $('#logpanel').hidden = true; $('#logbtn').setAttribute('aria-expanded', 'false'); }
    const cur = (h) => (hash === h || (h !== '#/' && hash.startsWith(h)) ? ' aria-current="page"' : '');
    const links = [`<a href="#/"${cur('#/')}>Cartelera</a>`];
    if (ses && ses.rol === 'CLIENTE') links.push(`<a href="#/mis-reservas"${cur('#/mis-reservas')}>Mis reservas</a>`);
    if (esStaff()) links.push(`<a href="#/panel"${cur('#/panel')}>Panel de gestión</a>`);
    if (adm) links.push(`<a href="#/conexiones"${cur('#/conexiones')}>Conexiones</a>`);
    $('#topbar').innerHTML = `<div class="bar"><a class="brand" href="#/"><i></i>Cine Andino</a><nav class="nav" aria-label="Principal">${links.join('')}</nav>
      ${ses ? `<div class="usermenu"><button type="button" id="userbtn" class="userbtn" aria-haspopup="menu" aria-expanded="false" aria-controls="usermenu">${avatarHtml(ses, urlFotoPropia())}<span class="uname">${esc(ses.username)}</span></button>
        <div id="usermenu" class="menu" role="menu" hidden><div class="menu-rol" role="presentation">Rol: <b>${esc(ROL[ses.rol] || ses.rol)}</b></div>
        <button type="button" role="menuitem" id="m-editar">Editar perfil</button><button type="button" role="menuitem" id="m-salir">Cerrar sesión</button></div></div>`
            : `<a class="btn alt sm" href="#/login" style="color:#fff;box-shadow:inset 0 0 0 1.5px #496070">Ingresar</a><a class="btn accent sm" href="#/registro" style="color:var(--ink)">Crear cuenta</a>`}</div>`;
    const btn = $('#userbtn'); const menu = $('#usermenu');
    btn?.addEventListener('click', (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; btn.setAttribute('aria-expanded', String(!menu.hidden)); });
    $('#m-editar')?.addEventListener('click', () => act(abrirPerfil));
    $('#m-salir')?.addEventListener('click', () => { cerrarModales(); setSes(null); fotoPropia = { v: null, url: null }; location.hash = '#/'; renderTopbar(); toast('Sesión cerrada'); });
  }
  // Cierra el menú del usuario al hacer clic fuera o con Escape
  document.addEventListener('click', () => { const m = $('#usermenu'); if (m && !m.hidden) { m.hidden = true; $('#userbtn').setAttribute('aria-expanded', 'false'); } });
  document.addEventListener('keydown', (e) => { const m = $('#usermenu'); if (e.key === 'Escape' && m && !m.hidden) { m.hidden = true; $('#userbtn').setAttribute('aria-expanded', 'false'); $('#userbtn').focus(); } });
  const needLogin = () => { if (!ses) { sessionStorage.setItem('cine_volver', location.hash); location.hash = '#/login'; return true; } return false; };
  const needStaff = () => { if (needLogin()) return true; if (!esStaff()) { location.hash = '#/'; toast('Esa sección es solo para el personal', 'bad'); return true; } return false; };

  // ================= Cartelera =================
  async function vCartelera() {
    titulo('Cartelera');
    let fecha = sessionStorage.getItem('cine_fecha') || hoyEC();
    let filtros = { nombre: '', genero: '' };
    main.innerHTML = `<h1>Cartelera</h1><p class="muted">Elige un día y una función para escoger tus asientos.</p>
      <div class="dates" id="fechas" role="group" aria-label="Día"></div>
      <form id="filtros" class="grid" style="margin-bottom:1rem"><div><label for="fn">Buscar por nombre</label><input id="fn" name="nombre" placeholder="Nombre de la película"></div>
        <div><label for="fg">Género</label><select id="fg" name="genero"><option value="">Todos</option></select></div>
        <div><label for="fd">Otra fecha</label><input id="fd" type="date" name="fecha"></div></form>
      <div id="films" class="films" aria-live="polite"></div>`;
    const generos = [...new Set((await api('peliculas', 'GET', '/peliculas', null, { auth: false })).map((p) => p.genero))].sort();
    $('#fg').innerHTML += generos.map((g) => `<option>${esc(g)}</option>`).join('');
    const dias = [0, 1, 2, 3].map((n) => sumaDias(hoyEC(), n));
    const pintarFechas = () => {
      $('#fechas').innerHTML = dias.map((d, i) => `<button type="button" data-f="${d}" aria-pressed="${d === fecha}">${i === 0 ? 'Hoy' : i === 1 ? 'Mañana' : fechaLarga(d).split(',')[0]} ${d.slice(8)}/${d.slice(5, 7)}</button>`).join('');
      $('#fd').value = fecha;
    };
    let seq = 0; // evita que una respuesta vieja pise a una más reciente al escribir rápido
    async function cargar() {
      const mi = ++seq;
      const q = new URLSearchParams({ fecha });
      if (filtros.nombre) q.set('nombre', filtros.nombre);
      if (filtros.genero) q.set('genero', filtros.genero);
      const [pelis, funs] = await Promise.all([api('peliculas', 'GET', `/peliculas?${q}`, null, { auth: false }), api('peliculas', 'GET', `/funciones?fecha=${fecha}`, null, { auth: false })]);
      if (mi !== seq || !$('#films')) return;
      $('#films').innerHTML = pelis.length ? pelis.map((p) => {
        const [c1, c2] = palettes[p.id % palettes.length];
        const slots = funs.filter((f) => f.pelicula_id === p.id).map((f) => {
          const pasada = inicioMs(f) <= Date.now();
          return `<a class="slot${pasada ? ' off' : ''}" href="#/funcion/${f.id}" ${pasada ? 'aria-disabled="true" tabindex="-1"' : ''}>${f.hora_inicio}<small>${esc(f.sala)}, desde ${money(f.precio_desde)}</small></a>`;
        }).join('');
        const poster = urlPoster(p) ? `<div class="poster has-img"><img src="${esc(urlPoster(p))}" alt="Póster de ${esc(p.nombre)}" loading="lazy"></div>` : `<div class="poster" style="--c1:${c1};--c2:${c2}" aria-hidden="true">${esc(p.nombre)}</div>`;
        return `<article class="film">${poster}
          <div><h3>${esc(p.nombre)}</h3><div class="tags"><span class="tag">${esc(p.genero)}</span><span class="tag">${p.duracion_min} min</span><span class="tag">Clasificación ${esc(p.clasificacion)}</span></div>
          <p class="small muted">${esc(p.descripcion || '')}</p><div class="slots">${slots || '<span class="small muted">Sin funciones este día</span>'}</div></div></article>`;
      }).join('') : '<div class="empty">No hay películas con esos filtros. Prueba otro día o borra la búsqueda.</div>';
    }
    pintarFechas();
    $('#fechas').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; fecha = b.dataset.f; sessionStorage.setItem('cine_fecha', fecha); pintarFechas(); act(cargar); });
    let espera;
    $('#filtros').addEventListener('input', (e) => {
      if (e.target.name === 'fecha') { if (e.target.value) { fecha = e.target.value; sessionStorage.setItem('cine_fecha', fecha); pintarFechas(); } } else filtros[e.target.name] = e.target.value;
      clearTimeout(espera);
      espera = setTimeout(() => act(cargar), e.target.name === 'nombre' ? 200 : 0);
    });
    cleanups.push(() => clearTimeout(espera));
    await cargar();
  }

  // ================= Acceso =================
  async function iniciarSesion(username, password) {
    const r = await api('usuarios', 'POST', '/oauth/token', { grant_type: 'password', username, password }, { auth: false });
    setSes(r); renderTopbar();
    cargarFotoPropia().then((cambio) => cambio && renderTopbar());
    toast(`Bienvenido, ${r.username}`, 'good');
    const volver = sessionStorage.getItem('cine_volver'); sessionStorage.removeItem('cine_volver');
    location.hash = volver || (r.rol === 'CLIENTE' ? '#/' : '#/panel');
  }
  // Acceso rápido de desarrollo: si en el campo "Usuario" se escribe el comando secreto (empieza con "/", por lo que nunca es un
  // usuario válido), Usuarios devuelve las cuentas de demostración. Con un comando incorrecto responde igual que un login fallido.
  async function accesoDev(comando) {
    try {
      const r = await api('usuarios', 'POST', '/auth/dev-access', { comando }, { auth: false });
      $('#dev').innerHTML = `<div class="hint"><b>Accesos de desarrollo</b><div class="demo-list">${r.cuentas.map((c) => `<button type="button" class="alt sm" data-u="${esc(c.username)}" data-p="${esc(c.password)}">${esc(c.etiqueta)}</button>`).join('')}</div></div>`;
      $('#u').value = ''; $('#p').value = '';
      $$('#dev [data-u]').forEach((b) => b.addEventListener('click', () => act(() => iniciarSesion(b.dataset.u, b.dataset.p))));
    } catch (e) {
      if (e.status === 0) throw e;
      throw new ApiError(401, 'CREDENCIALES_INVALIDAS', 'Usuario o contraseña incorrectos');
    }
  }
  function vLogin() {
    titulo('Ingresar');
    main.innerHTML = `<div class="narrow card"><h1>Ingresar</h1>
      <form id="f" class="stack" novalidate><div><label for="u">Usuario</label><input id="u" name="username" autocomplete="username" autocapitalize="none" spellcheck="false"></div>
      <div><label for="p">Contraseña</label><input id="p" name="password" type="password" autocomplete="current-password"></div>
      <button type="submit">Ingresar</button></form>
      <p class="small muted" style="margin-top:1rem">¿Sin cuenta? <a href="#/registro">Crea una</a>. Te enviaremos tu usuario y contraseña por correo.</p>
      <div id="dev" aria-live="polite"></div></div>`;
    $('#f').addEventListener('submit', (e) => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(e.target)); const u = (d.username || '').trim();
      if (u.startsWith('/')) return act(() => accesoDev(u));
      if (!u || !d.password) return toast('Escribe tu usuario y contraseña', 'bad');
      act(() => iniciarSesion(u, d.password));
    });
  }

  function vRegistro() {
    titulo('Crear cuenta');
    main.innerHTML = `<div class="wide card" id="reg"><h1>Crear cuenta de cliente</h1>
      <p class="muted">Te asignamos un usuario y una contraseña y los enviamos a tu correo. Después podrás elegir tu propio nombre de usuario.</p>
      <form id="f" class="grid">
        <div><label for="pn">Primer nombre</label><input id="pn" name="primer_nombre" required maxlength="50"></div>
        <div><label for="sn">Segundo nombre</label><input id="sn" name="segundo_nombre" maxlength="50"></div>
        <div><label for="ap">Apellido</label><input id="ap" name="apellido" required maxlength="50"></div>
        <div><label for="dni">DNI (cédula o RUC)</label><input id="dni" name="dni" required inputmode="numeric" pattern="\\d{10}(\\d{3})?" title="10 o 13 dígitos"></div>
        <div><label for="nac">Nacionalidad</label><input id="nac" name="nacionalidad"></div>
        <div><label for="tel">Teléfono</label><input id="tel" name="telefono" inputmode="tel"></div>
        <div style="grid-column:1/-1"><label for="dir">Dirección</label><input id="dir" name="direccion"></div>
        <div style="grid-column:1/-1"><label for="co">Correo electrónico</label><input id="co" name="correo" type="email" required></div>
        <div style="grid-column:1/-1"><label for="ft">Foto de perfil (opcional)</label><input id="ft" name="foto" type="file" accept="image/jpeg,image/png,image/webp"><span class="small muted">Si no subes una, mostraremos tus iniciales.</span></div>
        <div style="grid-column:1/-1"><button type="submit">Crear cuenta</button></div></form></div>`;
    $('#f').addEventListener('submit', (e) => {
      e.preventDefault();
      act(async () => {
        const fd = new FormData(e.target); const foto = fd.get('foto'); fd.delete('foto');
        const r = await api('usuarios', 'POST', '/auth/register', Object.fromEntries([...fd].filter(([, v]) => v !== '')), { auth: false });
        let avisoFoto = '';
        if (foto && foto.size) {
          try { await api('usuarios', 'PUT', '/auth/setup/foto', await reducirImagen(foto, { ancho: 256, cuadrado: true }), { token: r.setup_token }); }
          catch (er) { avisoFoto = `No pudimos guardar la foto (${er.message}). Podrás agregarla después desde «Editar perfil».`; }
        }
        eleccionUsuario(r, avisoFoto);
      });
    });
  }
  // Justo después del registro: el sistema ya asignó un usuario único; el cliente puede aceptarlo o elegir el suyo
  function eleccionUsuario(r, avisoFoto) {
    const c = r.credenciales_demo;
    const credenciales = (usuario) => (c ? `<p style="margin:.5rem 0 0">Modo demostración. Usuario: <code id="cred-user">${esc(usuario)}</code>, contraseña inicial: <code id="cred-pass">${esc(c.password)}</code></p>` : '');
    const fin = (usuario, texto) => {
      $('#reg').innerHTML = `<h1>Todo listo</h1><div class="hint"><b>${esc(texto)}</b> Tu nombre de usuario es <b id="un-final">${esc(usuario)}</b>.${credenciales(usuario)}${c ? '' : '<p style="margin:.5rem 0 0">Revisa tu correo: ahí está tu contraseña inicial.</p>'}</div>${avisoFoto ? `<p class="err" style="margin-top:.75rem">${esc(avisoFoto)}</p>` : ''}<p style="margin-top:1rem"><a class="btn" href="#/login">Ir a ingresar</a></p>`;
    };
    $('#reg').innerHTML = `<h1>Cuenta creada</h1><p>${esc(r.mensaje)}</p>
      <div class="hint">El sistema te asignó el usuario <b id="un-actual">${esc(r.username)}</b>.${credenciales(r.username)}</div>${avisoFoto ? `<p class="err" style="margin-top:.75rem">${esc(avisoFoto)}</p>` : ''}
      <h2 style="margin-top:1.25rem">¿Quieres elegir tu propio nombre de usuario?</h2>
      <p class="muted">Si cancelas, seguirás con <b>${esc(r.username)}</b>. Solo puedes cambiarlo ahora, antes de tu primer ingreso.</p>
      <form id="fu" class="stack" novalidate><div><label for="nu">Nuevo nombre de usuario</label><input id="nu" name="username" maxlength="30" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="por ejemplo: ana.torres">
        <span class="small muted">De 4 a 30 caracteres: letras minúsculas, números, punto, guion o guion bajo.</span></div>
        <div id="un-err" class="err" role="alert" hidden></div>
        <div class="row"><button type="submit">Guardar mi nombre de usuario</button><button type="button" class="alt" id="mantener">Mantener «${esc(r.username)}»</button></div></form>`;
    $('#mantener').addEventListener('click', () => fin(r.username, 'Perfecto, conservas el usuario asignado.'));
    $('#fu').addEventListener('submit', (e) => {
      e.preventDefault();
      const deseado = String(new FormData(e.target).get('username') || '').trim().toLowerCase();
      if (!deseado) return mostrarError($('#un-err'), { message: 'Escribe el nombre de usuario que quieres o pulsa «Mantener».' });
      act(async () => {
        try {
          const u = await api('usuarios', 'POST', '/auth/setup/username', { username: deseado }, { token: r.setup_token });
          fin(u.username, u.cambiado ? 'Listo, guardamos tu nuevo nombre de usuario.' : 'Ese ya era tu usuario.');
        } catch (er) {
          if (er.status === 401) return fin(r.username, 'El plazo para cambiarlo venció, así que conservas el usuario asignado.');
          mostrarError($('#un-err'), er);
        }
      });
    });
  }

  // ================= Mapa de asientos =================
  async function vFuncion(id) {
    if (needLogin()) return;
    titulo('Elegir asientos');
    const [est, disp] = await Promise.all([api('peliculas', 'GET', `/funciones/${id}/estructura`), api('reservas', 'GET', `/funciones/${id}/asientos`)]);
    const f = est.funcion;
    const max = disp.max_boletos;
    const info = new Map();
    est.secciones.forEach((s) => s.filas.forEach((fi) => fi.asientos.forEach((a) => info.set(a.id, { ...a, seccion: s.nombre, tipo: s.tipo, precio: s.precio }))));
    let estados = new Map(disp.asientos.map((a) => [a.asiento_id, a]));
    const sel = new Set();
    let clientes = [];
    if (esStaff()) clientes = await api('usuarios', 'GET', '/clientes').catch(() => []);
    main.innerHTML = `<p><a href="#/">Volver a la cartelera</a></p>
      <h1>${esc(f.pelicula.nombre)}</h1><p class="muted">${esc(fechaLarga(f.fecha))}, ${f.hora_inicio} a ${f.hora_fin}. ${esc(f.sala)}. Clasificación ${esc(f.pelicula.clasificacion)}.</p>
      <div class="layout"><section class="hall" aria-label="Mapa de asientos"><div class="screen">Pantalla</div><div id="mapa"></div>
        <div class="legend" aria-label="Leyenda"><span><i class="seat"></i>Disponible</span><span><i class="seat sel"></i>Tu selección</span><span><i class="seat mio"></i>Retenido por ti</span><span><i class="seat res"></i>Retenido por otro</span><span><i class="seat occ"></i>Ocupado</span><span><i class="seat blk"></i>Fuera de servicio</span></div>
        <p class="small muted" style="margin-top:.75rem">La disponibilidad se actualiza cada 5 segundos. Puedes elegir hasta ${max} asientos por compra.</p></section>
      <aside class="card summary" aria-live="polite"><h2>Tu compra</h2><ul id="lista"></ul><div class="total"><span>Total</span><span id="total">$0.00</span></div>
        ${esStaff() ? `<label for="cli">Reservar a nombre de</label><select id="cli"><option value="">Mi propia cuenta</option>${clientes.filter((c) => c.rol === 'CLIENTE').map((c) => `<option value="${c.id}">${esc(c.nombre)} (${esc(c.dni)})</option>`).join('')}</select><br><br>` : ''}
        <button id="reservar" class="accent" style="width:100%" disabled>Reservar asientos</button>
        <p class="small muted" style="margin-top:.6rem">Retenemos tus asientos ${Math.round(disp.ttl_segundos / 60)} minutos para que confirmes.</p></aside></div>`;
    const clase = (a, s) => (sel.has(a.id) ? 'sel' : s?.estado === 'RESERVADO' ? (s.mio ? 'mio' : 'res') : s?.estado === 'OCUPADO' ? 'occ' : s?.estado === 'BLOQUEADO' ? 'blk' : '');
    const nombreEstado = { DISPONIBLE: 'disponible', RESERVADO: 'retenido', OCUPADO: 'ocupado', BLOQUEADO: 'fuera de servicio' };
    function dibujar() {
      $('#mapa').innerHTML = est.secciones.map((s) => `<div class="sec"><div class="sec-head"><h3>${esc(s.nombre)}</h3><span class="price">${money(s.precio)} por asiento</span></div>
        ${s.filas.map((fi) => `<div class="seatrow"><span class="rowlab">${fi.letra}</span>${fi.asientos.map((a) => {
          const st = estados.get(a.id); const libre = (st?.estado ?? 'DISPONIBLE') === 'DISPONIBLE';
          const ocupado = !libre && !sel.has(a.id);
          return `<button type="button" class="seat ${clase(a, st)}" data-id="${a.id}" ${ocupado ? 'disabled' : ''} aria-pressed="${sel.has(a.id)}" aria-label="Asiento ${a.etiqueta}, ${esc(s.nombre)}, ${money(s.precio)}, ${sel.has(a.id) ? 'seleccionado' : nombreEstado[st?.estado ?? 'DISPONIBLE']}">${a.etiqueta.slice(1)}</button>`;
        }).join('')}</div>`).join('')}</div>`).join('');
      const items = [...sel].map((i) => info.get(i));
      $('#lista').innerHTML = items.length ? items.map((a) => `<li><span>${a.etiqueta}, ${esc(a.seccion)}</span><span>${money(a.precio)}</span></li>`).join('') : '<li class="muted">Aún no eliges asientos</li>';
      $('#total').textContent = money(items.reduce((t, a) => t + a.precio, 0));
      $('#reservar').disabled = !items.length;
      $('#reservar').textContent = items.length ? `Reservar ${items.length} asiento${items.length > 1 ? 's' : ''}` : 'Reservar asientos';
    }
    $('#mapa').addEventListener('click', (e) => {
      const b = e.target.closest('.seat'); if (!b) return;
      const sid = Number(b.dataset.id);
      if (sel.has(sid)) sel.delete(sid);
      else if (sel.size >= max) return toast(`Máximo ${max} asientos por compra`, 'bad');
      else sel.add(sid);
      dibujar();
    });
    $('#reservar').addEventListener('click', () => act(async () => {
      $('#reservar').disabled = true;
      const cli = $('#cli')?.value;
      try {
        const r = await api('reservas', 'POST', '/reservas', { funcion_id: id, asiento_ids: [...sel], ...(cli ? { cliente_id: Number(cli) } : {}) });
        toast('Asientos retenidos. Confirma tu reserva.', 'good');
        location.hash = `#/reserva/${r.id}`;
      } catch (e) {
        if (e.status === 409) { await refrescar(); }
        $('#reservar').disabled = false; throw e;
      }
    }));
    async function refrescar() {
      const d = await api('reservas', 'GET', `/funciones/${id}/asientos`);
      estados = new Map(d.asientos.map((a) => [a.asiento_id, a]));
      for (const sid of [...sel]) if ((estados.get(sid)?.estado ?? 'DISPONIBLE') !== 'DISPONIBLE') { sel.delete(sid); toast(`El asiento ${info.get(sid).etiqueta} acaba de ser tomado`, 'bad'); }
      dibujar();
    }
    every(() => act(refrescar), 5000);
    dibujar();
  }

  // ================= Reserva y boletos =================
  const ticketsHtml = (r) => (r.boletos || []).map((b) => `<article class="ticket"><div class="ticket-main"><div class="film-name">${esc(r.funcion?.pelicula || 'Función')}</div>
      <dl><dt>Fecha</dt><dd>${r.funcion?.fecha ? esc(fechaLarga(r.funcion.fecha)) : ''}</dd><dt>Hora</dt><dd>${esc(r.funcion?.hora_inicio || '')}</dd><dt>Sala</dt><dd>${esc(r.funcion?.sala || '')}</dd>
      <dt>Sección</dt><dd>${esc(b.seccion_tipo)}</dd><dt>Precio</dt><dd>${money(b.precio)}</dd><dt>Reserva</dt><dd>${esc(r.codigo)}</dd></dl></div>
      <div class="ticket-stub"><span class="seatbig">${esc(b.etiqueta)}</span><img src="${b.qr_data_url}" alt="Código QR del asiento ${esc(b.etiqueta)}">${badge(b.estado)}</div></article>`).join('');

  async function vReserva(id) {
    if (needLogin()) return;
    titulo('Reserva');
    const r = await api('reservas', 'GET', `/reservas/${id}`);
    const f = r.funcion || {};
    const cab = `<p><a href="${ses.rol === 'CLIENTE' ? '#/mis-reservas' : '#/panel/reservas'}">Volver a las reservas</a></p><div class="row between"><div><h1>Reserva ${esc(r.codigo)}</h1><p class="muted">${esc(f.pelicula || '')} ${f.fecha ? `, ${esc(fechaLarga(f.fecha))}, ${esc(f.hora_inicio)}, ${esc(f.sala)}` : ''}</p></div>${badge(r.estado)}</div>`;
    if (r.estado === 'PENDIENTE') {
      main.innerHTML = `${cab}<div class="card wide" style="margin:1rem 0"><p class="muted" style="margin:0">Tienes este tiempo para confirmar antes de que liberemos los asientos</p>
        <div class="countdown" id="cd" role="timer">--:--</div>
        <p>${r.cantidad_boletos} asiento${r.cantidad_boletos > 1 ? 's' : ''}, total <b>${money(r.total)}</b></p>
        <div class="row"><button id="conf" class="accent">Confirmar reserva</button><button id="canc" class="alt">Cancelar</button></div></div>`;
      const fin = new Date(r.expira_en).getTime();
      const tick = () => {
        const s = Math.max(0, Math.round((fin - Date.now()) / 1000));
        const el = $('#cd'); if (!el) return;
        el.textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
        el.classList.toggle('low', s <= 60);
        if (s === 0) { toast('La reserva expiró y los asientos se liberaron', 'bad'); route(); }
      };
      tick(); every(tick, 1000);
      $('#conf').addEventListener('click', () => act(async () => { await api('reservas', 'POST', `/reservas/${id}/confirmar`); toast('Reserva confirmada. Aquí están tus boletos.', 'good'); route(); }));
      $('#canc').addEventListener('click', () => act(async () => { await api('reservas', 'POST', `/reservas/${id}/cancelar`); toast('Reserva cancelada'); route(); }));
    } else if (r.estado === 'CONFIRMADA' || r.estado === 'USADA') {
      main.innerHTML = `${cab}<p>Muestra el código QR de cada boleto en la entrada. Total pagado en taquilla: <b>${money(r.total)}</b>.</p><div class="tickets">${ticketsHtml(r)}</div>
        ${r.estado === 'CONFIRMADA' ? '<p style="margin-top:1.25rem"><button id="canc" class="alt">Cancelar reserva</button></p>' : ''}`;
      $('#canc')?.addEventListener('click', () => { if (confirm('¿Cancelar esta reserva? Los boletos se anularán.')) act(async () => { await api('reservas', 'POST', `/reservas/${id}/cancelar`); toast('Reserva cancelada'); route(); }); });
    } else {
      main.innerHTML = `${cab}<div class="empty card">${r.estado === 'EXPIRADA' ? 'Esta reserva expiró porque no se confirmó a tiempo.' : 'Esta reserva fue cancelada.'}<br><a class="btn" style="margin-top:1rem" href="#/">Elegir otra función</a></div>`;
    }
  }

  async function vMisReservas() {
    if (needLogin()) return;
    if (ses.rol !== 'CLIENTE' && !ses.cliente_id) { location.hash = '#/panel'; return; }
    titulo('Mis reservas');
    const q = { funcion_id: sessionStorage.getItem('mr_f') || '', desde: sessionStorage.getItem('mr_d') || '', hasta: sessionStorage.getItem('mr_h') || '' };
    const todo = await api('reservas', 'GET', `/reportes/cliente/${ses.cliente_id}`);
    const params = new URLSearchParams(Object.entries(q).filter(([, v]) => v));
    const rep = params.toString() ? await api('reservas', 'GET', `/reportes/cliente/${ses.cliente_id}?${params}`) : todo;
    const funs = new Map(todo.reservas.map((x) => [x.funcion.id, x.funcion]));
    main.innerHTML = `<h1>Mis reservas</h1><p class="muted">Reporte individual con el historial de tus reservas.</p>
      <form id="f" class="grid card" style="margin-bottom:1rem"><div><label for="ff">Función</label><select id="ff" name="funcion_id"><option value="">Todas</option>${[...funs.values()].map((x) => `<option value="${x.id}" ${String(x.id) === q.funcion_id ? 'selected' : ''}>${esc(x.pelicula || 'Función')} ${esc(x.fecha || '')} ${esc(x.hora_inicio || '')}</option>`).join('')}</select></div>
        <div><label for="fdd">Desde</label><input id="fdd" type="date" name="desde" value="${q.desde}"></div><div><label for="fh">Hasta</label><input id="fh" type="date" name="hasta" value="${q.hasta}"></div>
        <div style="align-self:end"><button type="submit">Filtrar</button> <button type="button" class="alt" id="limpiar">Limpiar</button></div></form>
      <div class="kpis" style="margin-bottom:1rem"><div class="kpi"><b>${rep.total_reservas}</b>reservas</div><div class="kpi"><b>${rep.boletos_emitidos}</b>boletos emitidos</div>
        ${Object.entries(rep.por_estado).filter(([, n]) => n).map(([e, n]) => `<div class="kpi"><b>${n}</b>${esc(e.toLowerCase())}</div>`).join('')}</div>
      ${rep.reservas.length ? `<div class="tablewrap"><table><thead><tr><th>Código</th><th>Película</th><th>Función</th><th>Asientos</th><th>Total</th><th>Estado</th><th></th></tr></thead><tbody>
        ${rep.reservas.map((r) => `<tr><td>${esc(r.codigo)}</td><td>${esc(r.funcion.pelicula || '')}</td><td>${esc(r.funcion.fecha || '')} ${esc(r.funcion.hora_inicio || '')}<br><span class="small muted">${esc(r.funcion.sala || '')}</span></td><td>${esc(r.asientos.join(', ') || '-')}</td><td>${money(r.total)}</td><td>${badge(r.estado)}</td>
        <td><a class="btn sm alt" href="#/reserva/${r.id}">${r.estado === 'PENDIENTE' ? 'Confirmar' : 'Ver boletos'}</a></td></tr>`).join('')}</tbody></table></div>`
        : '<div class="empty card">Todavía no tienes reservas con esos filtros. <a href="#/">Mira la cartelera</a>.</div>'}`;
    $('#f').addEventListener('submit', (e) => { e.preventDefault(); const d = Object.fromEntries(new FormData(e.target)); sessionStorage.setItem('mr_f', d.funcion_id); sessionStorage.setItem('mr_d', d.desde); sessionStorage.setItem('mr_h', d.hasta); route(); });
    $('#limpiar').addEventListener('click', () => { ['mr_f', 'mr_d', 'mr_h'].forEach((k) => sessionStorage.removeItem(k)); route(); });
  }

  // ================= Panel de gestión (administrador y operador) =================
  const TABS = [['reservas', 'Reservas'], ['reportes', 'Reportes'], ['cartelera', 'Películas y funciones'], ['usuarios', 'Usuarios'], ['validar', 'Validar boletos'], ['auditoria', 'Auditoría']];
  async function vPanel(tab) {
    if (needStaff()) return;
    tab = tab || 'reservas';
    titulo('Panel de gestión');
    const tabs = TABS.filter(([k]) => k !== 'auditoria' || ses.rol === 'ADMINISTRADOR');
    const fn = { reservas: tabReservas, reportes: tabReportes, cartelera: tabCartelera, usuarios: tabUsuarios, validar: tabValidar, auditoria: tabAuditoria }[tab];
    if (!fn || !tabs.some(([k]) => k === tab)) { location.hash = '#/panel'; return; }
    main.innerHTML = `<h1>Panel de gestión</h1><nav class="tabs" aria-label="Secciones">${tabs.map(([k, n]) => `<a href="#/panel/${k}"${k === tab ? ' aria-current="page"' : ''}>${n}</a>`).join('')}</nav><div id="tab"></div>`;
    await fn($('#tab'));
  }

  async function tabUsuarios(box, credHtml = '') {
    const us = await api('usuarios', 'GET', '/usuarios');
    const roles = ses.rol === 'ADMINISTRADOR' ? ['CLIENTE', 'OPERADOR', 'ADMINISTRADOR'] : ['CLIENTE'];
    box.innerHTML = `${buscadorHtml('Buscar por usuario, nombre, DNI o correo')}<div class="tablewrap"><table><thead><tr><th>Usuario</th><th>Nombre</th><th>DNI</th><th>Correo</th><th>Rol</th><th>Estado</th><th>Última conexión</th><th></th></tr></thead><tbody>
      ${us.map((u) => `<tr><td>${esc(u.username)}</td><td>${esc([u.cliente?.primer_nombre, u.cliente?.apellido].filter(Boolean).join(' '))}</td><td>${esc(u.cliente?.dni || '')}</td><td>${esc(u.cliente?.correo || '')}</td><td>${esc(u.rol)}</td><td>${badge(u.estado)}</td>
      <td class="small">${u.ultima_conexion ? new Date(u.ultima_conexion).toLocaleString('es-EC') : 'Nunca'}</td>
      <td><div class="row" style="flex-wrap:nowrap">${esAdmin() ? `<button class="sm" data-edit="${u.id}">Editar</button>` : ''}${u.id === ses.usuario_id ? '' : `<button class="sm ${u.estado === 'ACTIVO' ? 'alt' : ''}" data-id="${u.id}" data-e="${u.estado === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO'}">${u.estado === 'ACTIVO' ? 'Desactivar' : 'Activar'}</button>`}</div></td></tr>`).join('')}</tbody></table></div>
      ${credHtml}
      <h2 style="margin-top:1.5rem">Crear usuario</h2><form id="nu" class="grid card">
        <div><label for="n1">Primer nombre</label><input id="n1" name="primer_nombre" required></div><div><label for="n2">Segundo nombre</label><input id="n2" name="segundo_nombre"></div>
        <div><label for="n3">Apellido</label><input id="n3" name="apellido" required></div><div><label for="n4">DNI</label><input id="n4" name="dni" required inputmode="numeric"></div>
        <div><label for="n5">Correo</label><input id="n5" name="correo" type="email" required></div><div><label for="n6">Teléfono</label><input id="n6" name="telefono"></div>
        <div><label for="n7">Rol</label><select id="n7" name="rol">${roles.map((r) => `<option>${r}</option>`).join('')}</select></div>
        <div style="align-self:end"><button type="submit">Crear usuario</button></div></form>`;
    enlazarBuscador(box);
    if (!box.dataset.bound) {
      box.dataset.bound = '1';
      box.addEventListener('click', (e) => {
        const ed = e.target.closest('button[data-edit]');
        if (ed) { act(() => abrirEdicionAdmin(Number(ed.dataset.edit), () => tabUsuarios(box))); return; }
        const b = e.target.closest('button[data-id]'); if (!b) return;
        act(async () => { await api('usuarios', 'PATCH', `/usuarios/${b.dataset.id}/estado`, { estado: b.dataset.e }); toast(`Cuenta ${b.dataset.e === 'ACTIVO' ? 'activada' : 'desactivada'}`, 'good'); await tabUsuarios(box); });
      });
    }
    $('#nu').addEventListener('submit', (e) => {
      e.preventDefault();
      act(async () => {
        const r = await api('usuarios', 'POST', '/usuarios', formData(e.target));
        const c = r.credenciales_demo;
        toast(`Usuario ${r.username} creado`, 'good');
        await tabUsuarios(box, `<div class="hint" style="margin-top:1rem"><b>Cuenta creada.</b> ${r.correo_enviado ? 'Se enviaron las credenciales por correo.' : 'Credenciales de demostración:'} ${c ? `Usuario <code>${esc(c.username)}</code>, contraseña <code>${esc(c.password)}</code>` : ''}</div>`);
      });
    });
  }

  // Editar título, descripción, género, duración, clasificación y póster. No toca funciones, reservas ni boletos existentes.
  function abrirEditarPelicula(p, alGuardar) {
    const m = modal(`Editar «${p.nombre}»`, `<form id="ep" class="stack" novalidate>
      <div class="foto-fila"><div class="thumb-grande">${urlPoster(p) ? `<img src="${esc(urlPoster(p))}" alt="Póster actual">` : '<span class="small muted">Sin póster</span>'}</div>
        <div><label for="ep-img">Póster (JPG, PNG o WEBP)</label><input id="ep-img" type="file" accept="image/jpeg,image/png,image/webp">
        ${p.imagen_url ? '<label class="checkline"><input id="ep-quitar" type="checkbox"> Quitar el póster actual</label>' : ''}</div></div>
      <div class="grid2"><div><label for="ep-n">Título</label><input id="ep-n" name="nombre" value="${esc(p.nombre)}" maxlength="150"></div>
        <div><label for="ep-g">Género</label><input id="ep-g" name="genero" value="${esc(p.genero)}" maxlength="40"></div>
        <div><label for="ep-d">Duración (min)</label><input id="ep-d" name="duracion_min" type="number" min="1" max="400" value="${p.duracion_min}"></div>
        <div><label for="ep-c">Clasificación</label><select id="ep-c" name="clasificacion">${['TP', '+12', '+15', '+18'].map((c) => `<option ${c === p.clasificacion ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
        <div class="span2"><label for="ep-ds">Descripción</label><textarea id="ep-ds" name="descripcion" rows="3">${esc(p.descripcion || '')}</textarea></div></div>
      <p class="hint small">Los cambios no afectan las funciones programadas, las reservas ni los boletos ya emitidos.</p>
      <div id="ep-err" class="err" role="alert" hidden></div>
      <div class="row end"><button type="button" class="alt" data-cerrar>Cancelar</button><button type="submit">Guardar cambios</button></div></form>`);
    m.q('#ep').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const fd = new FormData(ev.target);
      const datos = { nombre: String(fd.get('nombre')).trim(), genero: String(fd.get('genero')).trim(), duracion_min: Number(fd.get('duracion_min')), clasificacion: fd.get('clasificacion'), descripcion: String(fd.get('descripcion') || '').trim() };
      if (!datos.nombre || !datos.genero || !(datos.duracion_min > 0)) return mostrarError(m.q('#ep-err'), { message: 'Completa título, género y duración' });
      try {
        await api('peliculas', 'PUT', `/peliculas/${p.id}`, datos);
        const f = m.q('#ep-img').files?.[0];
        if (f) await subirPoster(p.id, f);
        else if (m.q('#ep-quitar')?.checked) await api('peliculas', 'DELETE', `/peliculas/${p.id}/imagen`);
        toast('Película actualizada', 'good'); m.cerrar(); alGuardar?.();
      } catch (er) { mostrarError(m.q('#ep-err'), er); }
    });
  }

  async function tabCartelera(box) {
    const fecha = sessionStorage.getItem('pf_fecha') || hoyEC();
    const [pelis, salas, funs] = await Promise.all([api('peliculas', 'GET', '/peliculas?estado=TODAS'), api('peliculas', 'GET', '/salas'), api('peliculas', 'GET', `/funciones?fecha=${fecha}&estado=TODAS`)]);
    box.innerHTML = `<h2>Películas</h2>${buscadorHtml('Buscar película por nombre, género o clasificación')}<div class="tablewrap"><table><thead><tr><th>Póster</th><th>Nombre</th><th>Género</th><th>Duración</th><th>Clasificación</th><th>Estado</th><th></th></tr></thead><tbody>
      ${pelis.map((p) => `<tr><td>${urlPoster(p) ? `<img class="thumb" src="${esc(urlPoster(p))}" alt="Póster de ${esc(p.nombre)}" loading="lazy">` : '<span class="small muted">Sin póster</span>'}</td><td>${esc(p.nombre)}</td><td>${esc(p.genero)}</td><td>${p.duracion_min} min</td><td>${esc(p.clasificacion)}</td><td>${badge(p.estado)}</td>
      <td><button class="sm" data-edpel="${p.id}">Editar</button> ${['ACTIVA', 'INACTIVA', 'RETIRADA'].filter((s) => s !== p.estado).map((s) => `<button class="sm alt" data-pel="${p.id}" data-e="${s}">${{ ACTIVA: 'Activar', INACTIVA: 'Desactivar', RETIRADA: 'Retirar' }[s]}</button>`).join(' ')}</td></tr>`).join('')}</tbody></table></div>
      <form id="np" class="grid card" style="margin-top:1rem"><div><label for="p1">Nombre</label><input id="p1" name="nombre" required></div><div><label for="p2">Género</label><input id="p2" name="genero" required></div>
        <div><label for="p3">Duración (min)</label><input id="p3" name="duracion_min" type="number" min="1" max="400" required></div>
        <div><label for="p4">Clasificación</label><select id="p4" name="clasificacion"><option>TP</option><option>+12</option><option>+15</option><option>+18</option></select></div>
        <div style="grid-column:1/-1"><label for="p5">Descripción</label><input id="p5" name="descripcion"></div>
        <div style="grid-column:1/-1"><label for="p6">Póster (opcional)</label><input id="p6" name="poster" type="file" accept="image/jpeg,image/png,image/webp"></div><div><button type="submit">Agregar película</button></div></form>
      <h2 style="margin-top:2rem">Funciones</h2><div class="row" style="margin-bottom:.75rem"><label for="pf" style="margin:0">Día</label><input id="pf" type="date" value="${fecha}" style="width:auto"></div>
      <div class="tablewrap"><table><thead><tr><th>Película</th><th>Sala</th><th>Horario</th><th>Estado</th><th></th></tr></thead><tbody>
      ${funs.map((f) => `<tr><td>${esc(f.pelicula.nombre)}</td><td>${esc(f.sala)}</td><td>${f.hora_inicio} a ${f.hora_fin}</td><td>${badge(f.estado)}</td><td>${f.estado === 'ACTIVA' ? `<button class="sm danger" data-fun="${f.id}">Cancelar función</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">Sin funciones este día</td></tr>'}</tbody></table></div>
      <form id="nf" class="grid card" style="margin-top:1rem"><div><label for="f1">Película</label><select id="f1" name="pelicula_id">${pelis.filter((p) => p.estado === 'ACTIVA').map((p) => `<option value="${p.id}">${esc(p.nombre)}</option>`).join('')}</select></div>
        <div><label for="f2">Sala</label><select id="f2" name="sala_id">${salas.map((s) => `<option value="${s.id}">${esc(s.nombre)}</option>`).join('')}</select></div>
        <div><label for="f3">Fecha</label><input id="f3" name="fecha" type="date" value="${fecha}" required></div><div><label for="f4">Hora de inicio</label><input id="f4" name="hora_inicio" type="time" required></div>
        <div style="align-self:end"><button type="submit">Programar función</button></div></form>
      <h2 style="margin-top:2rem">Salas, secciones y asientos</h2><div class="grid">${salas.map((s) => `<div class="card"><h3>${esc(s.nombre)}</h3>${s.secciones.map((x) => `<p class="small" style="margin:.2rem 0"><b>${esc(x.nombre)}</b>, ${money(x.precio)}: ${x.num_filas} filas de ${x.asientos_por_fila} asientos (${x.capacidad})</p>`).join('')}</div>`).join('')}</div>`;
    enlazarBuscador(box);
    $('#pf').addEventListener('change', (e) => { sessionStorage.setItem('pf_fecha', e.target.value); route(); });
    box.addEventListener('click', (e) => {
      const ed = e.target.closest('[data-edpel]');
      if (ed) { act(async () => abrirEditarPelicula(pelis.find((x) => x.id === Number(ed.dataset.edpel)), () => route())); return; }
      const p = e.target.closest('[data-pel]'); const f = e.target.closest('[data-fun]');
      if (p) act(async () => { await api('peliculas', 'PATCH', `/peliculas/${p.dataset.pel}/estado`, { estado: p.dataset.e }); toast('Estado actualizado', 'good'); route(); });
      if (f && confirm('¿Cancelar la función? Se cancelarán también sus reservas.')) act(async () => { await api('peliculas', 'PATCH', `/funciones/${f.dataset.fun}/cancelar`); toast('Función cancelada. Reservas avisó a los clientes afectados.', 'good'); route(); });
    });
    $('#np').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target); const poster = fd.get('poster'); fd.delete('poster');
      const d = Object.fromEntries([...fd].filter(([, v]) => v !== '')); d.duracion_min = Number(d.duracion_min);
      act(async () => {
        const p = await api('peliculas', 'POST', '/peliculas', d);
        if (poster && poster.size) { try { await subirPoster(p.id, poster); } catch (er) { fail(er); } }
        toast('Película agregada', 'good'); route();
      });
    });
    $('#nf').addEventListener('submit', (e) => { e.preventDefault(); const d = formData(e.target); d.pelicula_id = Number(d.pelicula_id); d.sala_id = Number(d.sala_id); d.hora_inicio += ':00'; act(async () => { await api('peliculas', 'POST', '/funciones', d); toast('Función programada', 'good'); route(); }); });
  }

  async function tabReservas(box) {
    const q = { estado: sessionStorage.getItem('pr_e') || '', pelicula_id: sessionStorage.getItem('pr_p') || '', funcion_id: sessionStorage.getItem('pr_f') || '' };
    const params = new URLSearchParams(Object.entries(q).filter(([, v]) => v));
    const [rs, pelis, clientes] = await Promise.all([api('reservas', 'GET', `/reservas?${params}`), api('peliculas', 'GET', '/peliculas?estado=TODAS'), api('usuarios', 'GET', '/clientes')]);
    const nombre = new Map(clientes.map((c) => [c.id, c.nombre]));
    box.innerHTML = `<form id="f" class="grid card" style="margin-bottom:1rem"><div><label for="e">Estado</label><select id="e" name="estado"><option value="">Todos</option>${['PENDIENTE', 'CONFIRMADA', 'CANCELADA', 'EXPIRADA', 'USADA'].map((s) => `<option ${s === q.estado ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
      <div><label for="p">Película</label><select id="p" name="pelicula_id"><option value="">Todas</option>${pelis.map((p) => `<option value="${p.id}" ${String(p.id) === q.pelicula_id ? 'selected' : ''}>${esc(p.nombre)}</option>`).join('')}</select></div>
      <div><label for="fu">Función (número)</label><input id="fu" name="funcion_id" type="number" min="1" value="${esc(q.funcion_id)}"></div><div style="align-self:end"><button type="submit">Filtrar</button></div></form>
      ${buscadorHtml('Buscar por código, cliente, película o asiento')}<div class="tablewrap"><table><thead><tr><th>Código</th><th>Cliente</th><th>Película y función</th><th>Asientos</th><th>Total</th><th>Estado</th><th></th></tr></thead><tbody>
      ${rs.map((r) => `<tr><td>${esc(r.codigo)}</td><td>${esc(nombre.get(r.cliente_id) || `Cliente ${r.cliente_id}`)}${r.gestionado_por ? '<br><span class="small muted">Gestionada por el personal</span>' : ''}</td>
      <td>${esc(r.funcion.pelicula || `Función ${r.funcion_id}`)}<br><span class="small muted">#${r.funcion_id}, ${esc(r.funcion.fecha || '')} ${esc(r.funcion.hora_inicio || '')}, ${esc(r.funcion.sala || '')}</span></td>
      <td>${esc((r.asientos || []).join(', ') || `${r.cantidad_boletos} sin boleto`)}</td><td>${money(r.total)}</td><td>${badge(r.estado)}</td>
      <td><a class="btn sm alt" href="#/reserva/${r.id}">Ver</a> ${['PENDIENTE', 'CONFIRMADA'].includes(r.estado) ? `<button class="sm danger" data-c="${r.id}">Cancelar</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="7" class="muted">No hay reservas con esos filtros</td></tr>'}</tbody></table></div>`;
    enlazarBuscador(box);
    $('#f').addEventListener('submit', (e) => { e.preventDefault(); const d = Object.fromEntries(new FormData(e.target)); sessionStorage.setItem('pr_e', d.estado); sessionStorage.setItem('pr_p', d.pelicula_id); sessionStorage.setItem('pr_f', d.funcion_id); route(); });
    box.addEventListener('click', (e) => { const b = e.target.closest('[data-c]'); if (b && confirm('¿Cancelar esta reserva?')) act(async () => { await api('reservas', 'POST', `/reservas/${b.dataset.c}/cancelar`); toast('Reserva cancelada', 'good'); route(); }); });
  }

  async function tabReportes(box) {
    const desde = sessionStorage.getItem('rp_d') || hoyEC();
    const hasta = sessionStorage.getItem('rp_h') || sumaDias(hoyEC(), 3);
    const [pelis, clientes] = await Promise.all([api('peliculas', 'GET', '/peliculas?estado=TODAS'), api('usuarios', 'GET', '/clientes')]);
    box.innerHTML = `<h2>Reporte general consolidado</h2><form id="f" class="grid card"><div><label for="d">Desde</label><input id="d" type="date" name="desde" value="${desde}" required></div><div><label for="h">Hasta</label><input id="h" type="date" name="hasta" value="${hasta}" required></div>
      <div><label for="pp">Película</label><select id="pp" name="pelicula_id"><option value="">Todas</option>${pelis.map((p) => `<option value="${p.id}">${esc(p.nombre)}</option>`).join('')}</select></div><div style="align-self:end"><button type="submit">Generar reporte</button></div></form>
      <div id="rep" style="margin-top:1rem"></div>
      <h2 style="margin-top:2rem">Reporte individual por cliente</h2><div class="row"><select id="cl" style="max-width:340px"><option value="">Elige un cliente</option>${clientes.map((c) => `<option value="${c.id}">${esc(c.nombre)} (${esc(c.rol.toLowerCase())})</option>`).join('')}</select></div><div id="repc" style="margin-top:1rem"></div>`;
    const pct = (n) => `<div class="row" style="flex-wrap:nowrap"><div class="bar-o" role="img" aria-label="${n}% de ocupación"><i style="width:${Math.min(100, n)}%"></i></div><span class="small">${n}%</span></div>`;
    async function generar(d) {
      const q = new URLSearchParams(Object.entries(d).filter(([, v]) => v));
      const r = await api('reservas', 'GET', `/reportes/general?${q}`);
      $('#rep').innerHTML = `<div class="kpis"><div class="kpi"><b>${r.total_funciones}</b>funciones</div><div class="kpi"><b>${r.total_reservas}</b>reservas</div>${Object.entries(r.por_estado).map(([e, n]) => `<div class="kpi"><b>${n}</b>${esc(e.toLowerCase())}</div>`).join('')}</div>
        <h3 style="margin-top:1.25rem">Por película</h3><div class="tablewrap"><table><thead><tr><th>Película</th><th>Funciones</th><th>Reservas</th><th>Ocupados</th><th>Retenidos</th><th>Disponibles</th><th>Ocupación</th></tr></thead><tbody>
        ${r.por_pelicula.map((p) => `<tr><td>${esc(p.pelicula)}</td><td>${p.funciones}</td><td>${p.reservas}</td><td>${p.ocupados}</td><td>${p.reservados}</td><td>${p.disponibles}</td><td>${pct(p.ocupacion_pct)}</td></tr>`).join('')}</tbody></table></div>
        <h3 style="margin-top:1.25rem">Por función y sección</h3><div class="tablewrap"><table><thead><tr><th>Función</th><th>Reservas por estado</th><th>Ocupados</th><th>Disponibles</th><th>Ocupación</th><th>Secciones (ocupados de capacidad)</th></tr></thead><tbody>
        ${r.funciones.map((f) => `<tr><td>${esc(f.pelicula)}<br><span class="small muted">#${f.funcion_id}, ${esc(f.fecha)} ${esc(f.hora_inicio)}, ${esc(f.sala)} ${f.estado_funcion !== 'ACTIVA' ? badge(f.estado_funcion) : ''}</span></td>
        <td class="small">${Object.entries(f.reservas_por_estado).filter(([, n]) => n).map(([e, n]) => `${n} ${e.toLowerCase()}`).join(', ') || 'Sin reservas'}</td><td>${f.ocupados}${f.reservados ? ` (+${f.reservados} retenidos)` : ''}</td><td>${f.disponibles}</td><td>${pct(f.ocupacion_pct)}</td>
        <td class="small">${f.secciones.map((s) => `${esc(s.tipo)} ${s.ocupados + s.reservados}/${s.capacidad - s.bloqueados}`).join(', ')}</td></tr>`).join('')}</tbody></table></div>`;
    }
    $('#f').addEventListener('submit', (e) => { e.preventDefault(); const d = Object.fromEntries(new FormData(e.target)); sessionStorage.setItem('rp_d', d.desde); sessionStorage.setItem('rp_h', d.hasta); act(() => generar(d)); });
    $('#cl').addEventListener('change', (e) => { if (!e.target.value) { $('#repc').innerHTML = ''; return; } act(async () => {
      const r = await api('reservas', 'GET', `/reportes/cliente/${e.target.value}`);
      $('#repc').innerHTML = `<div class="kpis"><div class="kpi"><b>${r.total_reservas}</b>reservas</div><div class="kpi"><b>${r.boletos_emitidos}</b>boletos emitidos</div></div>
        <div class="tablewrap" style="margin-top:.75rem"><table><thead><tr><th>Código</th><th>Película</th><th>Función</th><th>Asientos</th><th>Total</th><th>Estado</th></tr></thead><tbody>${r.reservas.map((x) => `<tr><td>${esc(x.codigo)}</td><td>${esc(x.funcion.pelicula || '')}</td><td>${esc(x.funcion.fecha || '')} ${esc(x.funcion.hora_inicio || '')}</td><td>${esc(x.asientos.join(', '))}</td><td>${money(x.total)}</td><td>${badge(x.estado)}</td></tr>`).join('') || '<tr><td colspan="6" class="muted">Sin reservas</td></tr>'}</tbody></table></div>`;
    }); });
    await generar({ desde, hasta });
  }

  // ----- Lector de QR: usa BarcodeDetector (nativo en Chrome/Edge para Android y macOS) y jsQR como alternativa.
  // jsQR va incluido en vendor/ (sin depender de internet ni de un CDN).
  let jsqrPromise = null;
  function cargarJsQR() {
    if (window.jsQR) return Promise.resolve(window.jsQR);
    jsqrPromise ??= new Promise((resolve) => {
      const sc = document.createElement('script');
      sc.src = 'vendor/jsQR.js';
      sc.onload = () => resolve(window.jsQR || null);
      sc.onerror = () => { console.warn('No se pudo cargar vendor/jsQR.js'); jsqrPromise = null; resolve(null); };
      document.head.append(sc);
    });
    return jsqrPromise;
  }
  async function crearLector() {
    const jsQR = await cargarJsQR();
    let nativo = null;
    if ('BarcodeDetector' in window) {
      try {
        if ((await window.BarcodeDetector.getSupportedFormats()).includes('qr_code')) nativo = new window.BarcodeDetector({ formats: ['qr_code'] });
      } catch { nativo = null; }
    }
    if (!nativo && !jsQR) return null;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    return async (video) => {
      if (nativo) {
        try { return (await nativo.detect(video))[0]?.rawValue || null; } catch { nativo = null; } // si falla, sigue con jsQR
      }
      if (!jsQR || !video.videoWidth) return null;
      const k = Math.min(1, 640 / video.videoWidth);
      canvas.width = Math.round(video.videoWidth * k); canvas.height = Math.round(video.videoHeight * k);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      return jsQR(img.data, img.width, img.height)?.data || null;
    };
  }

  function tabValidar(box) {
    let stream = null; let scanTimer = null; let ocupado = false;
    box.innerHTML = `<div class="card wide" style="margin:0"><h2>Validar boleto</h2>
      <p class="muted">Cada boleto entra una sola vez. Ingresa el código o escanea el QR del boleto con la cámara.</p>
      <div class="seg" role="tablist" aria-label="Forma de validar">
        <button type="button" role="tab" id="m-man" aria-selected="true" aria-controls="p-man">Ingresar código</button>
        <button type="button" role="tab" id="m-cam" aria-selected="false" aria-controls="p-cam">Escanear con cámara</button></div>
      <div id="p-man" role="tabpanel"><form id="f" class="stack"><div><label for="c">Código del boleto</label><textarea id="c" name="codigo" rows="2" required autocomplete="off"></textarea></div><button type="submit">Validar entrada</button></form></div>
      <div id="p-cam" role="tabpanel" hidden><div class="cam"><video id="vid" playsinline muted></video><div class="cam-frame" aria-hidden="true"></div></div>
        <p id="cam-msg" class="small muted" role="status" style="margin:.6rem 0">Pulsa «Abrir cámara» y apunta al código QR del boleto.</p>
        <div class="row"><button type="button" id="cam-start">Abrir cámara</button><button type="button" id="cam-stop" class="alt" hidden>Detener cámara</button></div></div>
      <div id="res" style="margin-top:1rem" aria-live="polite"></div></div>`;
    const msg = (t) => { const m = $('#cam-msg'); if (m) m.textContent = t; };
    function detener() {
      clearInterval(scanTimer); scanTimer = null;
      stream?.getTracks().forEach((t) => t.stop()); stream = null;
      const v = $('#vid'); if (v) v.srcObject = null;
      const st = $('#cam-start'); const sp = $('#cam-stop');
      if (st) st.hidden = false;
      if (sp) sp.hidden = true;
    }
    cleanups.push(detener); // apaga la cámara al salir de esta pantalla
    function modo(cam) {
      $('#m-man').setAttribute('aria-selected', String(!cam)); $('#m-cam').setAttribute('aria-selected', String(cam));
      $('#p-man').hidden = cam; $('#p-cam').hidden = !cam;
      if (!cam) detener();
    }
    async function validar(codigo) {
      try {
        const r = await api('reservas', 'POST', '/boletos/validar', { codigo: codigo.trim() });
        $('#res').innerHTML = `<div class="hint"><b>Entrada válida.</b> Asiento ${esc(r.boleto.etiqueta)}, sección ${esc(r.boleto.seccion_tipo)}. Reserva ${esc(r.reserva.codigo)} (${esc(r.reserva.estado)}).</div>`;
        toast('Boleto validado', 'good');
      } catch (er) {
        $('#res').innerHTML = `<div class="err"><b>No se permite la entrada.</b> ${esc(er.message)}</div>`;
        fail(er);
      }
    }
    async function abrirCamara() {
      if (!navigator.mediaDevices?.getUserMedia) {
        msg(window.isSecureContext === false ? 'La cámara solo funciona con https o en localhost. Ingresa el código manualmente.' : 'Este navegador no permite usar la cámara. Ingresa el código manualmente.');
        return;
      }
      msg('Solicitando permiso para usar la cámara...');
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      } catch (e) {
        msg(e.name === 'NotAllowedError' ? 'No diste permiso para usar la cámara. Actívalo en el navegador o ingresa el código manualmente.'
          : e.name === 'NotFoundError' ? 'No se encontró ninguna cámara en este dispositivo.' : `No se pudo abrir la cámara (${e.name}).`);
        return;
      }
      const v = $('#vid'); v.srcObject = stream; await v.play().catch(() => {});
      msg('Cargando el lector de QR...');
      const leer = await crearLector();
      if (!leer) { detener(); msg('No se pudo iniciar el lector de QR (falta el archivo vendor/jsQR.js en el servidor del frontend). Ingresa el código manualmente.'); return; }
      $('#cam-start').hidden = true; $('#cam-stop').hidden = false;
      msg('Apunta la cámara al código QR del boleto.');
      scanTimer = setInterval(async () => {
        if (ocupado || !stream) return;
        ocupado = true;
        try {
          const codigo = await leer(v);
          if (codigo) {
            detener(); $('#c').value = codigo; msg('Código leído. Validando...');
            await validar(codigo);
            msg('Pulsa «Abrir cámara» para escanear el siguiente boleto.');
          }
        } catch { /* cuadro sin QR: sigue intentando */ } finally { ocupado = false; }
      }, 300);
    }
    $('#m-man').addEventListener('click', () => modo(false));
    $('#m-cam').addEventListener('click', () => modo(true));
    $('#cam-start').addEventListener('click', abrirCamara);
    $('#cam-stop').addEventListener('click', () => { detener(); msg('Cámara detenida.'); });
    $('#f').addEventListener('submit', (e) => { e.preventDefault(); validar(new FormData(e.target).get('codigo')); });
  }

  async function tabAuditoria(box) {
    const rs = await api('usuarios', 'GET', '/auditoria?limit=100');
    box.innerHTML = `<p class="muted">Registro de acciones de administradores y operadores. Los envían Películas y Reservas a Usuarios.</p>${buscadorHtml('Buscar por usuario, acción, entidad o descripción')}<div class="tablewrap"><table><thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Entidad</th><th>Descripción</th></tr></thead><tbody>
      ${rs.map((a) => `<tr><td class="small">${new Date(a.fecha_accion).toLocaleString('es-EC')}</td><td>${esc(a.username || a.usuario_id)}</td><td>${esc(a.accion)}</td><td>${esc(a.entidad)} ${a.entidad_id ?? ''}</td><td>${esc(a.descripcion || '')}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">Sin registros</td></tr>'}</tbody></table></div>`;
    enlazarBuscador(box);
  }

  // ================= Estado de las conexiones =================
  async function vConexiones() {
    if (needLogin()) return;
    if (!esAdmin()) { location.hash = '#/'; toast('Esta sección es solo para administradores', 'bad'); return; }
    titulo('Conexiones');
    const svcs = [['usuarios', 'Usuarios', 'Node.js, OAuth 2.0 y JWT RS256'], ['peliculas', 'Películas', 'Python y FastAPI'], ['reservas', 'Reservas', 'Node.js y Express']];
    main.innerHTML = `<h1>Conexiones entre servicios</h1><p class="muted">El navegador habla con los tres microservicios; ellos se hablan entre sí por REST. Abre «Llamadas API» (abajo a la derecha) para ver cada petición.</p>
      <div class="grid" id="svcs"></div><div class="card" style="margin-top:1rem"><h2>Cómo se relacionan</h2><ul class="stack" style="padding-left:1.2rem;margin:0">
      <li>Películas y Reservas validan cada token con la clave pública que publica Usuarios (JWKS), sin compartir secretos.</li>
      <li>Reservas pide a Películas la estructura de la sala y los precios para calcular el total en el servidor.</li>
      <li>Películas y Reservas envían la auditoría de las acciones del personal a Usuarios, con un token de servicio.</li>
      <li>Si el personal cancela una función en Películas, Reservas cancela las reservas afectadas y libera los asientos.</li></ul>
      <p style="margin-top:1rem"><button id="re">Probar de nuevo</button></p><div id="jwk" class="small muted"></div></div>`;
    async function probar() {
      const base = (u) => u.replace('/api/v1', '');
      const out = await Promise.all(svcs.map(async ([k, n, d]) => {
        const t0 = performance.now();
        try {
          const r = await fetch(`${base(C[k])}/health`); const ok = r.ok; addCall(k, 'GET', '/health', r.status, Math.round(performance.now() - t0));
          return `<div class="card svc-${k}"><h3><i class="dot svc"></i>${n}</h3><p class="small muted">${d}</p><p>${ok ? badge('ACTIVO') : badge('INACTIVO')} <span class="small">${Math.round(performance.now() - t0)} ms</span></p><p class="small"><a href="${base(C[k])}/docs" target="_blank" rel="noopener">Abrir Swagger</a></p></div>`;
        } catch { addCall(k, 'GET', '/health', 'ERR', 0); return `<div class="card svc-${k}"><h3><i class="dot svc"></i>${n}</h3><p>${badge('INACTIVO')}</p><p class="small err">Sin respuesta en ${esc(base(C[k]))}</p></div>`; }
      }));
      $('#svcs').innerHTML = out.join('');
      try { const j = await (await fetch(`${base(C.usuarios)}/.well-known/jwks.json`)).json(); $('#jwk').textContent = `Clave pública vigente (kid): ${j.keys[0].kid}`; } catch { $('#jwk').textContent = ''; }
    }
    $('#re').addEventListener('click', probar);
    await probar();
  }

  // ================= Router =================
  const routes = [[/^\/$/, vCartelera], [/^\/login$/, vLogin], [/^\/registro$/, vRegistro], [/^\/funcion\/(\d+)$/, (id) => vFuncion(Number(id))], [/^\/reserva\/(\d+)$/, (id) => vReserva(Number(id))],
    [/^\/mis-reservas$/, vMisReservas], [/^\/panel(?:\/(\w+))?$/, vPanel], [/^\/conexiones$/, vConexiones]];
  async function route() {
    timers.splice(0).forEach(clearInterval);
    cleanups.splice(0).forEach((f) => f());
    renderTopbar();
    const path = location.hash.slice(1) || '/';
    for (const [re, fn] of routes) {
      const m = path.match(re);
      if (!m) continue;
      try { await fn(...m.slice(1)); } catch (e) {
        if (e.code === 'SESION_EXPIRADA') return;
        fail(e);
        main.innerHTML = `<div class="narrow card err"><b>No pudimos cargar esta pantalla.</b><br>${esc(e.message)}<p style="margin:.75rem 0 0"><a href="#/conexiones">Revisar el estado de los servicios</a></p></div>`;
      }
      return;
    }
    main.innerHTML = '<div class="empty">No encontramos esa página. <a href="#/">Volver a la cartelera</a></div>';
  }
  window.addEventListener('hashchange', route);
  window.__cine = { route, cargarJsQR };
  route();
  refrescarSesion();
})();
