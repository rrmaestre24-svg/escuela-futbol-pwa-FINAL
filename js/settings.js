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
  
  // ✅ CARGAR DATOS DEL CLUB PARA TODOS (mostrar siempre)
  const clubSection = document.getElementById('clubSettingsSection');
  const restrictedMsg = document.getElementById('clubSettingsRestricted');
  
  // Siempre mostrar la sección del club
  if (clubSection) clubSection.classList.remove('hidden');
  if (restrictedMsg) restrictedMsg.classList.add('hidden');
  
  // ✅ CARGAR DATOS DEL CLUB (PARA TODOS)
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
    clubMonthlyFee: document.getElementById('clubMonthlyFee'),
    coachCode: document.getElementById('coachCode'),
    monthlyDueDay: document.getElementById('monthlyDueDay'),
    monthlyGraceDays: document.getElementById('monthlyGraceDays'),
    monthlyReminderTemplate: document.getElementById('monthlyReminderTemplate'),
    pdfFooterMessage: document.getElementById('pdfFooterMessage')
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
  if (clubElements.clubFoundedYear) {
    const currentYear = new Date().getFullYear();
    const savedYear = Number(settings.foundedYear);
    const effectiveMax = Number.isFinite(savedYear) ? Math.max(currentYear, savedYear) : currentYear;
    clubElements.clubFoundedYear.max = String(effectiveMax);
    clubElements.clubFoundedYear.value = settings.foundedYear || '';
  }
  if (clubElements.clubMonthlyFee) clubElements.clubMonthlyFee.value = settings.monthlyFee || '';
  if (clubElements.coachCode) clubElements.coachCode.value = settings.coachCode || '';
  const dueDayNum = Number(settings.monthlyDueDay);
  const graceDaysNum = Number(settings.monthlyGraceDays);
  const safeDueDay = Number.isFinite(dueDayNum) ? Math.max(1, Math.min(28, dueDayNum)) : 10;
  const safeGraceDays = Number.isFinite(graceDaysNum) ? Math.max(0, Math.min(60, graceDaysNum)) : 5;
  if (clubElements.monthlyDueDay) clubElements.monthlyDueDay.value = safeDueDay;
  if (clubElements.monthlyGraceDays) clubElements.monthlyGraceDays.value = safeGraceDays;
  if (clubElements.monthlyReminderTemplate) {
    clubElements.monthlyReminderTemplate.value = settings.monthlyReminderTemplate || '';
  }
  if (clubElements.pdfFooterMessage) {
    clubElements.pdfFooterMessage.value = settings.pdfFooterMessage || '';
  }
  
  // ✅ Cargar clubId (solo lectura para todos)
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
  
  // ⚠️ DESHABILITAR CAMPOS SI NO ES ADMIN PRINCIPAL
  if (!currentUser?.isMainAdmin) {
    console.log('🔒 Usuario secundario: campos en modo solo lectura');
    
    // Deshabilitar todos los campos del club
    Object.values(clubElements).forEach(element => {
      if (element && element.tagName === 'INPUT') {
        element.disabled = true;
        element.classList.add('cursor-not-allowed', 'bg-gray-100', 'dark:bg-gray-800');
      }
    });
    
    // Deshabilitar color picker
    if (colorInput) {
      colorInput.disabled = true;
      colorInput.classList.add('cursor-not-allowed');
    }
    
    // Ocultar botón de guardar
    const saveButton = document.querySelector('#clubSettingsForm button[type="submit"]');
    if (saveButton) {
      saveButton.style.display = 'none';
    }
    
    // Ocultar botón de cambiar logo
    const changeLogoLabel = document.querySelector('label[for="changeClubLogo"]');
    if (changeLogoLabel) {
      changeLogoLabel.style.display = 'none';
    }
    
    // Mostrar mensaje informativo
    const formContainer = document.getElementById('clubSettingsForm');
    if (formContainer && !document.getElementById('readOnlyMessage')) {
      const message = document.createElement('div');
      message.id = 'readOnlyMessage';
      message.className = 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4';
      message.innerHTML = `
        <p class="text-sm text-blue-800 dark:text-blue-300">
          <strong>ℹ️ Información:</strong> Solo el administrador principal puede modificar estos datos.
        </p>
      `;
      formContainer.insertBefore(message, formContainer.firstChild);
    }
  } else {
    console.log('👑 Admin principal: campos editables');
  }

// ✅ Cargar lista de usuarios (TODOS LOS USUARIOS PUEDEN VERLA)
  setTimeout(() => {
    renderSchoolUsers();
    const avatarPreview = document.getElementById('schoolUserAvatarPreview');
    if (avatarPreview) {
      avatarPreview.src = getDefaultAvatar();
    }
  }, 100);
  
  // ✅ Cargar configuración de vibración
  loadVibrationSetting();
}

document.getElementById('changeAvatar')?.addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (file) {
    if (!file.type.startsWith('image/')) {
      showToast('❌ Por favor selecciona una imagen válida');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('❌ La imagen es muy grande. Máximo 5MB');
      return;
    }
    
    // ✅ COMPRIMIR IMAGEN ANTES DE GUARDAR
    imageToBase64(file, async function(base64) {
      console.log('🗜️ Comprimiendo avatar del usuario actual...');
      const compressed = await compressImageForFirebase(base64, 300, 0.6);
      
      const userAvatar = document.getElementById('userAvatar');
      if (userAvatar) userAvatar.src = compressed;
      
      const currentUser = getCurrentUser();
      if (currentUser) {
        updateUser(currentUser.id, { avatar: compressed });
        setCurrentUser({ ...currentUser, avatar: compressed });
        showToast('✅ Foto actualizada');
      }
      console.log(`✅ Avatar comprimido: ${Math.round(base64.length/1024)}KB → ${Math.round(compressed.length/1024)}KB`);
    });
  }
});


