// ========================================
// CONFIGURACIÓN - MEJORADO
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

// Guardar configuración del club - MEJORADO
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
  
  updateSchoolSettings(settings);
  
  document.getElementById('headerClubName').textContent = settings.name;
  
  showToast('✅ Configuración del club actualizada');
});

// Toggle modo oscuro (ya corregido en app.js)
function toggleDarkMode() {
  const html = document.documentElement;
  const isDark = html.classList.contains('dark');
  
  if (isDark) {
    html.classList.remove('dark');
    setDarkMode(false);
    showToast('☀️ Modo claro activado');
  } else {
    html.classList.add('dark');
    setDarkMode(true);
    showToast('🌙 Modo oscuro activado');
  }
  
  updateDarkModeIcons();
}

// Exportar datos
function exportData() {
  exportAllData();
}

// Aplicar modo oscuro al cargar
function applyDarkMode() {
  if (getDarkMode()) {
    document.documentElement.classList.add('dark');
  }
}

console.log('✅ settings.js cargado (MEJORADO)');