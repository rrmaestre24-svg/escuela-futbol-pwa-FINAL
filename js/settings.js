// ========================================
// CONFIGURACIÓN - CON GESTIÓN DE CONTRASEÑAS Y CLUB ID (SOLO LECTURA)
// ========================================

// Cargar configuración al abrir vista
function loadSettings() {
  const currentUser = getCurrentUser();
  const settings = getSchoolSettings();
  
  // Datos del usuario (todos los usuarios)
  if (currentUser) {
    document.getElementById('userAvatar').src = currentUser.avatar || getDefaultAvatar();
    document.getElementById('userName').value = currentUser.name || '';
    document.getElementById('userBirthDate').value = currentUser.birthDate || '';
    document.getElementById('userPhone').value = currentUser.phone || '';
    
    // Mostrar email (no editable por seguridad)
    const emailDisplay = document.getElementById('userEmailDisplay');
    if (emailDisplay) {
      emailDisplay.textContent = currentUser.email || '';
    }
  }
  
  // 👥 RESTRICCIÓN: Solo el admin principal ve/edita la configuración del club
  const clubSection = document.getElementById('clubSettingsSection');
  const restrictedMsg = document.getElementById('clubSettingsRestricted');
  
  if (currentUser?.isMainAdmin) {
    // Mostrar sección del club y ocultar mensaje
    if (clubSection) clubSection.classList.remove('hidden');
    if (restrictedMsg) restrictedMsg.classList.add('hidden');
    
    // Cargar datos del club
    document.getElementById('clubLogo').src = settings.logo || getDefaultLogo();
    document.getElementById('clubName').value = settings.name || '';
    document.getElementById('clubEmail').value = settings.email || '';
    document.getElementById('clubPhone').value = settings.phone || '';
    document.getElementById('clubAddress').value = settings.address || '';
    document.getElementById('clubCity').value = settings.city || '';
    document.getElementById('clubCountry').value = settings.country || '';
    document.getElementById('clubWebsite').value = settings.website || '';
    document.getElementById('clubSocial').value = settings.socialMedia || '';
    document.getElementById('clubFoundedYear').value = settings.foundedYear || '';
    document.getElementById('clubMonthlyFee').value = settings.monthlyFee || '';
    
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
      previewPrimaryColor(settings.primaryColor || '#0d9488');
    }
  } else {
    // Otros administradores: ocultar sección del club y mostrar mensaje
    if (clubSection) clubSection.classList.add('hidden');
    if (restrictedMsg) restrictedMsg.classList.remove('hidden');
  }

  // Cargar lista de usuarios (todos los usuarios)
  setTimeout(() => {
    renderSchoolUsers();
    document.getElementById('schoolUserAvatarPreview')?.setAttribute('src', getDefaultAvatar());
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
      document.getElementById('userAvatar').src = base64;
      
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
      document.getElementById('clubLogo').src = base64;
      document.getElementById('headerLogo').src = base64;
      
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
  
  const userData = {
    name: document.getElementById('userName').value,
    birthDate: document.getElementById('userBirthDate').value,
    phone: document.getElementById('userPhone').value
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
  
  const currentPassword = document.getElementById('currentPassword').value;
  const newPassword = document.getElementById('newPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;
  
  // Validar contraseña actual
  const users = getUsers();
  const user = users.find(u => u.id === currentUser.id);
  
  if (!user) {
    showToast('❌ Usuario no encontrado');
    return;
  }
  
  if (user.password !== currentPassword) {
    showToast('❌ La contraseña actual es incorrecta');
    document.getElementById('currentPassword').classList.add('border-red-500');
    return;
  }
  
  // Validar nueva contraseña
  if (newPassword.length < 6) {
    showToast('❌ La nueva contraseña debe tener al menos 6 caracteres');
    return;
  }
  
  if (newPassword !== confirmPassword) {
    showToast('❌ Las contraseñas no coinciden');
    document.getElementById('confirmPassword').classList.add('border-red-500');
    return;
  }
  
  if (newPassword === currentPassword) {
    showToast('⚠️ La nueva contraseña debe ser diferente a la actual');
    return;
  }
  
  // Actualizar contraseña
  updateUser(currentUser.id, { password: newPassword });
  
  // Limpiar formulario
  document.getElementById('changePasswordForm').reset();
  
  showToast('✅ Contraseña cambiada correctamente');
  
  console.log('🔐 Contraseña actualizada para:', currentUser.email);
});

// NUEVO: Mostrar/Ocultar contraseña
function togglePasswordVisibility(inputId) {
  const input = document.getElementById(inputId);
  const button = input.nextElementSibling;
  const icon = button.querySelector('[data-lucide]');
  
  if (input.type === 'password') {
    input.type = 'text';
    icon.setAttribute('data-lucide', 'eye-off');
  } else {
    input.type = 'password';
    icon.setAttribute('data-lucide', 'eye');
  }
  
  lucide.createIcons();
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
  
  const settings = {
    name: document.getElementById('clubName').value,
    email: document.getElementById('clubEmail').value,
    phone: document.getElementById('clubPhone').value,
    address: document.getElementById('clubAddress').value,
    city: document.getElementById('clubCity').value,
    country: document.getElementById('clubCountry').value,
    website: document.getElementById('clubWebsite').value,
    socialMedia: document.getElementById('clubSocial').value,
    foundedYear: document.getElementById('clubFoundedYear').value,
    monthlyFee: parseFloat(document.getElementById('clubMonthlyFee').value)
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
  
  document.getElementById('headerClubName').textContent = settings.name;
  showToast('✅ Configuración del club actualizada');
});

// Preview de color en tiempo real
document.getElementById('clubPrimaryAddress')?.addEventListener('input', function(e) {
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
  
  if (!container) return;
  
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
  
  lucide.createIcons();
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
  
  document.getElementById('addSchoolUserForm').reset();
  document.getElementById('schoolUserAvatarPreview').src = getDefaultAvatar();
  document.getElementById('addSchoolUserModal').classList.remove('hidden');
}

// Cerrar modal
function closeAddSchoolUserModal() {
  document.getElementById('addSchoolUserModal').classList.add('hidden');
}

// Guardar nuevo usuario de la escuela
function saveSchoolUser(userData) {
  const currentUser = getCurrentUser();
  if (!currentUser) return;
  
  const users = getUsers();
  if (users.find(u => u.email === userData.email)) {
    showToast('❌ Este email ya está registrado');
    return;
  }
  
  const newUser = {
    id: generateId(),
    schoolId: currentUser.schoolId,
    email: userData.email,
    password: userData.password,
    name: userData.name,
    birthDate: userData.birthDate || '',
    phone: userData.phone || '',
    avatar: userData.avatar || getDefaultAvatar(),
    role: 'admin',
    isMainAdmin: false,
    createdAt: getCurrentDate()
  };
  
  saveUser(newUser);

// ✅ GUARDAR SOLO EL NUEVO USUARIO EN FIREBASE (más seguro)
if (typeof saveUserToClubInFirebase === 'function') {
  saveUserToClubInFirebase(newUser);
}

showToast('✅ Usuario agregado correctamente');
closeAddSchoolUserModal();
renderSchoolUsers();
  showToast('✅ Usuario agregado correctamente');
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
      document.getElementById('schoolUserAvatarPreview').src = base64;
    });
  }
});

// Form submit para agregar usuario
document.getElementById('addSchoolUserForm')?.addEventListener('submit', function(e) {
  e.preventDefault();
  
  const avatarFile = document.getElementById('schoolUserAvatar').files[0];
  const currentAvatar = document.getElementById('schoolUserAvatarPreview').src;
  
  const userData = {
    name: document.getElementById('schoolUserName').value,
    email: document.getElementById('schoolUserEmail').value,
    phone: document.getElementById('schoolUserPhone').value,
    password: document.getElementById('schoolUserPassword').value,
    birthDate: document.getElementById('schoolUserBirthDate').value
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
  const icon = section.previousElementSibling.querySelector('i');
  
  // Alternar la sección actual
  section.classList.toggle('hidden');
  if (section.classList.contains('hidden')) {
    icon.setAttribute('data-lucide', 'chevron-down');
  } else {
    icon.setAttribute('data-lucide', 'chevron-up');
  }
  
  // Recrear iconos
  lucide.createIcons();
}

console.log('✅ settings.js cargado (PERMISOS POR ROL + CLUB ID SOLO LECTURA + SINCRONIZACIÓN AUTOMÁTICA)');