// Cambiar logo del club - ✅ CON COMPRESIÓN
document.getElementById('changeClubLogo')?.addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (file) {
    if (!file.type.startsWith('image/')) {
      showToast('❌ Por favor selecciona una imagen válida');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('❌ La imagen es muy grande. Máximo 5MB');
      return;
    }
    
    // ✅ COMPRIMIR LOGO ANTES DE GUARDAR
    imageToBase64(file, async function(base64) {
      console.log('🗜️ Comprimiendo logo del club...');
      const compressed = await compressImageForFirebase(base64, 400, 0.7);
      
      const clubLogo = document.getElementById('clubLogo');
      const headerLogo = document.getElementById('headerLogo');
      
      if (clubLogo) clubLogo.src = compressed;
      if (headerLogo) headerLogo.src = compressed;

      // ✅ Guardar base64 local inmediatamente (sin forzar escritura en settings/main)
      if (typeof saveSchoolSettings === 'function') {
        saveSchoolSettings({ logo: compressed });
      } else {
        const current = JSON.parse(localStorage.getItem('schoolSettings') || '{}');
        localStorage.setItem('schoolSettings', JSON.stringify({ ...current, logo: compressed }));
      }
      showToast('⏳ Subiendo logo a la nube...');

      // ✅ Subir a Firebase Storage
// ✅ Guardar logo en documento separado de Firestore
      try {
        if (window.firebase?.db) {
          const settings = getSchoolSettings();
          const clubId = settings.clubId || localStorage.getItem('clubId') || 'default';
          
          await window.firebase.setDoc(
            window.firebase.doc(window.firebase.db, `clubs/${clubId}/assets`, 'logo'),
            { 
              logo: compressed,
              updatedAt: new Date().toISOString()
            }
          );
          
          console.log('✅ Logo guardado en Firestore (documento separado)');
          showToast('✅ Logo actualizado en la nube');
        } else {
          showToast('✅ Logo actualizado localmente');
        }
      } catch (storageError) {
        console.error('❌ Error guardando logo:', storageError);
        showToast('⚠️ Logo guardado solo localmente');
      }
      
      console.log(`✅ Logo comprimido: ${Math.round(base64.length/1024)}KB → ${Math.round(compressed.length/1024)}KB`);
      
      // ⭐ GENERAR ICONOS PWA CON EL NUEVO LOGO
      if (typeof generatePWAIcons === 'function') {
        console.log('🎨 Regenerando íconos de la PWA...');
        localStorage.removeItem('pwa_icon_192');
        localStorage.removeItem('pwa_icon_512');
        localStorage.removeItem('pwa_icons_updated');
        setTimeout(() => {
          generatePWAIcons();
        }, 800);
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

// NUEVO: Cambiar contraseña - CON FIREBASE AUTHENTICATION
document.getElementById('changePasswordForm')?.addEventListener('submit', async function(e) {
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
  
  // 🔥 ACTUALIZAR EN FIREBASE AUTHENTICATION
  try {
    const firebaseUser = window.firebase?.auth?.currentUser;
    
    if (!firebaseUser) {
      showToast('❌ No hay sesión activa en Firebase');
      return;
    }
    
    showToast('🔄 Cambiando contraseña...');
    
    // 1. Re-autenticar (requerido por Firebase)
    const credential = window.firebase.EmailAuthProvider.credential(
      firebaseUser.email,
      currentPassword
    );
    
    await window.firebase.reauthenticateWithCredential(firebaseUser, credential);
    console.log('✅ Re-autenticación exitosa');
    
    // 2. Actualizar contraseña en Firebase
    await window.firebase.updatePassword(firebaseUser, newPassword);
    console.log('✅ Contraseña actualizada en Firebase Authentication');
    
    // 3. Actualizar en localStorage (mantener coherencia)
    updateUser(currentUser.id, { password: newPassword });
    console.log('✅ Contraseña actualizada en localStorage');
    
    // 4. Actualizar en Firestore si existe
    const clubId = localStorage.getItem('clubId');
    if (clubId && window.firebase?.db) {
      try {
        await window.firebase.updateDoc(
          window.firebase.doc(window.firebase.db, `clubs/${clubId}/users`, currentUser.id),
          { 
            passwordUpdatedAt: new Date().toISOString()
          }
        );
        console.log('✅ Timestamp actualizado en Firestore');
      } catch (firestoreError) {
        console.log('ℹ️ No se pudo actualizar Firestore:', firestoreError.message);
      }
    }
    
    // Limpiar formulario
    const changePasswordForm = document.getElementById('changePasswordForm');
    if (changePasswordForm) changePasswordForm.reset();
    
    showToast('✅ Contraseña cambiada correctamente');
    
    console.log('🔐 ========================================');
    console.log('🔐 CONTRASEÑA ACTUALIZADA EXITOSAMENTE');
    console.log('🔐 ========================================');
    console.log('   • Usuario:', currentUser.email);
    console.log('   • Firebase Auth: ✅');
    console.log('   • localStorage: ✅');
    console.log('   • Firestore: ✅');
    console.log('========================================');
    
  } catch (error) {
    console.error('❌ Error al cambiar contraseña:', error);
    
    // Remover clases de error previas
    currentPasswordInput.classList.remove('border-red-500');
    confirmPasswordInput.classList.remove('border-red-500');
    
    if (error.code === 'auth/wrong-password') {
      showToast('❌ La contraseña actual es incorrecta');
      currentPasswordInput.classList.add('border-red-500');
    } else if (error.code === 'auth/weak-password') {
      showToast('❌ La contraseña es muy débil');
      newPasswordInput.classList.add('border-red-500');
    } else if (error.code === 'auth/requires-recent-login') {
      showToast('❌ Por seguridad, cierra sesión y vuelve a entrar antes de cambiar tu contraseña');
    } else {
      showToast('❌ Error: ' + error.message);
    }
  }
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
  const coachCodeInput = document.getElementById('coachCode');
  const monthlyDueDay = document.getElementById('monthlyDueDay');
  const monthlyGraceDays = document.getElementById('monthlyGraceDays');
  const monthlyReminderTemplate = document.getElementById('monthlyReminderTemplate');
  const pdfFooterMessage = document.getElementById('pdfFooterMessage');
  
  const settings = {
    name: clubName ? clubName.value : '',
    email: clubEmail ? clubEmail.value : '',
    phone: clubPhone ? clubPhone.value : '',
    address: clubAddress ? clubAddress.value : '',
    city: clubCity ? clubCity.value : '',
    country: clubCountry ? clubCountry.value : '',
    website: clubWebsite ? clubWebsite.value : '',
    socialMedia: clubSocial ? clubSocial.value : '',
    foundedYear: (() => {
      if (!clubFoundedYear) return '';
      const raw = Number(clubFoundedYear.value);
      if (!Number.isFinite(raw)) return '';
      const currentYear = new Date().getFullYear();
      const normalized = Math.max(1900, Math.min(currentYear, Math.trunc(raw)));
      return String(normalized);
    })(),
    monthlyFee: clubMonthlyFee ? parseFloat(clubMonthlyFee.value) : 0,
    coachCode: coachCodeInput ? coachCodeInput.value : undefined,
    monthlyDueDay: (() => {
      const value = Number(monthlyDueDay?.value);
      return Number.isFinite(value) ? Math.max(1, Math.min(28, value)) : 10;
    })(),
    monthlyGraceDays: (() => {
      const value = Number(monthlyGraceDays?.value);
      return Number.isFinite(value) ? Math.max(0, Math.min(60, value)) : 5;
    })(),
    monthlyReminderTemplate: (monthlyReminderTemplate?.value || '').trim(),
    pdfFooterMessage: (pdfFooterMessage?.value || '').trim()
  };
  
 // Preservar clubId y logo existentes
  const existing = getSchoolSettings();
  if (settings.coachCode === undefined) {
    settings.coachCode = existing.coachCode || '';
  }
  settings.autoWhatsAppEnabled = existing.autoWhatsAppEnabled === true;
  if (existing.clubId) {
    settings.clubId = existing.clubId;
  }
  // ✅ Preservar logo (se guarda por separado en el change del input)
  if (existing.logo) {
    settings.logo = existing.logo;
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

document.getElementById('fillMonthlyReminderTemplate')?.addEventListener('click', function() {
  const input = document.getElementById('monthlyReminderTemplate');
  if (!input) return;

  input.value = 'Hola {parentName}, te saludamos de {clubName}. Te recordamos la mensualidad de {monthName} {year}, con vencimiento el {dueDate}. Si ya realizaste el pago, por favor ignora este mensaje. Gracias por tu apoyo.';
  input.focus();
  showToast('✅ Mensaje recomendado cargado. Puedes editarlo libremente.');
});

// Exportar datos
function exportData() {
  exportAllData();
}

// ========================================
// GESTIÓN DE USUARIOS DE LA ESCUELA
// ========================================

// ✅ Renderizar lista de usuarios de la escuela - CORREGIDO
function renderSchoolUsers() {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    console.warn('⚠️ No hay usuario actual');
    return;
  }
  
  // ✅ OBTENER TODOS LOS USUARIOS DEL MISMO CLUB (sin filtrar)
  const allUsers = getUsers();
  const schoolUsers = allUsers.filter(u => u.schoolId === currentUser.schoolId);
  
  const container = document.getElementById('schoolUsersList');
  
  if (!container) {
    console.warn('⚠️ Elemento schoolUsersList no encontrado');
    return;
  }
  
  // ✅ MOSTRAR TODOS LOS USUARIOS (sin importar si es admin principal o no)
  container.innerHTML = schoolUsers.map(user => `
    <div class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
      <div class="flex items-center gap-3">
        <img src="${user.avatar || getDefaultAvatar()}" alt="${user.name}" class="w-10 h-10 rounded-full object-cover border-2 border-teal-500">
        <div>
          <p class="font-medium text-gray-800 dark:text-white">${user.name}</p>
          <p class="text-xs text-gray-500 dark:text-gray-400">${user.email}</p>
          ${user.isMainAdmin ? 
            '<span class="text-xs bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-300 px-2 py-1 rounded mt-1 inline-block">Admin Principal</span>' : 
            '<span class="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 px-2 py-1 rounded mt-1 inline-block">Admin</span>'
          }
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
  
  console.log('✅ Lista de usuarios renderizada:', schoolUsers.length, 'usuarios');
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

// 🔥 Guardar nuevo usuario de la escuela - CON INSTANCIA SECUNDARIA (CORREGIDO v3)
async function saveSchoolUser(userData) {
  const currentUser = getCurrentUser();
  if (!currentUser) return;
  
  const users = getUsers();
  if (users.find(u => u.email === userData.email)) {
    showToast('❌ Este email ya está registrado');
    return;
  }
  
  // 🔥 VERIFICAR QUE FIREBASE ESTÉ LISTO
  if (!window.APP_STATE?.firebaseReady || !window.firebase?.auth) {
    showToast('❌ Firebase no disponible. Intenta más tarde.');
    return;
  }
  
  let secondaryApp = null;
  let deleteApp = null; // ⭐ Variable para la función deleteApp
  
  try {
    console.log('🔥 Creando usuario en Firebase Authentication...');
    showToast('🔥 Creando cuenta en Firebase...');
    
    // ⭐ PASO 1: CREAR INSTANCIA SECUNDARIA
    console.log('📱 Creando instancia secundaria de Firebase...');
    
    // ⭐ Importar deleteApp también
    const firebaseApp = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
    const firebaseAuth = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
    
    const { initializeApp } = firebaseApp;
    deleteApp = firebaseApp.deleteApp; // ⭐ Guardar referencia a deleteApp
    const { getAuth, createUserWithEmailAndPassword, signOut } = firebaseAuth;
    
    const firebaseConfig = {
      apiKey: "AIzaSyBThVgzEsTLWSW7puKOVErZ_KOLDEq8v3A",
      authDomain: "my-club-fae98.firebaseapp.com",
      projectId: "my-club-fae98",
      storageBucket: "my-club-fae98.firebasestorage.app",
      messagingSenderId: "807792685568",
      appId: "1:807792685568:web:06097faad391a9fd8c9ee5",
      measurementId: "G-5HRKNKEYKY"
    };
    
    secondaryApp = initializeApp(firebaseConfig, 'SecondaryApp-' + Date.now());
    const secondaryAuth = getAuth(secondaryApp);
    
    console.log('✅ Instancia secundaria creada');
    
    // ⭐ PASO 2: CREAR USUARIO
    console.log('👤 Creando usuario en instancia secundaria...');
    
    const userCredential = await createUserWithEmailAndPassword(
      secondaryAuth,
      userData.email,
      userData.password
    );
    
    const newUserUid = userCredential.user.uid;
    console.log('✅ Usuario creado en Firebase Auth con UID:', newUserUid);
    
    // ⭐ PASO 3: CERRAR SESIÓN EN INSTANCIA SECUNDARIA
    console.log('🔒 Cerrando sesión en instancia secundaria...');
    await signOut(secondaryAuth);
    console.log('✅ Sesión secundaria cerrada');
    
    // ⭐ PASO 4: ELIMINAR INSTANCIA SECUNDARIA (MÉTODO CORRECTO)
    console.log('🗑️ Eliminando instancia secundaria...');
    await deleteApp(secondaryApp); // ⭐ USO CORRECTO
    secondaryApp = null;
    console.log('✅ Instancia secundaria eliminada');
    
    // ⭐ PASO 5: GUARDAR EN FIRESTORE CON INSTANCIA PRINCIPAL
    console.log('💾 Guardando datos usando instancia principal...');
    
    const newUser = {
      id: newUserUid,
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
    
    saveUser(newUser);
    console.log('✅ Usuario guardado localmente');
    
    const settings = getSchoolSettings();
    const clubId = settings.clubId || currentUser.schoolId || 'default_club';
    console.log('🏢 Club ID:', clubId);
    
    console.log('📝 Escribiendo en Firestore como admin principal...');
    
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
    
    if (typeof saveUserClubMapping === 'function') {
      console.log('🗺️ Guardando mapeo para login multi-dispositivo...');
      const mappingSaved = await saveUserClubMapping(userData.email, clubId, newUserUid);
      if (mappingSaved) {
        console.log('✅ Mapeo guardado');
      } else {
        console.warn('⚠️ Mapeo no se pudo guardar');
      }
    }
    
    const adminStillConnected = window.firebase.auth.currentUser;
    if (adminStillConnected) {
      console.log('✅ Admin sigue conectado:', adminStillConnected.email);
    } else {
      console.warn('⚠️ Admin desconectado (esto NO debería pasar)');
    }
    
    showToast('✅ Usuario creado correctamente');
    
    console.log('✅ ========================================');
    console.log('✅ USUARIO CREADO EXITOSAMENTE');
    console.log('✅ ========================================');
    console.log('📋 Resumen:');
    console.log('   • UID:', newUserUid);
    console.log('   • Email:', userData.email);
    console.log('   • Club ID:', clubId);
    console.log('   • Usuario en Auth: ✅');
    console.log('   • Usuario en Firestore: ✅');
    console.log('   • Admin mantiene sesión: ✅');
    console.log('========================================');
    
    closeAddSchoolUserModal();
    renderSchoolUsers();
    
  } catch (error) {
    console.error('❌ ========================================');
    console.error('❌ ERROR AL CREAR USUARIO');
    console.error('❌ ========================================');
    console.error('Error completo:', error);
    console.error('Código:', error.code);
    console.error('Mensaje:', error.message);
    console.error('========================================');
    
    // Limpiar instancia secundaria si existe
    if (secondaryApp && deleteApp) {
      try {
        await deleteApp(secondaryApp); // ⭐ USO CORRECTO
        console.log('🗑️ Instancia secundaria limpiada después del error');
      } catch (cleanupError) {
        console.error('Error al limpiar instancia:', cleanupError);
      }
    }
    
    if (error.code === 'auth/email-already-in-use') {
      showToast('❌ Este email ya está registrado en Firebase. Por favor usa otro email.');
    } else if (error.code === 'auth/weak-password') {
      showToast('❌ La contraseña debe tener al menos 6 caracteres');
    } else if (error.code === 'auth/invalid-email') {
      showToast('❌ Email inválido');
    } else if (error.code === 'permission-denied') {
      showToast('❌ Error de permisos. Verifica que seas el admin principal.');
    } else {
      showToast('❌ Error: ' + error.message);
    }
  }
}
// ✅ FUNCIÓN MEJORADA: Eliminar usuario COMPLETAMENTE
async function deleteSchoolUser(userId) {
  const currentUser = getCurrentUser();
  
  if (!currentUser?.isMainAdmin) {
    showToast('❌ Solo el administrador principal puede eliminar usuarios');
    return;
  }
  
  const users = getUsers();
  const userToDelete = users.find(u => u.id === userId);
  
  if (!userToDelete) {
    showToast('❌ Usuario no encontrado');
    return;
  }
  
  if (userToDelete.isMainAdmin) {
    showToast('❌ No puedes eliminar al administrador principal');
    return;
  }
  
  if (!await confirmAction(`¿Eliminar PERMANENTEMENTE a ${userToDelete.name}?\n\n⚠️ Esta acción es IRREVERSIBLE.\n⚠️ Se cerrará su sesión INMEDIATAMENTE.\n⚠️ NO podrá volver a ingresar.`, {
    type: 'danger',
    title: 'Eliminar usuario',
    confirmText: 'Sí, eliminar permanentemente'
  })) {
    return;
  }
  
  try {
    showToast('🗑️ Eliminando usuario permanentemente...');
    
    const clubId = localStorage.getItem('clubId');
    
    if (!clubId) {
      showToast('❌ No se encontró el ID del club');
      return;
    }
    
    // 1️⃣ ELIMINAR DOCUMENTO COMPLETAMENTE DE FIRESTORE (NO SOLO MARCAR)
    try {
      await window.firebase.deleteDoc(
        window.firebase.doc(window.firebase.db, `clubs/${clubId}/users`, userId)
      );
      console.log('✅ Usuario ELIMINADO completamente de Firestore (documento borrado)');
    } catch (firestoreError) {
      console.error('⚠️ Error al eliminar de Firestore:', firestoreError);
      throw firestoreError;
    }
    
    // 2️⃣ Eliminar de localStorage
    const updatedUsers = users.filter(u => u.id !== userId);
    localStorage.setItem('users', JSON.stringify(updatedUsers));
    console.log('✅ Usuario eliminado de localStorage');
    
    // 3️⃣ Actualizar UI
    renderSchoolUsers();
    
    // 4️⃣ Eliminar mapeo (impide login)
    if (userToDelete.email) {
      try {
        await window.firebase.deleteDoc(
          window.firebase.doc(window.firebase.db, 'userClubMapping', userToDelete.email)
        );
        console.log('✅ Mapeo eliminado - Usuario bloqueado completamente');
      } catch (mappingError) {
        console.log('⚠️ No se pudo eliminar el mapeo:', mappingError.code);
      }
    }
    
    // 5️⃣ Eliminar la cuenta de Firebase Authentication vía Cloud Function
    // Esto evita que la cuenta quede huérfana y no pueda usarse en otro club
    if (userToDelete.id && window.firebase?.functions && window.firebase?.httpsCallable) {
      try {
        const deleteAuthUser = window.firebase.httpsCallable(window.firebase.functions, 'deleteAuthUser');
        await deleteAuthUser({ uidToDelete: userToDelete.id, clubId });
        console.log('✅ Cuenta de Firebase Authentication eliminada');
      } catch (authDeleteError) {
        // No bloquear la operación si falla — el usuario ya está bloqueado por Firestore
        console.warn('⚠️ No se pudo eliminar la cuenta Auth (usuario ya bloqueado):', authDeleteError.message);
      }
    }

    showToast('✅ Usuario eliminado permanentemente');
    console.log('✅ Eliminación completada. Cuenta Auth y acceso Firestore removidos.');

  } catch (error) {
    console.error('❌ Error al eliminar usuario:', error);
    showToast('❌ Error al eliminar: ' + error.message);
  }
}

document.getElementById('schoolUserAvatar')?.addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (file) {
    if (!file.type.startsWith('image/')) {
      showToast('❌ Por favor selecciona una imagen válida');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('❌ La imagen es muy grande. Máximo 5MB');
      return;
    }
    
    // ✅ COMPRIMIR IMAGEN ANTES DE MOSTRAR
    imageToBase64(file, async function(base64) {
      console.log('🗜️ Comprimiendo avatar de usuario...');
      const compressed = await compressImageForFirebase(base64, 300, 0.6);
      
      const schoolUserAvatarPreview = document.getElementById('schoolUserAvatarPreview');
      if (schoolUserAvatarPreview) {
        schoolUserAvatarPreview.src = compressed;
      }
      console.log(`✅ Avatar comprimido: ${Math.round(base64.length/1024)}KB → ${Math.round(compressed.length/1024)}KB`);
    });
  }
});

// Form submit para agregar usuario
document.getElementById('addSchoolUserForm')?.addEventListener('submit', async function(e) {
  e.preventDefault();
  
  const schoolUserAvatar = document.getElementById('schoolUserAvatar');
  const schoolUserAvatarPreview = document.getElementById('schoolUserAvatarPreview');
  const schoolUserName = document.getElementById('schoolUserName');
  const schoolUserEmail = document.getElementById('schoolUserEmail');
  const schoolUserPhone = document.getElementById('schoolUserPhone');
  const schoolUserPassword = document.getElementById('schoolUserPassword');
  const schoolUserBirthDate = document.getElementById('schoolUserBirthDate');
  
  // ✅ USAR LA IMAGEN DEL PREVIEW (YA COMPRIMIDA)
  let finalAvatar = schoolUserAvatarPreview ? schoolUserAvatarPreview.src : getDefaultAvatar();
  
  // ✅ VERIFICAR SI NECESITA COMPRESIÓN ADICIONAL
  if (finalAvatar && finalAvatar.startsWith('data:image') && finalAvatar.length > 500000) {
    console.warn('⚠️ Avatar muy grande, comprimiendo...');
    finalAvatar = await compressImageForFirebase(finalAvatar, 300, 0.6);
    console.log(`✅ Avatar comprimido: ${Math.round(finalAvatar.length/1024)}KB`);
  }
  
  const userData = {
    name: schoolUserName ? schoolUserName.value : '',
    email: schoolUserEmail ? schoolUserEmail.value : '',
    phone: schoolUserPhone ? schoolUserPhone.value : '',
    password: schoolUserPassword ? schoolUserPassword.value : '',
    birthDate: schoolUserBirthDate ? schoolUserBirthDate.value : '',
    avatar: finalAvatar  // ✅ USAR IMAGEN COMPRIMIDA
  };
  
  saveSchoolUser(userData);
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
}}}

function openPdfFooterMessageSettings() {
  const messagingSection = document.getElementById('messagingSection');
  if (messagingSection?.classList.contains('hidden')) {
    toggleSection('messagingSection');
  }

  setTimeout(() => {
    const input = document.getElementById('pdfFooterMessage');
    if (!input) {
      showToast('⚠️ Campo de mensaje PDF no encontrado');
      return;
    }

    input.scrollIntoView({ behavior: 'smooth', block: 'center' });
    input.focus();
    input.classList.add('ring-2', 'ring-teal-500', 'ring-offset-2', 'dark:ring-offset-gray-800');
    setTimeout(() => {
      input.classList.remove('ring-2', 'ring-teal-500', 'ring-offset-2', 'dark:ring-offset-gray-800');
    }, 1500);
  }, 180);
}

window.openPdfFooterMessageSettings = openPdfFooterMessageSettings;
window.openMessagingSettings = openPdfFooterMessageSettings;


// ========================================
// 🔥 DESTRUCCIÓN TOTAL DEL CLUB
// Solo Admin Principal + Triple Confirmación
// ========================================

/**
 * 🔥 FUNCIÓN PRINCIPAL: Borrar TODO el club completo
 * ⚠️ SOLO EL ADMIN PRINCIPAL PUEDE EJECUTAR ESTO
 */
async function clearAllData() {
  const currentUser = getCurrentUser();
  
  // ✅ VERIFICACIÓN 1: ¿Es admin principal?
  if (!currentUser?.isMainAdmin) {
    showToast('❌ Solo el administrador principal puede eliminar el club');
    console.error('🔒 Acceso denegado: Usuario no es admin principal');
    return;
  }
  
  const settings = getSchoolSettings();
  const clubId = localStorage.getItem('clubId') || settings.clubId;
  
  if (!clubId) {
    showToast('❌ No se encontró el ID del club');
    return;
  }
  
  // 📊 Contar datos antes de borrar
  const players = getAllPlayers() || [];
  const payments = getPayments() || [];
  const events = getCalendarEvents() || [];
  const users = getUsers() || [];
  const expenses = getExpenses() || [];
  
  console.log('🔥 ========================================');
  console.log('🔥 INICIANDO PROCESO DE DESTRUCCIÓN TOTAL');
  console.log('🔥 ========================================');
  console.log('📋 Datos a eliminar:');
  console.log('   • Jugadores:', players.length);
  console.log('   • Pagos:', payments.length);
  console.log('   • Eventos:', events.length);
  console.log('   • Usuarios:', users.length);
  console.log('   • Egresos:', expenses.length);
  console.log('   • Club:', settings.name || 'Sin nombre');
  console.log('========================================');
  
  // 🚨 PASO 1: Modal de advertencia FUERTE
  const confirmed = await showDestructionWarningModal(
    settings.name || 'tu club',
    players.length,
    payments.length,
    events.length,
    users.length,
    expenses.length
  );
  
  if (!confirmed) {
    console.log('❌ Proceso cancelado por el usuario en PASO 1');
    showToast('✅ Operación cancelada');
    return;
  }
  
  // 🚨 PASO 2: Confirmación escribiendo el nombre del club
  const nameConfirmed = await showClubNameConfirmationModal(settings.name || '');
  
  if (!nameConfirmed) {
    console.log('❌ Proceso cancelado por el usuario en PASO 2');
    showToast('✅ Operación cancelada');
    return;
  }
  
  // 🚨 PASO 3: Confirmación final
  const finalConfirmed = await showFinalConfirmationModal();
  
  if (!finalConfirmed) {
    console.log('❌ Proceso cancelado por el usuario en PASO 3');
    showToast('✅ Operación cancelada');
    return;
  }
  
  // ✅ TODAS LAS CONFIRMACIONES PASADAS - PROCEDER CON DESTRUCCIÓN
  console.log('🔥 Todas las confirmaciones completadas. Iniciando destrucción...');
  
  await executeClubDestruction(clubId, currentUser);
}

/**
 * 🚨 MODAL 1: Advertencia fuerte con estadísticas
 */
function showDestructionWarningModal(clubName, playersCount, paymentsCount, eventsCount, usersCount, expensesCount) {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.id = 'destructionWarningModal';
    modal.className = 'fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center p-4';
    modal.innerHTML = `
      <div class="bg-white dark:bg-gray-800 rounded-2xl max-w-lg w-full animate-scale-in border-4 border-red-600">
        <!-- Header Rojo de Peligro -->
        <div class="bg-gradient-to-r from-red-600 to-red-800 p-6 text-center rounded-t-xl">
          <div class="text-6xl mb-3">⚠️</div>
          <h3 class="font-black text-3xl text-white mb-2">¡PELIGRO EXTREMO!</h3>
          <p class="text-red-100 text-sm font-medium">DESTRUCCIÓN TOTAL DEL CLUB</p>
        </div>
        
        <!-- Contenido -->
        <div class="p-6 space-y-4">
          <div class="bg-red-50 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-800 rounded-lg p-4">
            <p class="text-sm text-red-900 dark:text-red-200 font-bold mb-3">
              Estás a punto de ELIMINAR PERMANENTEMENTE:
            </p>
            <ul class="space-y-2 text-sm text-red-800 dark:text-red-300">
              <li class="flex items-center gap-2">
                <span class="text-2xl">👥</span>
                <strong>${playersCount}</strong> Jugadores con todos sus datos
              </li>
              <li class="flex items-center gap-2">
                <span class="text-2xl">💰</span>
                <strong>${paymentsCount}</strong> Registros de pagos
              </li>
              <li class="flex items-center gap-2">
                <span class="text-2xl">📅</span>
                <strong>${eventsCount}</strong> Eventos del calendario
              </li>
              <li class="flex items-center gap-2">
                <span class="text-2xl">👨‍💼</span>
                <strong>${usersCount}</strong> Usuarios del club
              </li>
              <li class="flex items-center gap-2">
                <span class="text-2xl">📉</span>
                <strong>${expensesCount}</strong> Registros de egresos
              </li>
              <li class="flex items-center gap-2">
                <span class="text-2xl">⚙️</span>
                <strong>Toda</strong> la configuración de "${clubName}"
              </li>
            </ul>
          </div>
          
          <div class="bg-black text-white rounded-lg p-4">
            <p class="font-bold text-center mb-2">⛔ ESTA ACCIÓN ES IRREVERSIBLE ⛔</p>
            <ul class="text-xs space-y-1 text-gray-300">
              <li>❌ NO SE PUEDE DESHACER</li>
              <li>❌ NO HAY FORMA DE RECUPERAR LOS DATOS</li>
              <li>❌ PERDERÁS TODO EL HISTORIAL</li>
              <li>❌ TODOS LOS USUARIOS PERDERÁN ACCESO</li>
            </ul>
          </div>
          
          <p class="text-center text-sm text-gray-600 dark:text-gray-400">
            ¿Estás ABSOLUTAMENTE seguro de continuar?
          </p>
        </div>
        
        <!-- Botones -->
        <div class="p-6 pt-0 flex gap-3">
          <button onclick="cancelDestruction()" class="flex-1 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-white font-bold py-4 rounded-xl transition-all">
            ✅ NO, CANCELAR
          </button>
          <button onclick="continueDestruction()" class="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-xl transition-all">
            ⚠️ SÍ, CONTINUAR
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    window.cancelDestruction = () => {
      modal.remove();
      delete window.cancelDestruction;
      delete window.continueDestruction;
      resolve(false);
    };
    
    window.continueDestruction = () => {
      modal.remove();
      delete window.cancelDestruction;
      delete window.continueDestruction;
      resolve(true);
    };
  });
}

/**
 * 🚨 MODAL 2: Confirmación escribiendo el nombre del club
 */
function showClubNameConfirmationModal(clubName) {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.id = 'nameConfirmationModal';
    modal.className = 'fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center p-4';
    modal.innerHTML = `
      <div class="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full animate-scale-in border-4 border-yellow-500">
        <div class="bg-gradient-to-r from-yellow-500 to-orange-500 p-6 text-center rounded-t-xl">
          <div class="text-5xl mb-2">🔐</div>
          <h3 class="font-bold text-2xl text-white">Confirmación de Seguridad</h3>
        </div>
        
        <div class="p-6 space-y-4">
          <p class="text-center text-gray-700 dark:text-gray-300 font-medium">
            Para confirmar que realmente deseas eliminar <strong>TODO</strong>, escribe el nombre EXACTO de tu club:
          </p>
          
          <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-700 rounded-lg p-3 text-center">
            <p class="text-xs text-blue-700 dark:text-blue-300 mb-2">Nombre del club:</p>
            <p class="font-bold text-lg text-blue-900 dark:text-blue-100">${clubName}</p>
          </div>
          
          <input 
            type="text" 
            id="clubNameConfirmInput" 
            placeholder="Escribe el nombre del club aquí..."
            class="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 text-center font-medium"
            autocomplete="off"
          >
          
          <p class="text-xs text-center text-red-600 dark:text-red-400 font-medium">
            ⚠️ Debe coincidir exactamente (mayúsculas/minúsculas)
          </p>
        </div>
        
        <div class="p-6 pt-0 flex gap-3">
          <button onclick="cancelNameConfirmation()" class="flex-1 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-white font-bold py-3 rounded-xl">
            Cancelar
          </button>
          <button onclick="confirmNameMatch()" class="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-3 rounded-xl">
            Verificar
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    const input = document.getElementById('clubNameConfirmInput');
    if (input) input.focus();
    
    window.cancelNameConfirmation = () => {
      modal.remove();
      delete window.cancelNameConfirmation;
      delete window.confirmNameMatch;
      resolve(false);
    };
    
    window.confirmNameMatch = () => {
      const input = document.getElementById('clubNameConfirmInput');
      const enteredName = input ? input.value : '';
      
      if (enteredName === clubName) {
        modal.remove();
        delete window.cancelNameConfirmation;
        delete window.confirmNameMatch;
        resolve(true);
      } else {
        input.classList.add('border-red-500', 'bg-red-50', 'dark:bg-red-900/20');
        input.value = '';
        input.placeholder = '❌ No coincide. Intenta de nuevo...';
        showToast('❌ El nombre no coincide exactamente');
        
        setTimeout(() => {
          input.classList.remove('border-red-500', 'bg-red-50', 'dark:bg-red-900/20');
          input.placeholder = 'Escribe el nombre del club aquí...';
        }, 2000);
      }
    };
    
    // Enter para confirmar
    if (input) {
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          window.confirmNameMatch();
        }
      });
    }
  });
}

/**
 * 🚨 MODAL 3: Confirmación final absoluta
 */
function showFinalConfirmationModal() {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.id = 'finalConfirmationModal';
    modal.className = 'fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4';
    modal.innerHTML = `
      <div class="bg-gradient-to-br from-red-900 to-black rounded-2xl max-w-sm w-full animate-scale-in border-4 border-red-500 shadow-2xl">
        <div class="p-8 text-center space-y-6">
          <div class="text-7xl animate-pulse">🔥</div>
          
          <h3 class="font-black text-3xl text-white">
            ÚLTIMA ADVERTENCIA
          </h3>
          
          <p class="text-red-200 font-bold text-lg">
            Esta es tu última oportunidad<br>para cancelar
          </p>
          
          <div class="bg-black/50 rounded-lg p-4 border border-red-500">
            <p class="text-white text-sm font-medium">
              Al continuar, TODO será<br>eliminado PERMANENTEMENTE
            </p>
          </div>
          
          <p class="text-red-300 text-xs">
            ¿Estás ABSOLUTAMENTE SEGURO?
          </p>
        </div>
        
        <div class="p-6 pt-0 flex gap-3">
          <button onclick="cancelFinal()" class="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-xl transition-all text-lg">
            🛡️ NO, DETENER
          </button>
          <button onclick="confirmFinal()" class="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-xl transition-all text-lg">
            💥 SÍ, ELIMINAR
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    window.cancelFinal = () => {
      modal.remove();
      delete window.cancelFinal;
      delete window.confirmFinal;
      resolve(false);
    };
    
    window.confirmFinal = () => {
      modal.remove();
      delete window.cancelFinal;
      delete window.confirmFinal;
      resolve(true);
    };
  });
}

/**
 * 🔥 EJECUCIÓN: Destruir todo el club
 */
async function executeClubDestruction(clubId, currentUser) {
  console.log('🔥 ========================================');
  console.log('🔥 EJECUTANDO DESTRUCCIÓN TOTAL');
  console.log('🔥 ========================================');
  
  try {
    showToast('🔥 Eliminando datos de Firebase...');
    
    let deletedItems = {
      players: 0,
      payments: 0,
      events: 0,
      users: 0,
      expenses: 0,
      settings: false
    };
    
    // Verificar Firebase
    if (window.firebase?.db) {
      // 1️⃣ Eliminar Jugadores
      try {
        const playersSnapshot = await window.firebase.getDocs(
          window.firebase.collection(window.firebase.db, `clubs/${clubId}/players`)
        );
        
        for (const doc of playersSnapshot.docs) {
          await window.firebase.deleteDoc(doc.ref);
          deletedItems.players++;
        }
        console.log(`✅ ${deletedItems.players} jugadores eliminados de Firebase`);
      } catch (error) {
        console.error('❌ Error eliminando jugadores:', error);
      }
      
      // 2️⃣ Eliminar Pagos
      try {
        const paymentsSnapshot = await window.firebase.getDocs(
          window.firebase.collection(window.firebase.db, `clubs/${clubId}/payments`)
        );
        
        for (const doc of paymentsSnapshot.docs) {
          await window.firebase.deleteDoc(doc.ref);
          deletedItems.payments++;
        }
        console.log(`✅ ${deletedItems.payments} pagos eliminados de Firebase`);
      } catch (error) {
        console.error('❌ Error eliminando pagos:', error);
      }
      
      // 3️⃣ Eliminar Eventos
      try {
        const eventsSnapshot = await window.firebase.getDocs(
          window.firebase.collection(window.firebase.db, `clubs/${clubId}/events`)
        );
        
        for (const doc of eventsSnapshot.docs) {
          await window.firebase.deleteDoc(doc.ref);
          deletedItems.events++;
        }
        console.log(`✅ ${deletedItems.events} eventos eliminados de Firebase`);
      } catch (error) {
        console.error('❌ Error eliminando eventos:', error);
      }
      
      // 4️⃣ Eliminar Egresos
      try {
        const expensesSnapshot = await window.firebase.getDocs(
          window.firebase.collection(window.firebase.db, `clubs/${clubId}/expenses`)
        );
        
        for (const doc of expensesSnapshot.docs) {
          await window.firebase.deleteDoc(doc.ref);
          deletedItems.expenses++;
        }
        console.log(`✅ ${deletedItems.expenses} egresos eliminados de Firebase`);
      } catch (error) {
        console.error('❌ Error eliminando egresos:', error);
      }
      
      // 5️⃣ Eliminar Usuarios
      try {
        const usersSnapshot = await window.firebase.getDocs(
          window.firebase.collection(window.firebase.db, `clubs/${clubId}/users`)
        );
        
        for (const doc of usersSnapshot.docs) {
          await window.firebase.deleteDoc(doc.ref);
          deletedItems.users++;
        }
        console.log(`✅ ${deletedItems.users} usuarios eliminados de Firebase`);
      } catch (error) {
        console.error('❌ Error eliminando usuarios:', error);
      }
      
      // 6️⃣ Eliminar Configuración
      try {
        await window.firebase.deleteDoc(
          window.firebase.doc(window.firebase.db, `clubs/${clubId}/settings`, "main")
        );
        deletedItems.settings = true;
        console.log('✅ Configuración eliminada de Firebase');
      } catch (error) {
        console.error('❌ Error eliminando configuración:', error);
      }
      
      // 7️⃣ Eliminar Mapeo
      try {
        await window.firebase.deleteDoc(
          window.firebase.doc(window.firebase.db, 'userClubMapping', currentUser.email)
        );
        console.log('✅ Mapeo eliminado');
      } catch (error) {
        console.log('ℹ️ No se pudo eliminar mapeo:', error.code);
      }
    }
    
    // 8️⃣ Limpiar localStorage
    showToast('🗑️ Limpiando datos locales...');
    
    localStorage.removeItem('currentUser');
    localStorage.removeItem('users');
    localStorage.removeItem('players');
    localStorage.removeItem('payments');
    localStorage.removeItem('calendarEvents');
    localStorage.removeItem('schoolSettings');
    localStorage.removeItem('clubId');
    localStorage.removeItem('expenses');
    
    console.log('✅ localStorage limpiado');
    
    // 9️⃣ Cerrar sesión en Firebase
    if (window.firebase?.auth) {
      try {
        await window.firebase.signOut(window.firebase.auth);
        console.log('✅ Sesión de Firebase cerrada');
      } catch (error) {
        console.error('❌ Error al cerrar sesión:', error);
      }
    }
    
    console.log('🔥 ========================================');
    console.log('🔥 DESTRUCCIÓN COMPLETADA');
    console.log('🔥 ========================================');
    console.log('📊 Resumen de eliminación:');
    console.log('   • Jugadores:', deletedItems.players);
    console.log('   • Pagos:', deletedItems.payments);
    console.log('   • Eventos:', deletedItems.events);
    console.log('   • Usuarios:', deletedItems.users);
    console.log('   • Egresos:', deletedItems.expenses);
    console.log('   • Configuración:', deletedItems.settings ? '✅' : '❌');
    console.log('========================================');
    
    showToast('💥 Club eliminado completamente');
    
    // 🔟 Redirigir a login después de 3 segundos
    setTimeout(() => {
      window.location.href = 'login.html';
    }, 3000);
    
  } catch (error) {
    console.error('🔥 ========================================');
    console.error('🔥 ERROR CRÍTICO EN DESTRUCCIÓN');
    console.error('🔥 ========================================');
    console.error('Error:', error);
    console.error('========================================');
    
    showToast('❌ Error durante la eliminación: ' + error.message);
  }
}

console.log('✅ Función de destrucción total del club cargada');

// ========================================
// TOGGLE VIBRACIÓN HÁPTICA
// ========================================

function toggleVibration() {
  const toggle = document.getElementById('vibrateToggle');
  const enabled = toggle.checked;
  
  localStorage.setItem('vibrateEnabled', enabled);
  
  if (enabled) {
    showToast('📳 Vibración activada');
    // Vibración de prueba
    if (typeof vibrate === 'function') {
      vibrate([30, 50, 30]);
    }
  } else {
    showToast('🔕 Vibración desactivada');
  }
  
  console.log('📳 Vibración:', enabled ? 'ACTIVADA' : 'DESACTIVADA');
}

// Cargar estado al abrir configuración
function loadVibrationSetting() {
  const vibrateEnabled = localStorage.getItem('vibrateEnabled') !== 'false'; // Por defecto: true
  const toggle = document.getElementById('vibrateToggle');
  
  if (toggle) {
    toggle.checked = vibrateEnabled;
  }
}

// Exportar
window.toggleVibration = toggleVibration;
window.loadVibrationSetting = loadVibrationSetting;

console.log('✅ Sistema de toggle de vibración cargado');

// ========================================
// SINCRONIZACIÓN MANUAL CON INDICADOR VISUAL
// ========================================

async function manualSync() {
  const button = document.getElementById('syncButton');
  const spinner = document.getElementById('syncSpinner');
  const icon = document.getElementById('syncIcon');
  const text = document.getElementById('syncText');
  const statusText = document.getElementById('syncStatus');
  const lastSyncTime = document.getElementById('lastSyncTime');
  
  if (!button || !spinner || !icon || !text) return;
  
  try {
    // 🔴 ESTADO: SINCRONIZANDO (ROJO)
    button.disabled = true;
    button.classList.remove('bg-blue-600', 'hover:bg-blue-700', 'bg-green-600');
    button.classList.add('bg-red-600', 'cursor-wait');
    spinner.classList.remove('hidden');
    icon.classList.add('hidden');
    text.textContent = 'Sincronizando...';
    statusText.classList.remove('text-gray-500');
    statusText.classList.add('text-red-600', 'font-medium');
    
    vibrate(10); // Feedback háptico
    
    console.log('🔄 Iniciando sincronización manual...');
    
    // DESCARGAR DATOS DE FIREBASE
    if (typeof downloadFromFirebase === 'function') {
      await downloadFromFirebase();
      console.log('✅ Datos descargados correctamente');
    } else {
      throw new Error('Función downloadFromFirebase no disponible');
    }
    
    // ✅ ESTADO: COMPLETADO (VERDE)
    button.classList.remove('bg-red-600');
    button.classList.add('bg-green-600');
    spinner.classList.add('hidden');
    icon.classList.remove('hidden');
    icon.setAttribute('data-lucide', 'check-circle');
    text.textContent = '¡Sincronizado!';
    statusText.classList.remove('text-red-600');
    statusText.classList.add('text-green-600');
    
    // Actualizar hora
    const now = new Date();
    const timeStr = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    if (lastSyncTime) {
      lastSyncTime.textContent = timeStr;
    }
    
    vibrate([20, 50, 20]); // Feedback de éxito
    showToast('✅ Datos sincronizados correctamente');
    
    // Recrear íconos de Lucide
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
      lucide.createIcons();
    }
    
    // Volver a estado normal después de 2 segundos
    setTimeout(() => {
      button.classList.remove('bg-green-600');
      button.classList.add('bg-blue-600', 'hover:bg-blue-700');
      button.disabled = false;
      button.classList.remove('cursor-wait');
      icon.setAttribute('data-lucide', 'refresh-cw');
      text.textContent = 'Sincronizar Datos';
      statusText.classList.remove('text-green-600', 'font-medium');
      statusText.classList.add('text-gray-500');
      
      if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
      }
    }, 2000);
    
  } catch (error) {
    console.error('❌ Error en sincronización:', error);
    
    // ❌ ESTADO: ERROR (MANTENER ROJO)
    button.classList.remove('bg-green-600');
    button.classList.add('bg-red-600');
    spinner.classList.add('hidden');
    icon.classList.remove('hidden');
    icon.setAttribute('data-lucide', 'x-circle');
    text.textContent = 'Error al sincronizar';
    
    showToast('❌ Error al sincronizar: ' + error.message);
    
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
      lucide.createIcons();
    }
    
    // Volver a estado normal después de 3 segundos
    setTimeout(() => {
      button.classList.remove('bg-red-600');
      button.classList.add('bg-blue-600', 'hover:bg-blue-700');
      button.disabled = false;
      button.classList.remove('cursor-wait');
      icon.setAttribute('data-lucide', 'refresh-cw');
      text.textContent = 'Sincronizar Datos';
      statusText.classList.remove('text-red-600', 'font-medium');
      statusText.classList.add('text-gray-500');
      
      if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
      }
    }, 3000);
  }
}

// Exportar
window.manualSync = manualSync;

console.log('✅ Sistema de sincronización manual cargado')
