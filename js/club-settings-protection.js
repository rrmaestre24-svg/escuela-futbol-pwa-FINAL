// ========================================
// PROTECCIÓN DE CONFIGURACIÓN DEL CLUB
// Solo admin principal puede editar
// ========================================

console.log('🔒 Cargando protección de configuración del club...');

/**
 * Verifica si el usuario actual es admin principal
 */
function isMainAdmin() {
  const currentUser = getCurrentUser();
  return currentUser && currentUser.isMainAdmin === true;
}

/**
 * Verifica si el usuario puede editar la configuración del club
 */
function canEditClubSettings() {
  return isMainAdmin();
}

/**
 * Deshabilitar campos de configuración para admins secundarios
 */
function applyClubSettingsPermissions() {
  const currentUser = getCurrentUser();
  
  if (!currentUser) {
    console.log('⚠️ No hay usuario actual');
    return;
  }
  
  console.log(`🔐 Aplicando permisos para: ${currentUser.name} (isMainAdmin: ${currentUser.isMainAdmin})`);
  
  // Si NO es admin principal, deshabilitar campos
  if (!currentUser.isMainAdmin) {
    // Campos de configuración del club que deben protegerse
    const protectedFields = [
      'schoolName',           // Nombre del club
      'schoolEmail',          // Email
      'schoolPhone',          // Teléfono
      'schoolAddress',        // Dirección
      'schoolCity',           // Ciudad
      'schoolCountry',        // País
      'schoolWebsite',        // Sitio web
      'schoolSocialMedia',    // Redes sociales
      'schoolFoundedYear',    // Año de fundación
      'logoUpload'            // Cambio de logo
    ];
    
    let fieldsDisabled = 0;
    
    protectedFields.forEach(fieldId => {
      const field = document.getElementById(fieldId);
      if (field) {
        field.disabled = true;
        field.classList.add('bg-gray-100', 'dark:bg-gray-700', 'cursor-not-allowed');
        
        // Agregar tooltip explicativo
        field.title = 'Solo el administrador principal puede modificar este campo';
        fieldsDisabled++;
      }
    });
    
    console.log(`🔒 ${fieldsDisabled} campos protegidos`);
    
    // Deshabilitar botón de cambiar logo
    const changeLogoButton = document.querySelector('button[onclick*="logoUpload.click"]');
    if (changeLogoButton) {
      changeLogoButton.disabled = true;
      changeLogoButton.classList.add('opacity-50', 'cursor-not-allowed');
      changeLogoButton.onclick = function(e) {
        e.preventDefault();
        showToast('⚠️ Solo el administrador principal puede cambiar el logo');
        return false;
      };
    }
    
    // Interceptar el formulario de configuración
    const settingsForm = document.querySelector('#settingsSection form');
    if (settingsForm) {
      settingsForm.addEventListener('submit', function(e) {
        e.preventDefault();
        showToast('⚠️ Solo el administrador principal puede modificar la configuración del club');
        return false;
      });
    }
    
    // Mostrar aviso visual
    showAdminSecondaryNotice();
  } else {
    console.log('✅ Usuario es admin principal - acceso completo');
  }
}

/**
 * Mostrar aviso para admins secundarios
 */
function showAdminSecondaryNotice() {
  const settingsSection = document.getElementById('settingsSection');
  
  // 🆕 CORREGIDO: Si no existe settingsSection, salir silenciosamente (sin warning)
  if (!settingsSection) {
    return; // No mostrar warning, simplemente salir
  }
  
  // Verificar si ya existe el aviso
  if (document.getElementById('adminSecondaryNotice')) {
    return;
  }
  
  const notice = document.createElement('div');
  notice.id = 'adminSecondaryNotice';
  notice.className = 'bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 p-4 mb-4 rounded-lg animate-slide-in';
  notice.innerHTML = `
    <div class="flex items-start gap-3">
      <i data-lucide="info" class="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5"></i>
      <div>
        <h4 class="font-bold text-yellow-800 dark:text-yellow-300 mb-1">👤 Permisos de Administrador Secundario</h4>
        <p class="text-sm text-yellow-700 dark:text-yellow-400">
          Puedes gestionar jugadores, pagos, egresos y otros ingresos, pero 
          <strong>solo el administrador principal</strong> puede modificar la configuración del club 
          (nombre, logo, datos de contacto, etc.).
        </p>
      </div>
    </div>
  `;
  
  // Insertar al inicio de la sección de configuración
  settingsSection.insertBefore(notice, settingsSection.firstChild);
  
  console.log('✅ Aviso de admin secundario mostrado');
  
  // Recrear iconos de Lucide
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

/**
 * Validar permisos antes de guardar configuración
 */
function validateClubSettingsSave(settingsData) {
  const currentUser = getCurrentUser();
  
  if (!currentUser) {
    showToast('❌ Usuario no autenticado');
    return false;
  }
  
  // Si NO es admin principal, NO permitir cambios en campos protegidos
  if (!currentUser.isMainAdmin) {
    const currentSettings = getSchoolSettings();
    
    // Verificar si se intentó cambiar algún campo protegido
    const protectedFields = [
      'name', 'email', 'phone', 'address', 'city', 
      'country', 'website', 'socialMedia', 'foundedYear', 'logo'
    ];
    
    for (const field of protectedFields) {
      if (settingsData[field] !== undefined && 
          settingsData[field] !== currentSettings[field]) {
        showToast('⚠️ Solo el administrador principal puede modificar la configuración del club');
        console.warn(`🚫 Admin secundario intentó modificar: ${field}`);
        return false;
      }
    }
  }
  
  return true;
}

// ========================================
// APLICAR PERMISOS AL CARGAR LA PÁGINA
// ========================================

// Ejecutar cuando se cargue el DOM
document.addEventListener('DOMContentLoaded', () => {
  console.log('🔐 DOMContentLoaded - Preparando permisos...');
  
  // Esperar un momento para que se cargue el usuario actual
  setTimeout(() => {
    const currentUser = getCurrentUser();
    if (currentUser) {
      console.log(`👤 Usuario detectado: ${currentUser.name}`);
      applyClubSettingsPermissions();
    } else {
      console.log('⏳ Esperando usuario...');
    }
  }, 1000);
});

// Interceptar la función showSection si existe
if (typeof window.showSection !== 'undefined') {
  const originalShowSection = window.showSection;
  window.showSection = function(sectionId) {
    originalShowSection(sectionId);
    
    if (sectionId === 'settings') {
      console.log('⚙️ Navegando a configuración - aplicando permisos...');
      setTimeout(() => {
        applyClubSettingsPermissions();
      }, 200);
    }
  };
  console.log('✅ showSection interceptado');
}

// Hacer funciones globales
window.isMainAdmin = isMainAdmin;
window.canEditClubSettings = canEditClubSettings;
window.applyClubSettingsPermissions = applyClubSettingsPermissions;
window.validateClubSettingsSave = validateClubSettingsSave;

console.log('✅ club-settings-protection.js cargado correctamente');