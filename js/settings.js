// ========================================
// CONFIGURACIÓN - CON FIREBASE AUTHENTICATION PARA NUEVOS USUARIOS
// VERSIÓN CORREGIDA CON MAPEO Y RESTAURACIÓN DE SESIÓN
// ========================================

// Cargar configuración al abrir vista
function loadSettings() {
  const currentUser = getCurrentUser();
  const settings = getSchoolSettings();
  
  // Datos del usuario (todos los usuarios)
  if (currentUser) {
    const userAvatar = document.getElementById('userAvatar');
    const userName = document.getElementById('userName');
    const userBirthDate = document.getElementById('userBirthDate');
    const userPhone = document.getElementById('userPhone');
    const emailDisplay = document.getElementById('userEmailDisplay');
    
    if (userAvatar) userAvatar.src = currentUser.avatar || getDefaultAvatar();
    if (userName) userName.value = currentUser.name || '';
    if (userBirthDate) userBirthDate.value = currentUser.birthDate || '';
    if (userPhone) userPhone.value = currentUser.phone || '';
    if (emailDisplay) emailDisplay.textContent = currentUser.email || '';
  }
  
  // 👥 RESTRICCIÓN: Solo el admin principal ve/edita la configuración del club
  const clubSection = document.getElementById('clubSettingsSection');
  const restrictedMsg = document.getElementById('clubSettingsRestricted');
  
  if (currentUser?.isMainAdmin) {
    // Mostrar sección del club y ocultar mensaje
    if (clubSection) clubSection.classList.remove('hidden');
    if (restrictedMsg) restrictedMsg.classList.add('hidden');
    
    // Cargar datos del club con validación
    const clubElements = {
      clubLogo: document.getElementById('clubLogo'),
      clubName: document.getElementById('clubName'),
      clubEmail: document.getElementById('clubEmail'),
      clubPhone: document.getElementById('clubPhone'),
      clubAddress: document.getElementById('clubAddress'),
      clubCity: document.getElementById('clubCity'),
      clubCountry: document.getElementById('clubCountry'),
      clubWebsite: document.getElementById('clubWebsite'),
      clubSocial: document.getElementById('clubSocial'),
      clubFoundedYear: document.getElementById('clubFoundedYear'),
      clubMonthlyFee: document.getElementById('clubMonthlyFee')
    };
    
    if (clubElements.clubLogo) clubElements.clubLogo.src = settings.logo || getDefaultLogo();
    if (clubElements.clubName) clubElements.clubName.value = settings.name || '';
    if (clubElements.clubEmail) clubElements.clubEmail.value = settings.email || '';
    if (clubElements.clubPhone) clubElements.clubPhone.value = settings.phone || '';
    if (clubElements.clubAddress) clubElements.clubAddress.value = settings.address || '';
    if (clubElements.clubCity) clubElements.clubCity.value = settings.city || '';
    if (clubElements.clubCountry) clubElements.clubCountry.value = settings.country || '';
    if (clubElements.clubWebsite) clubElements.clubWebsite.value = settings.website || '';
    if (clubElements.clubSocial) clubElements.clubSocial.value = settings.socialMedia || '';
    if (clubElements.clubFoundedYear) clubElements.clubFoundedYear.value = settings.foundedYear || '';
    if (clubElements.clubMonthlyFee) clubElements.clubMonthlyFee.value = settings.monthlyFee || '';
    
    // 👇 Cargar clubId y convertir a solo lectura si ya existe
    let clubId = settings.clubId;
    if (!clubId && settings.name) {
      clubId = settings.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    }

    const clubIdInput = document.getElementById('clubIdInput');
    if (clubIdInput) {
      if (clubId) {
        // Reemplazar input por un div de solo lectura
        const readonlyDiv = document.createElement('div');
        readonlyDiv.className = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 cursor-not-allowed';
        readonlyDiv.textContent = clubId;
        readonlyDiv.id = 'clubIdDisplay';
        readonlyDiv.title = 'ID único del club (no editable)';
        clubIdInput.parentNode.replaceChild(readonlyDiv, clubIdInput);

        // Añadir mensaje informativo
        const infoMsg = document.createElement('p');
        infoMsg.className = 'text-xs text-gray-500 dark:text-gray-400 mt-1';
        infoMsg.textContent = 'Este ID identifica tu club en la nube. No se puede cambiar.';
        readonlyDiv.parentNode.appendChild(infoMsg);
      } else {
        clubIdInput.value = 'my_club';
        clubIdInput.disabled = true;
      }
    }

    // Color primario
    const colorInput = document.getElementById('clubPrimaryColor');
    if (colorInput) {
      colorInput.value = settings.primaryColor || '#0d9488';
      if (typeof previewPrimaryColor === 'function') {
        previewPrimaryColor(settings.primaryColor || '#0d9488');
      }
    }
  } else {
    // Otros administradores: ocultar sección del club y mostrar mensaje
    if (clubSection) clubSection.classList.add('hidden');
    if (restrictedMsg) restrictedMsg.classList.remove('hidden');
  }

  // Cargar lista de usuarios (todos los usuarios)
  setTimeout(() => {
    renderSchoolUsers();
    const avatarPreview = document.getElementById('schoolUserAvatarPreview');
    if (avatarPreview) {
      avatarPreview.src = getDefaultAvatar();
    }
  }, 100);
}

