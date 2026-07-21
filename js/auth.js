// ========================================
// SISTEMA DE AUTENTICACIÓN - MULTI-DISPOSITIVO 100% FUNCIONAL
// CON LOGIN POR CLUB ID OPCIONAL
// VERSIÓN CORREGIDA Y SIMPLIFICADA
// CON NORMALIZACIÓN DE TELÉFONOS
// CON PERSISTENCIA DE SESIÓN MEJORADA
// ========================================

// ========================================
// FUNCIONES DE SESIÓN Y DATOS
// (getCurrentUser, getSchoolSettings, showToast, imageToBase64,
//  compressImageForFirestore, getDefaultLogo, getDefaultAvatar
//  están definidas en storage.js y utils.js — no duplicar aquí)
// ========================================

// Establecer usuario actual (guardado doble para mayor seguridad)
function setCurrentUser(user) {
  try {
    const userStr = JSON.stringify(user);
    localStorage.setItem('currentUser', userStr);
    sessionStorage.setItem('currentUser', userStr); // Backup
    console.log('[SESSION] Usuario guardado:', maskEmail(user.email));
  } catch (error) {
    console.error('[SESSION] Error al guardar usuario actual:', error);
  }
}

// Limpiar sesión (solo cuando el usuario lo pide explícitamente)
function clearCurrentUser() {
  try {
    localStorage.removeItem('currentUser');
    sessionStorage.removeItem('currentUser');
    console.log('[SESSION] Sesion limpiada');
  } catch (error) {
    console.error('[SESSION] Error al limpiar sesión:', error);
  }
}

// Obtener todos los usuarios
function getUsers() {
  try {
    const usersStr = localStorage.getItem('users');
    return usersStr ? JSON.parse(usersStr) : [];
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    return [];
  }
}

// Guardar usuario
function saveUser(user) {
  try {
    const users = getUsers();
    users.push(user);
    localStorage.setItem('users', JSON.stringify(users));
  } catch (error) {
    console.error('Error al guardar usuario:', error);
  }
}

// Actualizar usuario
function updateUser(userId, updates) {
  try {
    const users = getUsers();
    const index = users.findIndex(u => u.id === userId);
    if (index !== -1) {
      users[index] = { ...users[index], ...updates };
      localStorage.setItem('users', JSON.stringify(users));
    }
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
  }
}

// Guardar configuración del club
function saveSchoolSettings(settings) {
  if (typeof updateSchoolSettings === 'function') {
    updateSchoolSettings(settings || {});
  } else {
    try {
      const current = JSON.parse(localStorage.getItem('schoolSettings') || '{}');
      localStorage.setItem('schoolSettings', JSON.stringify({ ...current, ...(settings || {}) }));
    } catch (error) {
      console.error('Error al guardar configuración:', error);
    }
  }
}

// Actualizar configuración
function updateSchoolSettings(updates) {
  try {
    const current = typeof getSchoolSettings === 'function'
      ? (getSchoolSettings() || {})
      : JSON.parse(localStorage.getItem('schoolSettings') || '{}');

    const updated = { ...current, ...(updates || {}) };
    localStorage.setItem('schoolSettings', JSON.stringify(updated));

    // Persistir en la nube (PATCH a clubs en Supabase vía saveSchoolSettingsToFirebase,
    // que está en firebase-sync.js). Sin esto, cambiar config/logo NO se guarda en la BD.
    // Solo si el update trae claves REALES del club (evita PATCH triviales).
    const CLUB_KEYS = ['name','phone','email','address','city','country','coachCode','monthlyFee','monthlyDueDay','monthlyGraceDays','currency','primaryColor','logo'];
    const tocaClub = Object.keys(updates || {}).some(k => CLUB_KEYS.includes(k));
    if (tocaClub && typeof saveSchoolSettingsToFirebase === 'function') {
      saveSchoolSettingsToFirebase(updated).catch(err =>
        console.warn('⚠️ No se pudo sincronizar configuración:', err));
    }
  } catch (error) {
    console.error('Error al actualizar configuración:', error);
  }
}

// Guardar todos los jugadores
function saveAllPlayers(players) {
  try {
    localStorage.setItem('players', JSON.stringify(players));
  } catch (error) {
    console.error('Error al guardar jugadores:', error);
  }
  // 🆕 ESPEJO A INDEXEDDB
  if (window.idb && window.idb.syncStore) {
    window.idb.syncStore('players', players).catch(e => console.warn('[idb] sync players (saveAllPlayers auth) falló:', e));
  }
}

// Confirmar acción
async function confirmAction(message, options = {}) {
  return showAppConfirm(message, options);
}

// Obtener fecha y hora actual en formato ISO (para Firestore)
function getCurrentDateTime() {
  return new Date().toISOString();
}


// Normalizar teléfono
function normalizePhone(phone) {
  if (!phone) return '';
  // Eliminar espacios, guiones y paréntesis
  let normalized = phone.replace(/[\s\-\(\)]/g, '');
  // Si no tiene +, agregar +57 para Colombia
  if (!normalized.startsWith('+')) {
    normalized = '+57' + normalized;
  }
  return normalized;
}

// ✅ NUEVA FUNCIÓN: Formatear Club ID personalizado
function formatClubId(input) {
  if (!input) return null;
  
  // Convertir a minúsculas
  let formatted = input.toLowerCase().trim();
  
  // Reemplazar espacios con guiones bajos
  formatted = formatted.replace(/\s+/g, '_');
  
  // Eliminar caracteres especiales (solo permitir letras, números, guiones y guiones bajos)
  formatted = formatted.replace(/[^a-z0-9_-]/g, '');
  
  // Eliminar guiones o guiones bajos múltiples
  formatted = formatted.replace(/[-_]{2,}/g, '_');
  
  // Eliminar guiones o guiones bajos al inicio o final
  formatted = formatted.replace(/^[-_]+|[-_]+$/g, '');
  
  return formatted || null;
}

window.onClubIdInput = function(value) {
  const inputEl = document.getElementById('regClubId');
  if (inputEl) {
    const formatted = formatClubId(value);
    inputEl.value = formatted !== null ? formatted : '';
  }
};

