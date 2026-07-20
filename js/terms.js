// ============================================================
// 📄 TÉRMINOS Y CONDICIONES / TRATAMIENTO DE DATOS — MY CLUB
//
// Muestra un modal BLOQUEANTE al admin del club la primera vez que entra
// (y cada vez que se publique una versión nueva del texto). Al aceptar,
// registra una fila en Supabase (tabla `terms_acceptances`) — esa fila es
// la PRUEBA del consentimiento (Ley 1581 / Habeas Data), por eso va a la
// base y no solo a localStorage.
//
// Aplica igual a clubes NUEVOS y EXISTENTES: el check es "¿este club ya
// aceptó ESTA versión?", no "¿es nuevo?".
//
// ⚠️ Al actualizar el texto legal: subir TERMS_VERSION acá, en terminos.html
//    y en legal/terminos-y-condiciones.md → a todos les vuelve a pedir aceptar.
// ============================================================

const TERMS_VERSION = '2026-07';
const TERMS_CACHE_KEY = 'termsAcceptedVersion'; // solo optimización; la verdad está en la BD

// ¿El club ya aceptó la versión actual? Si no → modal bloqueante.
// Ante CUALQUIER error (offline, fetch caído) NO bloquea: se reintenta en la
// próxima carga. Preferimos no dejar al club afuera de su app por un problema
// de red; el consentimiento se captura en el siguiente ingreso con conexión.
async function checkTermsAcceptance() {
  try {
    // Ya aceptada en este dispositivo → no consultar de nuevo
    if (localStorage.getItem(TERMS_CACHE_KEY) === TERMS_VERSION) return;

    const clubId = localStorage.getItem('clubId');
    if (!clubId || !window.SUPA_URL || !window.SUPA_ANON) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

    // Sin JWT válido, el interceptor manda anon y RLS devuelve [] (no error):
    // mostraríamos el modal a un club que YA aceptó, y el guardado fallaría.
    // Mejor no mostrar nada y reintentar cuando haya sesión.
    const _jwt = (window.SupaAuthV2 && typeof window.SupaAuthV2.getToken === 'function' && window.SupaAuthV2.getToken())
              || (window.SupaAuth && typeof window.SupaAuth.getToken === 'function' && window.SupaAuth.getToken());
    if (!_jwt) { console.warn('[terms] sin sesión Supabase — verificación pospuesta'); return; }

    const res = await fetch(
      window.SUPA_URL + '/rest/v1/terms_acceptances'
        + '?club_id=eq.' + encodeURIComponent(clubId)
        + '&terms_version=eq.' + encodeURIComponent(TERMS_VERSION)
        + '&select=id&limit=1',
      { headers: { apikey: window.SUPA_ANON, Authorization: 'Bearer ' + window.SUPA_ANON } }
    );
    if (!res.ok) { console.warn('[terms] no se pudo verificar (HTTP ' + res.status + ')'); return; }

    const rows = await res.json();
    if (Array.isArray(rows) && rows.length > 0) {
      try { localStorage.setItem(TERMS_CACHE_KEY, TERMS_VERSION); } catch (_) {}
      return; // ya aceptó
    }
    showTermsModal();
  } catch (e) {
    console.warn('[terms] verificación omitida:', e && e.message);
  }
}