// Cambiar avatar del usuario - MEJORADO
document.getElementById('changeAvatar')?.addEventListener('change', function(e) {
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
      const userAvatar = document.getElementById('userAvatar');
      if (userAvatar) userAvatar.src = base64;
      
      const currentUser = getCurrentUser();
      if (currentUser) {
        updateUser(currentUser.id, { avatar: base64 });
        setCurrentUser({ ...currentUser, avatar: base64 });
        showToast('✅ Foto actualizada');
      }
    });
  }
});

// Cambiar logo del club - MEJORADO
document.getElementById('changeClubLogo')?.addEventListener('change', function(e) {
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
      const clubLogo = document.getElementById('clubLogo');
      const headerLogo = document.getElementById('headerLogo');
      
      if (clubLogo) clubLogo.src = base64;
      if (headerLogo) headerLogo.src = base64;
      
      updateSchoolSettings({ logo: base64 });
      showToast('✅ Logo actualizado');
      
      if (typeof generatePWAIcons === 'function') {
        generatePWAIcons();
      }
    });
  }
});

// Guardar perfil de usuario
document.getElementById('userProfileForm')?.addEventListener('submit', function(e) {
  e.preventDefault();
  
  const currentUser = getCurrentUser();
  if (!currentUser) return;
  
  const userName = document.getElementById('userName');
  const userBirthDate = document.getElementById('userBirthDate');
  const userPhone = document.getElementById('userPhone');
  
  const userData = {
    name: userName ? userName.value : '',
    birthDate: userBirthDate ? userBirthDate.value : '',
    phone: userPhone ? userPhone.value : ''
  };
  
  updateUser(currentUser.id, userData);
  setCurrentUser({ ...currentUser, ...userData });
  
  showToast('✅ Perfil actualizado');
});

// NUEVO: Cambiar contraseña
document.getElementById('changePasswordForm')?.addEventListener('submit', function(e) {
  e.preventDefault();
  
  const currentUser = getCurrentUser();
  if (!currentUser) {
    showToast('❌ No hay usuario en sesión');
    return;
  }
  
  const currentPasswordInput = document.getElementById('currentPassword');
  const newPasswordInput = document.getElementById('newPassword');
  const confirmPasswordInput = document.getElementById('confirmPassword');
  
  if (!currentPasswordInput || !newPasswordInput || !confirmPasswordInput) {
    showToast('❌ Error en el formulario');
    return;
  }
  
  const currentPassword = currentPasswordInput.value;
  const newPassword = newPasswordInput.value;
  const confirmPassword = confirmPasswordInput.value;
  
  // Validar contraseña actual
  const users = getUsers();
  const user = users.find(u => u.id === currentUser.id);
  
  if (!user) {
    showToast('❌ Usuario no encontrado');
    return;
  }
  
  if (user.password !== currentPassword) {
    showToast('❌ La contraseña actual es incorrecta');
    currentPasswordInput.classList.add('border-red-500');
    return;
  }
  
  // Validar nueva contraseña
  if (newPassword.length < 6) {
    showToast('❌ La nueva contraseña debe tener al menos 6 caracteres');
    return;
  }
  
  if (newPassword !== confirmPassword) {
    showToast('❌ Las contraseñas no coinciden');
    confirmPasswordInput.classList.add('border-red-500');
    return;
  }
  
  if (newPassword === currentPassword) {
    showToast('⚠️ La nueva contraseña debe ser diferente a la actual');
    return;
  }
  
  // Actualizar contraseña
  updateUser(currentUser.id, { password: newPassword });
  
  // Limpiar formulario
  const changePasswordForm = document.getElementById('changePasswordForm');
  if (changePasswordForm) changePasswordForm.reset();
  
  showToast('✅ Contraseña cambiada correctamente');
  
  console.log('🔑 Contraseña actualizada para:', currentUser.email);
});

