// ========================================
// 🛍️ PREVENTAS (Ventas de uniformes) — js/sales.js
// El club arma una preventa (campaña) con ítems (foto, precio opcional, tallas);
// los padres piden tallas desde su portal; acá el club ve el consolidado por
// ítem/talla y descarga el PDF para el proveedor.
//
// Reglas de la casa aplicadas:
// - Aislamiento por club: TODA consulta filtra club_id (además de la RLS).
// - Fetch con patrón anon+interceptor (supabase-auth-v2 mete el JWT real).
// - Escrituras con Prefer: return=representation&select=id y verificación de
//   que volvió al menos una fila (familia de "fallos silenciosos").
// - PostgREST corta en 1000 filas → pedidos paginados con Range + order=id.
// - Todo dato dinámico escapado antes de entrar al HTML.
// - Sin license-exempt: con licencia vencida, el interceptor de solo-lectura
//   bloquea estas acciones solo (a propósito).
// ========================================

// ── Helpers locales ──────────────────────────────────────────────────────────
function _svEsc(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function _svId(prefix) {
  return (prefix || 'sv') + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// Patrón de la casa: anon key en el header; el interceptor global lo reemplaza
// por el JWT del usuario logueado. Sin sesión → RLS bloquea (fail-closed).
function _svHeaders(extra) {
  return Object.assign({
    apikey: window.SUPA_ANON,
    Authorization: `Bearer ${window.SUPA_ANON}`,
    'Content-Type': 'application/json',
  }, extra || {});
}

function _svClubId() {
  return (typeof getClubId === 'function' ? getClubId() : null) || localStorage.getItem('clubId') || '';
}

// Las escrituras dependen de get_my_club_id() (RLS), que lee app_metadata.club_id
// del JWT. Si el token quedó viejo y NO trae ese claim (podés estar logueado igual
// gracias a users_read_self), toda escritura da 403. Acá lo refrescamos: Supabase
// re-lee app_metadata al refrescar y recupera club_id. Barato: solo refresca si falta.
// Las escrituras dependen de get_my_club_id() (RLS), que lee app_metadata.club_id
// del JWT. OJO: hay DOS ayudantes de auth y el interceptor de supabase-auth.js (v1)
// PISA el header con SU token. Si v1 arrastra una sesión vieja (ej. un mint de
// coach/padre) sin club_id, toda escritura da 403 aunque v2 tenga el token bueno.
// Acá: (1) se refresca v2 si le falta el claim; (2) si el token que REALMENTE va a
// viajar no trae club_id, se avisa claro en vez de dejar un 403 sin explicación.
function _svDecodeClaims(token) {
  try {
    return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
  } catch (_) { return null; }
}

// El token que gana es el de v1 si tiene sesión (su interceptor sobrescribe), si no el de v2
function _svTokenEnUso() {
  // Mismo orden que el interceptor: v2 manda y v1 sólo entra si v2 no tiene sesión.
  const t2 = window.SupaAuthV2 && typeof window.SupaAuthV2.getToken === 'function' ? window.SupaAuthV2.getToken() : null;
  if (t2) return { token: t2, origen: 'v2' };
  const t1 = window.SupaAuth && typeof window.SupaAuth.getToken === 'function' ? window.SupaAuth.getToken() : null;
  return t1 ? { token: t1, origen: 'v1' } : { token: null, origen: null };
}

async function _svEnsureClaim() {
  try {
    const sa = window.SupaAuthV2;
    if (sa && typeof sa.getClubId === 'function' && !sa.getClubId() && typeof sa.refreshToken === 'function') {
      console.log('[Preventa] JWT sin club_id → refrescando token…');
      await sa.refreshToken();
    }
  } catch (e) { console.warn('[Preventa] no se pudo refrescar el token:', e?.message || e); }
}

// true = el token que viaja sirve para escribir. false = ya avisamos al usuario.
function _svClaimListo() {
  const { token, origen } = _svTokenEnUso();
  if (!token) {
    showToast('🔒 Tu sesión venció. Cerrá sesión y volvé a entrar.');
    return false;
  }
  const claims = _svDecodeClaims(token);
  const club = claims && claims.app_metadata ? claims.app_metadata.club_id : null;
  if (!club) {
    console.warn('[Preventa] el token en uso (' + origen + ') no trae app_metadata.club_id');
    showToast('🔒 Tu sesión perdió el club. Cerrá sesión y volvé a entrar para continuar.');
    return false;
  }
  return true;
}


// Escritura centralizada: informa el error REAL y se auto-cura una vez.
// (Antes cada write decía "sin fila de vuelta" y no se sabía si era 403, red o RLS.)
/* Diagnóstico de la preventa. Se corre a mano desde la consola: _svDiag()
   Dice QUÉ token viaja, qué club ve la base y si el UPDATE devuelve filas.
   Es inofensivo: el PATCH de prueba escribe deleted=false sobre una fila que YA
   está en false, así que no cambia ningún dato. */
window._svDiag = async function () {
  const linea = (k, v) => console.log('  ' + k.padEnd(22) + ':', v);
  console.log('%c=== DIAGNÓSTICO PREVENTA ===', 'font-weight:bold');

  for (const [nombre, api] of [['v1 (SupaAuth)', window.SupaAuth], ['v2 (SupaAuthV2)', window.SupaAuthV2]]) {
    const t = api && typeof api.getToken === 'function' ? api.getToken() : null;
    if (!t) { linea(nombre, 'sin token'); continue; }
    const c = _svDecodeClaims(t) || {};
    const venc = c.exp ? new Date(c.exp * 1000) : null;
    linea(nombre, `role=${c.role} club=${(c.app_metadata || {}).club_id} rol=${(c.app_metadata || {}).app_role} vence=${venc ? venc.toLocaleTimeString() : '?'}${venc && venc < new Date() ? ' ⛔VENCIDO' : ''}`);
  }
  const { origen } = _svTokenEnUso();
  linea('token que se usa', origen);
  linea('clubId del navegador', _svClubId());

  const it = _svItems[0];
  if (!it) { console.log('  (no hay ítems cargados para probar)'); return; }
  linea('ítem de prueba', it.id + ' — ' + it.name);

  const base = `${window.SUPA_URL}/rest/v1/sale_items?id=eq.${encodeURIComponent(it.id)}&club_id=eq.${encodeURIComponent(_svClubId())}`;
  const g = await fetch(base + '&select=id,club_id,deleted', { headers: _svHeaders() });
  linea('LECTURA (GET)', g.status + ' → ' + (await g.text()));
  const p = await fetch(base + '&select=id', {
    method: 'PATCH', headers: _svHeaders({ Prefer: 'return=representation' }),
    body: JSON.stringify({ deleted: false }),
  });
  linea('ESCRITURA (PATCH)', p.status + ' → ' + (await p.text()));
  console.log('%c=== fin ===', 'font-weight:bold');
};

async function _svWrite(url, method, body) {
  const hacer = async () => {
    const r = await fetch(url, {
      method,
      headers: _svHeaders({ Prefer: 'return=representation' }),
      body: body ? JSON.stringify(body) : undefined,
    });
    let rows = [];
    let texto = '';
    try { texto = await r.text(); rows = texto ? JSON.parse(texto) : []; } catch (_) { rows = []; }
    return { ok: r.ok, status: r.status, rows: Array.isArray(rows) ? rows : [], texto };
  };

  let res = await hacer();
  // Cualquier fallo se reintenta UNA vez tras refrescar el token. OJO: incluye el
  // caso "200 con []": si el JWT no trae club_id, la RLS no VE la fila y el UPDATE
  // afecta 0 filas devolviendo 200 vacío (no 403) — era el fallo silencioso del borrar.
  if (!res.ok || !res.rows.length) {
    console.warn('[Preventa] escritura sin efecto (' + res.status + '), refrescando token y reintentando…');
    await _svEnsureClaim();
    res = await hacer();
  }
  if (!res.ok || !res.rows.length) {
    console.error('[Preventa] escritura falló:', res.status, res.texto);
    const detalle = (res.ok && !res.rows.length)
                  ? 'tu sesión perdió el club (no ve el dato) — cerrá sesión y volvé a entrar'
                  : res.status === 403 ? 'tu sesión perdió el club — cerrá sesión y volvé a entrar'
                  : res.status === 401 ? 'tu sesión venció — volvé a iniciar sesión'
                  : 'revisá tu conexión';
    throw new Error(detalle);
  }
  return res.rows;
}

// ── Estado del módulo ────────────────────────────────────────────────────────
let _svCampaign = null;   // campaña más reciente no borrada (o null)
let _svItems = [];        // ítems de la campaña (no borrados)
let _svOrders = [];       // pedidos de la campaña
let _svPhotoBase64 = '';  // foto en edición (base64 comprimida) — '' = sin cambio
let _svPdfCat = '__todas__';   // filtro de categoría en la vista previa/PDF
let _svPhotoCache = {};   // id → base64 ya descargada (evita re-descargar)
let _svOpenItems = new Set(); // acordeones abiertos (persisten entre re-renders)

// ── Carga de datos (rápida) ─────────────────────────────────────────────────
// El cuello de botella era que la FOTO viaja en base64 dentro de la fila: pedir
// los ítems completos descargaba todas las imágenes antes de pintar nada.
// Ahora: (1) ítems SIN foto + pedidos EN PARALELO → se pinta al instante;
// (2) las fotos se piden aparte y se rellenan cuando llegan.
// La seguridad no cambia: mismas rutas autenticadas, misma RLS, mismo filtro club_id.
async function _svLoadAll() {
  const clubId = _svClubId();
  if (!clubId) throw new Error('Sin club activo');

  const rc = await fetch(
    `${window.SUPA_URL}/rest/v1/sale_campaigns?club_id=eq.${encodeURIComponent(clubId)}&deleted=eq.false&order=created_at.desc&limit=1`,
    { headers: _svHeaders() }
  );
  const camps = rc.ok ? await rc.json() : [];
  _svCampaign = camps[0] || null;
  _svItems = [];
  _svOrders = [];
  if (!_svCampaign) return;

  // Ítems SIN la foto (payload chico) y pedidos, en paralelo
  const [ri, orders] = await Promise.all([
    fetch(
      `${window.SUPA_URL}/rest/v1/sale_items?club_id=eq.${encodeURIComponent(clubId)}&campaign_id=eq.${encodeURIComponent(_svCampaign.id)}&deleted=eq.false&select=id,name,price,sizes,sort_order&order=sort_order,created_at`,
      { headers: _svHeaders() }
    ),
    _svFetchAllOrders(clubId, _svCampaign.id),
  ]);
  _svItems = ri.ok ? await ri.json() : [];
  _svOrders = orders;

  // Reusar fotos ya descargadas en esta sesión (no se vuelven a pedir)
  _svItems.forEach(it => { if (_svPhotoCache[it.id]) it.photo = _svPhotoCache[it.id]; });
}

// Segunda tanda: solo las fotos que falten. Al llegar, se repinta.
async function _svLoadPhotos() {
  if (!_svCampaign) return;
  const faltan = _svItems.filter(it => !it.photo).map(it => it.id);
  if (!faltan.length) return;
  try {
    const lista = faltan.map(id => `"${id}"`).join(',');
    const r = await fetch(
      `${window.SUPA_URL}/rest/v1/sale_items?club_id=eq.${encodeURIComponent(_svClubId())}&id=in.(${encodeURIComponent(lista)})&select=id,photo`,
      { headers: _svHeaders() }
    );
    if (!r.ok) return;
    const rows = await r.json();
    let hubo = false;
    rows.forEach(row => {
      if (!row.photo) return;
      _svPhotoCache[row.id] = row.photo;
      const it = _svItems.find(x => x.id === row.id);
      if (it) { it.photo = row.photo; hubo = true; }
    });
    if (hubo && document.getElementById('salesModalBody')) _svRender();
  } catch (e) { console.warn('[Preventa] fotos:', e?.message || e); }
}

// Pedidos paginados (PostgREST corta en 1000 filas sin avisar)
async function _svFetchAllOrders(clubId, campaignId) {
  const out = [];
  const PAGE = 1000;
  for (let p = 0; p < 20; p++) {
    const r = await fetch(
      `${window.SUPA_URL}/rest/v1/sale_orders?club_id=eq.${encodeURIComponent(clubId)}&campaign_id=eq.${encodeURIComponent(campaignId)}&order=id`,
      { headers: _svHeaders({ Range: `${p * PAGE}-${p * PAGE + PAGE - 1}` }) }
    );
    if (!r.ok) break;
    const rows = await r.json();
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

// ── Modal principal ──────────────────────────────────────────────────────────
function showSalesModal() {
  let modal = document.getElementById('salesModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'salesModal';
    modal.className = 'fixed inset-0 bg-black/60 flex items-center justify-center p-4';
  modal.style.zIndex = '60';
    modal.addEventListener('click', (e) => { if (e.target === modal) closeSalesModal(); });
    document.body.appendChild(modal);
  }
  modal.innerHTML = `
    <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col animate-scale-in" style="max-height:90vh">
      <div class="px-5 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <h2 class="font-bold text-gray-800 dark:text-white text-lg flex items-center gap-2">🛍️ Preventa</h2>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Uniformes y kits: los padres piden su talla desde el portal</p>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <button id="svPdfBtn" onclick="_svPdf()" class="hidden py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2">
              <i data-lucide="eye" class="w-4 h-4"></i> Ver pedido
            </button>
            <button onclick="closeSalesModal()" aria-label="Cerrar" class="-mt-1 -mr-1 w-9 h-9 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 text-2xl leading-none">&times;</button>
          </div>
        </div>
      </div>
      <div id="salesModalBody" class="p-4 overflow-y-auto">
        <p class="text-sm text-gray-500 dark:text-gray-400 text-center py-6">⏳ Cargando preventa...</p>
      </div>
    </div>`;
  if (window.lucide?.createIcons) lucide.createIcons();

  // Si ya se abrió antes en esta sesión, se pinta al instante y se refresca detrás
  if (_svCampaign) _svRender();

  _svEnsureClaim()
    .then(() => _svLoadAll())
    .then(() => { _svRender(); _svLoadPhotos(); })
    .catch((e) => {
      console.error('[Preventa] error cargando:', e);
      const body = document.getElementById('salesModalBody');
      if (body) body.innerHTML = '<p class="text-sm text-red-500 text-center py-6">❌ No se pudo cargar la preventa. Revisá tu conexión e intentá de nuevo.</p>';
    });
}
window.showSalesModal = showSalesModal;

function closeSalesModal() {
  document.getElementById('salesModal')?.remove();
  document.getElementById('svItemFormModal')?.remove();
}
window.closeSalesModal = closeSalesModal;

// ── Render ───────────────────────────────────────────────────────────────────
function _svRender() {
  const body = document.getElementById('salesModalBody');
  if (!body) return;
  const pdfBtn = document.getElementById('svPdfBtn');

  // Sin campaña → estado vacío con creación
  if (!_svCampaign) {
    if (pdfBtn) pdfBtn.classList.add('hidden');
    body.innerHTML = `
      <div class="text-center py-6">
        <div class="text-5xl mb-3">🛍️</div>
        <p class="font-semibold text-gray-800 dark:text-white mb-1">Todavía no hay ninguna preventa</p>
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">Creá una (ej. "Uniforme 2027"), agregale los ítems con foto y tallas, y los padres piden desde su portal.</p>
        <div class="flex gap-2 max-w-sm mx-auto">
          <input id="svNewTitle" type="text" maxlength="60" placeholder="Nombre de la preventa"
            class="flex-1 px-3 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700/60 text-gray-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-400">
          <button onclick="_svCreateCampaign()" class="px-4 py-2 bg-gradient-to-r from-teal-600 to-blue-600 text-white rounded-lg text-sm font-bold">Crear</button>
        </div>
      </div>`;
    return;
  }

  const abierta = _svCampaign.status === 'abierta';
  const players = (typeof getPlayers === 'function' ? getPlayers() : []) || [];
  const nameById = {};
  players.forEach(p => { if (p && p.id) nameById[p.id] = p.name || p.id; });

  const totalPedidos = _svOrders.reduce((s, o) => s + (Number(o.qty) || 1), 0);
  const jugadoresQuePidieron = new Set(_svOrders.map(o => o.player_id)).size;

  if (pdfBtn) pdfBtn.classList.toggle('hidden', _svOrders.length === 0);

  // Consolidado por ítem → talla → cantidad (+ jugadores)
  const porItem = {};
  _svOrders.forEach(o => {
    if (!porItem[o.item_id]) porItem[o.item_id] = { total: 0, tallas: {} };
    const qty = Number(o.qty) || 1;
    porItem[o.item_id].total += qty;
    if (!porItem[o.item_id].tallas[o.size]) porItem[o.item_id].tallas[o.size] = { qty: 0, players: [] };
    porItem[o.item_id].tallas[o.size].qty += qty;
    porItem[o.item_id].tallas[o.size].players.push({ name: nameById[o.player_id] || o.player_id, qty });
  });

  // Catálogo estilo tienda (igual al que ven los padres) + acciones del profesor
  const itemsHtml = _svItems.map(it => {
    const foto = it.photo
      ? `<img src="${it.photo}" alt="" style="width:100%;height:100%;object-fit:cover;display:block;">`
      : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:56px;background:rgba(128,128,128,0.12);">👕</div>`;
    const precio = (it.price !== null && it.price !== undefined && it.price !== '')
      ? (typeof formatCurrency === 'function' ? formatCurrency(it.price) : '$' + it.price)
      : null;
    const tallas = (Array.isArray(it.sizes) ? it.sizes : []).map(t =>
      `<span style="padding:5px 12px;border-radius:999px;border:1.5px solid rgba(128,128,128,0.28);font-size:12px;font-weight:700;opacity:0.85;">${_svEsc(t)}</span>`
    ).join('') || '<span class="text-xs text-gray-400">Sin tallas cargadas</span>';
    const pedidasIt = _svOrders.filter(o => o.item_id === it.id).reduce((s2, o) => s2 + (Number(o.qty) || 1), 0);

    return `
      <div class="rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700" style="background:rgba(128,128,128,0.05);">
        <div style="position:relative;width:100%;aspect-ratio:16/10;background:rgba(128,128,128,0.10);">
          ${foto}
          ${precio ? `<div style="position:absolute;top:10px;right:10px;padding:6px 13px;border-radius:999px;background:rgba(0,0,0,0.62);backdrop-filter:blur(6px);color:#fff;font-weight:800;font-size:14px;">${precio}</div>` : ''}
          ${pedidasIt ? `<div style="position:absolute;top:10px;left:10px;padding:6px 12px;border-radius:999px;background:rgba(13,148,136,0.92);color:#fff;font-weight:800;font-size:12px;">${pedidasIt} pedidas</div>` : ''}
        </div>
        <div class="p-3">
          <p class="font-bold text-gray-800 dark:text-white" style="font-size:16px;">${_svEsc(it.name)}</p>
          <p class="text-xs mt-0.5 text-gray-500 dark:text-gray-400">${precio ? 'Precio por unidad: ' + precio : 'Sin precio — la escuela lo confirma'}</p>
          <p class="text-[11px] font-bold text-gray-400 uppercase" style="margin:10px 0 6px;letter-spacing:0.06em;">Tallas ofrecidas</p>
          <div style="display:flex;flex-wrap:wrap;gap:6px;">${tallas}</div>
          ${abierta ? `
          <div class="flex gap-2 mt-3">
            <button onclick="_svItemForm('${escAttrJs(it.id)}')" style="flex:1;padding:9px;border:none;border-radius:12px;background:rgba(37,99,235,0.12);color:#2563eb;font-size:13.5px;font-weight:700;cursor:pointer;">✏️ Editar</button>
            <button onclick="_svDeleteItem('${escAttrJs(it.id)}')" style="padding:9px 16px;border:none;border-radius:12px;background:rgba(220,38,38,0.12);color:#dc2626;font-size:13.5px;font-weight:700;cursor:pointer;">🗑</button>
          </div>` : ''}
        </div>
      </div>`;
  }).join('');

  const consolidadoHtml = _svItems
    .filter(it => porItem[it.id])
    .map(it => {
      const data = porItem[it.id];
      const abiertoAcc = _svOpenItems.has(it.id);
      const tallasHtml = Object.keys(data.tallas).sort().map(t => {
        const td = data.tallas[t];
        const nombres = td.players.map(p => `${_svEsc(p.name)}${p.qty > 1 ? ' ×' + p.qty : ''}`).join(', ');
        return `
          <div class="px-3 py-2 bg-gray-50 dark:bg-gray-900/40 rounded-lg">
            <div class="flex items-center justify-between">
              <span class="font-bold text-gray-800 dark:text-white text-sm">Talla ${_svEsc(t)}</span>
              <span class="text-sm font-bold text-teal-600 dark:text-teal-400">×${td.qty}</span>
            </div>
            <p class="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">${nombres}</p>
          </div>`;
      }).join('');
      return `
        <div class="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
          <div class="flex items-center justify-between gap-2 px-3 py-2.5 cursor-pointer mc-row-hover" onclick="_svToggleItem('${escAttrJs(it.id)}')">
            <p class="font-semibold text-gray-800 dark:text-white text-sm truncate">${_svEsc(it.name)}</p>
            <span class="shrink-0 text-xs font-bold px-2 py-0.5 rounded-full bg-teal-600 text-white">${data.total} uds</span>
          </div>
          <div class="${abiertoAcc ? '' : 'hidden'} px-3 pb-3 pt-1 space-y-1.5" id="svAcc-${_svEsc(it.id)}">${tallasHtml}</div>
        </div>`;
    }).join('');

  body.innerHTML = `
    <div class="space-y-4">
      <!-- Campaña: título + estado + acciones -->
      <div class="flex items-center justify-between gap-2 flex-wrap">
        <div class="min-w-0">
          <p class="font-bold text-gray-800 dark:text-white truncate">${_svEsc(_svCampaign.title)}</p>
          <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${abierta ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}">${abierta ? '🟢 Abierta — los padres pueden pedir' : '⚪ Cerrada'}</span>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          ${abierta ? `<button onclick="_svItemForm(null)" class="px-3 py-1.5 bg-gradient-to-r from-teal-600 to-blue-600 text-white rounded-lg text-xs font-bold">➕ Ítem</button>` : ''}
          <button onclick="_svToggleCampaign()" class="px-3 py-1.5 ${abierta ? 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200' : 'bg-green-600 text-white'} rounded-lg text-xs font-bold">${abierta ? '🔒 Cerrar' : '🔓 Reabrir'}</button>
          <button onclick="_svDeleteCampaign()" title="Eliminar preventa" class="w-8 h-8 flex items-center justify-center rounded-lg text-red-500 mc-row-hover"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
        </div>
      </div>

      <!-- Contadores -->
      <div class="grid grid-cols-3 gap-2 text-center">
        <div class="bg-gray-50 dark:bg-gray-900/40 rounded-lg py-2">
          <div class="text-xl font-bold text-gray-700 dark:text-gray-200">${_svItems.length}</div>
          <div class="text-xs text-gray-500">Ítems</div>
        </div>
        <div class="bg-teal-50 dark:bg-teal-900/20 rounded-lg py-2">
          <div class="text-xl font-bold text-teal-600">${totalPedidos}</div>
          <div class="text-xs text-gray-500">Unidades pedidas</div>
        </div>
        <div class="bg-blue-50 dark:bg-blue-900/20 rounded-lg py-2">
          <div class="text-xl font-bold text-blue-600">${jugadoresQuePidieron}</div>
          <div class="text-xs text-gray-500">Jugadores</div>
        </div>
      </div>

      <!-- Ítems -->
      <div>
        <p class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Productos de la preventa</p>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px;">${itemsHtml}</div>
        ${itemsHtml ? '' : '<p class="text-sm text-gray-500 dark:text-gray-400 text-center py-3">Agregá el primer ítem (ej. Camiseta) con el botón ➕ Ítem.</p>'}
      </div>

      <!-- Consolidado -->
      <div>
        <p class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Pedidos — tocá un ítem para ver tallas</p>
        <div class="space-y-2">
        ${consolidadoHtml || '<p class="text-sm text-gray-500 dark:text-gray-400 text-center py-3">Todavía no hay pedidos de los padres.</p>'}
        </div>
      </div>
    </div>`;
  if (window.lucide?.createIcons) lucide.createIcons();
}

function _svToggleItem(itemId) {
  if (_svOpenItems.has(itemId)) _svOpenItems.delete(itemId); else _svOpenItems.add(itemId);
  document.getElementById('svAcc-' + itemId)?.classList.toggle('hidden');
}
window._svToggleItem = _svToggleItem;

// ── Acciones de campaña ──────────────────────────────────────────────────────
// Escrituras con return=representation&select=id + verificación de fila
// (con anon cerrado, un 200/204 vacío NO es éxito — fallos silenciosos).
async function _svCreateCampaign() {
  const title = (document.getElementById('svNewTitle')?.value || '').trim();
  if (!title) { showToast('❌ Poné un nombre (ej. Uniforme 2027)'); return; }
  if (!_svClaimListo()) return;
  const clubId = _svClubId();
  try {
    await _svWrite(`${window.SUPA_URL}/rest/v1/sale_campaigns?select=id`, 'POST',
      { id: _svId('svc'), club_id: clubId, title, status: 'abierta' });
    showToast('✅ Preventa creada');
    await _svLoadAll(); _svRender();
  } catch (e) {
    console.error('[Preventa] crear:', e);
    showToast('❌ No se pudo crear: ' + (e?.message || ''));
  }
}
window._svCreateCampaign = _svCreateCampaign;

async function _svToggleCampaign() {
  if (!_svCampaign) return;
  if (!_svClaimListo()) return;
  const nuevo = _svCampaign.status === 'abierta' ? 'cerrada' : 'abierta';
  try {
    await _svWrite(
      `${window.SUPA_URL}/rest/v1/sale_campaigns?id=eq.${encodeURIComponent(_svCampaign.id)}&club_id=eq.${encodeURIComponent(_svClubId())}&select=id`,
      'PATCH', { status: nuevo });
    showToast(nuevo === 'cerrada' ? '🔒 Preventa cerrada — los padres ya no pueden pedir' : '🔓 Preventa reabierta');
    await _svLoadAll(); _svRender();
  } catch (e) {
    console.error('[Preventa] estado:', e);
    showToast('❌ No se pudo cambiar el estado: ' + (e?.message || ''));
  }
}
window._svToggleCampaign = _svToggleCampaign;

async function _svDeleteCampaign() {
  if (!_svCampaign) return;
  if (!_svClaimListo()) return;
  if (!confirm(`¿Eliminar la preventa "${_svCampaign.title}" y sus pedidos de la vista?\n\nEsto no se puede deshacer desde la app.`)) return;
  try {
    await _svWrite(
      `${window.SUPA_URL}/rest/v1/sale_campaigns?id=eq.${encodeURIComponent(_svCampaign.id)}&club_id=eq.${encodeURIComponent(_svClubId())}&select=id`,
      'PATCH', { deleted: true });
    showToast('🗑️ Preventa eliminada');
    await _svLoadAll(); _svRender();
  } catch (e) {
    console.error('[Preventa] eliminar:', e);
    showToast('❌ No se pudo eliminar: ' + (e?.message || ''));
  }
}
window._svDeleteCampaign = _svDeleteCampaign;

// ── Ítems: formulario (crear/editar) ────────────────────────────────────────
function _svItemForm(itemId) {
  const it = itemId ? _svItems.find(x => x.id === itemId) : null;
  _svPhotoBase64 = ''; // '' = no cambiar foto al editar
  document.getElementById('svItemFormModal')?.remove();

  const m = document.createElement('div');
  m.id = 'svItemFormModal';
  m.className = 'fixed inset-0 bg-black/60 flex items-center justify-center p-4';
  m.style.zIndex = '70';
  m.addEventListener('click', (e) => { if (e.target === m) m.remove(); });
  m.innerHTML = `
    <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm p-5 animate-scale-in" style="max-height:90vh;overflow-y:auto">
      <h3 class="font-bold text-gray-800 dark:text-white mb-3">${it ? '✏️ Editar ítem' : '➕ Nuevo ítem'}</h3>
      <div class="space-y-3">
        <div>
          <label class="text-xs font-semibold text-gray-600 dark:text-gray-300">Nombre *</label>
          <input id="svItName" type="text" maxlength="50" value="${it ? _svEsc(it.name) : ''}" placeholder="Ej: Camiseta oficial"
            class="w-full mt-1 px-3 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700/60 text-gray-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-400">
        </div>
        <div>
          <label class="text-xs font-semibold text-gray-600 dark:text-gray-300">Precio (opcional)</label>
          <input id="svItPrice" type="number" inputmode="numeric" value="${it && it.price != null ? _svEsc(it.price) : ''}" placeholder="Ej: 65000"
            class="w-full mt-1 px-3 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700/60 text-gray-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-400">
        </div>
        <div>
          <label class="text-xs font-semibold text-gray-600 dark:text-gray-300">Tallas disponibles *</label>
          <p class="text-[11px] text-gray-400 mb-1">Tocá las que ofrecés. Podés agregar una personalizada.</p>
          <div id="svSizePresets" class="space-y-1.5"></div>
          <div class="flex gap-2 mt-2">
            <input id="svCustomSize" type="text" maxlength="12" placeholder="Talla personalizada"
              onkeydown="if(event.key==='Enter'){event.preventDefault();_svAddCustomSize();}"
              class="flex-1 px-3 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700/60 text-gray-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-400">
            <button type="button" onclick="_svAddCustomSize()" class="px-4 py-2.5 bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-200 rounded-xl text-sm font-bold">Agregar</button>
          </div>
          <div class="mt-2">
            <p class="text-[11px] font-semibold text-gray-500 dark:text-gray-400">Seleccionadas:</p>
            <div id="svSelectedSizes" class="flex flex-wrap gap-1.5 mt-1"></div>
          </div>
        </div>
        <div>
          <label class="text-xs font-semibold text-gray-600 dark:text-gray-300">Foto (opcional)</label>
          <input id="svItPhoto" type="file" accept="image/*" onchange="_svPhotoChange(this)"
            class="w-full mt-1 text-xs text-gray-600 dark:text-gray-300">
          <img id="svItPhotoPrev" src="${it && it.photo ? it.photo : ''}" class="${it && it.photo ? '' : 'hidden'} mt-2 w-20 h-20 rounded-lg object-cover border border-gray-200 dark:border-gray-600" alt="">
        </div>
      </div>
      <div class="flex gap-2 mt-4">
        <button onclick="document.getElementById('svItemFormModal').remove()" class="flex-1 py-2.5 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-xl text-sm font-semibold">Cancelar</button>
        <button onclick="_svSaveItem('${it ? escAttrJs(it.id) : ''}')" class="flex-1 py-2.5 bg-gradient-to-r from-teal-600 to-blue-600 text-white rounded-xl text-sm font-bold shadow-lg">Guardar</button>
      </div>
    </div>`;
  document.body.appendChild(m);
  // Separador de miles en vivo en el precio (mismo gesto que el resto de la app)
  if (typeof activarFormatoMonto === 'function') activarFormatoMonto(document.getElementById('svItPrice'));

  // Tallas: arranca con las del ítem (si es edición)
  _svFormSizes = it && Array.isArray(it.sizes) ? it.sizes.slice() : [];
  _svRenderSizePickers();
}
window._svItemForm = _svItemForm;

// ── Selector de tallas: presets por grupo + personalizada ────────────────────
// Antes era un campo de texto libre y salían cosas como "l.k.j.h" en el PDF del
// proveedor. Ahora se tocan chips y lo personalizado se agrega de a uno.
const _SV_SIZE_GROUPS = [
  { label: 'Ropa', sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'] },
  { label: 'Niños (años)', sizes: ['4', '6', '8', '10', '12', '14', '16'] },
  { label: 'Calzado', sizes: ['28', '30', '32', '34', '36', '38', '40', '42', '44'] },
];
let _svFormSizes = [];

function _svRenderSizePickers() {
  const cont = document.getElementById('svSizePresets');
  if (cont) {
    cont.innerHTML = _SV_SIZE_GROUPS.map(g => `
      <div style="margin-bottom:12px;">
        <p style="font-size:10.5px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;opacity:0.45;margin-bottom:7px;">${g.label}</p>
        <div style="display:flex;flex-wrap:wrap;gap:7px;">
          ${g.sizes.map(s => {
            const on = _svFormSizes.includes(s);
            return `<button type="button" onclick="_svToggleSize('${escAttrJs(s)}')"
              style="min-width:44px;padding:8px 14px;border-radius:999px;font-size:13px;font-weight:700;cursor:pointer;
                     transition:all .18s ease;
                     border:1.5px solid ${on ? 'transparent' : 'rgba(128,128,128,0.28)'};
                     background:${on ? 'linear-gradient(135deg,#0d9488,#2563eb)' : 'transparent'};
                     color:${on ? '#fff' : 'inherit'};
                     box-shadow:${on ? '0 3px 10px rgba(13,148,136,0.30)' : 'none'};
                     opacity:${on ? '1' : '0.75'};">${_svEsc(s)}</button>`;
          }).join('')}
        </div>
      </div>`).join('');
  }
  const sel = document.getElementById('svSelectedSizes');
  if (sel) {
    sel.innerHTML = _svFormSizes.length
      ? _svFormSizes.map(s => `
          <span style="display:inline-flex;align-items:center;gap:7px;padding:6px 8px 6px 13px;border-radius:999px;
                       background:rgba(13,148,136,0.12);border:1px solid rgba(13,148,136,0.28);
                       font-size:12.5px;font-weight:700;color:#0d9488;">
            ${_svEsc(s)}
            <button type="button" onclick="_svToggleSize('${escAttrJs(s)}')" title="Quitar"
              style="border:none;background:rgba(13,148,136,0.18);color:#0d9488;border-radius:50%;
                     width:18px;height:18px;line-height:1;font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;">&times;</button>
          </span>`).join('')
      : '<span style="font-size:12px;opacity:0.45;font-style:italic;">Todavía ninguna — tocá las de arriba</span>';
  }
}

function _svToggleSize(size) {
  const i = _svFormSizes.indexOf(size);
  if (i >= 0) _svFormSizes.splice(i, 1); else _svFormSizes.push(size);
  _svRenderSizePickers();
}
window._svToggleSize = _svToggleSize;

function _svAddCustomSize() {
  const input = document.getElementById('svCustomSize');
  const val = (input?.value || '').trim().slice(0, 12);
  if (!val) return;
  if (!_svFormSizes.includes(val)) _svFormSizes.push(val);
  if (input) input.value = '';
  _svRenderSizePickers();
}
window._svAddCustomSize = _svAddCustomSize;

function _svPhotoChange(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    // Comprimir al patrón de la casa (≤200KB, guarda base64 en la fila)
    _svPhotoBase64 = await compressImageForFirebase(String(reader.result || ''), 500, 0.7);
    const prev = document.getElementById('svItPhotoPrev');
    if (prev && _svPhotoBase64) { prev.src = _svPhotoBase64; prev.classList.remove('hidden'); }
  };
  reader.readAsDataURL(file);
}
window._svPhotoChange = _svPhotoChange;

async function _svSaveItem(itemId) {
  const name = (document.getElementById('svItName')?.value || '').trim();
  const priceRaw = (document.getElementById('svItPrice')?.value || '').trim();
  if (!name) { showToast('❌ El ítem necesita un nombre'); return; }
  // Las tallas salen de los chips seleccionados (_svFormSizes), no de un campo de texto
  const sizes = _svFormSizes.slice(0, 30);
  if (!sizes.length) { showToast('👆 Tocá al menos una talla arriba (ej: S, M, L)'); return; }
  const price = priceRaw === '' ? null
    : (typeof parseMonto === 'function' ? parseMonto(priceRaw) : parseFloat(priceRaw.replace(/\./g, '')) || null);

  if (!_svClaimListo()) return;
  const clubId = _svClubId();
  const payload = { name, sizes, price };
  if (_svPhotoBase64) payload.photo = _svPhotoBase64;

  try {
    if (itemId) {
      await _svWrite(
        `${window.SUPA_URL}/rest/v1/sale_items?id=eq.${encodeURIComponent(itemId)}&club_id=eq.${encodeURIComponent(clubId)}&select=id`,
        'PATCH', payload);
      if (payload.photo) _svPhotoCache[itemId] = payload.photo;
    } else {
      payload.id = _svId('svi');
      payload.club_id = clubId;
      payload.campaign_id = _svCampaign.id;
      payload.sort_order = _svItems.length;
      await _svWrite(`${window.SUPA_URL}/rest/v1/sale_items?select=id`, 'POST', payload);
      if (payload.photo) _svPhotoCache[payload.id] = payload.photo;
    }
    document.getElementById('svItemFormModal')?.remove();
    showToast('✅ Ítem guardado');
    await _svLoadAll(); _svRender();
  } catch (e) {
    console.error('[Preventa] ítem:', e);
    showToast('❌ No se pudo guardar: ' + (e?.message || ''));
  }
}
window._svSaveItem = _svSaveItem;

async function _svDeleteItem(itemId) {
  const it = _svItems.find(x => x.id === itemId);
  if (!it) return;
  if (!_svClaimListo()) return;
  if (!confirm(`¿Quitar "${it.name}" de la preventa?`)) return;
  try {
    await _svWrite(
      `${window.SUPA_URL}/rest/v1/sale_items?id=eq.${encodeURIComponent(itemId)}&club_id=eq.${encodeURIComponent(_svClubId())}&select=id`,
      'PATCH', { deleted: true });
    showToast('🗑️ Producto quitado');
    await _svLoadAll(); _svRender();
  } catch (e) {
    console.error('[Preventa] quitar ítem:', e);
    showToast('❌ No se pudo quitar: ' + (e?.message || ''));
  }
}
window._svDeleteItem = _svDeleteItem;

// ── PDF para el proveedor (con contexto + vista previa) ─────────────────────
// Arma el documento y lo muestra en pantalla ANTES de descargar, para que el
// dueño revise que la lista esté bien antes de mandársela al proveedor.
/* Color del club para los informes. Antes estaba fijo en morado; ahora sale de
   la configuración de la escuela (Ajustes → color principal), así el PDF que
   reciben el proveedor y las familias es el del club, no el de la app. */
/* Orden de tallas con sentido: alfabéticamente "L" queda antes que "XS", que es
   justo al revés de como se lee un pedido. Primero las de letra en su orden
   natural, después las numéricas de menor a mayor, y al final lo que no encaje. */
const _SV_ORDEN_TALLA = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
function _svCmpTalla(a, b) {
  const A = String(a).trim().toUpperCase(), B = String(b).trim().toUpperCase();
  const iA = _SV_ORDEN_TALLA.indexOf(A), iB = _SV_ORDEN_TALLA.indexOf(B);
  if (iA !== -1 && iB !== -1) return iA - iB;
  if (iA !== -1) return -1;
  if (iB !== -1) return 1;
  const nA = parseFloat(A), nB = parseFloat(B);
  if (Number.isFinite(nA) && Number.isFinite(nB)) return nA - nB;
  if (Number.isFinite(nA)) return -1;
  if (Number.isFinite(nB)) return 1;
  return A.localeCompare(B, 'es');
}

function _svColorClub() {
  const st = (typeof getSchoolSettings === 'function' ? getSchoolSettings() : null) || {};
  const hex = /^#[0-9a-f]{6}$/i.test(st.primaryColor || '') ? st.primaryColor : '#0d9488';
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return {
    hex,
    rgb: [r, g, b],
    // Versión clarita para los fondos de las bandas (mezcla con blanco al 88%).
    suave: [Math.round(r + (255 - r) * 0.88), Math.round(g + (255 - g) * 0.88), Math.round(b + (255 - b) * 0.88)],
    css: (a) => `rgba(${r},${g},${b},${a})`,
  };
}

/* tipo: 'proveedor' (sin plata: solo qué hacer y para quién) o 'admin' (todo).
   El proveedor no tiene por qué ver precios, valores ni abonos del club. */
function _svBuildPdf(tipo) {
  const paraProveedor = tipo === 'proveedor';
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const settings = (typeof getSchoolSettings === 'function' ? getSchoolSettings() : null) || {};
  const clubName = settings.name || _svClubId();
  const clubTel = settings.phone || '';
  const players = (typeof getPlayers === 'function' ? getPlayers() : []) || [];
  const nameById = {};
  players.forEach(p => { if (p && p.id) nameById[p.id] = p.name || p.id; });
  const catById = {};
  players.forEach(p => { if (p && p.id) catById[p.id] = p.category || ''; });
  const numById = {};
  players.forEach(p => { if (p && p.id) numById[p.id] = p.jerseyNumber || ''; });
  const itemById = {};
  _svItems.forEach(it => { itemById[it.id] = it; });

  // Respeta el filtro de categoría elegido en la vista previa
  const ordenes = _svPdfCat === '__todas__'
    ? _svOrders
    : _svOrders.filter(o => (catById[o.player_id] || 'Sin categoría') === _svPdfCat);

  const totalUnidades = ordenes.reduce((s, o) => s + (Number(o.qty) || 1), 0);
  const totalJugadores = new Set(ordenes.map(o => o.player_id)).size;
  let valorTotal = 0; let hayPrecio = false;
  ordenes.forEach(o => {
    const it = itemById[o.item_id];
    if (it && it.price != null && it.price !== '') { hayPrecio = true; valorTotal += Number(it.price) * (Number(o.qty) || 1); }
  });
  const money = (n) => (typeof formatCurrency === 'function' ? formatCurrency(n) : '$' + n);

  // ── Encabezado ──
  const C = _svColorClub();
  doc.setFillColor(C.rgb[0], C.rgb[1], C.rgb[2]);
  doc.rect(0, 0, 210, 30, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(17); doc.setFont(undefined, 'bold');
  doc.text(paraProveedor ? 'PEDIDO DE UNIFORMES' : 'PEDIDO DE PREVENTA', 14, 13);
  doc.setFontSize(10); doc.setFont(undefined, 'normal');
  doc.text(`${_svCampaign.title}${_svPdfCat !== '__todas__' ? '  —  Categoría ' + _svPdfCat : ''}`, 14, 21);
  doc.text(`${new Date().toLocaleDateString('es-CO')}`, 196, 21, { align: 'right' });

  doc.setTextColor(0, 0, 0);
  let y = 40;
  doc.setFontSize(11); doc.setFont(undefined, 'bold');
  doc.text(`Escuela: ${clubName}`, 14, y); y += 6;
  doc.setFontSize(9); doc.setFont(undefined, 'normal');
  if (clubTel) { doc.text(`Contacto: ${clubTel}`, 14, y); y += 5; }
  doc.text(`Estado de la preventa: ${_svCampaign.status === 'abierta' ? 'ABIERTA (puede seguir sumando pedidos)' : 'CERRADA'}`, 14, y); y += 8;

  // ── Resumen ──
  const mostrarPlata = hayPrecio && !paraProveedor;
  doc.setFillColor(246, 247, 249);
  doc.roundedRect(14, y - 5, 182, mostrarPlata ? 22 : 16, 2.5, 2.5, 'F');
  doc.setFontSize(10); doc.setFont(undefined, 'bold');
  doc.text(`Total de unidades: ${totalUnidades}`, 18, y + 2);
  doc.text(`Jugadores: ${totalJugadores}`, 88, y + 2);
  doc.text(`Productos: ${_svItems.length}`, 148, y + 2);
  if (mostrarPlata) {
    doc.setTextColor(22, 163, 74);
    doc.text(`Valor estimado total: ${money(valorTotal)}`, 18, y + 10);
    doc.setTextColor(0, 0, 0);
  }
  y += mostrarPlata ? 26 : 20;

  // ── Consolidado por producto/talla ──
  doc.setFontSize(12); doc.setFont(undefined, 'bold');
  doc.text(paraProveedor ? 'QUE HAY QUE PRODUCIR' : 'PEDIDO CONSOLIDADO (para el proveedor)', 14, y); y += 3;
  doc.setDrawColor(C.rgb[0], C.rgb[1], C.rgb[2]); doc.setLineWidth(0.6); doc.line(14, y, 196, y); y += 7;

  /* El proveedor necesita saber DE QUIÉN es cada prenda, no solo cuántas.
     Se usa la marcación si está cargada; si no, el nombre del jugador — así las
     preventas viejas (anteriores a la marcación) igual salen identificadas. */
  const porItem = {};
  ordenes.forEach(o => {
    if (!porItem[o.item_id]) porItem[o.item_id] = {};
    if (!porItem[o.item_id][o.size]) porItem[o.item_id][o.size] = { qty: 0, quienes: [] };
    const q = Number(o.qty) || 1;
    porItem[o.item_id][o.size].qty += q;
    const quien = String(o.marking || '').trim() || nameById[o.player_id] || o.player_id;
    // Se acumula por persona: si alguien pide 3 de la misma talla en pedidos
    // distintos, el proveedor lee "Juan (x3)" y no "Juan · Juan (x2)".
    const acum = porItem[o.item_id][o.size].quienes;
    const ya = acum.find(x => x.nombre === quien);
    if (ya) ya.qty += q; else acum.push({ nombre: quien, qty: q });
  });

  Object.keys(porItem).forEach(itemId => {
    const it = itemById[itemId];
    const tallas = porItem[itemId];
    const totalIt = Object.values(tallas).reduce((s, d) => s + d.qty, 0);
    if (y > 258) { doc.addPage(); y = 20; }
    doc.setFillColor(C.suave[0], C.suave[1], C.suave[2]);
    doc.roundedRect(14, y - 4.5, 182, 8, 1.5, 1.5, 'F');
    doc.setFontSize(10.5); doc.setFont(undefined, 'bold');
    doc.text(`${it ? it.name : itemId}`, 18, y + 1);
    const precioTxt = (!paraProveedor && it && it.price != null && it.price !== '') ? `${money(it.price)} c/u  ·  ` : '';
    doc.text(`${precioTxt}TOTAL: ${totalIt} uds`, 192, y + 1, { align: 'right' });
    y += 10;
    doc.setFontSize(9.5); doc.setFont(undefined, 'normal');
    Object.keys(tallas).sort(_svCmpTalla).forEach(t => {
      const d = tallas[t];
      if (y > 276) { doc.addPage(); y = 20; }
      doc.setFont(undefined, 'bold');
      doc.text(`Talla ${t}`, 22, y);
      doc.text(`${d.qty} unidad${d.qty === 1 ? '' : 'es'}`, 70, y);
      y += 5;
      doc.setFont(undefined, 'normal'); doc.setFontSize(8.5); doc.setTextColor(90, 90, 90);
      const _lista = d.quienes.map(x => x.qty > 1 ? `${x.nombre} (x${x.qty})` : x.nombre).join('  ·  ');
      doc.splitTextToSize(normalizeForPDF(_lista), 150).forEach(linea => {
        if (y > 280) { doc.addPage(); y = 20; }
        doc.text(linea, 26, y); y += 4;
      });
      doc.setFontSize(9.5); doc.setTextColor(0, 0, 0);
      y += 2.5;
    });
    y += 4;
  });

  // ── Detalle por jugador ──
  doc.addPage(); y = 20;
  doc.setFontSize(12); doc.setFont(undefined, 'bold');
  doc.text(paraProveedor ? 'DETALLE POR CATEGORIA' : 'PEDIDO POR CATEGORIA (control interno)', 14, y); y += 3;
  doc.setDrawColor(C.rgb[0], C.rgb[1], C.rgb[2]); doc.line(14, y, 196, y); y += 8;

  const porJugador = {};
  ordenes.forEach(o => {
    const n = nameById[o.player_id] || o.player_id;
    if (!porJugador[n]) porJugador[n] = { cat: catById[o.player_id] || '', lineas: [] };
    const it = itemById[o.item_id];
    const _n = o.jersey_number || numById[o.player_id];
    const num = _n ? ` #${_n}` : '';
    // La marcación solo se imprime si dice algo distinto del nombre del jugador,
    // que ya es el encabezado del bloque. Si no, es ruido repetido en cada línea.
    const _marca = String(o.marking || '').trim();
    const marca = (_marca && _marca !== String(n).trim()) ? `  ·  para: ${_marca}` : '';
    const abono = (!paraProveedor && Number(o.paid_amount) > 0) ? `  ·  abonó ${money(Number(o.paid_amount))}` : '';
    porJugador[n].lineas.push(`${it ? it.name : o.item_id} — talla ${o.size}${num}${(Number(o.qty) || 1) > 1 ? ' x' + o.qty : ''}${marca}${abono}`);
  });

  /* Agrupado por CATEGORÍA: encabezado de la categoría y debajo sus jugadores,
     que es como el club arma y entrega el pedido. */
  const porCat = {};
  Object.keys(porJugador).forEach(n => {
    const c = porJugador[n].cat || 'Sin categoria';
    (porCat[c] = porCat[c] || []).push(n);
  });

  doc.setFontSize(9.5);
  Object.keys(porCat).sort((a, b) => a.localeCompare(b, 'es', { numeric: true })).forEach(cat => {
    if (y > 265) { doc.addPage(); y = 20; }
    const prendas = porCat[cat].reduce((t, n) => t + porJugador[n].lineas.length, 0);
    doc.setFillColor(C.suave[0], C.suave[1], C.suave[2]);
    doc.roundedRect(14, y - 4.5, 182, 7.5, 1.5, 1.5, 'F');
    doc.setFontSize(10); doc.setFont(undefined, 'bold'); doc.setTextColor(C.rgb[0], C.rgb[1], C.rgb[2]);
    doc.text(normalizeForPDF(cat), 18, y + 0.8);
    doc.text(`${prendas} ${prendas === 1 ? 'prenda' : 'prendas'}`, 192, y + 0.8, { align: 'right' });
    doc.setTextColor(0, 0, 0); y += 10;

    doc.setFontSize(9.5);
    porCat[cat].sort((a, b) => a.localeCompare(b, 'es')).forEach(n => {
      if (y > 272) { doc.addPage(); y = 20; }
      doc.setFont(undefined, 'bold');
      doc.text(normalizeForPDF(n), 18, y); y += 5;
      doc.setFont(undefined, 'normal');
      porJugador[n].lineas.forEach(l => {
        if (y > 280) { doc.addPage(); y = 20; }
        doc.splitTextToSize(normalizeForPDF(`- ${l}`), 172).forEach(linea => {
          if (y > 282) { doc.addPage(); y = 20; }
          doc.text(linea, 22, y); y += 4.6;
        });
      });
      y += 2.5;
    });
    y += 3;
  });

  // Pie en todas las páginas
  const total = doc.internal.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFontSize(8); doc.setTextColor(140, 140, 140);
    doc.text(`${clubName} · Preventa "${_svCampaign.title}" · Página ${i} de ${total}`, 105, 290, { align: 'center' });
    doc.setTextColor(0, 0, 0);
  }
  return doc;
}

// Vista previa EN HTML (no iframe): el CSP de la app no permite enmarcar blob:,
// y además así carga al instante y se ve con el estilo de la app. El PDF real se
// genera al tocar "Descargar" con exactamente los mismos datos.
function _svPdf() {
  const C = _svColorClub();
  if (!_svCampaign || !_svOrders.length) { showToast('❌ No hay pedidos para exportar'); return; }

  const settings = (typeof getSchoolSettings === 'function' ? getSchoolSettings() : null) || {};
  const clubName = settings.name || _svClubId();
  const players = (typeof getPlayers === 'function' ? getPlayers() : []) || [];
  const nameById = {}, catById = {}, numById = {};
  players.forEach(p => { if (p && p.id) { nameById[p.id] = p.name || p.id; catById[p.id] = p.category || ''; numById[p.id] = p.jerseyNumber || ''; } });
  const itemById = {};
  _svItems.forEach(it => { itemById[it.id] = it; });
  const money = (n) => (typeof formatCurrency === 'function' ? formatCurrency(n) : '$' + n);

  // Categorías presentes en los pedidos (para el filtro)
  const cats = [...new Set(_svOrders.map(o => catById[o.player_id] || 'Sin categoría'))].sort((a, b) => a.localeCompare(b, 'es'));
  if (_svPdfCat !== '__todas__' && !cats.includes(_svPdfCat)) _svPdfCat = '__todas__';
  const ordenes = _svPdfCat === '__todas__'
    ? _svOrders
    : _svOrders.filter(o => (catById[o.player_id] || 'Sin categoría') === _svPdfCat);

  const totalUnidades = ordenes.reduce((a, o) => a + (Number(o.qty) || 1), 0);
  const totalJugadores = new Set(ordenes.map(o => o.player_id)).size;
  let valorTotal = 0, hayPrecio = false;
  ordenes.forEach(o => {
    const it = itemById[o.item_id];
    if (it && it.price != null && it.price !== '') { hayPrecio = true; valorTotal += Number(it.price) * (Number(o.qty) || 1); }
  });

  /* El proveedor necesita saber DE QUIÉN es cada prenda, no solo cuántas.
     Se usa la marcación si está cargada; si no, el nombre del jugador — así las
     preventas viejas (anteriores a la marcación) igual salen identificadas. */
  const porItem = {};
  ordenes.forEach(o => {
    if (!porItem[o.item_id]) porItem[o.item_id] = {};
    if (!porItem[o.item_id][o.size]) porItem[o.item_id][o.size] = { qty: 0, quienes: [] };
    const q = Number(o.qty) || 1;
    porItem[o.item_id][o.size].qty += q;
    const quien = String(o.marking || '').trim() || nameById[o.player_id] || o.player_id;
    // Se acumula por persona: si alguien pide 3 de la misma talla en pedidos
    // distintos, el proveedor lee "Juan (x3)" y no "Juan · Juan (x2)".
    const acum = porItem[o.item_id][o.size].quienes;
    const ya = acum.find(x => x.nombre === quien);
    if (ya) ya.qty += q; else acum.push({ nombre: quien, qty: q });
  });

  const consolidado = Object.keys(porItem).map(id => {
    const it = itemById[id];
    const tallas = porItem[id];
    const tot = Object.values(tallas).reduce((a, d) => a + d.qty, 0);
    return `
      <div style="border:1px solid rgba(128,128,128,0.25);border-radius:12px;overflow:hidden;margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;gap:8px;padding:9px 12px;background:${C.css(0.10)};">
          <span class="text-gray-800 dark:text-white" style="font-weight:800;font-size:13.5px;">${_svEsc(it ? it.name : id)}</span>
          <span class="text-gray-800 dark:text-white" style="font-weight:800;font-size:13px;white-space:nowrap;">${tot} uds${(it && it.price != null && it.price !== '') ? ` <span style="opacity:0.6;font-weight:600;">· ${money(it.price)} c/u</span>` : ''}</span>
        </div>
        <div style="padding:8px 12px;display:flex;flex-wrap:wrap;gap:6px;">
          ${Object.keys(tallas).sort(_svCmpTalla).map(t => `<span class="text-gray-700 dark:text-white" style="padding:4px 11px;border-radius:999px;background:rgba(128,128,128,0.20);font-size:12.5px;font-weight:700;">Talla ${_svEsc(t)}: <b>${tallas[t].qty}</b></span>`).join('')}
        </div>
      </div>`;
  }).join('');

  /* Planilla por jugador — una fila por prenda, como la hoja de Excel que los
     clubes llevaban aparte: quién, qué número, qué talla, qué uniforme, qué va
     marcado y cuánto abonó.

     El ABONO es control interno de la preventa: NO es ingreso contable, no
     consume folio DIAN y no entra al cierre de caja (decisión del dueño). Si el
     club además cobra el uniforme por "Otros Cobros", esa es la plata que cuenta. */
  const hayColumnas = ordenes.length === 0 || ordenes.some(o => o.paid_amount !== undefined);

  /* Se agrupa por CATEGORÍA: es como el club organiza el pedido y como se lo
     pasa al proveedor (encabezado de la categoría y abajo sus prendas).
     Dentro de cada categoría, por uniforme y después por nombre. */
  const filas = ordenes.slice().sort((a, b) => {
    const ca = catById[a.player_id] || 'Sin categoría', cb = catById[b.player_id] || 'Sin categoría';
    if (ca !== cb) return ca.localeCompare(cb, 'es', { numeric: true });
    const ia = (itemById[a.item_id] || {}).name || '', ib = (itemById[b.item_id] || {}).name || '';
    if (ia !== ib) return ia.localeCompare(ib, 'es');
    return String(nameById[a.player_id] || '').localeCompare(String(nameById[b.player_id] || ''), 'es');
  });

  let totalACobrar = 0, totalAbonado = 0;
  let catActual = null, nroEnCat = 0;
  const cuerpo = filas.map((o) => {
    const catFila = catById[o.player_id] || 'Sin categoría';
    let encabezado = '';
    if (catFila !== catActual) {
      catActual = catFila; nroEnCat = 0;
      const nEnCat = filas.filter(x => (catById[x.player_id] || 'Sin categoría') === catFila)
                          .reduce((t, x) => t + (Number(x.qty) || 1), 0);
      encabezado = `<tr><td colspan="8" style="padding:12px 10px 7px;">
          <span style="display:inline-block;padding:5px 13px;border-radius:999px;background:${C.css(0.14)};color:${C.hex};font-size:11.5px;font-weight:800;letter-spacing:0.02em;">
            ${_svEsc(catFila)} · ${nEnCat} ${nEnCat === 1 ? 'prenda' : 'prendas'}</span></td></tr>`;
    }
    const i = nroEnCat++;
    const it = itemById[o.item_id] || {};
    const qty = Number(o.qty) || 1;
    const precio = (it.price != null && it.price !== '') ? Number(it.price) * qty : null;
    const abonado = Number(o.paid_amount) || 0;
    if (precio != null) { totalACobrar += precio; totalAbonado += abonado; }
    const saldo = precio != null ? precio - abonado : null;
    // El saldo se lee de un vistazo: verde pagó, ámbar abonó algo, rojo debe todo.
    const pill = (txt, fondo, color) => `<span style="display:inline-block;padding:4px 11px;border-radius:999px;`
      + `background:${fondo};color:${color};font-size:11.5px;font-weight:800;white-space:nowrap;">${txt}</span>`;
    const td = 'padding:11px 10px;border-bottom:1px solid rgba(128,128,128,0.10);font-size:12.5px;vertical-align:middle;';
    const inp = 'width:100%;padding:7px 10px;border-radius:10px;border:1px solid transparent;'
              + 'background:rgba(128,128,128,0.12);font-size:12.5px;outline:none;transition:background .15s ease,border-color .15s ease;'
              + '';
    return `${encabezado}<tr>
        <td style="${td}opacity:0.5;">${i + 1}</td>
        <td style="${td}font-weight:700;">${_svEsc(nameById[o.player_id] || o.player_id)}</td>
        <td style="${td}text-align:center;">${hayColumnas
          ? `<input type="text" inputmode="numeric" maxlength="4" value="${_svEsc(o.jersey_number || numById[o.player_id] || '')}" placeholder="—"
               onchange="_svSetDorsalPedido('${escAttrJs(o.id)}', this.value)"
               onfocus="this.style.background='rgba(99,102,241,0.14)';this.style.borderColor='rgba(99,102,241,0.5)';"
               onblur="this.style.background='rgba(128,128,128,0.12)';this.style.borderColor='transparent';"
               class="text-gray-800 dark:text-white" style="${inp}width:64px;text-align:center;font-weight:800;">`
          : _svEsc(o.jersey_number || numById[o.player_id] || '—')}</td>
        <td style="${td}text-align:center;font-weight:700;">${_svEsc(o.size)}${qty > 1 ? ` <span style="opacity:0.6;font-weight:400;">×${qty}</span>` : ''}</td>
        <td style="${td}">${_svEsc(it.name || o.item_id)}</td>
        <td style="${td}">${hayColumnas
          ? `<input type="text" value="${_svEsc(o.marking || '')}" placeholder="Sin marcar" onchange="_svSetMarcacion('${escAttrJs(o.id)}', this.value)"
               onfocus="this.style.background='rgba(99,102,241,0.14)';this.style.borderColor='rgba(99,102,241,0.5)';"
               onblur="this.style.background='rgba(128,128,128,0.12)';this.style.borderColor='transparent';"
               class="text-gray-800 dark:text-white" style="${inp}min-width:110px;">`
          : '<span style="opacity:0.35;">—</span>'}</td>
        <td style="${td}text-align:right;">${hayColumnas
          ? `<input type="text" inputmode="numeric" value="${o.paid_amount ? _svEsc(montoADisplay(o.paid_amount)) : ''}" placeholder="0" onchange="_svSetAbono('${escAttrJs(o.id)}', this.value)"
               onfocus="this.style.background='rgba(22,163,74,0.16)';this.style.borderColor='rgba(22,163,74,0.5)';"
               onblur="this.style.background='rgba(128,128,128,0.12)';this.style.borderColor='transparent';"
               class="text-gray-800 dark:text-white" style="${inp}width:96px;text-align:right;font-weight:700;">`
          : '<span style="opacity:0.35;">—</span>'}</td>
        <td style="${td}text-align:right;">${
          saldo == null ? pill('sin precio', 'rgba(128,128,128,0.14)', 'currentColor')
          : saldo <= 0  ? pill('PAGÓ', 'rgba(22,163,74,0.18)', '#16a34a')
          : abonado > 0 ? pill(money(saldo), 'rgba(217,119,6,0.18)', '#d97706')
                        : pill(money(saldo), 'rgba(220,38,38,0.16)', '#dc2626')}</td>
      </tr>`;
  }).join('');

  const th = 'padding:10px;font-size:10px;font-weight:800;letter-spacing:0.09em;text-transform:uppercase;opacity:0.5;text-align:left;white-space:nowrap;';
  const detalle = `
      ${!hayColumnas ? `<div style="padding:9px 12px;border-radius:10px;background:rgba(245,158,11,0.15);border:1px solid rgba(245,158,11,0.45);color:#b45309;font-size:12px;font-weight:600;margin-bottom:10px;">
        Los abonos y la marcación necesitan una actualización de la base todavía sin aplicar.</div>` : ''}
      <div style="overflow-x:auto;border-radius:16px;border:1px solid rgba(128,128,128,0.16);">
        <table style="width:100%;border-collapse:collapse;min-width:660px;">
          <thead><tr style="background:rgba(128,128,128,0.09);">
            <th style="${th}">#</th><th style="${th}">Deportista</th>
            <th style="${th}text-align:center;">N°</th><th style="${th}text-align:center;">Talla</th>
            <th style="${th}">Uniforme</th><th style="${th}">Para quién</th>
            <th style="${th}text-align:right;">Abona</th><th style="${th}text-align:right;">Saldo</th>
          </tr></thead>
          <tbody class="text-gray-800 dark:text-white" style="--nada:0;">${cuerpo}</tbody>
        </table>
      </div>
      ${totalACobrar > 0 ? `<div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:14px;">
        <div class="text-gray-800 dark:text-white" style="flex:1;min-width:118px;padding:13px 12px;border-radius:16px;background:rgba(128,128,128,0.10);border:1px solid rgba(128,128,128,0.16);text-align:center;">
          <p style="font-size:10px;font-weight:800;letter-spacing:0.09em;text-transform:uppercase;opacity:0.5;margin-bottom:3px;">Total a cobrar</p>
          <p style="font-size:17px;font-weight:800;letter-spacing:-0.01em;">${money(totalACobrar)}</p></div>
        <div style="flex:1;min-width:118px;padding:13px 12px;border-radius:16px;background:rgba(22,163,74,0.12);border:1px solid rgba(22,163,74,0.28);text-align:center;color:#16a34a;">
          <p style="font-size:10px;font-weight:800;letter-spacing:0.09em;text-transform:uppercase;opacity:0.75;margin-bottom:3px;">Abonado</p>
          <p style="font-size:17px;font-weight:800;letter-spacing:-0.01em;">${money(totalAbonado)}</p></div>
        <div style="flex:1;min-width:118px;padding:13px 12px;border-radius:16px;background:rgba(220,38,38,0.10);border:1px solid rgba(220,38,38,0.26);text-align:center;color:#dc2626;">
          <p style="font-size:10px;font-weight:800;letter-spacing:0.09em;text-transform:uppercase;opacity:0.75;margin-bottom:3px;">Falta</p>
          <p style="font-size:17px;font-weight:800;letter-spacing:-0.01em;">${money(Math.max(0, totalACobrar - totalAbonado))}</p></div>
      </div>` : ''}`;

  document.getElementById('svPdfPreview')?.remove();
  const m = document.createElement('div');
  m.id = 'svPdfPreview';
  m.className = 'fixed inset-0 bg-black/70 flex items-center justify-center p-3';
  m.style.zIndex = '80';
  m.addEventListener('click', (e) => { if (e.target === m) m.remove(); });
  m.innerHTML = `
    <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col" style="max-height:90vh">
      <div class="px-4 pt-3 pb-3 border-b border-gray-200 dark:border-gray-700 shrink-0">
        <div class="flex items-start justify-between gap-2 mb-3">
          <div class="min-w-0">
            <p class="font-bold text-gray-800 dark:text-white text-base">Pedido de preventa</p>
            <p class="text-xs text-gray-500 dark:text-gray-400">Revisalo antes de mandárselo al proveedor</p>
          </div>
          <button onclick="document.getElementById('svPdfPreview').remove()" aria-label="Cerrar" class="shrink-0 w-9 h-9 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 text-2xl leading-none">&times;</button>
        </div>
        <div class="flex items-center gap-2">
          <select onchange="_svSetPdfCat(this.value)" title="Filtrar por categoría"
            class="flex-1 min-w-0 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-white text-sm">
            <option value="__todas__"${_svPdfCat === '__todas__' ? ' selected' : ''}>Todas las categorías</option>
            ${cats.map(c => `<option value="${_svEsc(c)}"${_svPdfCat === c ? ' selected' : ''}>${_svEsc(c)}</option>`).join('')}
          </select>
          <button onclick="_svElegirInforme()" class="shrink-0 py-2 px-3 text-white rounded-lg text-sm font-bold flex items-center gap-1.5"
            style="background:${C.hex};">
            <i data-lucide="download" class="w-4 h-4"></i> PDF
          </button>
        </div>
      </div>
      <div class="p-4 overflow-y-auto text-gray-800 dark:text-white">
        <div style="padding:14px;border-radius:14px;background:linear-gradient(135deg,${C.hex},${C.css(0.72)});color:#fff;margin-bottom:14px;">
          <p style="font-size:11px;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;opacity:0.9;">Pedido de preventa</p>
          <p style="font-size:19px;font-weight:800;margin-top:2px;">${_svEsc(_svCampaign.title)}</p>
          <p style="font-size:12px;opacity:0.9;margin-top:3px;">${_svEsc(clubName)}${settings.phone ? ' · ' + _svEsc(settings.phone) : ''} · ${new Date().toLocaleDateString('es-CO')}</p>
          ${_svPdfCat !== '__todas__' ? `<p style="font-size:11.5px;font-weight:800;margin-top:6px;padding:3px 10px;border-radius:999px;background:rgba(255,255,255,0.22);display:inline-block;">Categoría ${_svEsc(_svPdfCat)}</p>` : ''}
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(112px,1fr));gap:10px;margin-bottom:18px;">
          <div class="text-gray-800 dark:text-white" style="padding:13px 12px;border-radius:16px;background:rgba(128,128,128,0.09);border:1px solid rgba(128,128,128,0.16);text-align:center;">
            <p style="font-size:10px;font-weight:800;letter-spacing:0.09em;text-transform:uppercase;opacity:0.5;margin-bottom:3px;">Unidades</p><p style="font-size:21px;font-weight:800;letter-spacing:-0.02em;">${totalUnidades}</p></div>
          <div class="text-gray-800 dark:text-white" style="padding:13px 12px;border-radius:16px;background:rgba(128,128,128,0.09);border:1px solid rgba(128,128,128,0.16);text-align:center;">
            <p style="font-size:10px;font-weight:800;letter-spacing:0.09em;text-transform:uppercase;opacity:0.5;margin-bottom:3px;">Jugadores</p><p style="font-size:21px;font-weight:800;letter-spacing:-0.02em;">${totalJugadores}</p></div>
          <div class="text-gray-800 dark:text-white" style="padding:13px 12px;border-radius:16px;background:rgba(128,128,128,0.09);border:1px solid rgba(128,128,128,0.16);text-align:center;">
            <p style="font-size:10px;font-weight:800;letter-spacing:0.09em;text-transform:uppercase;opacity:0.5;margin-bottom:3px;">Productos</p><p style="font-size:21px;font-weight:800;letter-spacing:-0.02em;">${_svItems.length}</p></div>
          ${hayPrecio ? `<div style="padding:13px 12px;border-radius:16px;background:rgba(22,163,74,0.12);border:1px solid rgba(22,163,74,0.28);text-align:center;color:#16a34a;">
            <p style="font-size:10px;font-weight:800;letter-spacing:0.09em;text-transform:uppercase;opacity:0.5;margin-bottom:3px;opacity:0.75;">Valor estimado</p><p style="font-size:18px;font-weight:800;letter-spacing:-0.02em;">${money(valorTotal)}</p></div>` : ''}
        </div>
        <details style="margin-bottom:12px;">
          <summary class="text-gray-800 dark:text-white" style="cursor:pointer;list-style:none;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:11px 13px;border-radius:14px;background:rgba(128,128,128,0.10);border:1px solid rgba(128,128,128,0.16);font-size:13px;font-weight:800;letter-spacing:-0.01em;">
            <span style="display:flex;align-items:center;gap:8px;">
              <span class="sv-flecha" style="display:inline-block;transition:transform .18s ease;opacity:0.55;">▾</span>
              📦 Consolidado para el proveedor</span>
            <span style="font-weight:600;opacity:0.55;font-size:11.5px;">${_svItems.length} ${_svItems.length === 1 ? 'producto' : 'productos'} · tocá para plegar</span>
          </summary>
          <div style="padding-top:10px;">${consolidado}</div>
        </details>
        <details style="margin-bottom:4px;">
          <summary class="text-gray-800 dark:text-white" style="cursor:pointer;list-style:none;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:11px 13px;border-radius:14px;background:rgba(128,128,128,0.10);border:1px solid rgba(128,128,128,0.16);font-size:13px;font-weight:800;letter-spacing:-0.01em;">
            <span style="display:flex;align-items:center;gap:8px;">
              <span class="sv-flecha" style="display:inline-block;transition:transform .18s ease;opacity:0.55;">▾</span>
              📋 Pedido por categoría</span>
            <span style="font-weight:600;opacity:0.55;font-size:11.5px;">${ordenes.length} ${ordenes.length === 1 ? 'prenda' : 'prendas'} · tocá para abrir</span>
          </summary>
          <p class="text-gray-500 dark:text-gray-400" style="font-size:11.5px;margin:9px 0 8px;">El abono es control interno, no entra en Contabilidad.</p>
          <div>${detalle}</div>
        </details>
      </div>
    </div>`;
  document.body.appendChild(m);
}
window._svPdf = _svPdf;

/* ── Marcación y abono (solo admin) ───────────────────────────────────────
   Van sobre la fila del pedido en sale_orders. El ABONO es control interno de
   la preventa: NO crea un pago, NO consume folio DIAN y NO entra en
   Contabilidad ni en el cierre de caja. Es la planilla que los clubes llevaban
   en Excel, ahora adentro de la app. */
async function _svGuardarCampoPedido(orderId, campo, valor, aviso) {
  const o = _svOrders.find(x => x.id === orderId);
  if (!o) return;
  const anterior = o[campo];
  try {
    await _svWrite(
      `${window.SUPA_URL}/rest/v1/sale_orders?id=eq.${encodeURIComponent(orderId)}` +
      `&club_id=eq.${encodeURIComponent(_svClubId())}&select=id`,
      'PATCH', { [campo]: valor });
    o[campo] = valor;              // el caché local sigue al servidor, no al revés
    showToast(aviso);
    _svPdf();                      // re-dibuja la planilla con los totales al día
  } catch (e) {
    o[campo] = anterior;           // se revierte: la pantalla no miente
    console.error('[Preventa] guardar ' + campo + ':', e);
    showToast('❌ No se pudo guardar: ' + (e?.message || ''));
  }
}

/* El número que va estampado en ESTA prenda. Se copia del jugador al pedir;
   acá el club lo corrige sin tocar la ficha. Solo dígitos, de 1 a 1000. */
function _svSetDorsalPedido(orderId, valor) {
  // El máximo es 1000 en TODA la app: portal, ficha del jugador y esta planilla.
  // Antes acá era 99 y el pedido se recortaba a 3 caracteres, así que un dorsal
  // como 2015 (clubes que numeran por año) se guardaba como "201".
  const limpio = String(valor || '').replace(/\D/g, '');
  const n = parseInt(limpio, 10);
  // Se valida SIN recortar: recortando primero, un "10000" quedaba en "1000" y
  // pasaba como válido en vez de rechazarse.
  if (limpio && (!Number.isFinite(n) || n < 1 || n > 1000)) {
    showToast('⚠️ El número tiene que ir de 1 a 1000');
    _svPdf();
    return;
  }
  _svGuardarCampoPedido(orderId, 'jersey_number', limpio || null, '👕 Número guardado');
}
window._svSetDorsalPedido = _svSetDorsalPedido;

function _svSetMarcacion(orderId, valor) {
  const limpio = String(valor || '').trim().slice(0, 60);
  _svGuardarCampoPedido(orderId, 'marking', limpio || null, '✏️ Marcación guardada');
}

function _svSetAbono(orderId, valor) {
  // parseMonto entiende "100.000" y también el número pelado.
  let n = typeof parseMonto === 'function' ? parseMonto(valor) : parseFloat(valor) || 0;
  if (!Number.isFinite(n) || n < 0) n = 0;
  _svGuardarCampoPedido(orderId, 'paid_amount', n, '💵 Abono guardado');
}

window._svSetMarcacion = _svSetMarcacion;
window._svSetAbono = _svSetAbono;

/* Al descargar se pregunta PARA QUIÉN es el informe.
   El del proveedor no lleva precios, valores ni abonos: solo qué producir, en
   qué talla y para quién. El interno lleva todo. */
function _svElegirInforme() {
  const C = _svColorClub();
  document.getElementById('svElegirPdf')?.remove();
  const m = document.createElement('div');
  m.id = 'svElegirPdf';
  m.className = 'fixed inset-0 bg-black/70 flex items-center justify-center p-4';
  m.style.zIndex = '90';
  m.addEventListener('click', (e) => { if (e.target === m) m.remove(); });
  const opcion = (accion, icono, titulo, detalle, destacado) => `
    <button onclick="${accion}" class="w-full text-left"
      style="display:flex;gap:12px;align-items:flex-start;padding:15px;border-radius:16px;margin-bottom:10px;
             border:1.5px solid ${destacado ? C.css(0.5) : 'rgba(128,128,128,0.25)'};
             background:${destacado ? C.css(0.09) : 'transparent'};transition:background .15s ease;">
      <span style="font-size:21px;line-height:1;">${icono}</span>
      <span style="min-width:0;">
        <span class="text-gray-800 dark:text-white" style="display:block;font-weight:800;font-size:14px;">${titulo}</span>
        <span class="text-gray-500 dark:text-gray-400" style="display:block;font-size:12px;margin-top:3px;line-height:1.45;">${detalle}</span>
      </span>
    </button>`;
  m.innerHTML = `
    <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm p-5">
      <p class="text-gray-800 dark:text-white" style="font-weight:800;font-size:16px;">¿Para quién es el informe?</p>
      <p class="text-gray-500 dark:text-gray-400" style="font-size:12.5px;margin:4px 0 15px;">Se descargan distintos: el del proveedor no lleva plata.</p>
      ${opcion("_svPdfDownload('proveedor')", '📦', 'Para el proveedor',
               'Solo productos, tallas, cantidades y para quién es cada prenda. Sin precios, sin valores ni abonos.', true)}
      ${opcion("_svPdfDownload('admin')", '🔒', 'Para el club (interno)',
               'Todo lo anterior más precios, valor estimado y los abonos de cada familia.', false)}
      <button onclick="document.getElementById('svElegirPdf').remove()"
        class="w-full mt-1 py-2.5 rounded-xl text-sm font-bold text-gray-600 dark:text-gray-300"
        style="background:rgba(128,128,128,0.14);">Cancelar</button>
    </div>`;
  document.body.appendChild(m);
}
window._svElegirInforme = _svElegirInforme;

function _svPdfDownload(tipo) {
  // jsPDF se carga solo cuando de verdad se descarga (la vista previa es HTML)
  if (typeof window.jspdf === 'undefined') { loadJsPDF(() => _svPdfDownload(tipo)); return; }
  try {
    document.getElementById('svElegirPdf')?.remove();
    const doc = _svBuildPdf(tipo);
    const sufijo = _svPdfCat !== '__todas__' ? '-' + String(_svPdfCat).replace(/[^a-z0-9]/gi, '-').toLowerCase() : '';
    const quien = tipo === 'proveedor' ? '-proveedor' : '-interno';
    doc.save(`preventa-${(_svCampaign.title || 'pedido').replace(/[^a-z0-9]/gi, '-').toLowerCase()}${sufijo}${quien}.pdf`);
    showToast(tipo === 'proveedor' ? '📦 Informe para el proveedor descargado' : '🔒 Informe interno descargado');
  } catch (e) {
    console.error('[Preventa] descargar PDF:', e);
    showToast('❌ No se pudo descargar el PDF');
  }
}
window._svPdfDownload = _svPdfDownload;

console.log('✅ sales.js cargado (Preventas)');

// Cambia el filtro de categoría de la vista previa (y del PDF que se descargue)
function _svSetPdfCat(cat) {
  _svPdfCat = cat || '__todas__';
  _svPdf();   // repinta la vista previa con el filtro nuevo
}
window._svSetPdfCat = _svSetPdfCat;
