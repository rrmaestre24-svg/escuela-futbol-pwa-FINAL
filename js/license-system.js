console.log('🔐 Cargando sistema de licencias...');

// ========================================
// 📞 CONFIGURACIÓN DE CONTACTO
// ========================================
if (typeof ADMIN_WHATSAPP === 'undefined') {
  var ADMIN_WHATSAPP = '573005452038';
}

// WhatsApp para adquirir/activar módulos de pago (escaparate de módulos).
if (typeof MODULOS_WHATSAPP === 'undefined') {
  var MODULOS_WHATSAPP = '573104532888';
}

// Helper GLOBAL: ¿el club tiene activo un módulo de pago? (inventario,
// portal_padres, asistencias, convocatoria). Fuente: localStorage.licenseModulos
// (lo setea checkLicenseStatus desde la licencia). Falla CERRADO (deniega) ante
// cualquier problema. Lo usan el modal de documentos y el escaparate de módulos.
function moduloActivo(nombre) {
  try {
    const m = JSON.parse(localStorage.getItem('licenseModulos') || '{}');
    return !!(m && m[nombre] === true);
  } catch (e) { return false; }
}
if (typeof window !== 'undefined') { window.moduloActivo = moduloActivo; }

// ========================================
// CONFIGURACIÓN
// ========================================
if (typeof LICENSE_CONFIG === 'undefined') {
  var LICENSE_CONFIG = {
    GRACE_PERIOD_DAYS: 3,
    CODE_EXPIRY_DAYS: 7,
    ALERT_DAYS_BEFORE: [7, 3, 1]
  };
}

// ========================================
// SUPABASE — validación de códigos nuevos
// ========================================
const _SUPA_URL  = 'https://lcyebvfvolepcqzsqxfk.supabase.co';
const _SUPA_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjeWVidmZ2b2xlcGNxenNxeGZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MTA1OTUsImV4cCI6MjA5NDk4NjU5NX0.ZVd4uIYqv8TPIbezOqe8PmA6ZK9yLJ2tybLYz9NYriM';

async function _validateCodeSupabase(cleanCode) {
  try {
    const res = await fetch(
      `${_SUPA_URL}/rest/v1/activation_codes?code=eq.${encodeURIComponent(cleanCode)}&select=code,plan,used,used_by,created_at`,
      { headers: { apikey: _SUPA_ANON, Authorization: `Bearer ${_SUPA_ANON}` } }
    );
    if (!res.ok) return null;
    const rows = await res.json();
    return rows?.[0] || null;
  } catch (e) {
    return null;
  }
}