// NUEVO: Mostrar/Ocultar contraseña
function togglePasswordVisibility(inputId) {
  const input = document.getElementById(inputId);
  if (!input) return;
  
  const button = input.nextElementSibling;
  if (!button) return;
  
  const icon = button.querySelector('[data-lucide]');
  
  if (input.type === 'password') {
    input.type = 'text';
    if (icon) icon.setAttribute('data-lucide', 'eye-off');
  } else {
    input.type = 'password';
    if (icon) icon.setAttribute('data-lucide', 'eye');
  }
  
  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    lucide.createIcons();
  }
}

// NUEVO: Indicador de seguridad de contraseña
document.getElementById('newPassword')?.addEventListener('input', function(e) {
  const password = e.target.value;
  const strengthBar = document.getElementById('passwordStrength');
  const strengthText = document.getElementById('passwordStrengthText');
  
  if (!strengthBar || !strengthText) return;
  
  let strength = 0;
  let text = '';
  let color = '';
  
  if (password.length === 0) {
    strength = 0;
    text = '';
  } else if (password.length < 6) {
    strength = 25;
    text = 'Muy débil';
    color = 'bg-red-500';
  } else if (password.length < 8) {
    strength = 50;
    text = 'Débil';
    color = 'bg-orange-500';
  } else if (password.length < 10) {
    strength = 75;
    text = 'Media';
    color = 'bg-yellow-500';
  } else {
    strength = 100;
    text = 'Fuerte';
    color = 'bg-green-500';
  }
  
  // Bonus por caracteres especiales
  if (/[A-Z]/.test(password)) strength += 5;
  if (/[0-9]/.test(password)) strength += 5;
  if (/[^A-Za-z0-9]/.test(password)) strength += 10;
  
  strength = Math.min(100, strength);
  
  strengthBar.style.width = strength + '%';
  strengthBar.className = `h-full transition-all duration-300 ${color}`;
  strengthText.textContent = text;
});

// Guardar configuración del club - SIN permitir cambiar clubId
document.getElementById('clubSettingsForm')?.addEventListener('submit', function(e) {
  e.preventDefault();
  
  const currentUser = getCurrentUser();
  if (!currentUser?.isMainAdmin) {
    showToast('⚠️ Solo el administrador principal puede guardar la configuración del club');
    return;
  }
  
  const clubName = document.getElementById('clubName');
  const clubEmail = document.getElementById('clubEmail');
  const clubPhone = document.getElementById('clubPhone');
  const clubAddress = document.getElementById('clubAddress');
  const clubCity = document.getElementById('clubCity');
  const clubCountry = document.getElementById('clubCountry');
  const clubWebsite = document.getElementById('clubWebsite');
  const clubSocial = document.getElementById('clubSocial');
  const clubFoundedYear = document.getElementById('clubFoundedYear');
  const clubMonthlyFee = document.getElementById('clubMonthlyFee');
  
  const settings = {
    name: clubName ? clubName.value : '',
    email: clubEmail ? clubEmail.value : '',
    phone: clubPhone ? clubPhone.value : '',
    address: clubAddress ? clubAddress.value : '',
    city: clubCity ? clubCity.value : '',
    country: clubCountry ? clubCountry.value : '',
    website: clubWebsite ? clubWebsite.value : '',
    socialMedia: clubSocial ? clubSocial.value : '',
    foundedYear: clubFoundedYear ? clubFoundedYear.value : '',
    monthlyFee: clubMonthlyFee ? parseFloat(clubMonthlyFee.value) : 0
  };
  
  // Preservar clubId existente (¡nunca se sobrescribe!)
  const existing = getSchoolSettings();
  if (existing.clubId) {
    settings.clubId = existing.clubId;
  }

  // Color primario
  const colorInput = document.getElementById('clubPrimaryColor');
  if (colorInput) {
    settings.primaryColor = colorInput.value;
  }
  
  updateSchoolSettings(settings);
  
  if (typeof applyPrimaryColor === 'function') {
    applyPrimaryColor();
  }
  
  const headerClubName = document.getElementById('headerClubName');
  if (headerClubName) headerClubName.textContent = settings.name;
  
  showToast('✅ Configuración del club actualizada');
});

