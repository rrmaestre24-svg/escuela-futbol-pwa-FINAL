// ========================================
// CONFIGURACIÓN - CON GESTIÓN DE CONTRASEÑAS
// ========================================

// Cargar configuración al abrir vista
function loadSettings() {
  const currentUser = getCurrentUser();
  const settings = getSchoolSettings();
  
  // Datos del usuario
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
  
  // Datos del club - MEJORADO
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
  
  // Color primario
  const colorInput = document.getElementById('clubPrimaryColor');
  if (colorInput) {
    colorInput.value = settings.primaryColor || '#0d9488';
    previewPrimaryColor(settings.primaryColor || '#0d9488');
  }
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

// Guardar configuración del club - MEJORADO CON COLOR
document.getElementById('clubSettingsForm')?.addEventListener('submit', function(e) {
  e.preventDefault();
  
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
  
  // Agregar color primario si existe el campo
  const colorInput = document.getElementById('clubPrimaryColor');
  if (colorInput) {
    settings.primaryColor = colorInput.value;
  }
  
  updateSchoolSettings(settings);
  
  // Aplicar nuevo color inmediatamente
  if (typeof applyPrimaryColor === 'function') {
    applyPrimaryColor();
  }
  
  document.getElementById('headerClubName').textContent = settings.name;
  
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
      
      // AGREGAR ESTA LÍNEA
      if (typeof generatePWAIcons === 'function') {
        generatePWAIcons();
      }
    });
  }
});
console.log('✅ settings.js cargado (CON GESTIÓN DE CONTRASEÑAS)');