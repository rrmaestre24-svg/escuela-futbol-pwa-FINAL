// ========================================
// SISTEMA DE AUTENTICACIÓN - CON FIREBASE AUTHENTICATION
// ========================================

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

// Preview de logo en registro - MEJORADO
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

// Preview de avatar en registro - MEJORADO
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

// Login - CON FIREBASE AUTHENTICATION
document.getElementById('loginForm')?.addEventListener('submit', async function(e) {
  e.preventDefault();
  
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  
  // Buscar usuario local
  const users = getUsers();
  const user = users.find(u => u.email === email && u.password === password);
  
  if (user) {
    // 🔐 INTENTAR AUTENTICAR EN FIREBASE
    if (window.APP_STATE?.firebaseReady && window.firebase?.auth) {
      try {
        console.log('🔐 Autenticando en Firebase...');
        
        // Intentar login en Firebase
        const userCredential = await window.firebase.signInWithEmailAndPassword(
          window.firebase.auth,
          email,
          password
        );
        
        console.log('✅ Autenticado en Firebase:', userCredential.user.uid);
        window.APP_STATE.currentUser = userCredential.user;
        
      } catch (authError) {
        // Si no existe en Firebase, crearlo
        if (authError.code === 'auth/user-not-found' || authError.code === 'auth/invalid-credential') {
          console.log('⚠️ Usuario no existe en Firebase, creando...');
          
          try {
            const newUserCredential = await window.firebase.createUserWithEmailAndPassword(
              window.firebase.auth,
              email,
              password
            );
            
            console.log('✅ Usuario creado en Firebase:', newUserCredential.user.uid);
            window.APP_STATE.currentUser = newUserCredential.user;
            
          } catch (createError) {
            console.error('❌ Error al crear usuario en Firebase:', createError);
          }
        } else {
          console.error('❌ Error de autenticación Firebase:', authError);
        }
      }
    }
    
    // Eliminar password del objeto de sesión
    const { password: _, ...userWithoutPassword } = user;
    setCurrentUser(userWithoutPassword);
    
    showToast('✅ Bienvenido ' + user.name);
    
    setTimeout(() => {
      document.getElementById('loginScreen').classList.add('hidden');
      document.getElementById('appContainer').classList.remove('hidden');
      initApp();
    }, 500);
  } else {
    showToast('❌ Email o contraseña incorrectos');
  }
});

