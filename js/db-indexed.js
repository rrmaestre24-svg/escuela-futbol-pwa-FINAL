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
  const DB_VERSION = 1;
  let _dbPromise = null;

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
        if (!db.objectStoreNames.contains('payments')) {
          const store = db.createObjectStore('payments', { keyPath: 'id' });
          store.createIndex('club_id', 'club_id', { unique: false });
          store.createIndex('playerId', 'playerId', { unique: false });
        }
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

  async function put(storeName, obj) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const req = tx.objectStore(storeName).put(obj);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  async function del(storeName, id) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const req = tx.objectStore(storeName).delete(id);
      req.onsuccess = () => resolve(true);
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
      req.onsuccess = () => resolve(true);
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

  // Migración one-shot: copia localStorage.payments → IndexedDB si IDB está vacía.
  // Marca un flag para que no se repita.
  async function migratePaymentsFromLocalStorage() {
    if (localStorage.getItem('idb_migrated_payments') === 'true') {
      return { skipped: true, reason: 'already migrated' };
    }
    try {
      const existing = await count('payments');
      if (existing > 0) {
        localStorage.setItem('idb_migrated_payments', 'true');
        return { skipped: true, reason: 'IDB already has data', count: existing };
      }
      const lsPayments = JSON.parse(localStorage.getItem('payments') || '[]');
      if (!lsPayments.length) {
        localStorage.setItem('idb_migrated_payments', 'true');
        return { skipped: true, reason: 'localStorage vacío' };
      }
      const migrated = await bulkPut('payments', lsPayments);
      localStorage.setItem('idb_migrated_payments', 'true');
      console.log(`[idb] ✅ Migrados ${migrated} pagos de localStorage → IndexedDB`);
      return { migrated };
    } catch (err) {
      console.error('[idb] ❌ Error migrando pagos:', err);
      return { error: err.message };
    }
  }

  // Sincroniza la store completa de pagos a partir de una lista nueva.
  // Lo usan los caminos de sync remoto (realtime-sync, firebase-sync)
  // para mantener IndexedDB alineada con localStorage tras cada descarga.
  // Borra todo y carga la lista en una sola transacción para evitar estados intermedios.
  async function syncPaymentsToIDB(payments) {
    if (!Array.isArray(payments)) return { error: 'payments no es array' };
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('payments', 'readwrite');
      const store = tx.objectStore('payments');
      store.clear();
      payments.forEach(p => { if (p && p.id) store.put(p); });
      tx.oncomplete = () => resolve({ synced: payments.length });
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  // Para logs durante el piloto: compara localStorage vs IndexedDB
  async function verifyPaymentsConsistency() {
    try {
      const lsCount = JSON.parse(localStorage.getItem('payments') || '[]').length;
      const idbCount = await count('payments');
      const ok = lsCount === idbCount;
      console.log(`[idb] 📊 Pagos: localStorage=${lsCount} | IndexedDB=${idbCount} ${ok ? '✅' : '⚠️ DIFIEREN'}`);
      return { lsCount, idbCount, ok };
    } catch (err) {
      console.warn('[idb] Error verificando consistencia:', err);
      return null;
    }
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
      const mig = await migratePaymentsFromLocalStorage();
      if (mig && mig.migrated) {
        console.log(`[idb] 📦 Migración inicial: ${mig.migrated} pagos copiados`);
      }
      await verifyPaymentsConsistency();
      console.log('[idb] ✅ Listo');
    } catch (err) {
      console.error('[idb] ❌ Error en boot:', err);
    }
  }

  // API pública
  window.idb = {
    open, getAll, put, delete: del, count, clear, bulkPut,
    requestPersistence, getStorageEstimate,
    migratePaymentsFromLocalStorage, verifyPaymentsConsistency,
    syncPaymentsToIDB,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
