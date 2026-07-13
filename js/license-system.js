console.log('🔐 Cargando sistema de licencias...');

// ========================================
// 📞 CONFIGURACIÓN DE CONTACTO
// ========================================
if (typeof ADMIN_WHATSAPP === 'undefined') {
  var ADMIN_WHATSAPP = '573005452038';
}

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
// Helper: activa botones de módulos en el DOM según el objeto modulos
function _applyModuloButtons(modulos) {
  if (modulos?.inventario === true)   document.getElementById('btnInventarioWrapper')?.classList.remove('hidden');
  if (modulos?.portal_padres === true) document.getElementById('btnPortalPadresWrapper')?.classList.remove('hidden');
  if (modulos?.asistencias === true)  document.getElementById('btnAsistenciasWrapper')?.classList.remove('hidden');
  if (modulos?.convocatoria === true) document.getElementById('btnConvocatoriaWrapper')?.classList.remove('hidden');
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

function applyReadOnlyMode() {
  console.log('🔒 Aplicando modo solo lectura...');
  
  const actionButtons = document.querySelectorAll('button[onclick*="show"], button[onclick*="add"], button[onclick*="save"], button[onclick*="delete"]');
  
  actionButtons.forEach(btn => {
    if (!btn.classList.contains('license-exempt')) {
      btn.disabled = true;
      btn.classList.add('opacity-50', 'cursor-not-allowed');
      btn.onclick = function(e) {
        e.preventDefault();
        showToast('🔒 Licencia vencida - Modo solo lectura');
        return false;
      };
    }
  });

  const inputs = document.querySelectorAll('input:not([type="search"]), textarea, select');
  inputs.forEach(input => {
    if (!input.classList.contains('license-exempt')) {
      input.disabled = true;
      input.classList.add('bg-gray-100', 'dark:bg-gray-700', 'cursor-not-allowed');
    }
  });

  const modals = document.querySelectorAll('[id*="Modal"]');
  modals.forEach(modal => {
    const overlay = document.createElement('div');
    overlay.className = 'absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    overlay.innerHTML = `
      <div class="bg-white dark:bg-gray-800 rounded-lg p-6 text-center max-w-sm">
        <div class="text-4xl mb-3">🔒</div>
        <h3 class="font-bold text-lg mb-2">Licencia Vencida</h3>
        <p class="text-gray-600 dark:text-gray-400 text-sm mb-4">
          Contacta al administrador para renovar tu suscripción.
        </p>
        <a href="https://wa.me/${ADMIN_WHATSAPP}?text=Hola,%20necesito%20renovar%20mi%20licencia%20de%20MY%20CLUB" 
           target="_blank"
           class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm inline-block">
          📱 Contactar por WhatsApp
        </a>
      </div>
    `;
    modal.style.position = 'relative';
    modal.appendChild(overlay);
  });

  showToast('🔒 Modo solo lectura activado');
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
    const players = JSON.parse(localStorage.getItem('players') || '[]');
    const totalPlayers = players.length;

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

console.log('✅ license-system.js cargado correctamente');