// ✅ FUNCIÓN CORREGIDA: Verificar si el Club ID ya existe
async function checkClubIdExists(clubId) {
  if (window.MODO_SUPABASE) {
    try {
      // Edge Function pre-JWT (clubs_anon_select fue borrada)
      const res = await fetch(
        `${window.SUPA_URL}/functions/v1/get-club-public-info`,
        {
          method: 'POST',
          headers: { apikey: window.SUPA_ANON, Authorization: `Bearer ${window.SUPA_ANON}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ club_id: clubId })
        }
      );
      if (res.ok) {
        const data = await res.json();
        const exists = data?.exists === true;
        console.log(exists ? '❌ Club ID ya existe en Supabase:' : '✅ Club ID disponible:', clubId);
        return exists;
      }
    } catch (e) {
      console.error('❌ Error al verificar Club ID en Supabase:', e);
    }
    return false;
  }

  return false;
}

// Inicializar app
function initApp() {
  console.log('✅ App inicializada');

  // Mostrar botón de Export Excel solo al admin principal
  const user = getCurrentUser();
  const btnExcel = document.getElementById('btnExportExcel');
  if (btnExcel && user && user.isMainAdmin) {
    btnExcel.classList.remove('hidden');
  }

  // ✅ FIX: El listener de eliminación de usuario está centralizado en
  // app.js → setupUserDeletionListener(). No crear uno duplicado aquí.

  // Cargar contenido del dashboard si existe
  if (typeof loadDashboard === 'function') {
    loadDashboard();
  }
}

// ========================================
// CÓDIGO ORIGINAL DE AUTH.JS
// ========================================

function normalizeUserEmail(email) {
  return (email || '').trim().toLowerCase();
}
window.normalizeUserEmail = normalizeUserEmail;

// ✅ FUNCIÓN CRÍTICA: Guardar mapeo email → clubId
async function saveUserClubMapping(email, clubId, uid) {
  if (window.MODO_SUPABASE) {
    // En Supabase la tabla users ya tiene club_id — no se necesita mapeo separado
    console.log('ℹ️ [Supabase] saveUserClubMapping omitido — club_id en tabla users');
    return true;
  }

  console.log('ℹ️ saveUserClubMapping omitido — modo legacy sin Firebase');
  return false;
}

// ✅ FUNCIÓN MEJORADA: Obtener clubId desde múltiples fuentes
async function getClubIdForUser(email) {
  try {
    const normalizedEmail = normalizeUserEmail(email);
    if (!normalizedEmail) {
      console.warn('❌ Email inválido al buscar clubId');
      return null;
    }
    
    console.log('🔍 Buscando clubId para:', normalizedEmail);
    
    // 1️⃣ PRIMERA OPCIÓN: localStorage (más rápido)
    const storedClubId = localStorage.getItem('clubId');
    if (storedClubId) {
      console.log('✅ clubId encontrado en localStorage:', storedClubId);
      return storedClubId;
    }

    // 2️⃣ SEGUNDA OPCIÓN: Usuarios locales
    const users = getUsers();
    const localUser = users.find(u => normalizeUserEmail(u.email) === normalizedEmail);
    if (localUser && localUser.schoolId) {
      localStorage.setItem('clubId', localUser.schoolId);
      console.log('✅ clubId recuperado de usuario local:', localUser.schoolId);
      return localUser.schoolId;
    }

    // 3️⃣ TERCERA OPCIÓN: Supabase / Firebase (crítico para multi-dispositivo)
    if (window.MODO_SUPABASE) {
      console.log('☁️ Buscando clubId en Supabase (Edge Function)...');
      try {
        // Edge Function: solo devuelve club_id, no expone toda la tabla users
        const res = await fetch(
          `${window.SUPA_URL}/functions/v1/lookup-club-by-email`,
          {
            method: 'POST',
            headers: { apikey: window.SUPA_ANON, Authorization: `Bearer ${window.SUPA_ANON}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: normalizedEmail })
          }
        );
        if (res.ok) {
          const data = await res.json();
          if (data?.club_id) {
            const clubId = data.club_id;
            localStorage.setItem('clubId', clubId);
            console.log('✅ clubId encontrado en Supabase:', clubId);
            return clubId;
          }
        }
      } catch (e) {
        console.warn('⚠️ Error buscando clubId en Supabase:', e.message);
      }
    }

    console.warn('❌ No se encontró clubId en ninguna fuente');
    return null;
  } catch (error) {
    console.error('❌ Error al obtener clubId:', error);
    return null;
  }
}

// 🔥 FUNCIÓN: Descargar datos desde Firebase
// Local-first: si los datos del club ya están en localStorage y son recientes,
// los reutiliza sin hacer lecturas a Firestore.
const _FULL_DOWNLOAD_TTL_MS = 15 * 60 * 1000; // 15 minutos

async function downloadAllClubData(clubId, { force = false } = {}) {
  if (!clubId) {
    console.error('❌ clubId es requerido para descargar datos');
    showToast('❌ Error: No se encontró el ID del club');
    return false;
  }

  // 🆕 AISLAMIENTO POR CLUB EN IndexedDB (corre antes de cualquier descarga)
  // Si cambió el club desde el último login, limpia IDB y fuerza re-descarga.
  if (window.idb && window.idb.ensureClubIsolation) {
    try {
      const r = await window.idb.ensureClubIsolation(clubId);
      if (r && r.cleared) force = true;
    } catch (e) { console.warn('[idb] ensureClubIsolation falló:', e); }
  }

  // Cuando MODO_SUPABASE está activo, delegar completamente a Supabase
  if (window.MODO_SUPABASE && typeof downloadAllClubDataFromSupabase === 'function') {
    return downloadAllClubDataFromSupabase(clubId, { force });
  }

  console.warn('⚠️ No hay método de descarga disponible');
  showToast('⚠️ No se pudo sincronizar datos');
  return false;
}

