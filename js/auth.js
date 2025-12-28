// ========================================
// SISTEMA DE AUTENTICACIÓN - MULTI-DISPOSITIVO SIMPLIFICADO
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

// 🔥 FUNCIÓN SIMPLE: Descargar datos desde Firebase
async function downloadAllClubData() {
  if (!window.APP_STATE?.firebaseReady || !window.firebase?.auth?.currentUser) {
    return false;
  }

  try {
    console.log('📥 Descargando todos los datos...');
    showToast('📥 Descargando datos de la nube...');

    // 1️⃣ Descargar configuración del club
    const settingsRef = window.firebase.doc(window.firebase.db, "settings", "club");
    const settingsSnap = await window.firebase.getDoc(settingsRef);
    
    if (!settingsSnap.exists()) {
      console.log('⚠️ No hay configuración en Firebase');
      return false;
    }

    const clubSettings = settingsSnap.data();
    const clubId = clubSettings.clubId;
    
    saveSchoolSettings(clubSettings);
    console.log('✅ Configuración descargada');

    // 2️⃣ Descargar jugadores
    const playersSnapshot = await window.firebase.getDocs(
      window.firebase.collection(window.firebase.db, "players")
    );
    
    const players = [];
    playersSnapshot.forEach(doc => {
      players.push({ id: doc.id, ...doc.data() });
    });
    
    saveAllPlayers(players);
    console.log(`✅ ${players.length} jugadores descargados`);

    // 3️⃣ Descargar usuarios del club
    const usersRef = window.firebase.collection(window.firebase.db, `clubs/${clubId}/users`);
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
    console.error('❌ Error:', error);
    showToast('⚠️ Error al descargar datos');
    return false;
  }
}

// Login - SIMPLIFICADO
document.getElementById('loginForm')?.addEventListener('submit', async function(e) {
  e.preventDefault();
  
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  
  // 🔥 PRIMERO: Intentar autenticar con Firebase
  if (window.APP_STATE?.firebaseReady && window.firebase?.auth) {
    try {
      console.log('🔐 Autenticando en Firebase...');
      showToast('🔐 Verificando credenciales...');
      
      const userCredential = await window.firebase.signInWithEmailAndPassword(
        window.firebase.auth,
        email,
        password
      );
      
      console.log('✅ Autenticado en Firebase');
      window.APP_STATE.currentUser = userCredential.user;
      
      // 📥 DESCARGAR TODOS LOS DATOS
      const downloaded = await downloadAllClubData();
      
      if (downloaded) {
        // Buscar el usuario ahora que ya descargamos los datos
        const users = getUsers();
        const user = users.find(u => u.email === email);
        
        if (user) {
          // Actualizar contraseña local
          updateUser(user.id, { password: password });
          
          // Guardar sesión
          const { password: _, ...userWithoutPassword } = user;
          setCurrentUser(userWithoutPassword);
          
          showToast('✅ Bienvenido ' + user.name);
          
          setTimeout(() => {
            document.getElementById('loginScreen').classList.add('hidden');
            document.getElementById('appContainer').classList.remove('hidden');
            initApp();
          }, 500);
          
          return; // ✅ LOGIN EXITOSO
        }
      }
      
    } catch (authError) {
      console.error('❌ Error de autenticación:', authError);
      
      if (authError.code === 'auth/invalid-credential' || authError.code === 'auth/wrong-password') {
        showToast('❌ Email o contraseña incorrectos');
      } else if (authError.code === 'auth/user-not-found') {
        showToast('❌ Usuario no encontrado');
      } else if (authError.code === 'auth/too-many-requests') {
        showToast('❌ Demasiados intentos. Intenta más tarde.');
      } else {
        showToast('❌ Error de autenticación');
      }
      return;
    }
  }
  
  // Si llegamos aquí, no se pudo autenticar
  showToast('❌ Email o contraseña incorrectos');
});

