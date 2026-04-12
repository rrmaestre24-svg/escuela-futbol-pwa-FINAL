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
    console.log('[SESSION] Usuario guardado:', user.email);
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
  try {
    localStorage.setItem('schoolSettings', JSON.stringify(settings));
  } catch (error) {
    console.error('Error al guardar configuración:', error);
  }
}

// Actualizar configuración
function updateSchoolSettings(updates) {
  try {
    const current = getSchoolSettings() || {};
    const updated = { ...current, ...updates };
    saveSchoolSettings(updated);
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

// ✅ FUNCIÓN CORREGIDA: Verificar si el Club ID ya existe en Firebase
async function checkClubIdExists(clubId) {
  if (!window.firebase?.db) {
    console.warn('⚠️ Firebase no disponible para verificar Club ID');
    return false;
  }
  
  try {
    // ✅ RUTA CORRECTA: verificar el documento de settings que SÍ se crea al registrar
    // (el documento raíz clubs/{clubId} nunca se crea explícitamente)
    const settingsRef = window.firebase.doc(
      window.firebase.db, `clubs/${clubId}/settings`, 'main'
    );
    const settingsSnap = await window.firebase.getDoc(settingsRef);
    if (settingsSnap.exists()) {
      console.log('❌ Club ID ya existe (settings):', clubId);
      return true;
    }

    // ✅ También verificar en 'licenses' (fallback)
    const licenseRef = window.firebase.doc(window.firebase.db, 'licenses', clubId);
    const licenseSnap = await window.firebase.getDoc(licenseRef);
    if (licenseSnap.exists()) {
      console.log('❌ Club ID ya existe (licenses):', clubId);
      return true;
    }

    console.log('✅ Club ID disponible:', clubId);
    return false;
  } catch (error) {
    console.error('❌ Error al verificar Club ID:', error);
    return false;
  }
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

  // Escuchar en tiempo real si el documento del usuario fue eliminado.
  // Si el admin principal elimina este usuario, el listener lo detecta al instante
  // y fuerza el cierre de sesión sin esperar a que recargue la página.
  const clubId = localStorage.getItem('clubId');
  if (clubId && user?.id && window.firebase?.db && window.firebase?.onSnapshot) {
    const userDocRef = window.firebase.doc(window.firebase.db, `clubs/${clubId}/users`, user.id);
    // Guardar el unsuscribe para no crear listeners duplicados en re-renders
    if (window._userDocListener) window._userDocListener();
    function forceLogout() {
      console.warn('⚠️ Usuario eliminado por el admin. Cerrando sesión...');
      localStorage.removeItem('currentUser');
      localStorage.removeItem('clubId');
      sessionStorage.clear();
      if (window.firebase?.auth) {
        window.firebase.signOut(window.firebase.auth).catch(() => {});
      }
      window.location.href = 'login.html';
    }

    window._userDocListener = window.firebase.onSnapshot(userDocRef, (snap) => {
      // Caso 1: Firestore entregó el evento y el doc no existe → eliminado
      if (!snap.exists()) forceLogout();
    }, (err) => {
      // Caso 2: Firestore denegó el acceso porque el doc fue eliminado y las reglas
      // ya no permiten la lectura (isMemberOfClub retorna false) → también es eliminación
      if (err.code === 'permission-denied') {
        forceLogout();
      } else {
        // Otro error (ej. sin conexión) — no cerrar sesión, solo loguear
        console.warn('⚠️ Error en listener de usuario:', err.message);
      }
    });
  }

  // Cargar contenido del dashboard si existe
  if (typeof loadDashboard === 'function') {
    loadDashboard();
  }
}

// ========================================
// CÓDIGO ORIGINAL DE AUTH.JS
// ========================================

// ✅ FUNCIÓN AUXILIAR: Esperar a que Firebase esté listo
async function waitForFirebase(maxAttempts = 10) {
  for (let i = 0; i < maxAttempts; i++) {
    if (window.APP_STATE?.firebaseReady && window.firebase?.auth) {
      console.log('✅ Firebase está listo');
      return true;
    }
    console.log(`⏳ Esperando Firebase... intento ${i + 1}/${maxAttempts}`);
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  console.error('❌ Firebase no se inicializó después de esperar');
  return false;
}

// ✅ FUNCIÓN CRÍTICA: Guardar mapeo email → clubId en Firebase
async function saveUserClubMapping(email, clubId, uid) {
  if (!window.firebase?.db) {
    console.warn('⚠️ Firebase no disponible para guardar mapeo');
    return false;
  }
  
  try {
    console.log('💾 Guardando mapeo:', email, '→', clubId);
    
    await window.firebase.setDoc(
      window.firebase.doc(window.firebase.db, 'userClubMapping', email),
      {
        email: email,
        clubId: clubId,
        uid: uid,
        updatedAt: new Date().toISOString()
      }
    );
    
    console.log('✅ Mapeo guardado exitosamente');
    return true;
  } catch (error) {
    console.error('❌ Error al guardar mapeo:', error);
    return false;
  }
}

// ✅ FUNCIÓN MEJORADA: Obtener clubId desde múltiples fuentes
async function getClubIdForUser(email) {
  try {
    console.log('🔍 Buscando clubId para:', email);
    
    // 1️⃣ PRIMERA OPCIÓN: localStorage (más rápido)
    const storedClubId = localStorage.getItem('clubId');
    if (storedClubId) {
      console.log('✅ clubId encontrado en localStorage:', storedClubId);
      return storedClubId;
    }

    // 2️⃣ SEGUNDA OPCIÓN: Usuarios locales
    const users = getUsers();
    const localUser = users.find(u => u.email === email);
    if (localUser && localUser.schoolId) {
      localStorage.setItem('clubId', localUser.schoolId);
      console.log('✅ clubId recuperado de usuario local:', localUser.schoolId);
      return localUser.schoolId;
    }

    // 3️⃣ TERCERA OPCIÓN: Firebase (crítico para multi-dispositivo)
    console.log('🔥 Buscando clubId en Firebase...');
    
    if (window.firebase?.db) {
      const userMappingRef = window.firebase.doc(
        window.firebase.db, 
        'userClubMapping', 
        email
      );
      
      const mappingSnap = await window.firebase.getDoc(userMappingRef);
      
      if (mappingSnap.exists()) {
        const data = mappingSnap.data();
        const clubId = data.clubId;
        
        // Guardar en localStorage para próximas veces
        localStorage.setItem('clubId', clubId);
        
        console.log('✅ clubId encontrado en Firebase:', clubId);
        return clubId;
      } else {
        console.log('⚠️ No existe mapeo en Firebase para:', email);
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
async function downloadAllClubData(clubId) {
  if (!window.APP_STATE?.firebaseReady || !window.firebase?.auth?.currentUser) {
    console.warn('⚠️ Firebase no está listo o no hay usuario autenticado');
    return false;
  }

  if (!clubId) {
    console.error('❌ clubId es requerido para descargar datos');
    showToast('❌ Error: No se encontró el ID del club');
    return false;
  }

  try {
    console.log('🔥 Descargando datos del club:', clubId);
    showToast('🔥 Sincronizando datos...');

    // 1️⃣ Configuración del club
    const settingsRef = window.firebase.doc(
      window.firebase.db, 
      `clubs/${clubId}/settings`, 
      "main"
    );
    const settingsSnap = await window.firebase.getDoc(settingsRef);
    
    if (!settingsSnap.exists()) {
      console.log('⚠️ No hay configuración en Firebase para este club');
      showToast('⚠️ No se encontraron datos del club');
      return false;
    }

    const clubSettings = settingsSnap.data();
    saveSchoolSettings(clubSettings);
    console.log('✅ Configuración descargada');

    // 2️⃣ Jugadores
    const playersSnapshot = await window.firebase.getDocs(
      window.firebase.collection(window.firebase.db, `clubs/${clubId}/players`)
    );
    
    const players = [];
    playersSnapshot.forEach(doc => {
      players.push({ id: doc.id, ...doc.data() });
    });
    
    saveAllPlayers(players);
    console.log(`✅ ${players.length} jugadores descargados`);

    // 3️⃣ Pagos
    const paymentsSnapshot = await window.firebase.getDocs(
      window.firebase.collection(window.firebase.db, `clubs/${clubId}/payments`)
    );
    
    const payments = [];
    paymentsSnapshot.forEach(doc => {
      payments.push({ id: doc.id, ...doc.data() });
    });
    
    localStorage.setItem('payments', JSON.stringify(payments));
    console.log(`✅ ${payments.length} pagos descargados`);

    // 4️⃣ Eventos
    const eventsSnapshot = await window.firebase.getDocs(
      window.firebase.collection(window.firebase.db, `clubs/${clubId}/events`)
    );
    
    const events = [];
    eventsSnapshot.forEach(doc => {
      events.push({ id: doc.id, ...doc.data() });
    });
    
    localStorage.setItem('calendarEvents', JSON.stringify(events));
    console.log(`✅ ${events.length} eventos descargados`);

    // 5️⃣ Usuarios del club
    const usersRef = window.firebase.collection(
      window.firebase.db, 
      `clubs/${clubId}/users`
    );
    const usersSnapshot = await window.firebase.getDocs(usersRef);
    
    const clubUsers = [];
    usersSnapshot.forEach(doc => {
      const user = doc.data();
      clubUsers.push({
        id: user.id,
        schoolId: clubId,
        email: user.email,
        name: user.name,
        isMainAdmin: user.isMainAdmin || false,
        role: user.role || 'admin',
        avatar: user.avatar || '',
        phone: user.phone || '',
        birthDate: user.birthDate || '',
        password: 'encrypted',
        createdAt: user.createdAt || user.joinedAt || new Date().toISOString()
      });
    });
    
    localStorage.setItem('users', JSON.stringify(clubUsers));
    console.log(`✅ ${clubUsers.length} usuarios descargados`);

    // 6️⃣ Egresos
    const expensesSnapshot = await window.firebase.getDocs(
      window.firebase.collection(window.firebase.db, `clubs/${clubId}/expenses`)
    );

    const expenses = [];
    expensesSnapshot.forEach(doc => {
      expenses.push({ id: doc.id, ...doc.data() });
    });

    localStorage.setItem('expenses', JSON.stringify(expenses));
    console.log(`✅ ${expenses.length} egresos descargados`);

    // 7️⃣ Otros ingresos (terceros)
    const thirdPartySnapshot = await window.firebase.getDocs(
      window.firebase.collection(window.firebase.db, `clubs/${clubId}/thirdPartyIncomes`)
    );

    const thirdPartyIncomes = [];
    thirdPartySnapshot.forEach(doc => {
      thirdPartyIncomes.push({ id: doc.id, ...doc.data() });
    });

    localStorage.setItem('thirdPartyIncomes', JSON.stringify(thirdPartyIncomes));
    console.log(`✅ ${thirdPartyIncomes.length} otros ingresos descargados`);

    showToast('✅ Datos sincronizados correctamente');
    return true;
  } catch (error) {
    console.error('❌ Error al descargar datos:', error);
    showToast('⚠️ Error al descargar datos: ' + error.message);
    return false;
  }
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
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  
  if (!email || !password) {
    showToast('❌ Por favor completa todos los campos obligatorios');
    return;
  }
  
  console.log('🔐 Iniciando login para:', email);
  if (clubIdInput) {
    console.log('⚡ Club ID proporcionado:', clubIdInput, '(login rápido)');
  } else {
    console.log('🔍 Club ID no proporcionado, se buscará automáticamente');
  }
  
  // Esperar a que Firebase esté listo
  const firebaseReady = await waitForFirebase();
  
  if (!firebaseReady || !window.firebase?.auth) {
    showToast('❌ No se pudo conectar con Firebase. Recarga la página.');
    return;
  }
  
  try {
    showToast('🔐 Verificando credenciales...');
    
    // 1️⃣ Autenticar con Firebase
    const userCredential = await window.firebase.signInWithEmailAndPassword(
      window.firebase.auth,
      email,
      password
    );
    
    console.log('✅ Autenticado en Firebase');
    window.APP_STATE.currentUser = userCredential.user;
    const firebaseUid = userCredential.user.uid;
    
    let clubId = null;
    
    // 2️⃣ Si proporcionó clubId, intentar login directo
    if (clubIdInput) {
      console.log('⚡ Intentando login directo con clubId:', clubIdInput);
      
      try {
        const userInClubRef = window.firebase.doc(
          window.firebase.db,
          `clubs/${clubIdInput}/users`,
          firebaseUid
        );
        
        const userInClubSnap = await window.firebase.getDoc(userInClubRef);
        
        if (userInClubSnap.exists()) {
          clubId = clubIdInput;
          console.log('✅ Usuario encontrado en club:', clubId);
          showToast('✅ Acceso rápido exitoso');
        } else {
          console.warn('⚠️ Usuario no encontrado en el club proporcionado');
          showToast('⚠️ Club ID incorrecto, buscando automáticamente...');
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
      await window.firebase.signOut(window.firebase.auth);
      return;
    }

    // 4️⃣ Guardar clubId en localStorage
    localStorage.setItem('clubId', clubId);
    console.log('✅ clubId guardado:', clubId);

    // 🆕 5️⃣ VERIFICAR Y REGISTRAR USUARIO EN LA SUBCOLECCIÓN
    console.log('🔍 Verificando si usuario está registrado en club/users...');
    
    try {
      const userInClubRef = window.firebase.doc(
        window.firebase.db,
        `clubs/${clubId}/users`,
        firebaseUid
      );
      
      const userInClubDoc = await window.firebase.getDoc(userInClubRef);
      
      if (!userInClubDoc.exists()) {
        console.log('⚠️ Usuario NO está en club/users, registrando...');
        showToast('🔧 Configurando acceso...');
        
        // Registrar usuario en la subcolección
        await window.firebase.setDoc(userInClubRef, {
          id: firebaseUid,
          email: email,
          name: userCredential.user.displayName || email.split('@')[0],
          isMainAdmin: false, // Por defecto false
          role: 'admin',
          avatar: '',
          phone: '',
          birthDate: '',
          joinedAt: new Date().toISOString()
        });
        
        console.log('✅ Usuario registrado en club/users');
      } else {
        console.log('✅ Usuario ya existe en club/users');
      }
    } catch (registerError) {
      console.error('❌ Error al verificar/registrar usuario:', registerError);
      // Continuar de todos modos
    }

    // 6️⃣ Descargar todos los datos del club
    const downloaded = await downloadAllClubData(clubId);

    if (downloaded) {
      // 7️⃣ Buscar usuario en la lista descargada
      const users = getUsers();
      let user = users.find(u => u.email === email);

      // ✅ Fallback: si no lo encuentra localmente, construir sesión desde Firebase
      if (!user) {
        console.warn('⚠️ Usuario no encontrado localmente, usando datos de Firebase Auth');
        user = {
          id: firebaseUid,
          email: email,
          name: userCredential.user.displayName || email.split('@')[0],
          schoolId: clubId,
          role: 'admin',
          isMainAdmin: false,
          avatar: '',
          phone: ''
        };
      }

      // Actualizar password local si existe en lista
      if (users.find(u => u.email === email)) {
        updateUser(user.id, { password: password });
      }

      // Establecer sesión
      const { password: _, ...userWithoutPassword } = user;
      setCurrentUser(userWithoutPassword);

      // Registrar acceso en audit_log para estadísticas del super admin
      // No se espera (sin await) para no retrasar el login
      try {
        const now = new Date();
        window.firebase.addDoc(
          window.firebase.collection(window.firebase.db, `clubs/${clubId}/audit_log`),
          {
            action: 'login',
            userEmail: email,
            userName: user.name || email,
            role: user.role || 'admin',
            date: now.toISOString().split('T')[0],
            timestamp: now.toISOString()
          }
        );
      } catch(e) {}

      showToast('✅ Bienvenido ' + user.name);

      // Redireccionar al dashboard
      setTimeout(() => {
        window.location.href = 'index.html';
      }, 500);

      
    } else {
      showToast('❌ Error al descargar datos del club');
      await window.firebase.signOut(window.firebase.auth);
    }
    
  } catch (authError) {
    console.error('❌ Error de autenticación:', authError);
    
    if (authError.code === 'auth/invalid-credential' || authError.code === 'auth/wrong-password') {
      showToast('❌ Email o contraseña incorrectos');
    } else if (authError.code === 'auth/user-not-found') {
      showToast('❌ Usuario no encontrado');
    } else if (authError.code === 'auth/too-many-requests') {
      showToast('❌ Demasiados intentos. Intenta más tarde.');
    } else if (authError.code === 'auth/network-request-failed') {
      showToast('❌ Error de conexión. Verifica tu internet.');
    } else {
      showToast('❌ Error: ' + authError.message);
    }
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
  
  const codeValidation = await validateActivationCode(activationCode);
  
  if (!codeValidation.valid) {
    showToast('❌ ' + codeValidation.error);
    return;
  }
  
  console.log('✅ Código válido:', codeValidation.data);
  const activationPlan = codeValidation.data.plan;
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
  const adminEmail = document.getElementById('regAdminEmail').value.trim();
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
  
  if (adminPassword.length < 6) {
    showToast('❌ La contraseña debe tener al menos 6 caracteres');
    return;
  }
  
  // Validar que el email no esté registrado localmente
  const users = getUsers();
  if (users.find(u => u.email === adminEmail)) {
    showToast('❌ Este email ya está registrado');
    return;
  }

  // ========================================
  // PROCESAR IMÁGENES CON COMPRESIÓN
  // ========================================
  const processClubData = () => {
    if (clubLogoFile) {
      imageToBase64(clubLogoFile, function(clubLogo) {
        // ⭐ COMPRIMIR logo antes de procesar
        compressImageForFirestore(clubLogo, 800, function(compressedLogo) {
          processAdminData(compressedLogo);
        });
      });
    } else {
      processAdminData(getDefaultLogo());
    }
  };

  const processAdminData = (clubLogo) => {
    if (adminAvatarFile) {
      imageToBase64(adminAvatarFile, function(adminAvatar) {
        // ⭐ COMPRIMIR avatar antes de registrar
        compressImageForFirestore(adminAvatar, 800, function(compressedAvatar) {
          completeRegistration(clubLogo, compressedAvatar);
        });
      });
    } else {
      completeRegistration(clubLogo, getDefaultAvatar());
    }
  };
  
  // ========================================
  // FUNCIÓN PRINCIPAL DE REGISTRO
  // ========================================
const completeRegistration = async (clubLogo, adminAvatar) => {
    // ✅ OBTENER CLUB ID PERSONALIZADO DEL USUARIO
    const customClubIdInput = document.getElementById('regClubId')?.value.trim() || '';
    let clubId;
    
    if (customClubIdInput) {
      // Formatear el ID personalizado
      clubId = formatClubId(customClubIdInput);
      
      if (!clubId || clubId.length < 3) {
        showToast('❌ El ID del club debe tener al menos 3 caracteres válidos');
        return;
      }
      
      if (clubId.length > 30) {
        showToast('❌ El ID del club no puede tener más de 30 caracteres');
        return;
      }
      
      // Verificar que no exista
      showToast('🔍 Verificando disponibilidad del ID...');
      const exists = await checkClubIdExists(clubId);
      
      if (exists) {
        showToast('❌ Este ID de club ya está en uso. Elige otro.');
        return;
      }
      
      console.log('✅ Club ID personalizado disponible:', clubId);
    } else {
      // Si no proporcionó ID, generar uno automático (fallback)
      clubId = 'club_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6);
      console.log('🆔 Club ID generado automáticamente:', clubId);
    }
    
    // ✅ OBTENER VALORES DE CONFIGURACIÓN ADICIONALES
    const monthlyFee = document.getElementById('regMonthlyFee')?.value.trim() || '50000';
    const clubCurrency = document.getElementById('regClubCurrency')?.value || 'COP';
    const clubColor = document.getElementById('regClubColor')?.value || '#0d9488';
    
    console.log('🆔 Club ID final:', clubId);
    
    // Configuración del club (usando email del admin)
    const clubSettings = {
      schoolId: clubId,
      name: clubName,
      clubId: clubId,
      logo: clubLogo,
      email: adminEmail,
      phone: clubPhone,
      address: clubAddress,
      city: clubCity,
      country: clubCountry,
      website: clubWebsite,
      socialMedia: clubSocial,
      foundedYear: clubFoundedYear,
      monthlyFee: monthlyFee,
      currency: clubCurrency,
      primaryColor: clubColor
    };
    
    console.log('⏳ Verificando disponibilidad de Firebase...');
    showToast('⏳ Conectando con Firebase...');
    
    const firebaseReady = await waitForFirebase();
    
    if (!firebaseReady || !window.firebase?.auth) {
      showToast('❌ Firebase no disponible. Recarga la página.');
      return;
    }
    
    let firebaseUid = null;
    let userCreatedInAuth = false;
    
    try {
      console.log('🔥 Creando club:', clubId);
      showToast('🔥 Creando tu club...');
      
      // ========================================
      // PASO 1: CREAR USUARIO EN AUTHENTICATION
      // ========================================
      console.log('🔐 Paso 1/6: Creando usuario en Authentication...');
      showToast('🔐 Creando administrador...');
      
      try {
        const userCredential = await window.firebase.createUserWithEmailAndPassword(
          window.firebase.auth,
          adminEmail,
          adminPassword
        );
        
        window.APP_STATE.currentUser = userCredential.user;
        firebaseUid = userCredential.user.uid;
        userCreatedInAuth = true;
        
        console.log('✅ Usuario creado en Auth con UID:', firebaseUid);
        console.log('📧 Email usado:', adminEmail);
        console.log('🔒 Contraseña configurada correctamente');
        
      } catch (authError) {
        console.error('❌ ERROR en Authentication:', authError);
        
        if (authError.code === 'auth/email-already-in-use') {
          showToast('❌ Este email ya está registrado');
          return;
        } else if (authError.code === 'auth/weak-password') {
          showToast('❌ Contraseña muy débil (mínimo 6 caracteres)');
          return;
        } else if (authError.code === 'auth/invalid-email') {
          showToast('❌ Email inválido');
          return;
        } else {
          showToast('❌ Error: ' + authError.message);
          return;
        }
      }
      
      // Validar que se creó el usuario
      if (!userCreatedInAuth || !firebaseUid) {
        console.error('❌ REGISTRO ABORTADO: No se pudo crear usuario');
        showToast('❌ No se pudo crear el usuario. Intenta de nuevo.');
        return;
      }
      
      console.log('✅ Usuario confirmado, continuando con registro...');
      
      // ========================================
      // PASO 2: GUARDAR USUARIO LOCALMENTE
      // ========================================
      console.log('💾 Paso 2/6: Guardando usuario localmente...');
      
      const newUser = {
        id: firebaseUid,
        schoolId: clubId,
        email: adminEmail,
        password: adminPassword,
        name: adminName,
        birthDate: adminBirthDate,
        phone: adminPhone, // ⭐ YA NORMALIZADO
        avatar: adminAvatar,
        role: 'admin',
        isMainAdmin: true,
        createdAt: getCurrentDateTime()
      };
      
      saveUser(newUser);
      console.log('✅ Usuario guardado localmente');
      
      // ========================================
      // PASO 3: GUARDAR USUARIO EN FIRESTORE
      // ========================================
      console.log('🔥 Paso 3/6: Guardando usuario en Firestore...');
      showToast('💾 Guardando perfil...');
      
      await window.firebase.setDoc(
        window.firebase.doc(window.firebase.db, `clubs/${clubId}/users`, firebaseUid),
        {
          id: firebaseUid,
          email: adminEmail,
          name: adminName,
          isMainAdmin: true,
          role: 'admin',
          avatar: adminAvatar || '',
          phone: adminPhone || '', // ⭐ YA NORMALIZADO
          birthDate: adminBirthDate || '',
          createdAt: new Date().toISOString()
        }
    );
      console.log('✅ Usuario guardado en Firestore');
      
      // ========================================
      console.log('⚙️ Paso 4/6: Guardando configuración del club...');
      showToast('⚙️ Configurando club...');
      
      await window.firebase.setDoc(
        window.firebase.doc(window.firebase.db, `clubs/${clubId}/settings`, "main"),
        {
          ...clubSettings,
          createdAt: new Date().toISOString(),
          createdBy: firebaseUid,
          isInitialized: true
        }
      );
      console.log('✅ Configuración del club guardada');
      
      // ========================================
      // PASO 5: GUARDAR MAPEO EMAIL → CLUBID
      // ========================================
      console.log('🗺️ Paso 5/6: Guardando mapeo para login multi-dispositivo...');
      showToast('🔗 Configurando acceso...');
      
      const mappingSaved = await saveUserClubMapping(adminEmail, clubId, firebaseUid);
      
      if (!mappingSaved) {
        console.warn('⚠️ Mapeo no guardado - puede afectar login multi-dispositivo');
      } else {
console.log('✅ Mapeo guardado correctamente');
      }
      
      // ========================================
      // 🔐 ACTIVAR LICENCIA
      // ========================================
      console.log('🔐 Activando licencia...');
      showToast('🔐 Activando licencia...');
      
      if (typeof activateLicense === 'function') {
        const licenseActivated = await activateLicense(
          activationCode,
          clubId,
          clubName,
          clubPhone,
          activationPlan
        );
        
        if (licenseActivated) {
          console.log('✅ Licencia activada');
        }
      }
      // ========================================
      
      console.log('🎉 Paso 6/6: Finalizando registro...');
      showToast('✅ Club creado exitosamente');
      
      // Guardar configuración localmente
      localStorage.setItem('clubId', clubId);
      saveSchoolSettings(clubSettings); // ✅ CAMBIO AQUÍ
      
      console.log('💾 Configuración guardada:');
      console.log('   • Logo:', clubSettings.logo ? `✅ ${clubSettings.logo.substring(0, 50)}...` : '❌ NO guardado');
      console.log('   • Nombre:', clubSettings.name);
      console.log('   • Club ID:', clubSettings.clubId);
      
      // ✅ CRÍTICO: Establecer sesión ANTES de mostrar el modal
      const { password: _, ...userWithoutPassword } = newUser;
      setCurrentUser(userWithoutPassword);
      
      console.log('✅ Sesión establecida para:', userWithoutPassword.email);
      console.log('✅ Usuario guardado en localStorage');
      
      // Generar iconos PWA con el logo del club
      if (typeof generatePWAIcons === 'function') {
        console.log('🎨 Generando iconos PWA con logo del club...');
        generatePWAIcons();
      }

      // Mostrar modal con Club ID
      showClubIdToUser(clubId, clubName);
      
      // ========================================
      // RESUMEN EN CONSOLA
      // ========================================
      console.log('✅ ========================================');
      console.log('✅ REGISTRO COMPLETADO EXITOSAMENTE');
      console.log('✅ ========================================');
      console.log('📋 Resumen del registro:');
      console.log('   • UID:', firebaseUid);
      console.log('   • Email:', adminEmail);
      console.log('   • Club ID:', clubId);
      console.log('   • Teléfono Admin:', adminPhone);
      console.log('   • Teléfono Club:', clubPhone);
      console.log('   • Usuario en Auth: ✅');
      console.log('   • Usuario en Firestore: ✅');
      console.log('   • Configuración guardada: ✅');
      console.log('   • Mapeo guardado:', mappingSaved ? '✅' : '⚠️');
      console.log('   • Sesión activa: ✅');
      console.log('========================================');
    } catch (error) {
      console.error('❌ ========================================');
      console.error('❌ ERROR DURANTE EL REGISTRO');
      console.error('❌ ========================================');
      console.error('Error completo:', error);
      console.error('Código:', error.code);
      console.error('Mensaje:', error.message);
      console.error('Usuario creado en Auth:', userCreatedInAuth);
      console.error('UID:', firebaseUid);
      console.error('========================================');
      
      showToast('❌ Error: ' + error.message);
      
      // Si el usuario se creó en Auth pero hubo error después
      if (userCreatedInAuth && firebaseUid) {
        console.log('⚠️ El usuario fue creado en Authentication.');
        console.log('💡 Puedes intentar hacer login con:');
        console.log('   Email:', adminEmail);
        showToast('⚠️ El usuario fue creado. Intenta hacer login.');
      }
    }
  };
  
  // Iniciar proceso
  processClubData();
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
    console.log('✅ Usuario autenticado:', currentUser.email);
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
      // Cancelar listeners de Firebase antes de salir
      if (typeof window.userDeletionUnsubscribe === 'function') {
        window.userDeletionUnsubscribe();
        window.userDeletionUnsubscribe = null;
      }
      if (typeof window.licenseUnsubscribe === 'function') {
        window.licenseUnsubscribe();
        window.licenseUnsubscribe = null;
      }

      // Primero cerrar Firebase Auth
      if (window.firebase?.auth) {
        await window.firebase.signOut(window.firebase.auth);
      }

      // Luego limpiar TODA la sesión local
      clearCurrentUser();
      localStorage.removeItem('clubId');
      localStorage.removeItem('players');
      localStorage.removeItem('payments');
      localStorage.removeItem('calendarEvents');
      localStorage.removeItem('users');
      localStorage.removeItem('schoolSettings');
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
    console.log('[AUTH] Sesion local valida:', currentUser.email);
    showApp();
    return;
  }
  
  console.log('[AUTH] No hay sesion local, esperando Firebase Auth...');
  showLoading();
  
  // 2. Esperar a que Firebase esté listo (hasta 15 segundos para móviles)
  let attempts = 0;
  const maxAttempts = 30; // 15 segundos máximo
  
  const checkAuth = setInterval(async () => {
    attempts++;

    // Si no estamos en el dashboard (login.html no tiene appContainer), salir
    if (!document.getElementById('appContainer') && !document.getElementById('loginScreen')) {
      clearInterval(checkAuth);
      return;
    }
    
    // Verificar si localStorage fue restaurado
    const restoredUser = getCurrentUser();
    if (restoredUser && restoredUser.email) {
      clearInterval(checkAuth);
      console.log('[AUTH] Sesion restaurada:', restoredUser.email);
      showApp();
      return;
    }
    
    // Verificar si Firebase Auth tiene usuario activo
    if (window.firebase?.auth?.currentUser) {
      clearInterval(checkAuth);
      const user = window.firebase.auth.currentUser;
      console.log('[AUTH] Firebase Auth tiene usuario:', user.email);
      
      // Buscar clubId - primero en localStorage, luego en Firebase
      let clubId = localStorage.getItem('clubId');
      
      if (!clubId) {
        console.log('[AUTH] ClubId no encontrado en localStorage, buscando en Firebase...');
        try {
          // Buscar en userClubMapping
          const mappingRef = window.firebase.doc(window.firebase.db, 'userClubMapping', user.email);
          const mappingSnap = await window.firebase.getDoc(mappingRef);
          
          if (mappingSnap.exists()) {
            clubId = mappingSnap.data().clubId;
            localStorage.setItem('clubId', clubId);
            console.log('[AUTH] ClubId recuperado de Firebase:', clubId);
          }
        } catch (err) {
          console.warn('[AUTH] Error buscando clubId:', err);
        }
      }
      
      if (clubId) {
        try {
          // Restaurar datos del usuario
          const userRef = window.firebase.doc(window.firebase.db, 'clubs/' + clubId + '/users', user.uid);
          const userSnap = await window.firebase.getDoc(userRef);
          
          if (userSnap.exists()) {
            const userData = userSnap.data();
            const sessionData = {
              id: user.uid,
              email: user.email,
              name: userData.name || user.email.split('@')[0],
              schoolId: clubId,
              isMainAdmin: userData.isMainAdmin || false,
              role: userData.role || 'admin',
              avatar: userData.avatar || '',
              phone: userData.phone || ''
            };
            
            setCurrentUser(sessionData);
            console.log('[AUTH] Sesion restaurada completamente desde Firebase');
            
            // Descargar datos del club
            if (typeof downloadAllClubData === 'function') {
              await downloadAllClubData(clubId);
            }
            
            showApp();
            return;
          }
        } catch (err) {
          console.warn('[AUTH] Error restaurando sesion:', err);
        }
      }
      
      // Si llegamos aquí, hay usuario en Firebase pero no pudimos restaurar
      console.log('[AUTH] No se pudo restaurar sesion completa');
      showLogin();
      return;
    }
    
    // Verificar si Firebase ya terminó de verificar (authRestored)
    if (window.APP_STATE?.authRestored && !window.firebase?.auth?.currentUser) {
      clearInterval(checkAuth);
      console.log('[AUTH] Firebase confirmó que no hay sesión');
      showLogin();
      return;
    }
    
    // Timeout
    if (attempts >= maxAttempts) {
      clearInterval(checkAuth);
      console.log('[AUTH] Timeout esperando Firebase');
      showLogin();
    }
  }, 500);
});

// ========================================
// RECUPERACIÓN DE CONTRASEÑA CON FIREBASE
// ========================================

// ✅ FUNCIÓN MEJORADA: Recuperar contraseña con email de Firebase
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
if (!window.firebase?.auth) {
showResetMessage('❌ Error de conexión. Recarga la página.', 'error');
return;
}
submitBtn.disabled = true;
submitBtn.textContent = '⏳ Enviando...';
try {
await window.firebase.sendPasswordResetEmail(
window.firebase.auth,
email
);
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
let errorMessage = '❌ Error al enviar el email. ';switch (error.code) {
  case 'auth/user-not-found':
    errorMessage += 'No existe una cuenta con ese email.';
    break;
  case 'auth/invalid-email':
    errorMessage += 'Email no válido.';
    break;
  case 'auth/too-many-requests':
    errorMessage += 'Demasiados intentos. Intenta más tarde.';
    break;
  case 'auth/network-request-failed':
    errorMessage += 'Error de conexión. Verifica tu internet.';
    break;
  default:
    errorMessage += error.message;
}

showResetMessage(errorMessage, 'error');

submitBtn.disabled = false;
submitBtn.textContent = 'Enviar Enlace';}
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

// ========================================
// LOGIN CON GOOGLE
// ========================================

// Detectar si el usuario está en un dispositivo móvil
function isMobileDevice() {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

// Esperar a que Firebase Auth tenga un usuario autenticado (máximo 6 segundos)
function waitForAuthUser() {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(null), 6000);
    const unsub = window.firebase.onAuthStateChanged(window.firebase.auth, (user) => {
      if (user) {
        clearTimeout(timeout);
        unsub();
        resolve(user);
      }
    });
  });
}

// Procesar el resultado del redirect de Google (se llama al cargar la página)
async function handleGoogleRedirectResult() {
  // Solo actuar si venimos de un redirect de Google
  if (!sessionStorage.getItem('googleRedirectPending')) return;

  const firebaseReady = await waitForFirebase();
  if (!firebaseReady || !window.firebase?.auth) return;

  try {
    // Intentar getRedirectResult primero
    const result = await window.firebase.getRedirectResult(window.firebase.auth);
    if (result?.user) {
      sessionStorage.removeItem('googleRedirectPending');
      await processGoogleUser(result.user);
      return;
    }
  } catch (err) {
    console.warn('[Google] getRedirectResult falló:', err.code);
  }

  // Fallback: esperar a que onAuthStateChanged detecte al usuario
  showToast('⏳ Verificando cuenta de Google...');
  const user = await waitForAuthUser();

  if (user) {
    sessionStorage.removeItem('googleRedirectPending');
    await processGoogleUser(user);
  } else {
    sessionStorage.removeItem('googleRedirectPending');
    showToast('❌ No se pudo completar el inicio con Google. Intenta de nuevo.');
  }
}

// Procesar usuario autenticado con Google (compartido entre popup y redirect)
async function processGoogleUser(firebaseUser) {
  const email = firebaseUser.email;
  const firebaseUid = firebaseUser.uid;

  showToast('🔍 Buscando tu club...');

  const clubId = await getClubIdForUser(email);

  if (!clubId) {
    await window.firebase.signOut(window.firebase.auth);
    showToast('⚠️ No tienes un club registrado. Ve a "Registrarse" y usa tu código de activación.');
    if (typeof showRegisterTab === 'function') showRegisterTab();
    return;
  }

  localStorage.setItem('clubId', clubId);

  try {
    const userInClubRef = window.firebase.doc(window.firebase.db, `clubs/${clubId}/users`, firebaseUid);
    const userInClubSnap = await window.firebase.getDoc(userInClubRef);

    if (!userInClubSnap.exists()) {
      await window.firebase.setDoc(userInClubRef, {
        id: firebaseUid,
        email: email,
        name: firebaseUser.displayName || email.split('@')[0],
        isMainAdmin: false,
        role: 'admin',
        avatar: firebaseUser.photoURL || '',
        phone: '',
        birthDate: '',
        joinedAt: new Date().toISOString()
      });
    }
  } catch (e) {
    console.warn('[Google Login] No se pudo verificar usuario en club/users:', e.message);
  }

  const downloaded = await downloadAllClubData(clubId);

  if (!downloaded) {
    showToast('❌ Error al descargar datos del club');
    await window.firebase.signOut(window.firebase.auth);
    return;
  }

  const users = getUsers();
  let user = users.find(u => u.email === email);

  if (!user) {
    user = {
      id: firebaseUid,
      email: email,
      name: firebaseUser.displayName || email.split('@')[0],
      schoolId: clubId,
      role: 'admin',
      isMainAdmin: false,
      avatar: firebaseUser.photoURL || ''
    };
  }

  setCurrentUser(user);

  try {
    window.firebase.addDoc(
      window.firebase.collection(window.firebase.db, `clubs/${clubId}/audit_log`),
      {
        action: 'login_google',
        userEmail: email,
        userName: user.name || email,
        role: user.role || 'admin',
        date: new Date().toISOString().split('T')[0],
        timestamp: new Date().toISOString()
      }
    );
  } catch(e) {}

  showToast('✅ Bienvenido ' + user.name);
  setTimeout(() => { window.location.href = 'index.html'; }, 500);
}

async function loginWithGoogle() {
  const firebaseReady = await waitForFirebase();

  if (!firebaseReady || !window.firebase?.auth) {
    showToast('❌ No se pudo conectar con Firebase. Recarga la página.');
    return;
  }

  try {
    const provider = new window.firebase.GoogleAuthProvider();

    // Usar popup en todos los dispositivos
    showToast('⏳ Abriendo Google...');
    const userCredential = await window.firebase.signInWithPopup(window.firebase.auth, provider);
    await processGoogleUser(userCredential.user);

  } catch (err) {
    if (err.code === 'auth/popup-closed-by-user') {
      showToast('ℹ️ Inicio de sesión cancelado');
    } else if (err.code === 'auth/network-request-failed') {
      showToast('❌ Error de conexión. Verifica tu internet.');
    } else {
      showToast('❌ Error con Google: ' + err.message);
    }
  }
}

window.loginWithGoogle = loginWithGoogle;

// Ejecutar al cargar la página para capturar resultado del redirect en móvil
document.addEventListener('DOMContentLoaded', () => {
  handleGoogleRedirectResult();
});
console.log('✅ auth.js cargado (CON NORMALIZACIÓN DE TELÉFONOS)');