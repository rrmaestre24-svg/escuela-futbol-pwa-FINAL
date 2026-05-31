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
  const DB_VERSION = 3;
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
    hydrated: false,
  };

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

  // Alias retrocompat: solo pagos
  async function migratePaymentsFromLocalStorage() {
    return migrateStoreFromLocalStorage('payments', 'payments');
  }

  // Garantiza aislamiento de datos por club. Si el clubId cambió desde la
  // última vez que IDB se pobló (o es la primera vez), limpia TODAS las
  // stores y devuelve { cleared: true } para que el caller fuerce una
  // re-descarga. Si es el mismo club, no toca nada y devuelve { cleared: false }.
  // El flag `idb_current_club` vive en localStorage por su persistencia simple.
  async function ensureClubIsolation(clubId) {
    if (!clubId) return { cleared: false, reason: 'sin clubId' };
    const lastClubId = localStorage.getItem('idb_current_club');
    const clubChanged = lastClubId && lastClubId !== clubId;
    const firstLogin = !lastClubId;
    if (!clubChanged && !firstLogin) {
      return { cleared: false, reason: 'mismo club', clubId };
    }
    for (const s of STORES) {
      try { await clear(s.name); }
      catch (e) { console.warn(`[idb] ensureClubIsolation: falló clear de ${s.name}:`, e); }
    }
    localStorage.setItem('idb_current_club', clubId);
    console.log(`[idb] 🧹 Aislamiento: stores limpiadas (${lastClubId || 'ninguno'} → ${clubId})`);
    return { cleared: true, previousClubId: lastClubId, newClubId: clubId };
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
  async function hydrateCache() {
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
        `eventos:${window._cache.events.length} ingresos:${window._cache.thirdPartyIncomes.length}`);
      window.dispatchEvent(new CustomEvent('idb-cache-ready'));
    } catch (err) {
      console.error('[idb] ❌ Error hidratando cache RAM:', err);
    }
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
    // aislamiento de datos por club (se llama al inicio de cada login/download)
    ensureClubIsolation,
    // Fase 3: hidratación de cache RAM (también re-llamable desde consola)
    hydrateCache,
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
