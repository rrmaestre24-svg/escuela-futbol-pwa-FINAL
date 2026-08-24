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
  const DB_VERSION = 5; // 🆕 v5: store 'crypto_keys' para el cifrado en reposo de jugadores
  let _dbPromise = null;

  // 🔐 FASE D — Stores cuyos registros se cifran EN REPOSO en IndexedDB.
  // Solo JUGADORES: es el dato personal de menores (nombre, documento, fecha de
  // nacimiento, teléfono, dirección, contacto de emergencia, info médica, foto).
  // La plata (pagos) NO se cifra a propósito: agrega riesgo sin ser PII de menores.
  // El cifrado es transparente: se cifra al escribir, se descifra al leer; la cache
  // RAM (window._cache) y el resto de la app siguen viendo los datos en claro.
  const _STORES_CIFRADOS = new Set(['players']);

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
    // 🔐 Llave AES-GCM no extraíble para cifrar jugadores en reposo. Guarda un
    // objeto CryptoKey (IndexedDB lo soporta vía structured clone). La llave NUNCA
    // sale de acá y el JS no puede leer sus bytes (extractable:false).
    { name: 'crypto_keys', keyPath: 'id' },
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
    const raw = await new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
    if (!_esCifrado(storeName)) return raw;
    // Descifrar; los que fallen se OMITEN (fail-safe) y se reponen al sincronizar.
    const desc = await Promise.all(raw.map(_descifrarRegistro));
    return desc.filter(Boolean);
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

  // ══════════════════════════════════════════════════════════════════════════
  // 🔐 CIFRADO EN REPOSO (FASE D) — solo la store 'players'
  // ══════════════════════════════════════════════════════════════════════════
  // La llave AES-GCM es NO EXTRAÍBLE: vive como CryptoKey en IndexedDB (store
  // crypto_keys). El JS la usa para cifrar/descifrar pero no puede leer sus bytes,
  // así que una copia de los archivos / un backup / una extensión ve solo ruido.
  // No protege contra usar la app en el equipo desbloqueado (ahí descifra normal):
  // eso es una limitación del cifrado en el navegador, no un defecto.
  function _esCifrado(storeName) { return _STORES_CIFRADOS.has(storeName); }

  const _cryptoOk = (typeof crypto !== 'undefined' && crypto.subtle && crypto.getRandomValues);
  let _llavePromise = null;

  // Devuelve la CryptoKey (creándola la primera vez) o null si no hay WebCrypto
  // (contexto no seguro: http fuera de localhost). Memoizada: una sola vez.
  function _obtenerLlave() {
    if (_llavePromise) return _llavePromise;
    _llavePromise = (async () => {
      if (!_cryptoOk) { console.warn('[idb][🔐] WebCrypto no disponible — jugadores quedan en claro'); return null; }
      try {
        const db = await open();
        // 1. Camino común: la llave ya existe → leerla (readonly).
        const guardada = await new Promise((res) => {
          const tx = db.transaction('crypto_keys', 'readonly');
          const rq = tx.objectStore('crypto_keys').get('players_v1');
          rq.onsuccess = () => res(rq.result && rq.result.key);
          rq.onerror = () => res(null);
        });
        if (guardada) return guardada;
        // 2. No existe → generar candidata y hacer get-or-put ATÓMICO en UNA sola
        // transacción readwrite. IndexedDB serializa las tx readwrite sobre el mismo
        // store, así que dos pestañas del mismo dispositivo en el primer arranque NO
        // terminan con llaves distintas: la segunda ve la que puso la primera y la
        // reusa (antes había un await generateKey entre el get y el put → carrera).
        const candidata = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
        const llave = await new Promise((res, rej) => {
          let elegida = candidata;
          const tx = db.transaction('crypto_keys', 'readwrite');
          const store = tx.objectStore('crypto_keys');
          const g = store.get('players_v1');
          g.onsuccess = () => {
            if (g.result && g.result.key) elegida = g.result.key; // otra pestaña ya la puso
            else store.put({ id: 'players_v1', key: candidata });  // la ponemos nosotros
          };
          tx.oncomplete = () => res(elegida);
          tx.onerror = () => rej(tx.error);
        });
        if (llave === candidata) console.log('[idb][🔐] Llave de cifrado creada (no extraíble)');
        return llave;
      } catch (e) {
        console.warn('[idb][🔐] No se pudo obtener/crear la llave — jugadores en claro:', e?.message || e);
        return null;
      }
    })();
    return _llavePromise;
  }

  // Cifra UN registro → { id, schoolId/clubId EN CLARO, _enc (ArrayBuffer), _iv }.
  // El id y el campo de club quedan en claro (no son PII y el aislamiento los lee
  // sin descifrar). El ciphertext se guarda binario (no base64): soporta fotos
  // grandes sin desbordar la pila. Si algo falla, devuelve el registro EN CLARO:
  // nunca perder el dato por un problema de cifrado (disponibilidad > confidencialidad).
  async function _cifrarRegistro(obj) {
    if (!obj || obj.id == null) return obj;
    const llave = await _obtenerLlave();
    if (!llave) return obj;
    try {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const datos = new TextEncoder().encode(JSON.stringify(obj));
      const _enc = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, llave, datos);
      const meta = { id: obj.id, _enc, _iv: iv };
      if (obj.schoolId != null) meta.schoolId = obj.schoolId;   // club en claro para el aislamiento
      if (obj.clubId != null)   meta.clubId = obj.clubId;
      if (obj.club_id != null)  meta.club_id = obj.club_id;
      return meta;
    } catch (e) {
      console.warn('[idb][🔐] cifrado falló — se guarda en claro:', e?.message || e);
      return obj;
    }
  }

  async function _cifrarLista(items) {
    return Promise.all((items || []).map(_cifrarRegistro));
  }

  // Descifra UN registro. Sin `_enc` → registro en claro (legacy o sin cifrar) tal
  // cual. Con `_enc` pero sin llave o con fallo → null (se OMITE): la descarga lo
  // repone desde Supabase. Nunca lanza ni rompe la lectura de los demás.
  async function _descifrarRegistro(rec) {
    if (!rec) return null;
    if (rec._enc === undefined) return rec;
    const llave = await _obtenerLlave();
    if (!llave) return null;
    try {
      const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: rec._iv }, llave, rec._enc);
      return JSON.parse(new TextDecoder().decode(plain));
    } catch (e) {
      console.warn('[idb][🔐] un registro no se pudo descifrar (se omite; se repone al sincronizar):', e?.message || e);
      return null;
    }
  }

  async function put(storeName, obj) {
    const db = await open();
    // Cifrar ANTES de abrir la transacción: no se puede await dentro de una tx de
    // IndexedDB (se auto-cierra). La cache RAM recibe el objeto EN CLARO.
    const guardar = _esCifrado(storeName) ? await _cifrarRegistro(obj) : obj;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const req = tx.objectStore(storeName).put(guardar);
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
    const guardar = _esCifrado(storeName) ? await _cifrarLista(items) : items;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const s = tx.objectStore(storeName);
      let n = 0;
      guardar.forEach(item => {
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

  // 🔐 FASE D — MIGRACIÓN one-shot: re-cifra en reposo los jugadores que ya estaban
  // cacheados EN CLARO antes del cifrado. Hace falta porque el delta solo re-escribe
  // (y por ende cifra) los jugadores que CAMBIAN, y el resync completo (7 días) casi
  // nunca dispara en un club activo — así que sin esto el grueso del dato viejo se
  // quedaría en texto plano indefinidamente. Corre en boot(), después de hidratar.
  // Sigue el patrón de las otras migraciones: si no puede terminar (sin llave), NO
  // marca la bandera y lo reintenta en el próximo arranque.
  async function migrarCifrarJugadores() {
    const FLAG = 'idb_encrypt_migration_v1';
    try {
      if (!_esCifrado('players')) { localStorage.setItem(FLAG, '1'); return; }
      if (localStorage.getItem(FLAG) === '1') return;
      if (!_cryptoOk) return; // sin WebCrypto no se puede cifrar → reintentar al próximo boot
      const db = await open();
      // Leer TODOS los registros CRUDOS de players (sin descifrar).
      const crudos = await new Promise((res) => {
        const tx = db.transaction('players', 'readonly');
        const rq = tx.objectStore('players').getAll();
        rq.onsuccess = () => res(rq.result || []);
        rq.onerror = () => res([]);
      });
      // Solo los que están EN CLARO (sin _enc). Los ya cifrados no se tocan.
      const enClaro = crudos.filter(r => r && r.id != null && r._enc === undefined);
      if (enClaro.length === 0) { localStorage.setItem(FLAG, '1'); return; }
      // Si NO hay llave (sin WebCrypto o fallo al crearla) NO se puede cifrar nada:
      // salir SIN marcar el flag para reintentar en el próximo arranque. Distinto de que
      // falle un registro puntual (abajo), que sí debe dejar avanzar al resto.
      const llave = await _obtenerLlave();
      if (!llave) return;
      const cifrados = await _cifrarLista(enClaro); // cifra ANTES de abrir la tx de escritura
      // Escribir SOLO los que se pudieron cifrar. Un registro que no se pudo cifrar (dato
      // malformado puntual) queda como estaba (en claro) y NO bloquea al resto del roster
      // — antes un solo registro malo abortaba el cifrado de TODOS para siempre. El flag SÍ
      // se marca: un registro problemático no debe dejar el dispositivo sin cifrar en loop.
      const okCifrados = cifrados.filter(c => c && c._enc !== undefined);
      const noCifrables = cifrados.length - okCifrados.length;
      if (okCifrados.length) {
        await new Promise((res, rej) => {
          const tx = db.transaction('players', 'readwrite');
          const store = tx.objectStore('players');
          // Get-or-put ATÓMICO dentro de la MISMA tx (evita la carrera con un sync
          // que corra en el mismo arranque): solo re-escribimos la versión cifrada
          // si el registro SIGUE siendo el texto plano que snapshotié. Si ya tiene
          // _enc, otra escritura (mergeStore/syncStore, que cifran) lo tocó en el
          // medio → NO pisar con mi snapshot viejo. Si ya no existe, un borrado del
          // servidor lo sacó → NO resucitarlo. (Como los caminos de sync escriben
          // SIEMPRE cifrado, "sin _enc" garantiza que nadie lo tocó desde el snapshot.)
          okCifrados.forEach(c => {
            const g = store.get(c.id);
            g.onsuccess = () => { const cur = g.result; if (cur && cur._enc === undefined) store.put(c); };
            g.onerror = () => { /* saltar este registro, no abortar la tx */ };
          });
          tx.oncomplete = res; tx.onerror = () => rej(tx.error);
        });
      }
      // La cache RAM ya tiene el texto en claro (de hidratar): el contenido lógico no
      // cambia, solo la forma en reposo — no hace falta tocar window._cache.
      localStorage.setItem(FLAG, '1');
      if (noCifrables) console.warn(`[idb][🔐] Migración: ${okCifrados.length} jugadores re-cifrados; ${noCifrables} no se pudieron cifrar (dato malformado) — quedan en claro`);
      else console.log(`[idb][🔐] Migración: ${okCifrados.length} jugadores re-cifrados en reposo`);
    } catch (e) {
      console.warn('[idb][🔐] migración de cifrado falló (se reintenta al próximo arranque):', e?.message || e);
    }
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
    const _cambiados = Array.isArray(cambiados) ? cambiados.filter(i => i && i.id != null) : []; // mismo criterio que syncStore
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
    // Cifrar los cambiados ANTES de la transacción (la cache recibe los EN CLARO).
    const _guardar = _esCifrado(storeName) ? await _cifrarLista(_cambiados) : _cambiados;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      _guardar.forEach(it => store.put(it));
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
    // Cifrar (para la store) ANTES de la transacción; la cache recibe los EN CLARO.
    const _validos = items.filter(it => it && it.id != null);
    const _guardar = _esCifrado(storeName) ? await _cifrarLista(_validos) : _validos;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.clear();
      _guardar.forEach(it => store.put(it));
      tx.oncomplete = () => {
        // Mantener cache RAM en sync: reemplazar la lista entera (en claro)
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
      const idbCount = await count(storeName);
      // Las 5 listas pesadas viven SOLO en IndexedDB: localStorage se libera a
      // propósito (deny-list Fase 4), así que compararlo daría siempre "DIFIEREN".
      // La fuente de verdad es IndexedDB; se reporta su conteo sin falsa alarma (F-26).
      if (_LS_DENY_KEYS.has(localStorageKey)) {
        console.log(`[idb] 📊 ${storeName}: IndexedDB=${idbCount} (localStorage liberado)`);
        return { store: storeName, lsCount: null, idbCount, ok: true };
      }
      const lsCount = JSON.parse(localStorage.getItem(localStorageKey) || '[]').length;
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
      // 🔐 FASE D — re-cifrar en reposo los jugadores viejos que quedaron en claro.
      // Aislado en su propio try: si falla, no debe tumbar la verificación de paridad.
      try {
        await migrarCifrarJugadores();
      } catch (e) {
        console.warn('[idb] 🔐 Migración de cifrado falló:', e);
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