// Preview de color en tiempo real
document.getElementById('clubPrimaryColor')?.addEventListener('input', function(e) {
  if (typeof previewPrimaryColor === 'function') {
    previewPrimaryColor(e.target.value);
  }
});

// Exportar datos
function exportData() {
  exportAllData();
}

// ========================================
// GESTIÓN DE USUARIOS DE LA ESCUELA
// ========================================

// Renderizar lista de usuarios de la escuela
function renderSchoolUsers() {
  const currentUser = getCurrentUser();
  if (!currentUser) return;
  
  const schoolUsers = getSchoolUsers(currentUser.schoolId);
  const container = document.getElementById('schoolUsersList');
  
  if (!container) {
    console.warn('⚠️ Elemento schoolUsersList no encontrado');
    return;
  }
  
  container.innerHTML = schoolUsers.map(user => `
    <div class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
      <div class="flex items-center gap-3">
        <img src="${user.avatar || getDefaultAvatar()}" alt="${user.name}" class="w-10 h-10 rounded-full object-cover border-2 border-teal-500">
        <div>
          <p class="font-medium text-gray-800 dark:text-white">${user.name}</p>
          <p class="text-xs text-gray-500 dark:text-gray-400">${user.email}</p>
          ${user.isMainAdmin ? '<span class="text-xs bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-300 px-2 py-1 rounded mt-1 inline-block">Admin Principal</span>' : ''}
        </div>
      </div>
      ${!user.isMainAdmin && currentUser.isMainAdmin ? `
        <button onclick="deleteSchoolUser('${user.id}')" class="text-red-600 hover:text-red-700 p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20">
          <i data-lucide="trash-2" class="w-4 h-4"></i>
        </button>
      ` : ''}
    </div>
  `).join('');
  
  const counterDiv = document.getElementById('usersCounter');
  if (counterDiv) {
    counterDiv.innerHTML = `
      <p class="text-sm text-gray-600 dark:text-gray-400">
        <strong>${schoolUsers.length}</strong> de <strong>6</strong> usuarios
      </p>
    `;
  }
  
  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    setTimeout(() => {
      try {
        lucide.createIcons();
      } catch (error) {
        console.warn('⚠️ Error al crear iconos:', error);
      }
    }, 100);
  }
}

// Mostrar modal agregar usuario
function showAddSchoolUserModal() {
  const currentUser = getCurrentUser();
  if (!currentUser) return;
  
  if (!currentUser.isMainAdmin) {
    showToast('⚠️ Solo el administrador principal puede agregar usuarios');
    return;
  }
  
  if (!canAddMoreUsers(currentUser.schoolId)) {
    showToast('⚠️ Has alcanzado el límite de 6 usuarios por escuela');
    return;
  }
  
  const addSchoolUserForm = document.getElementById('addSchoolUserForm');
  const schoolUserAvatarPreview = document.getElementById('schoolUserAvatarPreview');
  const addSchoolUserModal = document.getElementById('addSchoolUserModal');
  
  if (addSchoolUserForm) addSchoolUserForm.reset();
  if (schoolUserAvatarPreview) schoolUserAvatarPreview.src = getDefaultAvatar();
  if (addSchoolUserModal) addSchoolUserModal.classList.remove('hidden');
}

// Cerrar modal
function closeAddSchoolUserModal() {
  const addSchoolUserModal = document.getElementById('addSchoolUserModal');
  if (addSchoolUserModal) addSchoolUserModal.classList.add('hidden');
}

