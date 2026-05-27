// supabase-auth.js — Helper para que la app use un JWT real de Supabase Auth
// (con `app_metadata.club_id`) en vez de la anon key en las llamadas a
// /rest/v1/ y /storage/v1/. Permite cerrar la RLS por club sin romper nada.
//
// Cómo se usa:
//   - Después del login, llamar window.SupaAuth.mintFirebase(idToken)
//     (admins), .mintCoach(code, clubId) o .mintParent(code, clubId).
//   - El interceptor global de fetch hace el resto: reemplaza el Bearer
//     anon por el del usuario en llamadas a Supabase.
//   - Se persiste en localStorage para sobrevivir recargas. Se refresca solo.
//
// FASE 1: aditivo, no rompe nada. Si no se ha llamado al mint, las
// llamadas siguen con anon (RLS anon `USING(true)` sigue activa).
// FASE 2: al eliminar las policies anon, solo las que usen este helper
// (con JWT) podrán leer/escribir → aislamiento real por club.

(function () {
  if (window.SupaAuth) return; // ya cargado

  const SUPA_URL = window.SUPA_URL;
  const ANON     = window.SUPA_ANON;
  if (!SUPA_URL || !ANON) {
    console.warn('[SupaAuth] window.SUPA_URL / SUPA_ANON no definidos — helper inactivo');
    return;
  }

  const STORAGE_KEY = 'supa_user_jwt';
  const REFRESH_MARGIN_S = 60; // refrescar si quedan menos de 60s

  const _origFetch = window.fetch.bind(window);

  // ── Estado ────────────────────────────────────────────────────────────────
  let _session = null;
  try { _session = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch (_) {}

  const _save = (s) => {
    _session = s;
    if (s) localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    else   localStorage.removeItem(STORAGE_KEY);
  };

  const _isExpiredSoon = (s) =>
    !s || !s.expires_at || (s.expires_at * 1000) <= Date.now() + REFRESH_MARGIN_S * 1000;

  // ── Mint vía Edge Function ────────────────────────────────────────────────
  async function _callMint(body) {
    const res = await _origFetch(`${SUPA_URL}/functions/v1/mint-club-jwt`, {
      method: 'POST',
      headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.access_token) {
      throw new Error(data?.error || `mint-club-jwt HTTP ${res.status}`);
    }
    _save({
      access_token:  data.access_token,
      refresh_token: data.refresh_token,
      expires_at:    data.expires_at,
      club_id:       data.club_id,
      player_id:     data.player_id || null,
    });
    console.log(`[SupaAuth] JWT emitido — club=${data.club_id}`);
    return _session;
  }

  // ── Refresh con refresh_token ────────────────────────────────────────────
  let _refreshPromise = null;
  async function _refresh() {
    if (!_session?.refresh_token) return null;
    if (_refreshPromise) return _refreshPromise;
    _refreshPromise = (async () => {
      try {
        const res = await _origFetch(`${SUPA_URL}/auth/v1/token?grant_type=refresh_token`, {
          method: 'POST',
          headers: { apikey: ANON, 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: _session.refresh_token }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.access_token) {
          console.warn('[SupaAuth] refresh falló:', data);
          _save(null);
          return null;
        }
        _save({
          access_token:  data.access_token,
          refresh_token: data.refresh_token || _session.refresh_token,
          expires_at:    data.expires_at,
          club_id:       _session.club_id,
          player_id:     _session.player_id,
        });
        return _session;
      } finally { _refreshPromise = null; }
    })();
    return _refreshPromise;
  }

  // ── Interceptor global de fetch ──────────────────────────────────────────
  const MINT_URL = `${SUPA_URL}/functions/v1/mint-club-jwt`;
  const AUTH_PREFIX = `${SUPA_URL}/auth/v1/`;

  function _shouldUseJwt(url) {
    if (typeof url !== 'string' || !url.startsWith(SUPA_URL)) return false;
    // No tocar las llamadas a mint ni a auth/v1 (las hace este helper con anon)
    if (url === MINT_URL || url.startsWith(MINT_URL + '?')) return false;
    if (url.startsWith(AUTH_PREFIX)) return false;
    return url.includes('/rest/v1/') || url.includes('/storage/v1/') || url.includes('/functions/v1/');
  }

  window.fetch = async function (input, init = {}) {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    if (_shouldUseJwt(url)) {
      if (_session && _isExpiredSoon(_session)) {
        try { await _refresh(); } catch (_) {}
      }
      if (_session?.access_token) {
        const headers = new Headers(init.headers || (typeof input !== 'string' ? input.headers : undefined) || {});
        headers.set('Authorization', `Bearer ${_session.access_token}`);
        if (!headers.has('apikey')) headers.set('apikey', ANON);
        init = { ...init, headers };
        if (typeof input !== 'string') input = new Request(input, init);
      }
    }
    return _origFetch(input, init);
  };

  // ── API pública ──────────────────────────────────────────────────────────
  window.SupaAuth = {
    mintFirebase: (firebaseIdToken) => _callMint({ type: 'firebase', firebase_id_token: firebaseIdToken }),
    mintCoach:    (code, clubId)     => _callMint({ type: 'coach',    code, club_id: clubId }),
    mintParent:   (code, clubId)     => _callMint({ type: 'parent',   code, club_id: clubId }),
    getToken:   () => _session?.access_token || null,
    getSession: () => _session,
    getClubId:  () => _session?.club_id || null,
    clear:      () => _save(null),
  };

  if (_session) {
    console.log(`[SupaAuth] sesión restaurada de localStorage — club=${_session.club_id}`);
  } else {
    console.log('[SupaAuth] sin sesión, llamadas siguen con anon');
  }
})();