// Modal bloqueante: no se puede cerrar ni con click afuera. Solo se sale aceptando.
// Todo el contenido es del sistema (hardcodeado) → sin superficie de XSS.
function showTermsModal() {
  if (document.getElementById('termsModal')) return;

  const modal = document.createElement('div');
  modal.id = 'termsModal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;'
    + 'justify-content:center;padding:1rem;background:rgba(0,0,0,0.75);backdrop-filter:blur(5px)';
  modal.innerHTML =
    '<div style="background:#1f2937;border-radius:1.25rem;padding:1.75rem;max-width:420px;width:100%;box-shadow:0 25px 50px rgba(0,0,0,0.6);max-height:92vh;overflow-y:auto">' +
      '<div style="text-align:center;margin-bottom:1rem">' +
        '<img src="assets/icons/icon-192x192.png" alt="MY CLUB" style="width:56px;height:56px;border-radius:14px;display:block;margin:0 auto .75rem" onerror="this.style.display=\'none\'">' +
        '<p style="font-size:1.1rem;font-weight:800;color:#fff;line-height:1.35">Términos y Tratamiento de Datos</p>' +
        '<span style="display:inline-block;margin-top:.4rem;font-size:11px;font-weight:700;color:#5eead4;background:rgba(13,148,136,0.15);border:1px solid rgba(13,148,136,0.35);padding:2px 10px;border-radius:999px">Versión ' + TERMS_VERSION + '</span>' +
      '</div>' +

      '<p style="font-size:.85rem;color:#d1d5db;line-height:1.6;margin-bottom:.9rem">' +
        'Para usar MY CLUB necesitamos que aceptes los <strong>Términos de Uso</strong> y la ' +
        '<strong>Política de Tratamiento de Datos</strong> (Ley 1581 / Habeas Data).' +
      '</p>' +

      '<div style="background:#111827;border-radius:.75rem;padding:.9rem;margin-bottom:1rem">' +
        '<p style="font-size:.78rem;color:#9ca3af;line-height:1.65;margin:0">' +
          'En resumen: tu club es el <strong style="color:#e5e7eb">responsable</strong> de los datos que carga ' +
          '(jugadores, acudientes) y MY CLUB es el <strong style="color:#e5e7eb">encargado</strong> de procesarlos. ' +
          'Al aceptar confirmás que contás con la <strong style="color:#e5e7eb">autorización de los padres o acudientes</strong> ' +
          'para tratar los datos de los menores.' +
        '</p>' +
      '</div>' +

      '<a href="terminos.html" target="_blank" rel="noopener" style="display:flex;align-items:center;justify-content:center;gap:.4rem;width:100%;padding:.7rem;border-radius:.7rem;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);color:#5eead4;font-weight:600;font-size:.85rem;text-decoration:none;margin-bottom:1rem">' +
        '📄 Leer los Términos completos' +
      '</a>' +

      '<label for="termsCheck" style="display:flex;align-items:flex-start;gap:.6rem;cursor:pointer;margin-bottom:1.1rem">' +
        '<input type="checkbox" id="termsCheck" style="margin-top:3px;width:18px;height:18px;flex-shrink:0;cursor:pointer;accent-color:#0d9488">' +
        '<span style="font-size:.82rem;color:#d1d5db;line-height:1.5">He leído y <strong style="color:#fff">acepto</strong> los Términos de Uso y la Política de Tratamiento de Datos.</span>' +
      '</label>' +

      '<button type="button" id="termsAcceptBtn" disabled style="width:100%;padding:.85rem;border-radius:.75rem;background:#0d9488;color:#fff;font-weight:700;font-size:.92rem;border:none;cursor:not-allowed;opacity:.45;transition:opacity .2s">' +
        'Acepto y continúo' +
      '</button>' +
      // No hay "más tarde": para usar la app hay que aceptar. Pero damos una
      // salida digna (cerrar sesión) en vez de dejar al usuario atrapado.
      '<button type="button" id="termsLogoutBtn" style="width:100%;padding:.6rem;margin-top:.5rem;border-radius:.75rem;background:transparent;color:#9ca3af;font-weight:600;font-size:.8rem;border:none;cursor:pointer;text-decoration:underline">' +
        'No acepto — cerrar sesión' +
      '</button>' +
      '<p style="font-size:.7rem;color:#6b7280;text-align:center;margin-top:.7rem">Queda registrado quién aceptó y cuándo.</p>' +
    '</div>';

  document.body.appendChild(modal);

  const check = document.getElementById('termsCheck');
  const btn = document.getElementById('termsAcceptBtn');
  if (check && btn) {
    check.addEventListener('change', function () {
      btn.disabled = !check.checked;
      btn.style.cursor = check.checked ? 'pointer' : 'not-allowed';
      btn.style.opacity = check.checked ? '1' : '.45';
    });
    btn.addEventListener('click', acceptTerms);
  }

  // Salida sin aceptar: cerrar sesión (no puede usar la app sin aceptar).
  // OJO: logout() abre un diálogo de confirmación con z-index MENOR al de este
  // modal, así que quedaría invisible detrás. Ocultamos el modal antes de
  // llamarlo y lo restauramos si el usuario cancela la salida.
  const out = document.getElementById('termsLogoutBtn');
  if (out) {
    out.addEventListener('click', async function () {
      const m = document.getElementById('termsModal');
      if (m) m.style.display = 'none';
      try {
        if (typeof logout === 'function') {
          await logout();
        } else {
          window.location.href = 'login.html';
          return;
        }
      } catch (e) { console.warn('[terms] logout:', e); }
      // Si canceló el confirm, sigue en la app → volver a mostrar el modal.
      // Si confirmó, logout() ya borró clubId y está por navegar: no lo
      // re-mostramos (evita un parpadeo antes de ir al login).
      if (m && document.body.contains(m) && localStorage.getItem('clubId')) {
        m.style.display = '';
      }
    });
  }
}

// Registra la aceptación en Supabase (INSERT en terms_acceptances).
async function acceptTerms() {
  const btn = document.getElementById('termsAcceptBtn');
  const check = document.getElementById('termsCheck');
  if (!check || !check.checked) return; // doble candado: sin tilde, no se guarda

  if (btn) { btn.disabled = true; btn.textContent = '⏳ Guardando...'; btn.style.opacity = '.6'; }

  const clubId = localStorage.getItem('clubId');
  const user = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;
  const payload = {
    club_id: clubId,
    terms_version: TERMS_VERSION,
    accepted_by: (user && (user.email || user.name)) || null,
    user_agent: (typeof navigator !== 'undefined' && navigator.userAgent)
      ? String(navigator.userAgent).slice(0, 300) : null
  };

  try {
    if (!clubId) throw new Error('No hay club en sesión');
    const res = await fetch(window.SUPA_URL + '/rest/v1/terms_acceptances', {
      method: 'POST',
      headers: {
        apikey: window.SUPA_ANON,
        Authorization: 'Bearer ' + window.SUPA_ANON,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + (await res.text().catch(() => '')));

    try { localStorage.setItem(TERMS_CACHE_KEY, TERMS_VERSION); } catch (_) {}
    const m = document.getElementById('termsModal');
    if (m) m.remove();
    if (typeof showToast === 'function') showToast('✅ ¡Gracias! Términos aceptados');
  } catch (e) {
    console.error('[terms] error al registrar la aceptación:', e);
    if (typeof showToast === 'function') {
      showToast('❌ No se pudo guardar. Revisá tu conexión e intentá de nuevo.');
    }
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Acepto y continúo';
      btn.style.opacity = '1';
      btn.style.cursor = 'pointer';
    }
  }
}

window.checkTermsAcceptance = checkTermsAcceptance;
window.showTermsModal = showTermsModal;

console.log('📄 Módulo de Términos cargado (v' + TERMS_VERSION + ')');