// 🔥 Guardar nuevo usuario de la escuela - CON FIREBASE AUTHENTICATION
// VERSIÓN CORREGIDA - CON MAPEO Y RESTAURACIÓN DE SESIÓN
async function saveSchoolUser(userData) {
  const currentUser = getCurrentUser();
  if (!currentUser) return;
  
  const users = getUsers();
  if (users.find(u => u.email === userData.email)) {
    showToast('❌ Este email ya está registrado');
    return;
  }
  
  // 🔥 CREAR EN FIREBASE AUTHENTICATION PRIMERO
  if (window.APP_STATE?.firebaseReady && window.firebase?.auth) {
    try {
      console.log('🔥 Creando usuario en Firebase Authentication...');
      showToast('🔥 Creando cuenta en Firebase...');
      
      // ⭐ IMPORTANTE: Guardar datos del admin ANTES de crear el nuevo usuario
      const adminUser = window.firebase.auth.currentUser;
      const adminEmail = adminUser ? adminUser.email : currentUser.email;
      
      // Obtener contraseña del admin desde localStorage (más confiable)
      const allUsers = getUsers();
      const adminFromStorage = allUsers.find(u => u.id === currentUser.id);
      const adminPassword = adminFromStorage ? adminFromStorage.password : null;
      
      if (!adminPassword) {
        console.warn('⚠️ No se pudo obtener contraseña del admin');
        showToast('⚠️ Advertencia: Puede que necesites volver a iniciar sesión');
      }
      
      // Crear el nuevo usuario en Firebase Auth
      const userCredential = await window.firebase.createUserWithEmailAndPassword(
        window.firebase.auth,
        userData.email,
        userData.password
      );
      
      const newUserUid = userCredential.user.uid;
      console.log('✅ Usuario creado en Firebase Auth con UID:', newUserUid);
      
      // Crear objeto de usuario local con el UID de Firebase
      const newUser = {
        id: newUserUid, // ⭐ Usar UID de Firebase como ID
        schoolId: currentUser.schoolId,
        email: userData.email,
        password: userData.password,
        name: userData.name,
        birthDate: userData.birthDate || '',
        phone: userData.phone || '',
        avatar: userData.avatar || getDefaultAvatar(),
        role: 'admin',
        isMainAdmin: false,
        createdAt: getCurrentDate(),
        firebaseUid: newUserUid
      };
      
      // Guardar localmente
      saveUser(newUser);
      console.log('✅ Usuario guardado localmente');
      
      // Guardar en Firestore
      const settings = getSchoolSettings();
      const clubId = settings.clubId || currentUser.schoolId || 'default_club';
      
      await window.firebase.setDoc(
        window.firebase.doc(window.firebase.db, `clubs/${clubId}/users`, newUserUid),
        {
          id: newUserUid,
          email: newUser.email,
          name: newUser.name,
          isMainAdmin: false,
          role: 'admin',
          avatar: newUser.avatar || '',
          phone: newUser.phone || '',
          birthDate: newUser.birthDate || '',
          createdAt: new Date().toISOString()
        }
      );
      console.log('✅ Usuario guardado en Firestore');
      
      // ⭐ CRÍTICO: Guardar mapeo email → clubId (para login multi-dispositivo)
      if (typeof saveUserClubMapping === 'function') {
        const mappingSaved = await saveUserClubMapping(userData.email, clubId, newUserUid);
        if (mappingSaved) {
          console.log('✅ Mapeo guardado - Login multi-dispositivo habilitado');
        } else {
          console.warn('⚠️ Mapeo no guardado - puede afectar login multi-dispositivo');
        }
      }
      
      // 🔄 IMPORTANTE: Cerrar sesión del nuevo usuario
      await window.firebase.signOut(window.firebase.auth);
      console.log('🔄 Sesión del nuevo usuario cerrada');
      
      // ⭐ RESTAURAR sesión del admin
      if (adminEmail && adminPassword) {
        try {
          await window.firebase.signInWithEmailAndPassword(
            window.firebase.auth,
            adminEmail,
            adminPassword
          );
          console.log('✅ Sesión del admin restaurada');
          window.APP_STATE.currentUser = window.firebase.auth.currentUser;
        } catch (reAuthError) {
          console.error('❌ Error al restaurar sesión del admin:', reAuthError);
          showToast('⚠️ Usuario creado, pero necesitas volver a iniciar sesión');
          
          // Redirigir al login después de un tiempo
          setTimeout(() => {
            logout();
          }, 2000);
          return;
        }
      } else {
        console.warn('⚠️ No se pudo restaurar sesión del admin');
        showToast('⚠️ Usuario creado, pero necesitas volver a iniciar sesión');
        
        setTimeout(() => {
          logout();
        }, 2000);
        return;
      }
      
      showToast('✅ Usuario creado correctamente');
      
      // Resumen en consola
      console.log('✅ ========================================');
      console.log('✅ USUARIO CREADO EXITOSAMENTE');
      console.log('✅ ========================================');
      console.log('📋 Resumen:');
      console.log('   • UID:', newUserUid);
      console.log('   • Email:', userData.email);
      console.log('   • Club ID:', clubId);
      console.log('   • Usuario en Auth: ✅');
      console.log('   • Usuario en Firestore: ✅');
      console.log('   • Mapeo guardado: ✅');
      console.log('   • Sesión admin restaurada: ✅');
      console.log('========================================');
      console.log('💡 El nuevo usuario puede hacer login con:');
      console.log('   Email:', userData.email);
      console.log('   Contraseña: (la configurada)');
      console.log('   Club ID:', clubId, '(opcional)');
      console.log('========================================');
      
    } catch (error) {
      console.error('❌ Error al crear usuario en Firebase:', error);
      
      if (error.code === 'auth/email-already-in-use') {
        showToast('❌ Este email ya existe en Firebase');
      } else if (error.code === 'auth/weak-password') {
        showToast('❌ La contraseña debe tener al menos 6 caracteres');
      } else if (error.code === 'auth/invalid-email') {
        showToast('❌ Email inválido');
      } else {
        showToast('❌ Error: ' + error.message);
      }
      return;
    }
  } else {
    console.log('⚠️ Firebase no disponible');
    showToast('❌ Firebase no disponible. Intenta más tarde.');
    return;
  }

  closeAddSchoolUserModal();
  renderSchoolUsers();
}