// Registro - CON FIREBASE AUTHENTICATION AUTOMÁTICO
document.getElementById('registerForm')?.addEventListener('submit', async function(e) {
  e.preventDefault();
  
  // Datos del club
  const clubLogoFile = document.getElementById('regClubLogo').files[0];
  const clubName = document.getElementById('regClubName').value;
  const clubIdInput = document.getElementById('regClubId').value;
  let clubId = clubIdInput.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
  if (!clubId && clubName) {
    clubId = clubName.toLowerCase().replace(/[^a-z0-9]/g, '_');
  }
  if (!clubId) {
    showToast('⚠️ El ID del club es obligatorio');
    return;
  }
  const clubColor = document.getElementById('regClubColor').value;
  const clubCurrency = document.getElementById('regClubCurrency').value;
  const monthlyFee = parseFloat(document.getElementById('regMonthlyFee').value);
  const clubEmail = document.getElementById('regClubEmail').value;
  const clubPhone = document.getElementById('regClubPhone').value;
  const clubAddress = document.getElementById('regClubAddress').value;
  const clubCity = document.getElementById('regClubCity').value;
  const clubCountry = document.getElementById('regClubCountry').value;
  const clubWebsite = document.getElementById('regClubWebsite').value;
  const clubSocial = document.getElementById('regClubSocial').value;
  const clubFoundedYear = document.getElementById('regClubFoundedYear').value;
  
  // Datos del admin
  const adminAvatarFile = document.getElementById('regAdminAvatar').files[0];
  const adminName = document.getElementById('regAdminName').value;
  const adminBirthDate = document.getElementById('regAdminBirthDate').value;
  const adminPhone = document.getElementById('regAdminPhone').value;
  const adminEmail = document.getElementById('regAdminEmail').value;
  const adminPassword = document.getElementById('regAdminPassword').value;
  
  // Validar contraseña
  if (adminPassword.length < 6) {
    showToast('❌ La contraseña debe tener al menos 6 caracteres');
    return;
  }
  
  // Validar email único
  const users = getUsers();
  if (users.find(u => u.email === adminEmail)) {
    showToast('❌ Este email ya está registrado');
    return;
  }
  
  // Procesar logo del club
  const processClubData = () => {
    if (clubLogoFile) {
      imageToBase64(clubLogoFile, function(clubLogo) {
        processAdminData(clubLogo);
      });
    } else {
      processAdminData(getDefaultLogo());
    }
  };
  
  // Procesar datos del admin
  const processAdminData = (clubLogo) => {
    if (adminAvatarFile) {
      imageToBase64(adminAvatarFile, function(adminAvatar) {
        completeRegistration(clubLogo, adminAvatar);
      });
    } else {
      completeRegistration(clubLogo, getDefaultAvatar());
    }
  };
  
  // Completar registro
  const completeRegistration = async (clubLogo, adminAvatar) => {
    // Generar ID único para la escuela
    const schoolId = generateId();
    
    // Guardar configuración del club CON schoolId y clubId
    const clubSettings = {
      schoolId: schoolId,
      name: clubName,
      clubId: clubId,
      logo: clubLogo,
      email: clubEmail,
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
    
    updateSchoolSettings(clubSettings);
    
    // Crear usuario admin principal
    const newUser = {
      id: generateId(),
      schoolId: schoolId,
      email: adminEmail,
      password: adminPassword,
      name: adminName,
      birthDate: adminBirthDate,
      phone: adminPhone,
      avatar: adminAvatar,
      role: 'admin',
      isMainAdmin: true,
      createdAt: getCurrentDate()
    };
    
    // Guardar localmente primero
    saveUser(newUser);
    
    // 🔥 CREAR USUARIO EN FIREBASE AUTHENTICATION
    if (window.APP_STATE?.firebaseReady && window.firebase?.auth) {
      try {
        console.log('🔥 Creando usuario en Firebase Authentication...');
        
        const userCredential = await window.firebase.createUserWithEmailAndPassword(
          window.firebase.auth,
          adminEmail,
          adminPassword
        );
        
        console.log('✅ Usuario creado en Firebase Auth');
        console.log('🆔 Firebase UID:', userCredential.user.uid);
        
        window.APP_STATE.currentUser = userCredential.user;
        
        // Guardar datos del usuario en Firestore
        try {
          await window.firebase.setDoc(
            window.firebase.doc(window.firebase.db, `clubs/${clubId}/users`, newUser.id),
            {
              id: newUser.id,
              email: newUser.email,
              name: newUser.name,
              isMainAdmin: true,
              role: 'admin',
              avatar: newUser.avatar || '',
              createdAt: new Date().toISOString(),
              firebaseUid: userCredential.user.uid
            }
          );
          
          console.log('✅ Datos del usuario guardados en Firestore');
          
          // Guardar configuración del club en Firestore
          await window.firebase.setDoc(
            window.firebase.doc(window.firebase.db, "settings", "club"),
            {
              ...clubSettings,
              createdAt: new Date().toISOString(),
              createdBy: userCredential.user.uid,
              isInitialized: true
            }
          );
          
          console.log('✅ Configuración del club guardada en Firebase');
          
          showToast('✅ Club y usuario creados en Firebase correctamente');
          
        } catch (firestoreError) {
          console.error('❌ Error al guardar en Firestore:', firestoreError);
          showToast('⚠️ Usuario creado pero error al guardar datos adicionales');
        }
        
      } catch (authError) {
        console.error('❌ Error al crear usuario en Firebase:', authError);
        
        if (authError.code === 'auth/email-already-in-use') {
          showToast('⚠️ Email ya existe en Firebase, intentando login...');
          
          try {
            const loginCredential = await window.firebase.signInWithEmailAndPassword(
              window.firebase.auth,
              adminEmail,
              adminPassword
            );
            
            console.log('✅ Login exitoso con cuenta existente');
            window.APP_STATE.currentUser = loginCredential.user;
            
          } catch (loginError) {
            console.error('❌ Error al hacer login:', loginError);
          }
        } else if (authError.code === 'auth/weak-password') {
          showToast('❌ La contraseña es muy débil (mínimo 6 caracteres)');
          return;
        } else if (authError.code === 'auth/invalid-email') {
          showToast('❌ Email inválido');
          return;
        } else {
          showToast('⚠️ Club creado localmente, sincroniza más tarde');
        }
      }
    } else {
      console.log('⚠️ Firebase no disponible, guardado solo localmente');
      showToast('⚠️ Club creado localmente (Firebase no disponible)');
    }
    
    showToast('✅ Club registrado exitosamente');
    
    // Generar iconos PWA con el logo del club
    if (typeof generatePWAIcons === 'function') {
      generatePWAIcons();
    }
    
    // Auto-login
    const { password: _, ...userWithoutPassword } = newUser;
    setCurrentUser(userWithoutPassword);
    
    setTimeout(() => {
      document.getElementById('loginScreen').classList.add('hidden');
      document.getElementById('appContainer').classList.remove('hidden');
      initApp();
    }, 1000);
  };
  
  processClubData();
});

// Logout - CON FIREBASE
async function logout() {
  if (confirmAction('¿Estás seguro de cerrar sesión?')) {
    // Cerrar sesión en Firebase
    if (window.firebase?.auth) {
      try {
        await window.firebase.signOut(window.firebase.auth);
        console.log('✅ Sesión de Firebase cerrada');
      } catch (error) {
        console.error('❌ Error al cerrar sesión de Firebase:', error);
      }
    }
    
    // Limpiar sesión local
    clearCurrentUser();
    showToast('👋 Sesión cerrada');
    
    setTimeout(() => {
      window.location.reload();
    }, 1000);
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

// NUEVO: Recuperar contraseña
function forgotPassword() {
  const email = prompt('📧 Ingresa tu email registrado:');
  
  if (!email) return;
  
  const users = getUsers();
  const user = users.find(u => u.email === email);
  
  if (!user) {
    showToast('❌ Email no encontrado');
    return;
  }
  
  // Simulación de recuperación (en producción enviarías un email real)
  const confirmReset = confirm(
    `✅ Usuario encontrado: ${user.name}\n\n` +
    `📱 Teléfono registrado: ${user.phone}\n\n` +
    `¿Deseas restablecer la contraseña?\n` +
    `(Se enviará un SMS al teléfono registrado)`
  );
  
  if (confirmReset) {
    const newPassword = prompt(
      '🔒 Ingresa tu nueva contraseña:\n' +
      '(Mínimo 6 caracteres)'
    );
    
    if (!newPassword || newPassword.length < 6) {
      showToast('❌ Contraseña no válida (mínimo 6 caracteres)');
      return;
    }
    
    const confirmNewPassword = prompt('🔒 Confirma tu nueva contraseña:');
    
    if (newPassword !== confirmNewPassword) {
      showToast('❌ Las contraseñas no coinciden');
      return;
    }
    
    // Actualizar contraseña
    updateUser(user.id, { password: newPassword });
    
    showToast('✅ Contraseña restablecida correctamente. Ya puedes iniciar sesión.');
    
    console.log('🔒 Contraseña restablecida para:', user.email);
  }
}

console.log('✅ auth.js cargado (CON FIREBASE AUTHENTICATION AUTOMÁTICO)');