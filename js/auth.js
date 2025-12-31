// ========================================
// SISTEMA DE AUTENTICACIÓN - MULTI-DISPOSITIVO 100% FUNCIONAL
// CON LOGIN POR CLUB ID OPCIONAL
// VERSIÓN CORREGIDA Y SIMPLIFICADA
// ✅ CON NORMALIZACIÓN DE TELÉFONOS
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

// ✅✅✅ LOGIN MEJORADO - CON CLUB ID OPCIONAL ✅✅✅
document.getElementById('loginForm')?.addEventListener('submit', async function(e) {
  e.preventDefault();
  
  const clubIdInput = document.getElementById('loginClubId')?.value.trim() || '';
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  
  if (!email || !password) {
    showToast('❌ Por favor completa todos los campos obligatorios');
    return;
  }
  
  console.log('🔍 Iniciando login para:', email);
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
    showToast('🔍 Verificando credenciales...');
    
    // 1️⃣ Autenticar con Firebase
    const userCredential = await window.firebase.signInWithEmailAndPassword(
      window.firebase.auth,
      email,
      password
    );
    
    console.log('✅ Autenticado en Firebase');
    window.APP_STATE.currentUser = userCredential.user;
    
    let clubId = null;
    
    // 2️⃣ NUEVO: Si proporcionó clubId, intentar login directo
    if (clubIdInput) {
      console.log('⚡ Intentando login directo con clubId:', clubIdInput);
      
      try {
        // Verificar que el usuario existe en ese club
        const userInClubRef = window.firebase.doc(
          window.firebase.db,
          `clubs/${clubIdInput}/users`,
          userCredential.user.uid
        );
        
        const userInClubSnap = await window.firebase.getDoc(userInClubRef);
        
        if (userInClubSnap.exists()) {
          clubId = clubIdInput;
          console.log('✅ Usuario encontrado en club:', clubId);
          showToast('✅ Acceso rápido exitoso');
        } else {
          console.warn('⚠️ Usuario no encontrado en el club proporcionado');
          showToast('⚠️ Club ID incorrecto, buscando automáticamente...');
          // Continuar con búsqueda automática
        }
      } catch (directError) {
        console.warn('⚠️ Error en login directo:', directError.message);
        showToast('⚠️ Buscando club automáticamente...');
        // Continuar con búsqueda automática
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

    // 5️⃣ Descargar todos los datos del club
    const downloaded = await downloadAllClubData(clubId);

    if (downloaded) {
      // 6️⃣ Buscar usuario en la lista descargada
      const users = getUsers();
      const user = users.find(u => u.email === email);
      
      if (user) {
        // Actualizar password local
        updateUser(user.id, { password: password });
        
        // Establecer sesión
        const { password: _, ...userWithoutPassword } = user;
        setCurrentUser(userWithoutPassword);
        
        showToast('✅ Bienvenido ' + user.name);
        
        // Redireccionar al dashboard
        setTimeout(() => {
          document.getElementById('loginScreen').classList.add('hidden');
          document.getElementById('appContainer').classList.remove('hidden');
          initApp();
        }, 500);
      } else {
        showToast('⚠️ Usuario no encontrado en el club');
        await window.firebase.signOut(window.firebase.auth);
      }
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

// ✅✅✅ REGISTRO SIMPLIFICADO - CON NORMALIZACIÓN DE TELÉFONOS ✅✅✅
document.getElementById('registerForm')?.addEventListener('submit', async function(e) {
  e.preventDefault();
  
  // ========================================
  // DATOS DEL CLUB
  // ========================================
  const clubLogoFile = document.getElementById('regClubLogo').files[0];
  const clubName = document.getElementById('regClubName').value.trim();
  const clubIdInput = document.getElementById('regClubId').value.trim();
  
  // Generar clubId automáticamente si no se proporciona
  let clubId = clubIdInput.toLowerCase().replace(/[^a-z0-9_]/g, '_');
  if (!clubId && clubName) {
    clubId = clubName.toLowerCase().replace(/[^a-z0-9]/g, '_');
  }
  
  if (!clubId) {
    showToast('⚠️ El ID del club es obligatorio');
    return;
  }
  
  const clubColor = document.getElementById('regClubColor').value;
  const clubCurrency = document.getElementById('regClubCurrency').value;
  const monthlyFee = parseFloat(document.getElementById('regMonthlyFee').value) || 0;
  
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
  // PROCESAR IMÁGENES
  // ========================================
  const processClubData = () => {
    if (clubLogoFile) {
      imageToBase64(clubLogoFile, function(clubLogo) {
        processAdminData(clubLogo);
      });
    } else {
      processAdminData(getDefaultLogo());
    }
  };
  
  const processAdminData = (clubLogo) => {
    if (adminAvatarFile) {
      imageToBase64(adminAvatarFile, function(adminAvatar) {
        completeRegistration(clubLogo, adminAvatar);
      });
    } else {
      completeRegistration(clubLogo, getDefaultAvatar());
    }
  };
  
  // ========================================
  // FUNCIÓN PRINCIPAL DE REGISTRO
  // ========================================
  const completeRegistration = async (clubLogo, adminAvatar) => {
    
    // Configuración del club (usando email del admin)
    const clubSettings = {
      schoolId: clubId,
      name: clubName,
      clubId: clubId,
      logo: clubLogo,
      email: adminEmail,
      phone: clubPhone, // ⭐ YA NORMALIZADO
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
      console.log('📝 Paso 1/6: Creando usuario en Authentication...');
      showToast('📝 Creando administrador...');
      
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
        console.log('🔑 Contraseña configurada correctamente');
        
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
        createdAt: getCurrentDate()
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
      // PASO 4: GUARDAR CONFIGURACIÓN DEL CLUB
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
      // PASO 6: FINALIZACIÓN
      // ========================================
      console.log('🎉 Paso 6/6: Finalizando registro...');
      showToast('✅ Club creado exitosamente');
      
      // Guardar configuración localmente
      localStorage.setItem('clubId', clubId);
      updateSchoolSettings(clubSettings);
      
      // Establecer sesión actual
      const { password: _, ...userWithoutPassword } = newUser;
      setCurrentUser(userWithoutPassword);
      
      // Generar iconos PWA
      if (typeof generatePWAIcons === 'function') {
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

// ✅ FUNCIÓN: Cerrar modal y redirigir al dashboard
function closeClubIdModal() {
  const modal = document.getElementById('clubIdModal');
  if (modal) {
    modal.remove();
  }
  
  // Redirigir al dashboard
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('appContainer').classList.remove('hidden');
  initApp();
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

// Logout
async function logout() {
  if (confirmAction('¿Estás seguro de cerrar sesión?')) {
    try {
      if (window.firebase?.auth) {
        await window.firebase.signOut(window.firebase.auth);
      }
      
      clearCurrentUser();
      showToast('👋 Sesión cerrada');
      
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
      showToast('⚠️ Error al cerrar sesión');
    }
  }
}

// Verificar sesión al cargar
window.addEventListener('DOMContentLoaded', function() {
  const currentUser = getCurrentUser();
  
  if (currentUser) {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('appContainer').classList.remove('hidden');
    initApp();
  } else {
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('appContainer').classList.add('hidden');
  }
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

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
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
    let errorMessage = '❌ Error al enviar el email. ';
    
    switch (error.code) {
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