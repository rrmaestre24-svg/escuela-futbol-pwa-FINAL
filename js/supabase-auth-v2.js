// supabase-auth-v2.js — Helper de Supabase Auth NATIVO (sin Firebase ni mint).
// Reemplaza a supabase-auth.js para el login de ADMINS. Coach y parent siguen
// usando supabase-auth.js (mintCoach/mintParent) porque su autenticación es
// por código, no por email/password.
//
// API expuesta en window.SupaAuthV2:
//   - login(email, password)       → signInWithPassword contra /auth/v1/token
//   - logout()                     → limpia sesión + (opcional) revoca refresh_token
//   - getSession() / getToken() / getClubId()
//   - isLogged()
//
// Reutiliza el mismo interceptor de fetch que supabase-auth.js inyecta. PERO
// la sesión la persistimos con key 'supa_user_jwt_v2' para coexistir durante
// DUAL AUTH sin pisar el v1.
//
// Decisión de coexistencia (5/06 → 26/06):
//   - Si v2 tiene sesión activa → la usa.
//   - Si v2 NO tiene sesión y v1 sí → usa v1 (fallback Firebase legacy).
//   - El interceptor de fetch chequea ambos.
//
// NO TOCAR los endpoints de coach/parent: supabase-auth.js se mantiene cargado
// y sigue ofreciendo mintCoach / mintParent.