async function _markCodeUsedSupabase(cleanCode, clubId) {
  try {
    await fetch(
      `${_SUPA_URL}/rest/v1/activation_codes?code=eq.${encodeURIComponent(cleanCode)}`,
      {
        method: 'PATCH',
        headers: {
          apikey: _SUPA_ANON,
          Authorization: `Bearer ${_SUPA_ANON}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal'
        },
        body: JSON.stringify({ used: true, used_by: clubId, used_at: new Date().toISOString() })
      }
    );
  } catch (e) {
    console.warn('No se pudo marcar código en Supabase:', e);
  }
}

// ========================================
// FUNCIONES DE VALIDACIÓN DE CÓDIGOS
// ========================================

/**
 * Validar código de activación (Firebase primero, luego Supabase)
 */
async function validateActivationCode(code) {
  if (!code || code.trim() === '') {
    return { valid: false, error: 'Código vacío' };
  }

  const cleanCode = code.trim().toUpperCase();

  // --- Intentar Supabase ---
  console.log('🔍 Validando código en Supabase...');
  const row = await _validateCodeSupabase(cleanCode);

  if (!row) return { valid: false, error: 'Código inválido o no existe' };
  if (row.used === true) return { valid: false, error: 'Este código ya fue utilizado' };

  const createdAt = new Date(row.created_at);
  const expiresAt = new Date(createdAt);
  expiresAt.setDate(expiresAt.getDate() + LICENSE_CONFIG.CODE_EXPIRY_DAYS);
  if (new Date() > expiresAt) return { valid: false, error: 'Este código ha expirado. Solicita uno nuevo.' };

  console.log('✅ Código válido (Supabase)');
  return { valid: true, source: 'supabase', data: { code: cleanCode, plan: row.plan, createdAt, expiresAt } };
}

/**
 * Marcar código como usado y crear licencia
 */
async function activateLicense(code, clubId, clubName, clubPhone, plan, codeSource) {
  try {
    const cleanCode = code.trim().toUpperCase();
    const now = new Date();

    const endDate = new Date(now);
    if (plan === 'anual') {
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else {
      endDate.setMonth(endDate.getMonth() + 1);
    }

    console.log('📝 Marcando código como usado...');
    if (codeSource === 'supabase' || window.MODO_SUPABASE) {
      await _markCodeUsedSupabase(cleanCode, clubId);
    }

    console.log('📝 Creando licencia...');
    if (window.MODO_SUPABASE) {
      const licRes = await fetch(
        `${_SUPA_URL}/rest/v1/licenses?club_id=eq.${encodeURIComponent(clubId)}`,
        {
          method: 'PATCH',
          headers: { apikey: _SUPA_ANON, Authorization: `Bearer ${_SUPA_ANON}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
          body: JSON.stringify({
            club_name: clubName,
            plan: plan,
            activation_code: cleanCode,
            start_date: now.toISOString(),
            end_date: endDate.toISOString(),
            status: 'activo',
            total_players: 0
          })
        }
      );
      // Si no existe aún, crear con POST
      if (!licRes.ok || licRes.status === 204) {
        const checkRes = await fetch(
          `${_SUPA_URL}/rest/v1/licenses?club_id=eq.${encodeURIComponent(clubId)}&select=id&limit=1`,
          { headers: { apikey: _SUPA_ANON, Authorization: `Bearer ${_SUPA_ANON}` } }
        );
        const existing = checkRes.ok ? await checkRes.json() : [];
        if (existing.length === 0) {
          await fetch(`${_SUPA_URL}/rest/v1/licenses`, {
            method: 'POST',
            headers: { apikey: _SUPA_ANON, Authorization: `Bearer ${_SUPA_ANON}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
            body: JSON.stringify({
              club_id: clubId,
              club_name: clubName,
              plan: plan,
              activation_code: cleanCode,
              start_date: now.toISOString(),
              end_date: endDate.toISOString(),
              status: 'activo',
              total_players: 0,
              created_at: now.toISOString()
            })
          });
        }
      }
    }

    localStorage.setItem('licenseStatus', 'activo');
    localStorage.setItem('licenseEndDate', endDate.toISOString());
    localStorage.setItem('licensePlan', plan);

    console.log('✅ Licencia activada correctamente');
    return true;

  } catch (error) {
    console.error('❌ Error al activar licencia:', error);
    return false;
  }
}

// ========================================
// VERIFICACIÓN DE ESTADO DE LICENCIA
// ========================================

/**
 * Verificar estado de licencia del club actual
 */
// ── Escaparate de módulos: metadata (qué hace cada uno) + acciones ──────────
const MODULO_INFO = {
  portal_padres: {
    nombre: 'Portal de Padres', icon: 'users',
    desc: 'Cada papá o mamá tiene su propio acceso para acompañar a su hijo/a desde el celular. Puede mantener sus datos al día, cambiar la foto de perfil y subir la documentación que haga falta (para torneos, inscripciones y más). Menos trabajo para el club, y las familias más cerca de la escuela.'
  },
  asistencias: {
    nombre: 'Asistencias', icon: 'check-square',
    desc: 'Tomá la lista de asistencia a los entrenamientos, como cuando pasan lista en el colegio. Cada profe marca quién vino y quién faltó desde el celular, y vos ves el resumen por jugador y por categoría.'
  },
  inventario: {
    nombre: 'Inventario y Facturación', icon: 'boxes',
    desc: 'Llevá el control de los uniformes y materiales del club, con las ventas y la facturación en un solo lugar.'
  },
  convocatoria: {
    nombre: 'Convocatorias', icon: 'clipboard-list',
    desc: 'Armá la lista de jugadores citados a cada partido y avisales con un clic quiénes juegan.'
  }
};
// Nombre de la función global que abre cada módulo (solo se llama si está activo).
const MODULO_ACCION = {
  inventario: 'abrirInventario',
  portal_padres: 'showParentAccessAutomation',
  asistencias: 'abrirAsistencias',
  convocatoria: 'abrirConvocatoria'
};

// Modal "módulo bloqueado": explica qué hace + botón de WhatsApp para adquirirlo.
// Contenido 100% del sistema (MODULO_INFO hardcodeado). clubNombre solo se usa
// dentro de la URL de WhatsApp (encodeURIComponent) — nunca en el innerHTML.
function mostrarModuloBloqueado(key) {
  const info = MODULO_INFO[key];
  if (!info) return;
  if (document.getElementById('moduloBloqueadoModal')) return;

  const _s = (typeof getSchoolSettings === 'function') ? getSchoolSettings() : null;
  const clubNombre = _s ? (_s.name || _s.schoolName || '') : '';
  const waMsg = 'Hola, quiero activar el módulo ' + info.nombre + ' en MY CLUB.' + (clubNombre ? ' Mi club es ' + clubNombre + '.' : '');
  const waUrl = 'https://wa.me/' + MODULOS_WHATSAPP + '?text=' + encodeURIComponent(waMsg);

  const modal = document.createElement('div');
  modal.id = 'moduloBloqueadoModal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;padding:1rem;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px)';
  modal.innerHTML =
    '<div style="background:#1f2937;border-radius:1.25rem;padding:1.75rem;max-width:360px;width:100%;text-align:center;box-shadow:0 25px 50px rgba(0,0,0,0.5)">' +
      '<div style="width:64px;height:64px;border-radius:1rem;margin:0 auto 1rem;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#4f46e5,#7c3aed)">' +
        '<i data-lucide="' + info.icon + '" style="width:32px;height:32px;color:#fff"></i>' +
      '</div>' +
      '<p style="font-size:1.15rem;font-weight:800;color:#fff;margin-bottom:.4rem">' + info.nombre + '</p>' +
      '<div style="display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:700;color:#c7d2fe;background:rgba(79,70,229,0.25);padding:3px 10px;border-radius:999px;margin-bottom:.9rem">🔒 Módulo PRO</div>' +
      '<p style="font-size:.85rem;color:#d1d5db;line-height:1.55;margin-bottom:1.1rem">' + info.desc + '</p>' +
      '<div style="background:#111827;border-radius:.75rem;padding:.8rem;margin-bottom:1.1rem">' +
        '<p style="font-size:.8rem;color:#9ca3af">Este módulo no está incluido en tu plan. Activalo para empezar a usarlo.</p>' +
      '</div>' +
      '<a href="' + waUrl + '" target="_blank" rel="noopener" style="display:flex;align-items:center;justify-content:center;gap:.5rem;width:100%;padding:.8rem;border-radius:.75rem;background:linear-gradient(135deg,#25d366,#128c7e);color:#fff;font-weight:700;font-size:.9rem;text-decoration:none;margin-bottom:.6rem">' +
        '<i data-lucide="message-circle" style="width:18px;height:18px"></i> Contactar para activarlo' +
      '</a>' +
      '<button type="button" onclick="document.getElementById(\'moduloBloqueadoModal\').remove()" style="width:100%;padding:.7rem;border-radius:.75rem;background:#374151;color:#d1d5db;font-weight:600;font-size:.85rem;border:none;cursor:pointer">Ahora no</button>' +
    '</div>';
  document.body.appendChild(modal);
  modal.addEventListener('click', function (e) { if (e.target === modal) modal.remove(); });
  if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
}
if (typeof window !== 'undefined') { window.mostrarModuloBloqueado = mostrarModuloBloqueado; }

// Muestra TODOS los botones de módulos; activa los del club y bloquea el resto.
// Fail-closed: sin datos → todos bloqueados. Idempotente (se puede llamar varias veces).
function _applyModuloButtons(modulos) {
  Object.keys(MODULO_ACCION).forEach(function (key) {
    const btn = document.querySelector('[data-modulo="' + key + '"]');
    if (!btn) return;
    const activo = !!(modulos && modulos[key] === true);
    if (activo) {
      btn.classList.remove('modulo-bloqueado');
      btn.onclick = function () { const fn = window[MODULO_ACCION[key]]; if (typeof fn === 'function') fn(); };
    } else {
      btn.classList.add('modulo-bloqueado');
      btn.onclick = function () { mostrarModuloBloqueado(key); };
    }
  });
  if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
}

async function checkLicenseStatus() {
  const clubId = localStorage.getItem('clubId');

  if (!clubId) {
    return { status: 'sin_licencia', daysRemaining: 0, message: 'No hay club registrado' };
  }

  // ── Intento 1: Supabase ─────────────────────────────────────────────────────
  // No depende de Firebase init — responde más rápido y capta cambios del super-admin
  // Edge Function pre-JWT (licenses_anon_select fue borrada)
  try {
    const res = await fetch(
      `${_SUPA_URL}/functions/v1/get-club-public-info`,
      {
        method: 'POST',
        headers: { apikey: _SUPA_ANON, Authorization: `Bearer ${_SUPA_ANON}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ club_id: clubId, include_license: true })
      }
    );
    if (res.ok) {
      const data = await res.json();
      const lic = data?.license;
      if (lic) {
        if (lic.status === 'inactivo') {
          console.log('🔴 [Supabase] Licencia desactivada por administrador');
          localStorage.setItem('licenseStatus', 'inactivo');
          return { status: 'inactivo', daysRemaining: 0, endDate: new Date(lic.end_date), message: '🔴 Licencia desactivada - Contacta al administrador' };
        }
        const endDate = new Date(lic.end_date);
        // 🆕 Usa grace_period_days configurable por club (super_admin lo puede ajustar)
        const result = calculateLicenseState(endDate, lic.grace_period_days);
        _applyModuloButtons(lic.modulos);
        localStorage.setItem('licenseStatus', result.status);
        localStorage.setItem('licenseEndDate', lic.end_date);
        if (typeof lic.grace_period_days === 'number') {
          localStorage.setItem('licenseGraceDays', String(lic.grace_period_days));
        }
        if (lic.plan) localStorage.setItem('licensePlan', lic.plan);
        console.log('📋 [Supabase] Estado de licencia:', result);
        return result;
      }
    }
  } catch (_) { /* continúa a Firebase */ }

  // ── Fallback a caché local ──
  const cachedEndDate = localStorage.getItem('licenseEndDate');
  if (cachedEndDate) return calculateLicenseState(new Date(cachedEndDate));
  return { status: 'error', daysRemaining: 0, message: 'Sin conexión' };
}

/**
 * Calcular estado de licencia basado en fecha de vencimiento.
 * 🆕 gracePeriodDays: días de gracia configurables por club (default LICENSE_CONFIG.GRACE_PERIOD_DAYS=3).
 *    Lo trae la EF get-club-public-info desde licenses.grace_period_days.
 */
function calculateLicenseState(endDate, gracePeriodDays) {
  const grace = (typeof gracePeriodDays === 'number' && gracePeriodDays >= 0)
    ? gracePeriodDays
    : LICENSE_CONFIG.GRACE_PERIOD_DAYS;
  const now = new Date();
  const diffTime = endDate - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays > grace) {
    return {
      status: 'activo',
      daysRemaining: diffDays,
      endDate: endDate,
      message: `Licencia activa - ${diffDays} días restantes`
    };
  } else if (diffDays > 0) {
    return {
      status: 'por_vencer',
      daysRemaining: diffDays,
      endDate: endDate,
      message: `⚠️ Tu licencia vence en ${diffDays} día${diffDays > 1 ? 's' : ''}`
    };
  } else if (diffDays > -grace) {
    const graceDaysLeft = grace + diffDays;
    return {
      status: 'gracia',
      daysRemaining: graceDaysLeft,
      endDate: endDate,
      graceTotal: grace,
      message: `⚠️ Período de gracia - ${graceDaysLeft} día${graceDaysLeft > 1 ? 's' : ''} para renovar`
    };
  } else {
    return {
      status: 'inactivo',
      daysRemaining: 0,
      endDate: endDate,
      message: '🔴 Licencia vencida - Contacta al administrador'
    };
  }
}

// ========================================
// INTERFAZ DE USUARIO
// ========================================

function showLicenseBanner(status) {
  const existingBanner = document.getElementById('licenseBanner');
  if (existingBanner) {
    existingBanner.remove();
  }

  // No mostrar banner si está activo, o en estados transitorios/sin datos
  // (sin_licencia / error aparecen al arrancar o sin conexión — evitar banner gris molesto).
  if (status.status === 'activo' || status.status === 'sin_licencia' || status.status === 'error') {
    // Restaurar layout: header y contenido vuelven a su posición normal
    document.body.style.paddingTop = '';
    const _hdr = document.querySelector('header.fixed');
    if (_hdr) _hdr.style.top = '';
    const _main = document.querySelector('main');
    if (_main) _main.style.paddingTop = '';
    return;
  }

  const banner = document.createElement('div');
  banner.id = 'licenseBanner';

  // 🆕 Banner mejorado: animación pulsante en gracia, countdown grande,
  //    botón de acción claro (WhatsApp), y mensaje específico según severidad.
  const cfg = {
    por_vencer: {
      bg: 'bg-gradient-to-r from-yellow-400 to-amber-500',
      text: 'text-yellow-900',
      icon: '⚠️',
      title: 'Tu licencia vence pronto',
      subtitle: `Vence en ${status.daysRemaining} día${status.daysRemaining !== 1 ? 's' : ''}. Renová antes para no perder acceso.`,
      pulse: false
    },
    gracia: {
      bg: 'bg-gradient-to-r from-orange-500 to-red-500',
      text: 'text-white',
      icon: '⏰',
      title: '⚠️ Tu licencia venció — Período de gracia',
      subtitle: `Tu cuenta se BLOQUEARÁ en ${status.daysRemaining} día${status.daysRemaining !== 1 ? 's' : ''} si no renovás.`,
      pulse: true
    },
    inactivo: {
      bg: 'bg-gradient-to-r from-red-700 to-rose-700',
      text: 'text-white',
      icon: '🔴',
      title: 'Licencia vencida — Cuenta bloqueada',
      subtitle: 'Tu cuenta está en modo solo lectura. Contactá a MY CLUB para reactivar.',
      pulse: false
    }
  };
  const c = cfg[status.status] || { bg: 'bg-gray-500', text: 'text-white', icon: 'ℹ️', title: status.message, subtitle: '', pulse: false };

  // Mensaje de WhatsApp con nombre del club + estado para que MY CLUB lo identifique
  const _clubNombre = (getSchoolSettings && getSchoolSettings()?.name) || localStorage.getItem('clubId') || '';
  const _waMsg = status.status === 'inactivo'
    ? `Hola, mi licencia de MY CLUB venció y necesito reactivarla. Club: ${_clubNombre}`
    : `Hola, quiero renovar la licencia de MY CLUB antes de que venza. Club: ${_clubNombre}`;
  const whatsappBtn = `<a href="https://wa.me/${ADMIN_WHATSAPP}?text=${encodeURIComponent(_waMsg)}"
       target="_blank"
       class="shrink-0 inline-flex items-center gap-1 bg-white text-gray-900 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-gray-100 shadow-md">
       📲 Renovar ahora
     </a>`;

  banner.className = `${c.bg} ${c.text} fixed top-0 left-0 right-0 z-[60] shadow-lg ${c.pulse ? 'animate-pulse' : ''}`;
  banner.innerHTML = `
    <div class="px-4 py-3 max-w-7xl mx-auto flex items-center gap-3">
      <span class="text-2xl shrink-0">${c.icon}</span>
      <div class="flex-1 min-w-0">
        <p class="font-bold text-sm leading-tight">${c.title}</p>
        <p class="text-xs opacity-95 mt-0.5">${c.subtitle}</p>
      </div>
      ${whatsappBtn}
    </div>
  `;

  document.body.prepend(banner);
  // El banner empuja el header (también fixed top-0) y el contenido hacia abajo,
  // en vez de taparlos. Se recalcula al alto real del banner (variable).
  requestAnimationFrame(() => {
    const h = banner.offsetHeight;
    const header = document.querySelector('header.fixed');
    if (header) header.style.top = h + 'px';
    const main = document.querySelector('main');
    if (main) main.style.paddingTop = `calc(6rem + ${h}px)`; // 6rem = pt-24 original del main
  });
}

// ── MODO SOLO LECTURA (licencia inactiva) ─────────────────────────────────────
// Modal lindo (estilo del de "módulo bloqueado", inline → a prueba de purga de
// Tailwind). Aparece al entrar y REAPARECE cuando el usuario intenta una acción de
// escritura. El nombre del club solo va en la URL de WhatsApp (encodeURIComponent),
// nunca en el innerHTML → sin XSS.
function showLicenseLockModal() {
  if (document.getElementById('licenseLockModal')) return; // no apilar

  const _s = (typeof getSchoolSettings === 'function') ? getSchoolSettings() : null;
  const clubNombre = _s ? (_s.name || _s.schoolName || '') : (localStorage.getItem('clubId') || '');
  const waMsg = 'Hola, mi licencia de MY CLUB está inactiva y quiero ponerme al día para reactivarla.' + (clubNombre ? ' Mi club es ' + clubNombre + '.' : '');
  const waUrl = 'https://wa.me/' + ADMIN_WHATSAPP + '?text=' + encodeURIComponent(waMsg);

  const modal = document.createElement('div');
  modal.id = 'licenseLockModal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;padding:1rem;background:rgba(0,0,0,0.65);backdrop-filter:blur(4px);animation:mcFadeIn .18s ease-out';
  modal.innerHTML =
    '<div style="background:#1f2937;border-radius:1.25rem;padding:1.75rem;max-width:380px;width:100%;text-align:center;box-shadow:0 25px 50px rgba(0,0,0,0.55);animation:mcPop .2s ease-out">' +
      '<div style="width:66px;height:66px;border-radius:1rem;margin:0 auto 1rem;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#dc2626,#b91c1c)">' +
        '<i data-lucide="lock" style="width:32px;height:32px;color:#fff"></i>' +
      '</div>' +
      '<p style="font-size:1.2rem;font-weight:800;color:#fff;margin-bottom:.4rem">Licencia inactiva</p>' +
      '<div style="display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:700;color:#fecaca;background:rgba(220,38,38,0.22);padding:3px 11px;border-radius:999px;margin-bottom:.9rem">👁️ Modo solo lectura</div>' +
      '<p style="font-size:.9rem;color:#d1d5db;line-height:1.55;margin-bottom:1rem">Podés <b style="color:#fff">ver toda tu información</b>, pero no hacer cambios. Para reactivar tu licencia y ponerte al día, escribinos y te ayudamos.</p>' +
      '<a href="' + waUrl + '" target="_blank" rel="noopener" style="display:flex;align-items:center;justify-content:center;gap:.5rem;width:100%;padding:.85rem;border-radius:.75rem;background:linear-gradient(135deg,#25d366,#128c7e);color:#fff;font-weight:700;font-size:.92rem;text-decoration:none;margin-bottom:.6rem">' +
        '<i data-lucide="message-circle" style="width:18px;height:18px"></i> Hablar con soporte y ponerme al día' +
      '</a>' +
      '<button type="button" id="licenseLockClose" style="width:100%;padding:.7rem;border-radius:.75rem;background:#374151;color:#d1d5db;font-weight:600;font-size:.85rem;border:none;cursor:pointer">Seguir en modo lectura</button>' +
    '</div>';

  // Animaciones (se inyectan una sola vez)
  if (!document.getElementById('mcLockAnim')) {
    const st = document.createElement('style');
    st.id = 'mcLockAnim';
    st.textContent = '@keyframes mcFadeIn{from{opacity:0}to{opacity:1}}@keyframes mcPop{from{opacity:0;transform:scale(.94) translateY(8px)}to{opacity:1;transform:none}}';
    document.head.appendChild(st);
  }

  document.body.appendChild(modal);
  const close = () => modal.remove();
  modal.querySelector('#licenseLockClose').addEventListener('click', close);
  modal.addEventListener('click', function (e) { if (e.target === modal) close(); });
  if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
}
if (typeof window !== 'undefined') { window.showLicenseLockModal = showLicenseLockModal; }

// ¿El click/submit es un intento de ESCRITURA? (crear/guardar/editar/borrar/enviar…)
// Modo lectura (licencia vencida): DENEGAR POR DEFECTO.
// Solo se permite NAVEGAR y VER; todo lo demás — módulos, agregar, editar, borrar,
// enviar, importar, PDF, documentos, cobrar, etc. — queda bloqueado ("no funciona
// nada, solo lectura"). Solo corre en clubes con licencia inactiva → impacto acotado.
function _bloquearEnLectura(target) {
  const ctrl = target.closest('button, a, [role="button"], [onclick], input[type="submit"], input[type="button"]');
  if (!ctrl) return false; // clic en vacío/texto → no bloquea
  // Exentos: modal de licencia, banner, enlaces de contacto, y lo marcado a mano
  if (ctrl.closest('#licenseLockModal, #licenseBanner, #moduloBloqueadoModal')) return false;
  if (ctrl.classList.contains('license-exempt') || ctrl.closest('.license-exempt')) return false;
  const href = (ctrl.getAttribute && ctrl.getAttribute('href')) || '';
  if (/^(https?:\/\/wa\.me|tel:|mailto:)/i.test(href)) return false;
  // Botones de MÓDULOS (PRO): SIEMPRE bloqueados en modo lectura, sin importar su
  // texto (ej. "Ver Inventario y Facturación" tiene "Ver" pero es un módulo → bloquear).
  if (ctrl.closest('[data-modulo], .modulo-btn')) return true;
  // Navegación estructural (barra inferior / pestañas) → permitido para poder VER
  if (ctrl.closest('nav, [role="tablist"], .bottom-nav, #bottomNav, .nav-item')) return false;
  const txt = (
    (ctrl.getAttribute && (ctrl.getAttribute('onclick') || '')) + ' ' +
    (ctrl.getAttribute && (ctrl.getAttribute('aria-label') || '')) + ' ' +
    (ctrl.className || '') + ' ' + (ctrl.textContent || '')
  ).toLowerCase().slice(0, 500);
  // LISTA BLANCA: navegar / ver / sistema → permitido. TODO lo demás se bloquea.
  // (Nota: se quitó "whats" a propósito → los botones "Enviar por WhatsApp" quedan
  //  bloqueados; el WhatsApp de soporte del modal/banner ya está exento por su id.)
  const permitido = /(navigate|navego|navegar|\binicio\b|jugador|\bpagos\b|calendario|\bm[aá]s\b|home|dashboard|volver|atr[aá]s|cerrar|close|cancelar|×|\bver\b|detalle|detail|buscar|search|filtr|\btodos\b|activos|inactivos|categor|tema|theme|logout|salir|cerrar sesi|renovar|contactar|copiar|\bcopy\b|siguiente|anterior|expand|colaps|desplegar)/;
  if (permitido.test(txt)) return false;
  return true; // denegar por defecto
}

function applyReadOnlyMode() {
  if (window.__licenseReadOnly) { showLicenseLockModal(); return; } // idempotente
  console.log('🔒 Aplicando modo solo lectura...');
  window.__licenseReadOnly = true;

  // Interceptor global en fase de captura: cualquier intento de ESCRITURA muestra
  // el modal (funciona también con botones creados dinámicamente en modales).
  const guard = function (e) {
    if (!window.__licenseReadOnly) return;
    try {
      if (_bloquearEnLectura(e.target)) {
        e.preventDefault();
        e.stopPropagation();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        showLicenseLockModal();
      }
    } catch (_) { /* ante la duda, no bloquear la navegación */ }
  };
  document.addEventListener('click', guard, true);
  // Cualquier envío de formulario también queda bloqueado
  document.addEventListener('submit', function (e) {
    if (!window.__licenseReadOnly) return;
    try {
      if (e.target && e.target.closest && e.target.closest('.license-exempt, #licenseLockModal')) return;
      e.preventDefault();
      e.stopPropagation();
      showLicenseLockModal();
    } catch (_) { /* ante la duda, no romper */ }
  }, true);

  // Aviso inicial al entrar (se puede cerrar; reaparece al intentar una acción)
  showLicenseLockModal();
}

// ========================================
// INICIALIZACIÓN
// ========================================

async function initLicenseSystem() {
  console.log('🔐 Inicializando sistema de licencias...');
  
  const clubId = localStorage.getItem('clubId');
  
  if (!clubId) {
    console.log('ℹ️ No hay club registrado, omitiendo verificación de licencia');
    return;
  }

  await new Promise(resolve => setTimeout(resolve, 1000));

  const status = await checkLicenseStatus();
  console.log('📋 Estado de licencia:', status);

  showLicenseBanner(status);

  if (status.status === 'inactivo') {
    applyReadOnlyMode();
  }

  updatePlayerCount();
}

async function updatePlayerCount() {
  const clubId = localStorage.getItem('clubId');
  if (!clubId) return;

  try {
    // Contar desde la cache RAM/IndexedDB, NO desde localStorage: 'players' está
    // en la deny-list de la Fase 4, así que localStorage.getItem('players') devuelve
    // siempre [] → total_players quedaba clavado en 0 en la tabla licenses (F-25).
    const players = (typeof getPlayers === 'function')
      ? getPlayers()
      : JSON.parse(localStorage.getItem('players') || '[]');
    const totalPlayers = Array.isArray(players) ? players.length : 0;

    // Solo escribir si el número cambió — evita escrituras innecesarias
    const cachedCount = Number(localStorage.getItem('_cachedPlayerCount') ?? '-1');
    if (cachedCount === totalPlayers) {
      console.log('📊 Contador de jugadores sin cambios, omitiendo escritura');
      return;
    }
    localStorage.setItem('_cachedPlayerCount', String(totalPlayers));

    if (window.MODO_SUPABASE) {
      await fetch(
        `${_SUPA_URL}/rest/v1/licenses?club_id=eq.${encodeURIComponent(clubId)}`,
        {
          method: 'PATCH',
          headers: { apikey: _SUPA_ANON, Authorization: `Bearer ${_SUPA_ANON}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
          body: JSON.stringify({ total_players: totalPlayers })
        }
      );
    }

    console.log('📊 Contador de jugadores actualizado:', totalPlayers);
  } catch (error) {
    console.warn('⚠️ No se pudo actualizar contador de jugadores:', error);
  }
}

// ========================================
// 📡 LISTENER DE CAMBIOS EN TIEMPO REAL - ✅ CON MANEJO DE ERRORES
// ========================================

function listenToLicenseChanges() {
  const clubId = localStorage.getItem('clubId');
  
  if (!clubId) return;

  if (!window.MODO_SUPABASE) {
    // Máximo 5 intentos para no bloquear la app
    if (!window._licenseRetries) window._licenseRetries = 0;
    window._licenseRetries++;
    if (window._licenseRetries >= 5) {
      console.warn('⚠️ Firebase no disponible, omitiendo listener de licencia');
      window._licenseRetries = 0;
      return;
    }
    setTimeout(listenToLicenseChanges, 2000);
    return;
  }

  try {
    console.log('👂 Escuchando cambios en licencia:', clubId);

    // Cancelar polling anterior si existe (evita duplicados al reiniciar sesión)
    if (typeof window.licenseUnsubscribe === 'function') {
      window.licenseUnsubscribe();
      window.licenseUnsubscribe = null;
    }

    async function checkLicenseStatus() {
      try {
        // Supabase primero — super-admin escribe aquí al desactivar
        let newStatus = null;
        let newModulos = null;
        try {
          // Edge Function pre-JWT (licenses_anon_select fue borrada)
          const res = await fetch(
            `${window.SUPA_URL}/functions/v1/get-club-public-info`,
            {
              method: 'POST',
              headers: { apikey: window.SUPA_ANON, Authorization: `Bearer ${window.SUPA_ANON}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ club_id: clubId, include_license: true })
            }
          );
          if (res.ok) {
            const data = await res.json();
            if (data?.license) { newStatus = data.license.status; newModulos = data.license.modulos; }
          }
        } catch (_) {}

        if (!newStatus) return; // sin datos disponibles

        const currentStatus = localStorage.getItem('licenseStatus');
        // Normalizar ANTES de comparar y guardar con el MISMO valor. Antes se comparaba
        // JSON.stringify(newModulos) ("null" si venía null) contra lo guardado ("{}"),
        // que nunca coincidían => recarga infinita en clubs con modulos null. FIX.
        const _modulosStr = JSON.stringify(newModulos || {});
        const modulosChanged = _modulosStr !== localStorage.getItem('licenseModulos');
        localStorage.setItem('licenseModulos', _modulosStr);

        localStorage.setItem('licenseStatus', newStatus);

        if (newStatus !== 'activo') {
          // Siempre mostrar banner si está inactivo — cubre cambio Y primer arranque
          showLicenseBanner({ status: 'inactivo', message: '🔴 Licencia desactivada - Contacta al administrador' });

          if (!window._licenseReloadInProgress && (currentStatus !== newStatus)) {
            // Toast + reload solo si el estado cambió (evita loop en recargas)
            showToast(`🔴 Licencia desactivada. Contacta al administrador.`);
            window._licenseReloadInProgress = true;
            setTimeout(() => { window.location.reload(); }, 2000);
          }
        } else if (modulosChanged) {
          // Módulos cambiaron — recargar para aplicar permisos nuevos
          window.location.reload();
        } else if (currentStatus && currentStatus !== newStatus) {
          showToast(`✅ Licencia activada correctamente`);
        }
      } catch (error) {
        if (error.code === 'permission-denied') {
          console.warn('⚠️ Sin permisos para verificar licencia');
        } else {
          console.error('❌ Error verificando licencia:', error);
        }
      }
    }

    checkLicenseStatus(); // primera verificación inmediata al arrancar
    const intervalId = setInterval(checkLicenseStatus, 10 * 60 * 1000);
    window.licenseUnsubscribe = () => clearInterval(intervalId);

    console.log('✅ Polling de licencia activado (10 min)');
    
  } catch (error) {
    console.error('❌ Error al configurar listener:', error);
  }
}

