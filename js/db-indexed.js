// ========================================
// IndexedDB wrapper — piloto FASE 0+1 (solo pagos)
// ========================================
// Wrapper Promise sobre IndexedDB para listas pesadas.
// Objetivo del piloto: que cada pago que se guarde en localStorage
// también se guarde en IndexedDB en paralelo, sin tocar lecturas
// ni el comportamiento de la UI. Permite validar el patrón antes
// de extenderlo al resto de las listas.

(function () {
  const DB_NAME = 'myclub_db';
  const DB_VERSION = 4; // 🆕 v4: agrega store 'coaches' (onupgradeneeded lo crea solo)
  let _dbPromise = null;

  // Stores cubiertas por el espejo IDB.
  // Cada localStorageKey indica qué clave de localStorage refleja esta store
  // (lo usa la migración inicial y los logs de paridad).
  const STORES = [
    { name: 'payments',           localStorageKey: 'payments' },
    { name: 'players',            localStorageKey: 'players' },
    { name: 'expenses',           localStorageKey: 'expenses' },
    { name: 'events',             localStorageKey: 'calendarEvents' },
    { name: 'thirdPartyIncomes',  localStorageKey: 'thirdPartyIncomes' },
    { name: 'coaches',            localStorageKey: 'coaches' }, // 🆕 v4
  ];

  // Stores auxiliares — NO entran en STORES porque no se espejan ni se hidratan al cache.
  // Solo se crean si faltan en onupgradeneeded.
  const AUX_STORES = [
    // Cola de escrituras a Supabase que fallaron por red.
    // Cada item: { id, table, operation, payload, clubId, attempts, lastAttempt, createdAt }
    { name: 'pendingSyncQueue', keyPath: 'id', indexes: [{ name: 'createdAt', keyPath: 'createdAt' }] },
  ];

  // 🚀 FASE 3 — Cache RAM hidratada desde IDB al boot.
  // Los getters de storage.js leen de acá primero, con fallback a localStorage
  // si la cache aún no está lista o si la lectura falla.
  // Las escrituras (put/delete/clear/syncStore) mantienen este objeto sincronizado.
  window._cache = window._cache || {
    payments: null,
    players: null,
    expenses: null,
    events: null,
    thirdPartyIncomes: null,
    coaches: null, // 🆕 v4
    hydrated: false,
  };

  // 🧹 FASE 4 — Deny list: estas 5 keys ya viven solo en IndexedDB + cache RAM.
  // Bloqueamos sus escrituras a localStorage para liberar los 5 MB y evitar
  // datos duplicados que pueden quedar stale. Los reads aún funcionan como
  // fallback en getters (devolverán [] si LS está limpio).
  const _LS_DENY_KEYS = new Set([
    'payments', 'players', 'expenses', 'calendarEvents', 'thirdPartyIncomes'
  ]);
  // Monkey-patch setItem: no-op silencioso para las 5 keys pesadas.
  // Se aplica AL CARGAR este script (antes que cualquier otro módulo escriba).
  //
  // Se parchea Storage.prototype y NO la instancia localStorage: en WebKit
  // (Safari / todo iPhone) `Object.defineProperty(localStorage, 'setItem', …)`
  // no reemplaza el método — el objeto Storage desvía esa definición a su
  // almacén y la guarda como un dato más, dejando una clave "setItem" con el
  // código de la función y el candado SIN efecto. Sobre el prototipo se
  // comporta igual en Blink y en WebKit.
  try {
    if (!Storage.prototype._mcDenyPatch) {
      const _ls = localStorage;                       // referencia fija: evita el getter en cada escritura
      const _originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        // Solo localStorage; sessionStorage queda intacto.
        if (this === _ls && _LS_DENY_KEYS.has(key)) return; // ignora silenciosamente
        return _originalSetItem.call(this, key, value);
      };
      // No enumerable: la marca no aparece al recorrer propiedades del storage.
      Object.defineProperty(Storage.prototype, '_mcDenyPatch', { value: true, configurable: true });
    }
  } catch (e) {
    console.warn('[idb] No se pudo patchear localStorage.setItem:', e);
  }

  function open() {
    if (_dbPromise) return _dbPromise;
    _dbPromise = new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        reject(new Error('IndexedDB no disponible en este navegador'));
        return;
      }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        // Crear stores faltantes (cubre v1->v2->v3 y fresh installs)
        STORES.forEach(s => {
          if (!db.objectStoreNames.contains(s.name)) {
            const store = db.createObjectStore(s.name, { keyPath: 'id' });
            store.createIndex('club_id', 'club_id', { unique: false });
            if (s.name === 'payments') {
              store.createIndex('playerId', 'playerId', { unique: false });
            }
          }
        });
        // Stores auxiliares (v3+): cola de reintentos, etc.
        AUX_STORES.forEach(s => {
          if (!db.objectStoreNames.contains(s.name)) {
            const store = db.createObjectStore(s.name, { keyPath: s.keyPath });
            (s.indexes || []).forEach(ix => {
              store.createIndex(ix.name, ix.keyPath, { unique: !!ix.unique });
            });
          }
        });
      };
      req.onsuccess = (e) => resolve(e.target.result);
      req.onerror = (e) => reject(e.target.error);
      req.onblocked = () => reject(new Error('IndexedDB bloqueada por otra pestaña con versión vieja'));
    });
    return _dbPromise;
  }

  async function getAll(storeName) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  // Helper: actualiza window._cache después de un cambio en IDB
  // (upsert por id si obj se pasa, delete por id si id se pasa)
  function _cacheUpsert(storeName, obj) {
    if (!window._cache || !obj || !obj.id) return;
    const arr = window._cache[storeName];
    if (!Array.isArray(arr)) return; // cache aún no hidratada para este store
    const idx = arr.findIndex(i => i && i.id === obj.id);
    if (idx >= 0) arr[idx] = obj;
    else arr.push(obj);
  }
  function _cacheDelete(storeName, id) {
    if (!window._cache || !id) return;
    const arr = window._cache[storeName];
    if (!Array.isArray(arr)) return;
    const idx = arr.findIndex(i => i && i.id === id);
    if (idx >= 0) arr.splice(idx, 1);
  }
  function _cacheReplace(storeName, items) {
    if (!window._cache) return;
    window._cache[storeName] = Array.isArray(items) ? items : [];
  }

  async function put(storeName, obj) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const req = tx.objectStore(storeName).put(obj);
      req.onsuccess = () => {
        _cacheUpsert(storeName, obj);
        resolve(true);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async function del(storeName, id) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const req = tx.objectStore(storeName).delete(id);
      req.onsuccess = () => {
        _cacheDelete(storeName, id);
        resolve(true);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async function count(storeName) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  // Busca en una store el primer registro que traiga campo de club, recorriendo con
  // cursor (sin cargar la store entera a memoria) hasta un tope de registros.
  //
  // Por qué recorre y no mira solo el primero: los registros creados SIN CONEXIÓN
  // todavía no tienen campo de club — se inyecta recién al sincronizar contra
  // Supabase. Si el primero por orden de clave resulta ser uno de esos, juzgar por
  // él daría "no verificable" y dispararía un borrado innecesario de datos legítimos.
  //
  // Devuelve { encontrado, club }. `encontrado: false` significa que la store no
  // aporta evidencia sobre a qué club pertenece (vacía, o todo sin sincronizar).
  const CLUB_SCAN_LIMIT = 50;
  async function findClubIdInStore(storeName, limite = CLUB_SCAN_LIMIT) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).openCursor();
      let vistos = 0;
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (!cursor) return resolve({ encontrado: false, club: null });
        const v = cursor.value || {};
        const club = v.schoolId || v.clubId || v.club_id;
        if (club) return resolve({ encontrado: true, club: String(club).trim() });
        if (++vistos >= limite) return resolve({ encontrado: false, club: null });
        cursor.continue();
      };
      req.onerror = () => reject(req.error);
    });
  }

  async function clear(storeName) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const req = tx.objectStore(storeName).clear();
      req.onsuccess = () => {
        _cacheReplace(storeName, []);
        resolve(true);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async function bulkPut(storeName, items) {
    if (!items || !items.length) return 0;
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const s = tx.objectStore(storeName);
      let n = 0;
      items.forEach(item => {
        const req = s.put(item);
        req.onsuccess = () => { n++; };
      });
      tx.oncomplete = () => resolve(n);
      tx.onerror = () => reject(tx.error);
    });
  }

  async function requestPersistence() {
    if (!navigator.storage || !navigator.storage.persist) {
      console.log('[idb] navigator.storage no disponible en este navegador');
      return null;
    }
    try {
      const already = await navigator.storage.persisted();
      if (already) {
        console.log('[idb] ✅ Persistencia ya estaba concedida');
        return true;
      }
      const granted = await navigator.storage.persist();
      console.log(granted
        ? '[idb] ✅ Persistencia concedida — el navegador no borrará los datos automáticamente'
        : '[idb] ⚠️ Persistencia NO concedida — los datos podrían ser evictados si el disco se llena. Instalá la PWA para mejorarlo.');
      return granted;
    } catch (err) {
      console.warn('[idb] Error pidiendo persistencia:', err);
      return null;
    }
  }

  async function getStorageEstimate() {
    if (!navigator.storage || !navigator.storage.estimate) return null;
    try {
      return await navigator.storage.estimate();
    } catch (err) {
      console.warn('[idb] Error obteniendo estimate:', err);
      return null;
    }
  }

  // Migración one-shot por store: copia localStorage[key] → IndexedDB si IDB está vacía.
  // Marca un flag por store para que no se repita.
  async function migrateStoreFromLocalStorage(storeName, localStorageKey) {
    const flag = `idb_migrated_${storeName}`;
    if (localStorage.getItem(flag) === 'true') {
      return { skipped: true, reason: 'already migrated' };
    }
    try {
      const existing = await count(storeName);
      if (existing > 0) {
        localStorage.setItem(flag, 'true');
        return { skipped: true, reason: 'IDB already has data', count: existing };
      }
      const items = JSON.parse(localStorage.getItem(localStorageKey) || '[]');
      if (!items.length) {
        localStorage.setItem(flag, 'true');
        return { skipped: true, reason: 'localStorage vacío' };
      }
      const migrated = await bulkPut(storeName, items);
      localStorage.setItem(flag, 'true');
      console.log(`[idb] ✅ Migrados ${migrated} items de localStorage[${localStorageKey}] → IndexedDB[${storeName}]`);
      return { migrated };
    } catch (err) {
      console.error(`[idb] ❌ Error migrando ${storeName}:`, err);
      return { error: err.message };
    }
  }

  // Migración de todas las stores configuradas (corre en boot)
  async function migrateAllFromLocalStorage() {
    const results = {};
    for (const s of STORES) {
      results[s.name] = await migrateStoreFromLocalStorage(s.name, s.localStorageKey);
    }
    return results;
  }

  // 🧹 FASE 4 — Libera de localStorage las 5 listas pesadas para recuperar la cuota
  // de ~5 MB. Corre DENTRO de boot(), después de la migración inicial y de hidratar
  // la cache: nunca borra una lista sin confirmar que IndexedDB ya la tiene, así que
  // no hay ventana de pérdida en un dispositivo con IDB vacía y sin internet.
  // Si alguna queda pendiente no marca la bandera y lo reintenta en el próximo boot.
  //
  // v2 — se repite aunque el dispositivo ya hubiera corrido la v1: en Safari el
  // candado nunca surtió efecto (ver el parche de setItem arriba), así que las 5
  // listas se siguieron escribiendo y volvieron a llenar la cuota.
  async function liberarLocalStoragePesado() {
    if (localStorage.getItem('idb_fase4_cleanup_v2') === 'true') return;
    let liberadas = 0;
    let pendientes = 0;
    for (const s of STORES) {
      if (!_LS_DENY_KEYS.has(s.localStorageKey)) continue; // 'coaches' sigue viviendo en localStorage
      const crudo = localStorage.getItem(s.localStorageKey);
      if (crudo === null) continue;
      let enLocal = 0;
      try {
        const parsed = JSON.parse(crudo);
        enLocal = Array.isArray(parsed) ? parsed.length : 0;
      } catch (e) {
        enLocal = 0; // ilegible: no hay nada que preservar
      }
      if (enLocal === 0) { localStorage.removeItem(s.localStorageKey); liberadas++; continue; }
      // Hay datos reales en localStorage: borrar SOLO si IndexedDB los tiene TODOS.
      // No alcanza con que IndexedDB tenga "algo": una migración vieja pudo saltearse
      // el respaldo completo, y ahí localStorage es el único que conserva el resto.
      // El -1 del catch nunca cumple la comparación → si count() falla, no se borra.
      const enIdb = await count(s.name).catch(() => -1);
      if (enIdb >= enLocal) { localStorage.removeItem(s.localStorageKey); liberadas++; }
      else { pendientes++; }
    }
    localStorage.removeItem('setItem');              // basura que dejó el parche viejo en WebKit
    localStorage.removeItem('idb_fase4_cleanup_v1'); // bandera vieja, ya no se consulta
    if (pendientes === 0) {
      localStorage.setItem('idb_fase4_cleanup_v2', 'true');
      if (liberadas) console.log(`[idb] 🧹 Fase 4: localStorage liberado (${liberadas} listas).`);
    } else {
      console.warn(`[idb] 🧹 Fase 4: ${pendientes} lista(s) siguen solo en localStorage; se reintenta en el próximo arranque.`);
    }
  }

  // Alias retrocompat: solo pagos
  async function migratePaymentsFromLocalStorage() {
    return migrateStoreFromLocalStorage('payments', 'payments');
  }

  // Garantiza aislamiento de datos por club. Si el clubId cambió desde la
  // última vez que IDB se pobló, limpia TODAS las stores y devuelve
  // { cleared: true } para que el caller fuerce una re-descarga. Si es el
  // mismo club, no toca nada.
  //
  // 🛡️ REGLA DE SEGURIDAD: nunca borrar sin poder reponer.
  //   - clubChanged (lastClubId existe y es distinto): borra y re-descarga.
  //   - firstLogin (no existía idb_current_club): NO borra aunque localStorage
  //     se haya perdido — si IDB tiene datos, los recupera poniendo el flag.
  //     El borrado selectivo solo se hace ante cambio real de club (navegador
  //     compartido entre dos clubes). Esto evita que una pérdida de localStorage
  //     (borrado, iOS storage pressure) deje al usuario sin datos locales.
  //   - mismo club: no toca nada.
  // El flag `idb_current_club` vive en localStorage por su persistencia simple.
  function _diagWipe(reason, clubId, extra) {
    try {
      localStorage.setItem('_diag_ultimo_wipe', JSON.stringify({
        ts: Date.now(),
        iso: new Date().toISOString(),
        reason,
        clubId,
        extra: extra || null
      }));
    } catch (_) {}
  }
  async function ensureClubIsolation(clubId) {
    if (!clubId) return { cleared: false, reason: 'sin clubId' };
    const lastClubId = localStorage.getItem('idb_current_club');
    const clubChanged = lastClubId && lastClubId !== clubId;
    const firstLogin = !lastClubId;
    if (!clubChanged && !firstLogin) {
      return { cleared: false, reason: 'mismo club', clubId };
    }
    if (firstLogin) {
      // No sabemos de qué club son los datos actuales. Intentar verificar.
      // Estrategia: recorrer TODAS las stores no vacías y exigir que TODAS las que
      // aporten evidencia coincidan con el clubId entrante. Los campos varían:
      // players→schoolId, coaches→club_id, resto→clubId.
      //
      // Una store puede no aportar evidencia (todos sus registros creados sin
      // conexión, todavía sin campo de club): esa NO se usa para decidir, pero
      // tampoco alcanza para recuperar. Hace falta al menos UNA store que confirme
      // el club. Si hay datos y ninguna lo confirma → fail-safe: limpiar
      // (aislamiento > caché; los cambios sin sincronizar viven en pendingSyncQueue,
      // que no está en STORES y por lo tanto sobrevive al borrado).
      let _foundData = false;   // hay datos en IndexedDB
      let _verificado = false;  // al menos una store confirmó que son de este club
      let _allMatch = true;     // ninguna store contradijo
      try {
        for (const s of STORES) {
          const cnt = await count(s.name);
          if (cnt === 0) continue;
          _foundData = true;
          const r = await findClubIdInStore(s.name);
          if (!r.encontrado) continue; // sin evidencia — no decide ni a favor ni en contra
          if (r.club !== String(clubId).trim()) { _allMatch = false; break; }
          _verificado = true;
        }
      } catch (_) { _foundData = true; _allMatch = false; } // error → fail-safe

      if (_foundData && _allMatch && _verificado) {
        localStorage.setItem('idb_current_club', clubId);
        _diagWipe('firstLogin_recovery', clubId, { lastClubId });
        console.log(`[idb] ↩️ firstLogin con datos verificados — recuperado (club=${clubId})`);
        return { cleared: false, reason: 'firstLogin verificado — recuperado', clubId };
      }

      if (!_foundData) {
        localStorage.setItem('idb_current_club', clubId);
        _diagWipe('firstLogin_vacio', clubId, { lastClubId });
        console.log(`[idb] 🆕 firstLogin sin datos previos (club=${clubId})`);
        return { cleared: false, reason: 'firstLogin sin datos previos', clubId };
      }

      // Hay datos pero no se pudo verificar que sean de este club — fail-safe
      _diagWipe('firstLogin_mismatch', clubId, { lastClubId, action: 'clear' });
      console.log(`[idb] ⚠️ firstLogin con datos no verificados — limpiando (club=${clubId})`);
    }
    // clubChanged: cambio real de club → limpiar todo (aislamiento multi-club)
    for (const s of STORES) {
      try { await clear(s.name); }
      catch (e) { console.warn(`[idb] ensureClubIsolation: falló clear de ${s.name}:`, e); }
    }
    localStorage.setItem('idb_current_club', clubId);
    _diagWipe('club_changed', clubId, { lastClubId });
    console.log(`[idb] 🧹 Aislamiento: stores limpiadas (${lastClubId} → ${clubId})`);
    return { cleared: true, previousClubId: lastClubId, newClubId: clubId };
  }

  /**
   * Aplica un CAMBIO PARCIAL sobre una store, sin tocar el resto.
   *
   * Es la contraparte de syncStore() para la descarga incremental: syncStore
   * reemplaza la lista entera (clear + put); esto solo mete lo que cambió y saca
   * lo que se borró. Todo en UNA transacción: o entra completo o no entra nada,
   * así la store nunca queda a mitad de camino si algo falla en el medio.
   *
   * @param {string} storeName
   * @param {Array}  cambiados  filas nuevas o modificadas (upsert por id)
   * @param {Array}  borrados   ids a sacar (los que el servidor marcó como borrados)
   */
  async function mergeStore(storeName, cambiados, borrados) {
    const _cambiados = Array.isArray(cambiados) ? cambiados.filter(i => i && i.id) : [];
    // Si un id viniera en las dos listas, gana el cambio: dentro de una misma
    // transacción los put corren antes que los delete, así que sin esto el
    // borrado se comería la actualización. Se resuelve ACÁ y no en quien llama
    // para no depender de que cada llamador futuro se acuerde de hacerlo.
    const _idsCambiados = new Set(_cambiados.map(i => i.id));
    const _borrados = Array.isArray(borrados)
      ? borrados.filter(id => id && !_idsCambiados.has(id))
      : [];
    if (!_cambiados.length && !_borrados.length) {
      return { store: storeName, actualizados: 0, eliminados: 0 };
    }
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      _cambiados.forEach(it => store.put(it));
      _borrados.forEach(id => store.delete(id));
      tx.oncomplete = () => {
        // La cache RAM se toca SOLO si la transacción se completó: nunca mostrar
        // en pantalla algo que la base no llegó a guardar.
        _cambiados.forEach(it => _cacheUpsert(storeName, it));
        _borrados.forEach(id => _cacheDelete(storeName, id));
        resolve({ store: storeName, actualizados: _cambiados.length, eliminados: _borrados.length });
      };
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  // Sincroniza una store completa a partir de una lista nueva.
  // Lo usan los caminos de sync remoto (realtime-sync, firebase-sync, auth)
  // para mantener IndexedDB alineada con localStorage tras cada descarga.
  // Borra todo y carga la lista en una sola transacción para evitar estados intermedios.
  async function syncStore(storeName, items) {
    if (!Array.isArray(items)) return { error: 'items no es array' };
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.clear();
      items.forEach(it => { if (it && it.id) store.put(it); });
      tx.oncomplete = () => {
        // Mantener cache RAM en sync: reemplazar la lista entera
        _cacheReplace(storeName, items);
        resolve({ store: storeName, synced: items.length });
      };
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  // 🚀 FASE 3 — Hidrata window._cache leyendo todas las stores de IDB.
  // Se llama una vez al boot. Después, los updates a IDB mantienen el cache
  // sincronizado automáticamente (vía put/del/clear/syncStore).
  async function _hydrateCacheReal() {
    try {
      const t0 = Date.now();
      for (const s of STORES) {
        try {
          const items = await getAll(s.name);
          window._cache[s.name] = items;
        } catch (e) {
          console.warn(`[idb] hydrateCache: falló getAll(${s.name}):`, e);
          window._cache[s.name] = []; // array vacío para que el getter no caiga al fallback de LS
        }
      }
      window._cache.hydrated = true;
      const ms = Date.now() - t0;
      console.log(`[idb] 🚀 Cache RAM hidratada en ${ms}ms — pagos:${window._cache.payments.length} ` +
        `jugadores:${window._cache.players.length} egresos:${window._cache.expenses.length} ` +
        `eventos:${window._cache.events.length} ingresos:${window._cache.thirdPartyIncomes.length} ` +
        `coaches:${(window._cache.coaches || []).length}`);
      window.dispatchEvent(new CustomEvent('idb-cache-ready'));
    } catch (err) {
      console.error('[idb] ❌ Error hidratando cache RAM:', err);
    }
  }

  // ── Hidratación: una sola corrida a la vez, y nunca deja a nadie colgado ────
  // Hay 3 puntos que piden hidratar en el arranque (boot, session-check y la
  // revalidación de realtime-sync). Sin deduplicar, competían por las mismas
  // transacciones de IndexedDB y en un celular lento eso podía pasarse del
  // techo de tiempo y mostrar ceros. Compartir la corrida en curso lo evita.
  let _hydrateEnCurso = null;

  function hydrateCache() {
    if (_hydrateEnCurso) return _hydrateEnCurso;
    _hydrateEnCurso = _hydrateCacheReal().finally(() => { _hydrateEnCurso = null; });
    return _hydrateEnCurso;
  }

  const HYDRATE_TIMEOUT_MS = 15000;

  /**
   * Igual que hydrateCache(), pero con techo de tiempo: si IndexedDB se cuelga
   * (open/getAll que nunca disparan callback), quien espera sigue de largo en vez
   * de quedarse trabado para siempre. Arrancar con la caché a medias es
   * recuperable — no arrancar, no. La hidratación real sigue corriendo por
   * detrás y el cache se completa cuando termine.
   */
  function hydrateCacheWithTimeout(ms = HYDRATE_TIMEOUT_MS) {
    let timer;
    return Promise.race([
      hydrateCache().finally(() => clearTimeout(timer)), // evita el warning tardío
      new Promise((resolve) => {
        timer = setTimeout(() => {
          console.warn(`[idb] la hidratación superó ${ms}ms — se continúa sin esperarla`);
          resolve();
        }, ms);
      }),
    ]);
  }

  // Alias para mantener compat con el código del piloto inicial
  async function syncPaymentsToIDB(payments) {
    return syncStore('payments', payments);
  }

  // Compara localStorage vs IndexedDB para una store específica
  async function verifyStoreConsistency(storeName, localStorageKey) {
    try {
      const lsCount = JSON.parse(localStorage.getItem(localStorageKey) || '[]').length;
      const idbCount = await count(storeName);
      const ok = lsCount === idbCount;
      console.log(`[idb] 📊 ${storeName}: localStorage=${lsCount} | IndexedDB=${idbCount} ${ok ? '✅' : '⚠️ DIFIEREN'}`);
      return { store: storeName, lsCount, idbCount, ok };
    } catch (err) {
      console.warn(`[idb] Error verificando consistencia de ${storeName}:`, err);
      return null;
    }
  }

  // Verifica todas las stores configuradas
  async function verifyAllConsistency() {
    const results = [];
    for (const s of STORES) {
      const r = await verifyStoreConsistency(s.name, s.localStorageKey);
      if (r) results.push(r);
    }
    return results;
  }

  // Alias retrocompat: solo pagos
  async function verifyPaymentsConsistency() {
    return verifyStoreConsistency('payments', 'payments');
  }

  async function boot() {
    try {
      await open();
      console.log('[idb] 🚀 IndexedDB abierta (myclub_db v' + DB_VERSION + ')');
      await requestPersistence();
      const est = await getStorageEstimate();
      if (est) {
        const usedMB = (est.usage / (1024 * 1024)).toFixed(2);
        const quotaMB = (est.quota / (1024 * 1024)).toFixed(0);
        const quotaGB = (est.quota / (1024 * 1024 * 1024)).toFixed(2);
        console.log(`[idb] 💾 Almacenamiento del dispositivo: ${usedMB} MB usados / ${quotaMB} MB (${quotaGB} GB) disponibles`);
      }
      const mig = await migrateAllFromLocalStorage();
      Object.entries(mig).forEach(([store, r]) => {
        if (r && r.migrated) console.log(`[idb] 📦 Migración inicial ${store}: ${r.migrated} items`);
      });
      // 🚀 FASE 3 — Hidratar cache RAM ANTES de la verificación para que los
      // getters de storage.js lean de cache en cuanto pidan datos.
      await hydrateCache();
      // Recién acá, con los datos ya en IndexedDB y en la cache RAM, es seguro
      // liberar las copias pesadas de localStorage. Aislado en su propio try:
      // si falla, no debe llevarse puesta la verificación de paridad.
      try {
        await liberarLocalStoragePesado();
      } catch (e) {
        console.warn('[idb] Cleanup Fase 4 falló:', e);
      }
      await verifyAllConsistency();
      console.log('[idb] ✅ Listo');
    } catch (err) {
      console.error('[idb] ❌ Error en boot:', err);
    }
  }

  // API pública
  window.idb = {
    // operaciones básicas
    open, getAll, put, delete: del, count, clear, bulkPut,
    // sistema
    requestPersistence, getStorageEstimate,
    // migración
    migrateStoreFromLocalStorage, migrateAllFromLocalStorage,
    // verificación de paridad
    verifyStoreConsistency, verifyAllConsistency,
    // sync espejo (lo llaman los caminos de descarga remota)
    syncStore,
    // mezcla parcial (descarga incremental / delta)
    mergeStore,
    // aislamiento de datos por club (se llama al inicio de cada login/download)
    ensureClubIsolation,
    // Fase 3: hidratación de cache RAM (también re-llamable desde consola)
    hydrateCache,
    hydrateCacheWithTimeout,
    // aliases retrocompat (NO eliminar — los usan los archivos antiguos)
    migratePaymentsFromLocalStorage,
    verifyPaymentsConsistency,
    syncPaymentsToIDB,
    // metadata
    STORES,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
