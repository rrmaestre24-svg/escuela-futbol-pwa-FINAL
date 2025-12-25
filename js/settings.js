// ========================================
// CONFIGURACIÓN
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
  
  // Datos del club
  document.getElementById('clubLogo').src = settings.logo || getDefaultLogo();
  document.getElementById('clubName').value = settings.name || '';
  document.getElementById('clubEmail').value = settings.email || '';
  document.getElementById('clubPhone').value = settings.phone || '';
  document.getElementById('clubAddress').value = settings.address || '';
  document.getElementById('clubMonthlyFee').value = settings.monthlyFee || '';
}

// Cambiar avatar del usuario
document.getElementById('changeAvatar')?.addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (file) {
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

// Cambiar logo del club
document.getElementById('changeClubLogo')?.addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (file) {
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
  
  document.getElementById('headerClubName').textContent = getSchoolSettings().name;
  
  showToast('✅ Perfil actualizado');
});

// Guardar configuración del club
document.getElementById('clubSettingsForm')?.addEventListener('submit', function(e) {
  e.preventDefault();
  
  const settings = {
    name: document.getElementById('clubName').value,
    email: document.getElementById('clubEmail').value,
    phone: document.getElementById('clubPhone').value,
    address: document.getElementById('clubAddress').value,
    monthlyFee: parseFloat(document.getElementById('clubMonthlyFee').value)
  };
  
  updateSchoolSettings(settings);
  
  document.getElementById('headerClubName').textContent = settings.name;
  
  showToast('✅ Configuración del club actualizada');
});

// Toggle modo oscuro
function toggleDarkMode() {
  const html = document.documentElement;
  const isDark = html.classList.contains('dark');
  
  if (isDark) {
    html.classList.remove('dark');
    setDarkMode(false);
  } else {
    html.classList.add('dark');
    setDarkMode(true);
  }
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

console.log('✅ settings.js cargado');