// Eliminar usuario de la escuela
function deleteSchoolUser(userId) {
  if (!confirmAction('¿Estás seguro de eliminar este usuario? Perderá acceso a la escuela.')) return;
  
  let users = getUsers();
  users = users.filter(u => u.id !== userId);
  localStorage.setItem('users', JSON.stringify(users));
  
  // ✅ SINCRONIZAR ELIMINACIÓN CON FIREBASE
  if (typeof syncAllToFirebase === 'function') {
    syncAllToFirebase();
  }
  
  showToast('✅ Usuario eliminado');
  renderSchoolUsers();
}

// Preview avatar del nuevo usuario
document.getElementById('schoolUserAvatar')?.addEventListener('change', function(e) {
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
      const schoolUserAvatarPreview = document.getElementById('schoolUserAvatarPreview');
      if (schoolUserAvatarPreview) schoolUserAvatarPreview.src = base64;
    });
  }
});

// Form submit para agregar usuario
document.getElementById('addSchoolUserForm')?.addEventListener('submit', function(e) {
  e.preventDefault();
  
  const schoolUserAvatar = document.getElementById('schoolUserAvatar');
  const schoolUserAvatarPreview = document.getElementById('schoolUserAvatarPreview');
  const schoolUserName = document.getElementById('schoolUserName');
  const schoolUserEmail = document.getElementById('schoolUserEmail');
  const schoolUserPhone = document.getElementById('schoolUserPhone');
  const schoolUserPassword = document.getElementById('schoolUserPassword');
  const schoolUserBirthDate = document.getElementById('schoolUserBirthDate');
  
  const avatarFile = schoolUserAvatar ? schoolUserAvatar.files[0] : null;
  const currentAvatar = schoolUserAvatarPreview ? schoolUserAvatarPreview.src : getDefaultAvatar();
  
  const userData = {
    name: schoolUserName ? schoolUserName.value : '',
    email: schoolUserEmail ? schoolUserEmail.value : '',
    phone: schoolUserPhone ? schoolUserPhone.value : '',
    password: schoolUserPassword ? schoolUserPassword.value : '',
    birthDate: schoolUserBirthDate ? schoolUserBirthDate.value : ''
  };
  
  if (avatarFile) {
    imageToBase64(avatarFile, function(base64) {
      userData.avatar = base64;
      saveSchoolUser(userData);
    });
  } else {
    userData.avatar = currentAvatar;
    saveSchoolUser(userData);
  }
});

// Toggle sección plegable
function toggleSection(sectionId) {
  const section = document.getElementById(sectionId);
  if (!section) {
    console.warn('⚠️ Sección no encontrada:', sectionId);
    return;
  }
  
  const prevElement = section.previousElementSibling;
  if (!prevElement) {
    console.warn('⚠️ Elemento previo no encontrado para:', sectionId);
    return;
  }
  
  const icon = prevElement.querySelector('i');
  
  // Alternar la sección actual
  section.classList.toggle('hidden');
  
  if (icon) {
    if (section.classList.contains('hidden')) {
      icon.setAttribute('data-lucide', 'chevron-down');
    } else {
      icon.setAttribute('data-lucide', 'chevron-up');
    }
    
    // Recrear iconos
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
      setTimeout(() => {
        try {
          lucide.createIcons();
        } catch (error) {
          console.warn('⚠️ Error al crear iconos:', error);
        }
      }, 50);
    }
  }
}

console.log('✅ settings.js cargado (VERSIÓN CORREGIDA CON MAPEO Y RESTAURACIÓN)');