// Mostrar tab de login
function showLoginTab() {
  document.getElementById('loginForm').classList.remove('hidden');
  document.getElementById('registerForm').classList.add('hidden');
  document.getElementById('loginTab').classList.add('bg-teal-600', 'text-white');
  document.getElementById('loginTab').classList.remove('bg-gray-200', 'dark:bg-gray-700', 'text-gray-700', 'dark:text-gray-300');
  document.getElementById('registerTab').classList.remove('bg-teal-600', 'text-white');
  document.getElementById('registerTab').classList.add('bg-gray-200', 'dark:bg-gray-700', 'text-gray-700', 'dark:text-gray-300');
}

// Mostrar tab de registro
function showRegisterTab() {
  document.getElementById('loginForm').classList.add('hidden');
  document.getElementById('registerForm').classList.remove('hidden');
  document.getElementById('registerTab').classList.add('bg-teal-600', 'text-white');
  document.getElementById('registerTab').classList.remove('bg-gray-200', 'dark:bg-gray-700', 'text-gray-700', 'dark:text-gray-300');
  document.getElementById('loginTab').classList.remove('bg-teal-600', 'text-white');
  document.getElementById('loginTab').classList.add('bg-gray-200', 'dark:bg-gray-700', 'text-gray-700', 'dark:text-gray-300');
}

// Preview de logo en registro
document.getElementById('regClubLogo')?.addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (file) {
    if (!file.type.startsWith('image/')) {
      showToast('❌ Por favor selecciona una imagen válida');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      showToast('❌ La imagen es muy grande. Máximo 2MB');
      return;
    }
    imageToBase64(file, function(base64) {
      const preview = document.getElementById('regLogoPreview');
      preview.src = base64;
      preview.classList.remove('hidden');
    });
  }
});

// Preview de avatar en registro
document.getElementById('regAdminAvatar')?.addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (file) {
    if (!file.type.startsWith('image/')) {
      showToast('❌ Por favor selecciona una imagen válida');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      showToast('❌ La imagen es muy grande. Máximo 2MB');
      return;
    }
    imageToBase64(file, function(base64) {
      const preview = document.getElementById('regAvatarPreview');
      preview.src = base64;
      preview.classList.remove('hidden');
    });
  }
});