(function () {
  if (window.SupaAuthV2) return;

  window.MODO_SUPABASE = true;

  const SUPA_URL = window.SUPA_URL;
  const ANON     = window.SUPA_ANON;
  if (!SUPA_URL || !ANON) {
    console.warn('[SupaAuthV2] window.SUPA_URL / SUPA_ANON no definidos — helper inactivo');
    return;
  }

  const STORAGE_KEY = 'supa_user_jwt_v2';
  const REFRESH_MARGIN_S = 60;

  // Si v1 ya monkey-patcheó fetch, _origFetch del v1 referencia al original.
  // Acá tomamos el window.fetch ACTUAL — si v1 ya está cargado, eso ya tiene
  // el interceptor. Lo agregamos abajo solo si no estaba puesto el de v2.
  const _origFetch = window.fetch.bind(window);

  // ── Estado ────────────────────────────────────────────────────────────────
  let _session = null;
  try { _session = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch (_) {}

  const _save = (s) => {
    _session = s;
    if (s) localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    else   localStorage.removeItem(STORAGE_KEY);
  };

  // Relee la sesión de localStorage (útil cuando otra pestaña renovó el token).
  function _reReadSession() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.access_token) {
          _session = parsed;
          return _session;
        }
      }
    } catch (_) {}
    return null;
  }

  // Sincronizar sesión entre pestañas: si otra pestaña renovó el refresh_token,
  // adoptamos su sesión sin hacer un refresh propio (evita invalid_grant por
  // uso doble del refresh_token de un solo uso de Supabase).
  try {
    window.addEventListener('storage', function _syncSession(e) {
      if (e.key !== STORAGE_KEY) return;
      if (e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed && parsed.access_token) {
            _session = parsed;
            _startHeartbeat();
            console.log('[SupaAuthV2] ↩️ sesión adoptada de otra pestaña');
          }
        } catch (_) {}
      } else if (e.newValue === null) {
        // Otra pestaña hizo logout
        _session = null;
        _stopHeartbeat();
      }
    });
  } catch (_) {}

  const _isExpiredSoon = (s) =>
    !s || !s.expires_at || (s.expires_at * 1000) <= Date.now() + REFRESH_MARGIN_S * 1000;

  // ── Decodificar app_metadata.club_id del JWT (sin librerías) ─────────────
  function _decodeJwtClubId(token) {
    try {
      const payload = token.split('.')[1];
      const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
      const obj = JSON.parse(decodeURIComponent(escape(json)));
      return obj?.app_metadata?.club_id || null;
    } catch (_) { return null; }
  }

  // ── Login con email/password (signInWithPassword nativo) ─────────────────
  async function login(email, password, captchaToken) {
    if (!email || !password) throw new Error('email y password requeridos');
    const _body = { email: email.trim().toLowerCase(), password };
    // CAPTCHA (Turnstile): solo si hay token. Fail-open — sin token se manda igual
    // (Supabase lo ignora hasta que se active CAPTCHA en su panel de Auth).
    if (captchaToken) _body.gotrue_meta_security = { captcha_token: captchaToken };
    const res = await _origFetch(`${SUPA_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: ANON, 'Content-Type': 'application/json' },
      body: JSON.stringify(_body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.access_token) {
      const msg = data?.error_description || data?.msg || data?.error || `HTTP ${res.status}`;
      const err = new Error(msg);
      err.status = res.status;
      err.code = data?.error_code || null;
      throw err;
    }
    _save({
      access_token:  data.access_token,
      refresh_token: data.refresh_token,
      expires_at:    data.expires_at,
      club_id:       _decodeJwtClubId(data.access_token),
      user_id:       data.user?.id || null,
      email:         data.user?.email || email.trim().toLowerCase(),
    });
    _startHeartbeat();
    console.log(`[SupaAuthV2] login OK — club=${_session.club_id}`);
    return _session;
  }

  // ── Refresh con refresh_token (resiliente) ───────────────────────────────
  // Estrategia:
  //   1. Retry 2 veces ante 5xx / red caída / timeout con backoff (500ms, 1500ms).
  //   2. 400/401/403/invalid_grant → NO borra la sesión inmediatamente.
  //      Primero relee localStorage (otra pestaña pudo haber refrescado).
  //      Si tampoco hay sesión válida ahí, entonces borra.
  //   3. Cualquier otro error → devuelve null sin borrar la sesión actual.
  let _refreshPromise = null;
  async function _refresh() {
    if (!_session?.refresh_token) return null;
    if (_refreshPromise) return _refreshPromise;
    const _oldToken = _session.access_token;
    _refreshPromise = (async () => {
      try {
        const RETRIES = 2;
        const BACKOFFS = [500, 1500];
        const REFRESH_TIMEOUT_MS = 8000;
        for (let attempt = 0; attempt <= RETRIES; attempt++) {
          let res, data;
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), REFRESH_TIMEOUT_MS);
            try {
              res = await _origFetch(`${SUPA_URL}/auth/v1/token?grant_type=refresh_token`, {
                method: 'POST',
                headers: { apikey: ANON, 'Content-Type': 'application/json' },
                body: JSON.stringify({ refresh_token: _session.refresh_token }),
                signal: controller.signal,
              });
            } finally {
              clearTimeout(timeoutId);
            }
            data = await res.json().catch(() => ({}));
          } catch (fetchErr) {
            // Red caída / timeout — reintentar si quedan intentos
            if (attempt < RETRIES) {
              await new Promise(r => setTimeout(r, BACKOFFS[attempt]));
              continue;
            }
            console.warn('[SupaAuthV2] refresh: red caída tras reintentos');
            return null;
          }
          if (res.ok && data?.access_token) {
            _save({
              access_token:  data.access_token,
              refresh_token: data.refresh_token || _session.refresh_token,
              expires_at:    data.expires_at,
              club_id:       _decodeJwtClubId(data.access_token) || _session.club_id,
              user_id:       _session.user_id,
              email:         _session.email,
            });
            return _session;
          }
          // Error del servidor
          const status = res.status;
          const errCode = data?.error || data?.error_code || '';
          const isServerError = status >= 500 || status === 429;
          const isAuthError = status === 400 || status === 401 || status === 403
            || errCode === 'invalid_grant';
          if (isServerError && attempt < RETRIES) {
            await new Promise(r => setTimeout(r, BACKOFFS[attempt]));
            continue;
          }
          if (isAuthError) {
            // invalid_grant suele significar que otra pestaña ya usó el
            // refresh_token (es de un solo uso en Supabase). Releer localStorage
            // por si la otra pestaña ya guardó la sesión renovada.
            const recovered = _reReadSession();
            if (recovered && recovered.access_token !== _oldToken) {
              console.log('[SupaAuthV2] ↩️ refresh_token agotado — adoptada sesión de otra pestaña');
              return recovered;
            }
            console.warn('[SupaAuthV2] refresh: sesión inválida —', data);
            _save(null);
            return null;
          }
          // Otro error (ej. 422, 500 tras reintentos) — no borrar sesión
          console.warn('[SupaAuthV2] refresh: error no crítico —', status, data);
          return null;
        }
        return null;
      } finally { _refreshPromise = null; }
    })();
    return _refreshPromise;
  }

  // ── Heartbeat: refresco proactivo ────────────────────────────────────────
  // Sin esto, el token solo se refresca ante cada petición saliente (interceptor).
  // Si la app queda abierta e inactiva, nadie lo renueva y al volver está vencido.
  // El heartbeat corre cada 5 min y refresca si el token está por expirar.
  let _heartbeatId = null;
  function _startHeartbeat() {
    _stopHeartbeat();
    if (!_session) return;
    _heartbeatId = setInterval(async () => {
      if (!_session) { _stopHeartbeat(); return; }
      if (_isExpiredSoon(_session)) {
        try { await _refresh(); } catch (_) {}
      }
    }, 5 * 60 * 1000);
  }
  function _stopHeartbeat() {
    if (_heartbeatId) { clearInterval(_heartbeatId); _heartbeatId = null; }
  }

  async function logout() {
    _stopHeartbeat();
    if (_session?.access_token) {
      // Best-effort: revocar refresh_token. Si falla, igual limpiamos local.
      try {
        await _origFetch(`${SUPA_URL}/auth/v1/logout`, {
          method: 'POST',
          headers: { apikey: ANON, Authorization: `Bearer ${_session.access_token}` },
        });
      } catch (_) {}
    }
    _save(null);
  }

  // ── Interceptor de fetch (coexistencia con v1) ───────────────────────────
  // Si supabase-auth.js v1 ya monkey-patcheó window.fetch, su interceptor toma
  // el JWT de window.SupaAuth.getToken(). Para que v2 también funcione,
  // sobrescribimos window.fetch UNA VEZ con un interceptor unificado que:
  //   1. Si la URL es Supabase REST/Storage/Functions (excepto mint y auth/v1)
  //   2. Toma el JWT de v2 si existe; sino v1; sino anon.
  //
  // Para no duplicar interceptores, detectamos si supabase-auth.js ya está
  // cargado (window.SupaAuth) y sobrescribimos su interceptor con uno nuevo
  // que cubre ambos.

  const AUTH_PREFIX  = `${SUPA_URL}/auth/v1/`;
  const MINT_URL     = `${SUPA_URL}/functions/v1/mint-club-jwt`;
  const _curFetch = window.fetch.bind(window);

  function _shouldUseJwt(url) {
    if (typeof url !== 'string' || !url.startsWith(SUPA_URL)) return false;
    if (url === MINT_URL || url.startsWith(MINT_URL + '?')) return false;
    if (url.startsWith(AUTH_PREFIX)) return false;
    return url.includes('/rest/v1/') || url.includes('/storage/v1/') || url.includes('/functions/v1/');
  }

  window.fetch = async function (input, init = {}) {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    if (_shouldUseJwt(url)) {
      // 1) v2 (primario) — refrescar si está por expirar
      if (_session && _isExpiredSoon(_session)) {
        try { await _refresh(); } catch (_) {}
      }
      let token = _session?.access_token || null;
      let usingV2 = !!token;
      // 2) Fallback v1 — solo si v2 no tiene sesión
      if (!token && window.SupaAuth && typeof window.SupaAuth.getToken === 'function') {
        token = window.SupaAuth.getToken();
      }
      if (token) {
        const headers = new Headers(init.headers || (typeof input !== 'string' ? input.headers : undefined) || {});
        headers.set('Authorization', `Bearer ${token}`);
        if (!headers.has('apikey')) headers.set('apikey', ANON);
        init = { ...init, headers };
        if (typeof input !== 'string') input = new Request(input, init);
      }
      // 3) Auto-retry en 401: refresh v2 reactivo y reintentar UNA vez
      let res = await _curFetch(input, init);
      if (res.status === 401 && usingV2 && _session?.refresh_token) {
        try {
          const refreshed = await _refresh();
          if (refreshed?.access_token) {
            const headers2 = new Headers(init.headers || {});
            headers2.set('Authorization', `Bearer ${refreshed.access_token}`);
            if (!headers2.has('apikey')) headers2.set('apikey', ANON);
            const retryInit = { ...init, headers: headers2 };
            const retryInput = (typeof input !== 'string') ? new Request(typeof input === 'object' && input.url ? input.url : url, retryInit) : input;
            res = await _curFetch(retryInput, retryInit);
          }
        } catch (_) {}
      }
      return res;
    }
    return _curFetch(input, init);
  };

  // ── API pública ──────────────────────────────────────────────────────────
  window.SupaAuthV2 = {
    login,
    logout,
    getSession: () => _session,
    getToken:   () => _session?.access_token || null,
    getClubId:  () => _session?.club_id || null,
    getEmail:   () => _session?.email || null,
    getUserId:  () => _session?.user_id || null,
    isLogged:   () => !!_session?.access_token,
    clear:      () => _save(null),
    // refreshToken: expuesto para que session-check.js pueda intentar
    // refrescar la sesión antes de decidir si redirigir al login.
    refreshToken: () => _refresh(),
  };

  if (_session) {
    _startHeartbeat();
    console.log(`[SupaAuthV2] sesión restaurada — club=${_session.club_id}`);
  } else {
    console.log('[SupaAuthV2] sin sesión (esperando login)');
  }
})();