// Registro - SIN CAMBIOS
document.getElementById('registerForm')?.addEventListener('submit', async function(e) {
  e.preventDefault();
  
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
  
  const adminAvatarFile = document.getElementById('regAdminAvatar').files[0];
  const adminName = document.getElementById('regAdminName').value;
  const adminBirthDate = document.getElementById('regAdminBirthDate').value;
  const adminPhone = document.getElementById('regAdminPhone').value;
  const adminEmail = document.getElementById('regAdminEmail').value;
  const adminPassword = document.getElementById('regAdminPassword').value;
  
  if (adminPassword.length < 6) {
    showToast('❌ La contraseña debe tener al menos 6 caracteres');
    return;
  }
  
  const users = getUsers();
  if (users.find(u => u.email === adminEmail)) {
    showToast('❌ Este email ya está registrado');
    return;
  }
  
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
  
  const completeRegistration = async (clubLogo, adminAvatar) => {
    const schoolId = generateId();
    
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
    
    saveUser(newUser);
    
    // 🔥 CREAR EN FIREBASE
    if (window.APP_STATE?.firebaseReady && window.firebase?.auth) {
      try {
        console.log('🔥 Creando en Firebase...');
        
        const userCredential = await window.firebase.createUserWithEmailAndPassword(
          window.firebase.auth,
          adminEmail,
          adminPassword
        );
        
        window.APP_STATE.currentUser = userCredential.user;
        
        await window.firebase.setDoc(
          window.firebase.doc(window.firebase.db, `clubs/${clubId}/users`, newUser.id),
          {
            id: newUser.id,
            email: newUser.email,
            name: newUser.name,
            isMainAdmin: true,
            role: 'admin',
            avatar: newUser.avatar || '',
            phone: newUser.phone || '',
            birthDate: newUser.birthDate || '',
            createdAt: new Date().toISOString(),
            firebaseUid: userCredential.user.uid
          }
        );
        
        await window.firebase.setDoc(
          window.firebase.doc(window.firebase.db, "settings", "club"),
          {
            ...clubSettings,
            createdAt: new Date().toISOString(),
            createdBy: userCredential.user.uid,
            isInitialized: true
          }
        );
        
        showToast('✅ Club creado en la nube');
        
      } catch (error) {
        console.error('❌ Error Firebase:', error);
        showToast('⚠️ Club creado localmente');
      }
    }
    
    showToast('✅ Club registrado');
    
    if (typeof generatePWAIcons === 'function') {
      generatePWAIcons();
    }
    
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

// Logout
async function logout() {
  if (confirmAction('¿Estás seguro de cerrar sesión?')) {
    if (window.firebase?.auth) {
      try {
        await window.firebase.signOut(window.firebase.auth);
      } catch (error) {
        console.error('Error:', error);
      }
    }
    
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

// Recuperar contraseña
function forgotPassword() {
  const email = prompt('📧 Ingresa tu email:');
  if (!email) return;
  
  const users = getUsers();
  const user = users.find(u => u.email === email);
  
  if (!user) {
    showToast('❌ Email no encontrado');
    return;
  }
  
  const confirmReset = confirm(`✅ Usuario: ${user.name}\n📱 Teléfono: ${user.phone}\n\n¿Restablecer contraseña?`);
  
  if (confirmReset) {
    const newPassword = prompt('🔒 Nueva contraseña (mínimo 6 caracteres):');
    
    if (!newPassword || newPassword.length < 6) {
      showToast('❌ Contraseña inválida');
      return;
    }
    
    const confirmNewPassword = prompt('🔒 Confirma la contraseña:');
    
    if (newPassword !== confirmNewPassword) {
      showToast('❌ Las contraseñas no coinciden');
      return;
    }
    
    updateUser(user.id, { password: newPassword });
    showToast('✅ Contraseña restablecida');
  }
}

console.log('✅ auth.js cargado (MULTI-DISPOSITIVO SIMPLIFICADO)');