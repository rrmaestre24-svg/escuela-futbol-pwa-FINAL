// ========================================
// SISTEMA DE AUTENTICACIÓN - MEJORADO
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

// Login
document.getElementById('loginForm')?.addEventListener('submit', function(e) {
  e.preventDefault();
  
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  
  const users = getUsers();
  const user = users.find(u => u.email === email && u.password === password);
  
  if (user) {
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

// Registro - MEJORADO
document.getElementById('registerForm')?.addEventListener('submit', function(e) {
  e.preventDefault();
  
  // Datos del club
  const clubLogoFile = document.getElementById('regClubLogo').files[0];
  const clubName = document.getElementById('regClubName').value;
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
  const completeRegistration = (clubLogo, adminAvatar) => {
    // Guardar configuración del club - MEJORADO
    updateSchoolSettings({
      name: clubName,
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
    });
    
    // Crear usuario admin
    const newUser = {
      id: generateId(),
      email: adminEmail,
      password: adminPassword,
      name: adminName,
      birthDate: adminBirthDate,
      phone: adminPhone,
      avatar: adminAvatar,
      role: 'admin',
      createdAt: getCurrentDate()
    };
    
    saveUser(newUser);
    
    showToast('✅ Club registrado exitosamente');
    
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

// Logout
function logout() {
  if (confirmAction('¿Estás seguro de cerrar sesión?')) {
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

console.log('✅ auth.js cargado (MEJORADO)');