// ✅✅✅ LOGIN MEJORADO - CON AUTO-REGISTRO EN SUBCOLECCIÓN ✅✅✅
document.getElementById('loginForm')?.addEventListener('submit', async function(e) {
  e.preventDefault();
  
  const clubIdInput = document.getElementById('loginClubId')?.value.trim() || '';
  const email = normalizeUserEmail(document.getElementById('loginEmail').value);
  const password = document.getElementById('loginPassword').value;
  
  if (!email || !password) {
    showToast('❌ Por favor completa todos los campos obligatorios');
    return;
  }
  
  console.log('🔐 Iniciando login para:', maskEmail(email));
  if (clubIdInput) {
    console.log('⚡ Club ID proporcionado:', clubIdInput, '(login rápido)');
  } else {
    console.log('🔍 Club ID no proporcionado, se buscará automáticamente');
  }
  
  if (!window.SupaAuthV2) {
    showToast('❌ No se pudo conectar. Recarga la página.');
    return;
  }

  try {
    showToast('🔐 Verificando credenciales...');

    // 1️⃣ Autenticar con Supabase
    let firebaseUid = null;
    let authMethod = null;

    // Intento Supabase v2
    if (window.SupaAuthV2) {
      try {
        // Token del CAPTCHA (Turnstile) si el widget lo produjo. Fail-open: si no
        // hay widget/token, se manda vacío y Supabase lo ignora (hasta activarlo).
        const _captchaToken = (window.turnstile && typeof window.turnstile.getResponse === 'function')
          ? (window.turnstile.getResponse() || '') : '';
        await window.SupaAuthV2.login(email, password, _captchaToken);
        authMethod = 'supabase';
        console.log('✅ Autenticado en Supabase (v2)');

        // Resolver el perfil del admin (id + name/avatar/phone/is_main_admin) por email,
        // con el JWT v2 (vía interceptor). Antes solo traía el id → faltaban perfil y rol.
        const lookup = await fetch(
          `${window.SUPA_URL}/rest/v1/users?email=eq.${encodeURIComponent(email)}&deleted=eq.false&select=id,name,avatar,phone,is_main_admin&limit=1`
        );
        let _prof = {};
        if (lookup.ok) {
          const rows = await lookup.json();
          if (rows[0]?.id) { firebaseUid = rows[0].id; _prof = rows[0]; }
        }

        // currentUser con el perfil real (name/avatar/phone/isMainAdmin) para el dashboard
        // y la gestión de usuarios (que dependen de currentUser.isMainAdmin).
        window.APP_STATE.currentUser = {
          uid: firebaseUid,
          email,
          name: _prof.name || '',
          avatar: _prof.avatar || '',
          phone: _prof.phone || '',
          isMainAdmin: _prof.is_main_admin || false,
          getIdToken: async () => null,
        };
      } catch (supaErr) {
        console.error('[LOGIN] Supabase falló:', supaErr?.message || supaErr);
        // El token de Turnstile es de un solo uso: reiniciar el widget para el reintento
        // y volver a mostrarlo (por si el reintento necesita interacción).
        if (window.turnstile && typeof window.turnstile.reset === 'function') { try { window.turnstile.reset(); } catch (_) {} }
        var _tw = document.getElementById('turnstileWrap');
        if (_tw) { _tw.style.opacity = '1'; _tw.style.maxHeight = '90px'; _tw.style.margin = '6px 0'; }
        showToast('❌ Correo o contraseña incorrectos');
        return;
      }
    }

    if (!firebaseUid) {
      showToast('❌ No se pudo identificar el usuario');
      return;
    }

    let clubId = null;
    
    // 2️⃣ Si proporcionó clubId, intentar login directo
    if (clubIdInput) {
      console.log('⚡ Intentando login directo con clubId:', clubIdInput);

      try {
        const res = await fetch(
          `${window.SUPA_URL}/rest/v1/users?id=eq.${encodeURIComponent(firebaseUid)}&club_id=eq.${encodeURIComponent(clubIdInput)}&deleted=eq.false&select=id`,
          { headers: { apikey: window.SUPA_ANON, Authorization: `Bearer ${window.SUPA_ANON}` } }
        );
        if (res.ok) {
          const rows = await res.json();
          if (rows.length > 0) {
            clubId = clubIdInput;
            console.log('✅ Usuario encontrado en club:', clubId);
            showToast('✅ Acceso rápido exitoso');
          } else {
            console.warn('⚠️ Usuario no encontrado en el club proporcionado');
            showToast('⚠️ Club ID incorrecto, buscando automáticamente...');
          }
        }
      } catch (directError) {
        console.warn('⚠️ Error en login directo:', directError.message);
        showToast('⚠️ Buscando club automáticamente...');
      }
    }
    
    // 3️⃣ Si no se encontró con clubId directo, buscar automáticamente
    if (!clubId) {
      console.log('🔍 Buscando club automáticamente...');
      showToast('🔍 Buscando tu club...');
      clubId = await getClubIdForUser(email);
    }
    
    if (!clubId) {
      showToast('❌ No se encontró tu club. Verifica el ID o contacta al administrador.');
      return;
    }

    // 4️⃣ Reparar/actualizar mapeo para login multi-dispositivo
    const mappingSaved = await saveUserClubMapping(email, clubId, firebaseUid);
    if (!mappingSaved) {
      console.warn('⚠️ No se pudo guardar mapeo en login');
    }

    // 5️⃣ Guardar clubId en localStorage
    localStorage.setItem('clubId', clubId);
    console.log('✅ clubId guardado:', clubId);

    // 🆕 6️⃣ VERIFICAR Y REGISTRAR USUARIO EN LA SUBCOLECCIÓN / TABLA
    console.log('🔍 Verificando si usuario está registrado en users...');

    try {
      const checkRes = await fetch(
        `${window.SUPA_URL}/rest/v1/users?id=eq.${encodeURIComponent(firebaseUid)}&club_id=eq.${encodeURIComponent(clubId)}&select=id`,
        { headers: { apikey: window.SUPA_ANON, Authorization: `Bearer ${window.SUPA_ANON}` } }
      );
      if (checkRes.ok) {
        const rows = await checkRes.json();
        if (rows.length === 0) {
          console.log('⚠️ Usuario NO está en Supabase users, registrando...');
          showToast('🔧 Configurando acceso...');
          await fetch(`${window.SUPA_URL}/rest/v1/users`, {
            method: 'POST',
            headers: { apikey: window.SUPA_ANON, Authorization: `Bearer ${window.SUPA_ANON}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
            body: JSON.stringify({
              id: firebaseUid,
              club_id: clubId,
              email: email,
              name: window.APP_STATE.currentUser?.displayName || email.split('@')[0],
              is_main_admin: false,
              deleted: false,
              created_at: new Date().toISOString()
            })
          });
          console.log('✅ Usuario registrado en Supabase');
        } else {
          console.log('✅ Usuario ya existe en Supabase');
        }
      }
    } catch (registerError) {
      console.error('❌ Error al verificar/registrar usuario:', registerError);
      // Continuar de todos modos
    }

    // 7️⃣ Descargar todos los datos del club.
    //    force:true → en login fresco NO reutilizar caché LOCAL-FIRST: rebajar SIEMPRE
    //    users (perfil, is_main_admin, lista de la escuela) y clubs (logo/nombre) con el JWT.
    //    Sin esto, al cerrar/volver a entrar rápido, la caché incompleta deja sin perfil/logo.
    const downloaded = await downloadAllClubData(clubId, { force: true });

    if (downloaded) {
      // 8️⃣ Buscar usuario en la lista descargada
      const users = getUsers();
      let user = users.find(u => normalizeUserEmail(u.email) === email);

      // ✅ Fallback: si no lo encuentra localmente, construir sesión desde Firebase
      if (!user) {
        console.warn('⚠️ Usuario no en la lista descargada — usando el perfil leído en el login');
        const _cu = window.APP_STATE.currentUser || {};
        user = {
          id: firebaseUid,
          email: email,
          name: _cu.name || _cu.displayName || email.split('@')[0],
          schoolId: clubId,
          role: 'admin',
          isMainAdmin: _cu.isMainAdmin || false,
          avatar: _cu.avatar || '',
          phone: _cu.phone || ''
        };
      }

      // Establecer sesión
      const { password: _, ...userWithoutPassword } = user;
      setCurrentUser(userWithoutPassword);

      // audit_log deshabilitado — evita escrituras Firestore innecesarias en cada login

      showToast('✅ Bienvenido ' + user.name);

      // Redireccionar al dashboard
      setTimeout(() => {
        window.location.href = 'index.html';
      }, 500);

      
    } else {
      showToast('❌ Error al descargar datos del club');
    }
    
  } catch (error) {
    console.error('❌ Error en login:', error);
    showToast('❌ No se pudo iniciar sesión. Revisá tu conexión e intentá de nuevo.');
  }
});

document.getElementById('registerForm')?.addEventListener('submit', async function(e) {
  e.preventDefault();
  
  // ========================================
  // 🔐 VALIDACIÓN DE CÓDIGO DE ACTIVACIÓN
  // ========================================
  const activationCode = document.getElementById('regActivationCode')?.value.trim().toUpperCase();
  
  if (!activationCode) {
    showToast('❌ El código de activación es obligatorio');
    return;
  }
  
  if (!/^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(activationCode)) {
    showToast('❌ Formato de código inválido (XXXX-XXXX)');
    return;
  }
  
  showToast('⏳ Validando código...');
  
  if (typeof validateActivationCode !== 'function') {
    showToast('❌ Error: Recarga la página');
    return;
  }
  
  // La validación AUTORITATIVA del código la hace la Edge Function register-club
  // (server-side, service role). Acá ya se validó el FORMATO arriba; no se consulta
  // la BD con la anon key (bloqueada por RLS). register-club devuelve el error exacto
  // si el código es inválido, ya usado o expirado.
  const activationPlan = null;
  const codeValidation = { valid: true, source: 'supabase', data: { plan: null } };
  // ========================================
  
  // ========================================
  // ========================================
  // DATOS DEL CLUB
  // ========================================
  const clubLogoFile = document.getElementById('regClubLogo').files[0];
  const clubName = document.getElementById('regClubName').value.trim();
  
  // ⭐ NORMALIZACIÓN DE TELÉFONOS DEL CLUB
  const clubPhone = normalizePhone(document.getElementById('regClubPhone')?.value.trim() || '');
  const clubAddress = document.getElementById('regClubAddress')?.value.trim() || '';
  const clubCity = document.getElementById('regClubCity')?.value.trim() || '';
  const clubCountry = document.getElementById('regClubCountry')?.value.trim() || '';
  const clubWebsite = document.getElementById('regClubWebsite')?.value.trim() || '';
  const clubSocial = document.getElementById('regClubSocial')?.value.trim() || '';
  const clubFoundedYear = document.getElementById('regClubFoundedYear')?.value.trim() || '';
  
  // ========================================
  // DATOS DEL ADMINISTRADOR PRINCIPAL
  // ========================================
  const adminAvatarFile = document.getElementById('regAdminAvatar').files[0];
  const adminName = document.getElementById('regAdminName').value.trim();
  const adminBirthDate = document.getElementById('regAdminBirthDate')?.value || '';
  
  // ⭐ NORMALIZACIÓN DE TELÉFONO DEL ADMIN
  const adminPhone = normalizePhone(document.getElementById('regAdminPhone')?.value.trim() || '');
  const adminEmail = normalizeUserEmail(document.getElementById('regAdminEmail').value);
  const adminPassword = document.getElementById('regAdminPassword').value;
  
  // ========================================
  // VALIDACIONES
  // ========================================
  if (!clubName) {
    showToast('❌ El nombre del club es obligatorio');
    return;
  }
  
  if (!adminName || !adminEmail || !adminPassword) {
    showToast('❌ Por favor completa los datos del administrador');
    return;
  }
  
  if (adminPassword.length < 8) {
    showToast('❌ La contraseña debe tener al menos 8 caracteres');
    return;
  }
  
  // Validar que el email no esté registrado localmente
  const users = getUsers();
  if (users.find(u => normalizeUserEmail(u.email) === adminEmail)) {
    showToast('❌ Este email ya está registrado');
    return;
  }

  // ========================================
  // FUNCIÓN PRINCIPAL DE REGISTRO
  // ========================================
  const completeRegistrationV2 = async (clubLogoFile, adminAvatarFile) => {
    // 1) Resolver club_id (personalizado o automático)
    const customClubIdInput = document.getElementById('regClubId')?.value.trim() || '';
    let clubId;
    if (customClubIdInput) {
      clubId = formatClubId(customClubIdInput);
      if (!clubId || clubId.length < 3) { showToast('❌ El ID del club debe tener al menos 3 caracteres válidos'); return; }
      if (clubId.length > 30) { showToast('❌ El ID del club no puede tener más de 30 caracteres'); return; }
      showToast('🔍 Verificando disponibilidad del ID...');
      try {
        const exists = await checkClubIdExists(clubId);
        if (exists) { showToast('❌ Este ID de club ya está en uso. Elige otro.'); return; }
      } catch (e) { /* si la verificación falla, register-club igual valida el ID server-side */ }
    } else {
      clubId = 'club_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6);
    }

    const monthlyFee = document.getElementById('regMonthlyFee')?.value.trim() || '50000';
    const clubCurrency = document.getElementById('regClubCurrency')?.value || 'COP';
    const clubColor = document.getElementById('regClubColor')?.value || '#0d9488';

    // 2) Subir imágenes a Supabase Storage (best-effort; fallback a imagen por defecto)
    let finalClubLogo = (typeof getDefaultLogo === 'function') ? getDefaultLogo() : '';
    let finalAdminAvatar = (typeof getDefaultAvatar === 'function') ? getDefaultAvatar() : '';
    showToast('⏳ Preparando imágenes...');
    try {
      if (clubLogoFile && typeof uploadAvatarToStorage === 'function') {
        const res = await uploadAvatarToStorage(clubLogoFile, 'logo', clubId, 'logo');
        finalClubLogo = res.url;
      }
    } catch (err) { console.warn('⚠️ Falló subida de logo (se usa default):', err); }
    try {
      if (adminAvatarFile && typeof uploadAvatarToStorage === 'function') {
        const res = await uploadAvatarToStorage(adminAvatarFile, 'admin_' + Date.now(), clubId, 'admin');
        finalAdminAvatar = res.url;
      }
    } catch (err) { console.warn('⚠️ Falló subida de avatar admin (se usa default):', err); }

    // 3) Registro server-side: valida código + crea club + admin + licencia + marca código
    showToast('🔐 Creando tu club...');
    let regData;
    try {
      const regRes = await fetch(`${window.SUPA_URL}/functions/v1/register-club`, {
        method: 'POST',
        headers: { apikey: window.SUPA_ANON, Authorization: `Bearer ${window.SUPA_ANON}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: activationCode,
          club: {
            id: clubId, name: clubName, logo: finalClubLogo,
            email: adminEmail, phone: clubPhone, address: clubAddress,
            city: clubCity, country: clubCountry,
            monthly_fee: parseFloat(monthlyFee) || 0, currency: clubCurrency, primary_color: clubColor
          },
          admin: {
            name: adminName, email: adminEmail, password: adminPassword,
            phone: adminPhone, birth_date: adminBirthDate, avatar: finalAdminAvatar
          }
        })
      });
      regData = await regRes.json().catch(() => ({}));
      if (!regRes.ok || !regData.ok) {
        showToast('❌ ' + (regData.error || 'No se pudo completar el registro'));
        return;
      }
    } catch (err) {
      console.error('❌ Error llamando register-club:', err);
      showToast('❌ Error de conexión al crear el club. Intenta de nuevo.');
      return;
    }

    const userId = regData.user_id;
    console.log('✅ Club creado server-side:', clubId, '| plan:', regData.plan);

    // 4) Iniciar sesión con Supabase Auth (email+password)
    showToast('🔗 Iniciando sesión...');
    if (window.SupaAuthV2 && typeof window.SupaAuthV2.login === 'function') {
      try {
        console.log('[AUTH] Ejecutando auto-login en Supabase Auth...');
        // Token del CAPTCHA del registro (fail-open) para que el auto-login pase
        // cuando CAPTCHA esté activo en Supabase.
        const _regToken = (window.turnstile && typeof window.turnstile.getResponse === 'function' && document.getElementById('cfRegister'))
          ? (window.turnstile.getResponse(document.getElementById('cfRegister')) || '') : '';
        await window.SupaAuthV2.login(adminEmail, adminPassword, _regToken);
        console.log('[AUTH] Auto-login exitoso');
      }
      catch (e) {
        console.warn('Login post-registro falló (podrá loguear manualmente):', e);
      }
    }

    // 5) Estado local + settings + sesión + UI
    const clubSettings = {
      schoolId: clubId, name: clubName, clubId: clubId, logo: finalClubLogo,
      email: adminEmail, phone: clubPhone, address: clubAddress, city: clubCity,
      country: clubCountry, website: clubWebsite, socialMedia: clubSocial,
      foundedYear: clubFoundedYear, monthlyFee: monthlyFee, currency: clubCurrency,
      primaryColor: clubColor
    };

    const newUser = {
      id: userId, schoolId: clubId, email: adminEmail, name: adminName,
      birthDate: adminBirthDate, phone: adminPhone, avatar: finalAdminAvatar,
      role: 'admin', isMainAdmin: true,
      createdAt: (typeof getCurrentDateTime === 'function' ? getCurrentDateTime() : new Date().toISOString())
    };
    if (typeof saveUser === 'function') saveUser(newUser);

    localStorage.setItem('clubId', clubId);
    localStorage.removeItem('schoolSettings');
    if (typeof saveSchoolSettings === 'function') saveSchoolSettings(clubSettings);

    const { password: _pw, ...userWithoutPassword } = newUser;
    if (typeof setCurrentUser === 'function') setCurrentUser(userWithoutPassword);

    if (typeof generatePWAIcons === 'function') { try { generatePWAIcons(); } catch (e) {} }

    showToast('✅ Club creado exitosamente');
    if (typeof showClubIdToUser === 'function') showClubIdToUser(clubId, clubName);
  };

  // Iniciar proceso
  completeRegistrationV2(clubLogoFile, adminAvatarFile);
});

// ✅ FUNCIÓN: Mostrar Club ID al usuario con opción de copiar
function showClubIdToUser(clubId, clubName) {
  // Crear modal
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
  modal.innerHTML = `
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6 animate-fade-in">
      <div class="text-center">
        <!-- Icono -->
        <div class="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-teal-100 dark:bg-teal-900 mb-4">
          <svg class="h-8 w-8 text-teal-600 dark:text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
        </div>
        
        <!-- Título -->
        <h3 class="text-xl font-bold text-gray-900 dark:text-white mb-2">
          ¡Club Creado Exitosamente!
        </h3>
        
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
          ${clubName}
        </p>
        
        <!-- Club ID -->
        <div class="bg-gray-100 dark:bg-gray-700 rounded-lg p-4 mb-4">
          <p class="text-xs text-gray-600 dark:text-gray-400 mb-2 font-semibold">
            🔑 ID DE TU CLUB (Guárdalo)
          </p>
          <div class="flex items-center justify-center gap-2">
            <code id="clubIdDisplay" class="text-lg font-mono font-bold text-teal-600 dark:text-teal-400">
              ${clubId}
            </code>
            <button 
              onclick="copyClubId('${clubId}')" 
              class="p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
              title="Copiar Club ID"
            >
              <svg class="h-5 w-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
              </svg>
            </button>
          </div>
        </div>
        
        <!-- Información -->
        <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
          <p class="text-sm text-blue-800 dark:text-blue-300 text-left">
            <strong>💡 Consejo:</strong>
            <br>
            • Anota este ID en un lugar seguro
            <br>
            • Úsalo para login más rápido
            <br>
            • Compártelo con otros administradores
          </p>
        </div>
        
        <!-- Botón Continuar -->
        <button 
          onclick="closeClubIdModal()" 
          class="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3 rounded-lg transition-colors"
        >
          Entendido, Continuar
        </button>
      </div>
    </div>
  `;
  
  modal.id = 'clubIdModal';
  document.body.appendChild(modal);
  
  // Agregar estilos para animación
  const style = document.createElement('style');
  style.textContent = `
    @keyframes fade-in {
      from {
        opacity: 0;
        transform: scale(0.95);
      }
      to {
        opacity: 1;
        transform: scale(1);
      }
    }
    .animate-fade-in {
      animation: fade-in 0.3s ease-out;
    }
  `;
  document.head.appendChild(style);
}

// ✅ FUNCIÓN: Copiar Club ID al portapapeles
function copyClubId(clubId) {
  navigator.clipboard.writeText(clubId).then(() => {
    showToast('✅ Club ID copiado al portapapeles');
    
    // Animación visual
    const displayElement = document.getElementById('clubIdDisplay');
    if (displayElement) {
      displayElement.classList.add('animate-pulse');
      setTimeout(() => {
        displayElement.classList.remove('animate-pulse');
      }, 500);
    }
  }).catch(err => {
    console.error('Error al copiar:', err);
    showToast('⚠️ No se pudo copiar. Anótalo manualmente.');
  });
}
// ✅ FUNCIÓN CORREGIDA: Cerrar modal y redirigir a index.html
function closeClubIdModal() {
  const modal = document.getElementById('clubIdModal');
  if (modal) {
    modal.remove();
  }
  
  console.log('🔄 Cerrando modal y preparando redirección...');
  
  // Verificar que la sesión se guardó correctamente
  const currentUser = getCurrentUser();
  
  if (currentUser) {
    console.log('✅ Usuario autenticado:', maskEmail(currentUser.email));
    console.log('📋 Club ID:', localStorage.getItem('clubId'));
    
    showToast('✅ Redirigiendo al dashboard...');
    
    // Redirigir a index.html donde está el dashboard
    setTimeout(() => {
      window.location.href = 'index.html';
    }, 500);
    
  } else {
    console.error('❌ ERROR: No se encontró usuario en sesión');
    console.error('❌ Contenido localStorage:', {
      currentUser: localStorage.getItem('currentUser'),
      clubId: localStorage.getItem('clubId')
    });
    
    showToast('⚠️ Error de sesión. Recargando...');
    
    setTimeout(() => {
      window.location.reload();
    }, 2000);
  }
}


// ✅ FUNCIONES PARA MOSTRAR CLUB ID EN DASHBOARD
function displayClubIdInDashboard() {
  const clubId = localStorage.getItem('clubId') || getSchoolSettings()?.clubId;
  
  if (clubId) {
    // Llenar en configuración
    const dashboardElement = document.getElementById('dashboardClubId');
    if (dashboardElement) {
      dashboardElement.textContent = clubId;
    }
    
    // Llenar en navbar
    const navbarElement = document.getElementById('navbarClubId');
    if (navbarElement) {
      navbarElement.textContent = clubId;
    }
  }
}

function copyDashboardClubId() {
  const clubId = document.getElementById('dashboardClubId')?.textContent;
  if (clubId) {
    navigator.clipboard.writeText(clubId).then(() => {
      showToast('✅ Club ID copiado');
    }).catch(() => {
      showToast('⚠️ No se pudo copiar');
    });
  }
}

function copyNavbarClubId() {
  const clubId = document.getElementById('navbarClubId')?.textContent;
  if (clubId) {
    navigator.clipboard.writeText(clubId).then(() => {
      showToast('✅ Club ID copiado');
    }).catch(() => {
      showToast('⚠️ No se pudo copiar');
    });
  }
}

// Logout - Limpia TODO al cerrar sesión (solo cuando el usuario lo pide)
async function logout() {
  if (await confirmAction('¿Estás seguro de cerrar sesión?', { type: 'warning', title: 'Cerrar sesión' })) {
    try {
      // Limpiar JWT de Supabase del usuario (v1 y v2) — vuelve a anon hasta el próximo login
      if (window.SupaAuth)   window.SupaAuth.clear();
      if (window.SupaAuthV2) { try { await window.SupaAuthV2.logout(); } catch (_) {} }

      // Cancelar listeners antes de salir
      if (typeof window.userDeletionUnsubscribe === 'function') {
        window.userDeletionUnsubscribe();
        window.userDeletionUnsubscribe = null;
      }
      if (typeof window.licenseUnsubscribe === 'function') {
        window.licenseUnsubscribe();
        window.licenseUnsubscribe = null;
      }

      // Limpiar TODA la sesión local
      clearCurrentUser();
      localStorage.removeItem('clubId');
      localStorage.removeItem('players');
      localStorage.removeItem('payments');
      localStorage.removeItem('calendarEvents');
      localStorage.removeItem('users');
      localStorage.removeItem('schoolSettings');
      localStorage.removeItem('_lastFullDownload'); // ← forzar descarga limpia en próximo login
      // Licencia/módulos del club anterior: limpiar para que otro club en el mismo
      // dispositivo NO herede módulos (fail-closed en los candados de pago).
      localStorage.removeItem('licenseModulos');
      localStorage.removeItem('licenseStatus');
      localStorage.removeItem('licensePlan');
      localStorage.removeItem('licenseEndDate');
      localStorage.removeItem('licenseGraceDays');
      // Aceptación de Términos: es POR CLUB. Si no se limpia, otro club en el
      // mismo dispositivo se saltaría el modal y no quedaría su consentimiento.
      localStorage.removeItem('termsAcceptedVersion');
      sessionStorage.clear();
      
      showToast('👋 Sesión cerrada');
      
      setTimeout(() => {
        window.location.href = 'login.html';
      }, 1000);
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
      showToast('⚠️ Error al cerrar sesión');
    }
  }
}

// Verificar sesión al cargar - VERSIÓN MEJORADA PARA MÓVILES
window.addEventListener('DOMContentLoaded', async function() {
  console.log('[AUTH] Verificando sesion al cargar...');
  
  const loginScreen = document.getElementById('loginScreen');
  const appContainer = document.getElementById('appContainer');
  
  // Función para mostrar loading
  function showLoading() {
    if (loginScreen) {
      const existingLoader = document.getElementById('sessionLoader');
      if (!existingLoader) {
        const loader = document.createElement('div');
        loader.id = 'sessionLoader';
        loader.className = 'fixed inset-0 bg-white dark:bg-gray-900 flex items-center justify-center z-50';
        loader.innerHTML = '<div class="text-center"><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500 mx-auto mb-4"></div><p class="text-gray-600 dark:text-gray-400">Verificando sesión...</p></div>';
        document.body.appendChild(loader);
      }
    }
  }
  
  // Función para ocultar loading
  function hideLoading() {
    const loader = document.getElementById('sessionLoader');
    if (loader) loader.remove();
  }
  
  // Función para mostrar la app
  function showApp() {
    hideLoading();
    if (loginScreen) loginScreen.classList.add('hidden');
    if (appContainer) appContainer.classList.remove('hidden');
    initApp();
  }
  
  // Función para mostrar login
  function showLogin() {
    hideLoading();
    if (loginScreen) loginScreen.classList.remove('hidden');
    if (appContainer) appContainer.classList.add('hidden');
  }
  
  // 1. Verificar sesión local INMEDIATAMENTE
  const currentUser = getCurrentUser();
  
  if (currentUser && currentUser.email) {
    console.log('[AUTH] Sesion local valida:', maskEmail(currentUser.email));
    if (!appContainer) {
      // Si estamos en login.html pero hay sesión, redirigir al dashboard
      window.location.href = 'index.html';
      return;
    }
    showApp();
    return;
  }
  
  console.log('[AUTH] No hay sesion local, verificando Supabase...');
  showLoading();

  // 2. Verificar sesión en Supabase Auth
  if (window.SupaAuthV2 && window.SupaAuthV2.isLogged()) {
    console.log('[AUTH] Supabase tiene sesión activa');
    const storedUser = getCurrentUser();
    if (storedUser && storedUser.email && storedUser.schoolId) {
      showApp();
      return;
    }
    showLogin();
    return;
  }

  // 3. No hay sesión
  showLogin();
});

// ========================================
// RECUPERACIÓN DE CONTRASEÑA
// ========================================

// ✅ FUNCIÓN MEJORADA: Recuperar contraseña con email
async function forgotPassword() {
  const modal = document.createElement('div');
  modal.id = 'resetPasswordModal';
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
  modal.innerHTML = `
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6 animate-fade-in">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-xl font-bold text-gray-900 dark:text-white">
          🔐 Recuperar Contraseña
        </h3>
        <button 
          onclick="closeResetModal()" 
          class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>

      <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Ingresa tu email y te enviaremos un enlace para restablecer tu contraseña.
      </p>

      <form id="resetPasswordForm" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            📧 Email
          </label>
          <input 
            type="email" 
            id="resetEmail" 
            required
            placeholder="tu@email.com"
            class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 dark:bg-gray-700 dark:text-white"
          >
        </div>

        <div id="resetMessage" class="hidden"></div>

        <div id="cfReset" style="display:flex;justify-content:center;margin:4px 0"></div>

        <div class="flex gap-3">
          <button 
            type="button" 
            onclick="closeResetModal()" 
            class="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Cancelar
          </button>
          <button 
            type="submit" 
            id="resetSubmitBtn"
            class="flex-1 bg-teal-600 hover:bg-teal-700 text-white font-medium py-2 rounded-lg transition-colors"
          >
            Enviar Enlace
          </button>
        </div>
      </form>
    </div>
  `;
  
  document.body.appendChild(modal);

  // Turnstile en el modal de reset (dinámico → render explícito). Fail-open:
  // si el widget/script no está, no se renderiza y el reset sigue funcionando
  // (Supabase lo ignora hasta que se active CAPTCHA en su panel).
  window._cfResetId = null;
  if (window.turnstile && typeof window.turnstile.render === 'function') {
    try {
      window._cfResetId = window.turnstile.render('#cfReset', {
        sitekey: '0x4AAAAAAD6O-vFleQZEjppC', theme: 'dark', action: 'recover'
      });
    } catch (e) { console.warn('[reset] turnstile render:', e && e.message); }
  }

  if (!document.getElementById('resetPasswordStyles')) {
    const style = document.createElement('style');
    style.id = 'resetPasswordStyles';
    style.textContent = `
      @keyframes fade-in {
        from {
          opacity: 0;
          transform: scale(0.95);
        }
        to {
          opacity: 1;
          transform: scale(1);
        }
      }
      .animate-fade-in {
animation: fade-in 0.3s ease-out;
}
`;
document.head.appendChild(style);
}
document.getElementById('resetPasswordForm').addEventListener('submit', handlePasswordReset);
setTimeout(() => {
document.getElementById('resetEmail').focus();
}, 100);
}
async function handlePasswordReset(e) {
e.preventDefault();
const email = document.getElementById('resetEmail').value.trim();
const submitBtn = document.getElementById('resetSubmitBtn');
const messageDiv = document.getElementById('resetMessage');
if (!email) {
showResetMessage('❌ Por favor ingresa tu email', 'error');
return;
}
const emailRegex = /^[^\s@]+@[^\s@]+.[^\s@]+$/;
if (!emailRegex.test(email)) {
showResetMessage('❌ Email no válido', 'error');
return;
}
submitBtn.disabled = true;
submitBtn.textContent = '⏳ Enviando...';
try {
// Reset vía SUPABASE Auth (camino post-cutover).
// El email lo emite Supabase con el template configurado en el dashboard.
// redirect_to → reset-password.html de ESTE mismo despliegue (sirve local y prod).
// Debe estar en la lista de redirect URLs permitidas de Supabase.
const _dir = window.location.origin + window.location.pathname.replace(/[^/]*$/, '');
const _redirectTo = _dir + 'reset-password.html';
// CAPTCHA (Turnstile) del modal si lo hay. Fail-open: sin token se manda igual.
const _captchaToken = (window.turnstile && window._cfResetId != null && typeof window.turnstile.getResponse === 'function')
  ? (window.turnstile.getResponse(window._cfResetId) || '') : '';
const _recoverBody = { email };
if (_captchaToken) _recoverBody.gotrue_meta_security = { captcha_token: _captchaToken };
const res = await fetch(`${window.SUPA_URL}/auth/v1/recover?redirect_to=${encodeURIComponent(_redirectTo)}`, {
  method: 'POST',
  headers: { apikey: window.SUPA_ANON, 'Content-Type': 'application/json' },
  body: JSON.stringify(_recoverBody)
});
if (!res.ok) {
  const data = await res.json().catch(() => ({}));
  throw new Error(data?.msg || data?.error_description || `HTTP ${res.status}`);
}
showResetMessage(
  `✅ ¡Email enviado! Revisa tu bandeja de entrada (${email}) y sigue las instrucciones para restablecer tu contraseña.`,
  'success'
);

document.getElementById('resetPasswordForm').querySelector('div').classList.add('hidden');
submitBtn.classList.add('hidden');

const cancelBtn = document.querySelector('#resetPasswordForm button[type="button"]');
cancelBtn.textContent = 'Cerrar';
cancelBtn.classList.remove('flex-1');
cancelBtn.classList.add('w-full');

setTimeout(() => {
  closeResetModal();
}, 5000);
} catch (error) {
  showResetMessage('❌ Error al enviar el email: ' + (error.message || 'Intenta de nuevo'), 'error');
  submitBtn.disabled = false;
  submitBtn.textContent = 'Enviar Enlace';
  }
}
function showResetMessage(message, type) {
const messageDiv = document.getElementById('resetMessage');
if (type === 'success') {
messageDiv.className = 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 text-sm text-green-800 dark:text-green-300';
} else {
messageDiv.className = 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-sm text-red-800 dark:text-red-300';
}
messageDiv.textContent = message;
messageDiv.classList.remove('hidden');
}
function closeResetModal() {
const modal = document.getElementById('resetPasswordModal');
if (modal) {
modal.remove();
}
}
document.addEventListener('click', function(e) {
const modal = document.getElementById('resetPasswordModal');
if (modal && e.target === modal) {
closeResetModal();
}
});


console.log('✅ auth.js cargado (CON NORMALIZACIÓN DE TELÉFONOS)');
