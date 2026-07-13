// ============================================================
// 📁 CENTRO DE DOCUMENTOS — MY CLUB
// Vista dentro de la app: agrupa a los jugadores por CATEGORÍA y
// muestra quién tiene documentos subidos y quién no, con descarga.
// Datos: getPlayers() (caché local) + refresco de `documents` desde
// Supabase (para ver también lo que subieron los padres del portal).
// Tolerante a fallos: si Supabase falla, usa la caché.
// ============================================================

let _dcData = [];            // [{ id, name, category, avatar, status, documents:[] }]
let _dcFilter = 'all';       // 'all' | 'with' | 'without'
let _dcSearch = '';
let _dcOpenCats = new Set(); // categorías expandidas manualmente
let _dcOpenPlayers = new Set();
let _dcLoading = false;

// Escapa texto para insertarlo como HTML O como valor de ATRIBUTO de forma segura.
// Escapa comillas ("/') además de &<> — imprescindible porque estos valores
// (nombre, url, avatar) los controla el padre desde el portal y van dentro de
// atributos con comillas (src="", data-url="", data-cat=""). Sin escapar las
// comillas habría inyección de HTML/atributos (XSS almacenado).
function _dcEsc(s) {
  return (s == null ? '' : String(s))
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function _dcDefaultAvatar(name) {
  // Inicial saneada a [A-Z0-9] para que la URL sea siempre segura dentro del
  // onerror inline (evita romper el JS si el nombre empieza con comilla, etc.)
  let ch = (name || '?').charAt(0).toUpperCase();
  if (!/[A-Z0-9]/.test(ch)) ch = 'X';
  return 'https://ui-avatars.com/api/?name=' + ch + '&background=0d9488&color=fff&size=64';
}

function _dcIsInactive(st) {
  const s = String(st || '').toLowerCase();
  return s === 'inactivo' || s === 'inactive';
}

function _dcDocIcon(t) {
  return t === 'pdf' ? '📄' : t === 'word' ? '📝' : '🖼️';
}

// Carga base desde caché + refresca `documents` desde Supabase (best-effort).
async function _dcLoad() {
  const base = (typeof getPlayers === 'function' ? getPlayers() : []) || [];
  let data = base
    .filter(p => p && !p.deleted)
    .map(p => ({
      id: p.id,
      name: p.name || 'Sin nombre',
      category: (p.category && String(p.category).trim()) || 'Sin categoría',
      avatar: p.avatar || '',
      status: p.status || '',
      documents: Array.isArray(p.documents) ? p.documents : []
    }));

  // Refrescar documentos desde Supabase (incluye los subidos por los padres).
  try {
    const clubId = localStorage.getItem('clubId');
    if (window.MODO_SUPABASE && clubId && window.SUPA_URL && window.SUPA_ANON) {
      const res = await fetch(
        window.SUPA_URL + '/rest/v1/players?club_id=eq.' + encodeURIComponent(clubId) + '&select=id,documents&limit=3000',
        { headers: { apikey: window.SUPA_ANON, Authorization: 'Bearer ' + window.SUPA_ANON } }
      );
      if (res.ok) {
        const rows = await res.json();
        const byId = {};
        rows.forEach(r => { byId[r.id] = Array.isArray(r.documents) ? r.documents : []; });
        data = data.map(p => (byId[p.id] ? Object.assign({}, p, { documents: byId[p.id] }) : p));
      }
    }
  } catch (e) {
    console.warn('[docs-center] refresco de documentos falló, uso caché:', e && e.message);
  }

  _dcData = data;
}

// Punto de entrada — lo llama navigateTo('documentsCenter').
async function renderDocumentsCenter() {
  const cont = document.getElementById('documentsCenterContent');
  if (!cont) return;
  if (_dcLoading) return;
  _dcLoading = true;
  cont.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 py-10">⏳ Cargando documentos...</p>';
  try {
    await _dcLoad();
    _dcRenderShell();
  } catch (e) {
    console.error('[docs-center] error:', e);
    cont.innerHTML = '<p class="text-center text-red-500 py-10">No se pudieron cargar los documentos.</p>';
  } finally {
    _dcLoading = false;
  }
}

function _dcStats() {
  const total = _dcData.length;
  const withDocs = _dcData.filter(p => (p.documents || []).length > 0).length;
  return { total: total, withDocs: withDocs, without: total - withDocs, pct: total ? Math.round(withDocs / total * 100) : 0 };
}

function _dcRenderShell() {
  const cont = document.getElementById('documentsCenterContent');
  if (!cont) return;
  const s = _dcStats();
  const fBtn = (key, label) => {
    const active = _dcFilter === key;
    return '<button onclick="dcSetFilter(\'' + key + '\')" class="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ' +
      (active ? 'bg-teal-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300') + '">' + label + '</button>';
  };
  cont.innerHTML =
    '<div class="glass-card rounded-xl p-4 shadow-sm">' +
      '<div class="flex items-center justify-between mb-2">' +
        '<span class="text-sm text-gray-600 dark:text-gray-300"><strong>' + s.withDocs + '</strong> de <strong>' + s.total + '</strong> jugadores con documentos</span>' +
        '<span class="text-sm font-bold text-teal-600">' + s.pct + '%</span>' +
      '</div>' +
      '<div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">' +
        '<div class="h-2 rounded-full bg-gradient-to-r from-teal-500 to-cyan-500 transition-all" style="width:' + s.pct + '%"></div>' +
      '</div>' +
    '</div>' +
    '<div class="flex flex-wrap items-center gap-2 mt-3">' + fBtn('all', 'Todos') + fBtn('with', '✓ Con documentos') + fBtn('without', '⚠ Sin documentos') + '</div>' +
    '<div class="relative mt-3">' +
      '<input id="dcSearchInput" type="text" value="' + _dcEsc(_dcSearch) + '" oninput="dcOnSearch(this.value)" placeholder="Buscar jugador..." ' +
        'class="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none">' +
      '<i data-lucide="search" class="w-4 h-4 text-gray-400 absolute left-3 top-2.5"></i>' +
    '</div>' +
    '<div id="dcList" class="mt-3 space-y-3"></div>';

  // Listener delegado en el #dcList recién creado (el nodo viejo y su listener
  // se destruyen con el innerHTML anterior, así que no se duplican).
  const list = document.getElementById('dcList');
  if (list) { list.addEventListener('click', _dcListClick); }

  _dcRenderList();
  if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
}

function _dcFilteredPlayers() {
  const q = _dcSearch.trim().toLowerCase();
  return _dcData.filter(p => {
    const hasDocs = (p.documents || []).length > 0;
    if (_dcFilter === 'with' && !hasDocs) return false;
    if (_dcFilter === 'without' && hasDocs) return false;
    if (q && p.name.toLowerCase().indexOf(q) === -1) return false;
    return true;
  });
}

function _dcRenderList() {
  const list = document.getElementById('dcList');
  if (!list) return;
  const players = _dcFilteredPlayers();
  if (players.length === 0) {
    list.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 py-8">No hay jugadores que coincidan.</p>';
    return;
  }
  // Agrupar por categoría
  const groups = {};
  players.forEach(p => { (groups[p.category] = groups[p.category] || []).push(p); });
  const cats = Object.keys(groups).sort();
  // Con filtro o búsqueda activa, expandir todo para ver los jugadores al toque.
  const forceOpen = (_dcFilter !== 'all') || (_dcSearch.trim() !== '');

  let html = '';
  cats.forEach(cat => {
    const arr = groups[cat].sort((a, b) => a.name.localeCompare(b.name));
    const withN = arr.filter(p => (p.documents || []).length > 0).length;
    const pct = arr.length ? Math.round(withN / arr.length * 100) : 0;
    const open = forceOpen || _dcOpenCats.has(cat);
    html +=
      '<div class="glass-card rounded-xl overflow-hidden shadow-sm">' +
        '<div data-dc-action="toggle-cat" data-cat="' + _dcEsc(cat) + '" class="w-full flex items-center justify-between p-4 text-left cursor-pointer">' +
          '<div class="min-w-0">' +
            '<p class="font-bold text-gray-800 dark:text-white truncate">' + _dcEsc(cat) + '</p>' +
            '<div class="flex items-center gap-2 mt-1">' +
              '<div class="w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden"><div class="h-1.5 rounded-full bg-teal-500" style="width:' + pct + '%"></div></div>' +
              '<span class="text-xs text-gray-500 dark:text-gray-400">' + withN + '/' + arr.length + ' con documentos</span>' +
            '</div>' +
          '</div>' +
          '<i data-lucide="' + (open ? 'chevron-down' : 'chevron-right') + '" class="w-5 h-5 text-gray-400 flex-shrink-0 pointer-events-none"></i>' +
        '</div>' +
        (open ? '<div class="px-3 pb-3 space-y-2">' + arr.map(_dcPlayerRow).join('') + '</div>' : '') +
      '</div>';
  });
  list.innerHTML = html;
  if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
}

function _dcPlayerRow(p) {
  const docs = p.documents || [];
  const has = docs.length > 0;
  const open = _dcOpenPlayers.has(p.id);
  const inactive = _dcIsInactive(p.status);
  const avatar = p.avatar || _dcDefaultAvatar(p.name);
  const badge = has
    ? '<span class="text-xs font-semibold text-green-600 dark:text-green-400 whitespace-nowrap">✓ ' + docs.length + ' doc' + (docs.length > 1 ? 's' : '') + '</span>'
    : '<span class="text-xs font-semibold text-amber-600 dark:text-amber-400 whitespace-nowrap">⚠ Sin documentos</span>';

  const head =
    '<div class="flex items-center justify-between gap-2 bg-white dark:bg-gray-700 rounded-lg p-2 ' + (has ? 'cursor-pointer' : '') + '" ' +
      (has ? 'data-dc-action="toggle-player" data-id="' + _dcEsc(p.id) + '"' : '') + '>' +
      '<div class="flex items-center gap-2 min-w-0 pointer-events-none">' +
        '<img src="' + _dcEsc(avatar) + '" onerror="this.src=\'' + _dcDefaultAvatar(p.name) + '\'" class="w-12 h-12 rounded-full object-cover flex-shrink-0 border-2 border-teal-500/40 shadow-sm">' +
        '<div class="min-w-0">' +
          '<p class="text-sm font-medium text-gray-800 dark:text-white truncate">' + _dcEsc(p.name) + (inactive ? ' <span class="text-[10px] text-gray-400">(inactivo)</span>' : '') + '</p>' +
          badge +
        '</div>' +
      '</div>' +
      (has ? '<i data-lucide="' + (open ? 'chevron-up' : 'chevron-down') + '" class="w-4 h-4 text-gray-400 flex-shrink-0 pointer-events-none"></i>' : '') +
    '</div>';

  let body = '';
  if (has && open) {
    const photoRow = p.avatar
      ? '<div class="flex items-center justify-between gap-2">' +
          '<span class="text-xs text-gray-600 dark:text-gray-300 truncate">🖼️ Foto de perfil</span>' +
          '<button data-dc-action="download" data-url="' + _dcEsc(p.avatar) + '" class="px-2.5 py-1 rounded-md bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 text-xs font-semibold flex-shrink-0">Descargar</button>' +
        '</div>'
      : '';
    const docRows = docs.map(d =>
      '<div class="flex items-center justify-between gap-2">' +
        '<span class="text-xs text-gray-600 dark:text-gray-300 truncate">' + _dcDocIcon(d.fileType) + ' ' + _dcEsc(d.name) + '</span>' +
        '<button data-dc-action="download" data-url="' + _dcEsc(d.url) + '" class="px-2.5 py-1 rounded-md bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 text-xs font-semibold flex-shrink-0">Descargar</button>' +
      '</div>'
    ).join('');
    body = '<div class="pl-16 pr-1 pt-1 pb-1 space-y-1.5">' + photoRow + docRows + '</div>';
  }
  return '<div>' + head + body + '</div>';
}

// Handler delegado de clicks dentro de la lista.
function _dcListClick(e) {
  const el = e.target.closest('[data-dc-action]');
  if (!el) return;
  const action = el.getAttribute('data-dc-action');
  if (action === 'toggle-cat') {
    const cat = el.getAttribute('data-cat');
    if (_dcOpenCats.has(cat)) _dcOpenCats.delete(cat); else _dcOpenCats.add(cat);
    _dcRenderList();
  } else if (action === 'toggle-player') {
    const id = el.getAttribute('data-id');
    if (_dcOpenPlayers.has(id)) _dcOpenPlayers.delete(id); else _dcOpenPlayers.add(id);
    _dcRenderList();
  } else if (action === 'download') {
    const url = el.getAttribute('data-url');
    // Solo https:// (bloquea esquemas peligrosos como javascript: o data:)
    if (!url || !/^https:\/\//i.test(url)) return;
    if (typeof downloadDocument === 'function') downloadDocument(url);
    else window.open(url, '_blank');
  }
}

// ── Handlers globales (usados por onclick/oninput en el shell) ──
function dcSetFilter(f) {
  _dcFilter = f;
  _dcRenderShell();
}
function dcOnSearch(val) {
  _dcSearch = val || '';
  _dcRenderList(); // solo la lista → no pierde el foco del buscador
}

window.renderDocumentsCenter = renderDocumentsCenter;
window.dcSetFilter = dcSetFilter;
window.dcOnSearch = dcOnSearch;

console.log('📁 Centro de Documentos cargado');