window.addEventListener('load', () => {
  setTimeout(() => {
    listenToLicenseChanges();
  }, 3000);
});

// ========================================
// FUNCIONES GLOBALES
// ========================================
window.validateActivationCode = validateActivationCode;
window.activateLicense = activateLicense;
window.checkLicenseStatus = checkLicenseStatus;
window.initLicenseSystem = initLicenseSystem;
window.showLicenseBanner = showLicenseBanner;
window.applyReadOnlyMode = applyReadOnlyMode;
window.updatePlayerCount = updatePlayerCount;
window.listenToLicenseChanges = listenToLicenseChanges;


function abrirInventario() {
  const clubId = localStorage.getItem('clubId');
  window.open('https://inventario.appmyclub.com?clubId=' + clubId, '_blank');
}
window.abrirInventario = abrirInventario;

function abrirAsistencias() {
  const clubId = localStorage.getItem('clubId');
  window.open('https://asistencia.appmyclub.com/admin.html?clubId=' + clubId, '_blank');
}
window.abrirAsistencias = abrirAsistencias;

function abrirConvocatoria() {
  const clubId = localStorage.getItem('clubId');
  window.open('https://convocatoria.appmyclub.com?clubId=' + clubId, '_blank');
}
window.abrirConvocatoria = abrirConvocatoria;

// Estado inicial de los botones de módulos con lo cacheado (funciona sin red).
// checkLicenseStatus lo vuelve a aplicar cuando llega la licencia fresca.
(function _initModuloButtons() {
  function _run() {
    try { _applyModuloButtons(JSON.parse(localStorage.getItem('licenseModulos') || '{}')); }
    catch (e) { try { _applyModuloButtons({}); } catch (_) {} }
  }
  if (typeof document !== 'undefined' && document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _run);
  } else {
    _run();
  }
})();

console.log('✅ license-system.js cargado correctamente');