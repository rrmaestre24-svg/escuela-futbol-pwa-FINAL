console.log('🔐 Cargando sistema de licencias...');

// ========================================
// 📞 CONFIGURACIÓN DE CONTACTO
// ========================================
if (typeof ADMIN_WHATSAPP === 'undefined') {
  var ADMIN_WHATSAPP = '573005452038';
}

// ========================================
// CONFIGURACIÓN
// ========================================
if (typeof LICENSE_CONFIG === 'undefined') {
  var LICENSE_CONFIG = {
    GRACE_PERIOD_DAYS: 3,
    CODE_EXPIRY_DAYS: 7,
    ALERT_DAYS_BEFORE: [7, 3, 1]
  };
}

const LICENSE_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 horas

function getLicenseCacheKey(clubId) {
  return `licenseCache_${clubId}`;
}

function getLicenseCacheTimeKey(clubId) {
  return `licenseLastCheckTime_${clubId}`;
}

function hydrateLicenseStatus(data) {
  if (!data) return null;

  return {
    ...data,
    endDate: data.endDate ? new Date(data.endDate) : null,
    cachedAt: Number(data.cachedAt || 0)
  };
}

function persistLicenseStatus(clubId, status, modulos = {}) {
  if (!clubId || !status) return status;

  const serialized = {
    ...status,
    modulos: modulos || status.modulos || {},
    endDate: status.endDate instanceof Date
      ? status.endDate.toISOString()
      : (status.endDate || null),
    cachedAt: Date.now()
  };

  localStorage.setItem('licenseStatus', serialized.status || 'error');
  if (serialized.endDate) {
    localStorage.setItem('licenseEndDate', serialized.endDate);
  }
  if (serialized.plan) {
    localStorage.setItem('licensePlan', serialized.plan);
  }
  localStorage.setItem('licenseModulos', JSON.stringify(serialized.modulos || {}));
  localStorage.setItem(getLicenseCacheKey(clubId), JSON.stringify(serialized));
  localStorage.setItem(getLicenseCacheTimeKey(clubId), String(serialized.cachedAt));

  return hydrateLicenseStatus(serialized);
}

function readCachedLicenseStatus(clubId) {
  if (!clubId) return null;

  try {
    const raw = localStorage.getItem(getLicenseCacheKey(clubId));
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    const cachedAt = Number(parsed.cachedAt || localStorage.getItem(getLicenseCacheTimeKey(clubId)) || '0');
    if (!cachedAt) return null;

    const data = hydrateLicenseStatus({ ...parsed, cachedAt });
    if (!data) return null;

    return {
      data,
      cachedAt,
      isFresh: (Date.now() - cachedAt) < LICENSE_CACHE_TTL_MS
    };
  } catch (error) {
    console.warn('⚠️ Error leyendo caché de licencia:', error);
    return null;
  }
}

function applyCachedLicenseState(clubId, status) {
  if (!clubId || !status) return status;

  const normalized = hydrateLicenseStatus({
    ...status,
    cachedAt: Number(status.cachedAt || 0)
  });

  localStorage.setItem('licenseStatus', normalized.status || 'error');
  if (normalized.endDate) {
    localStorage.setItem('licenseEndDate', normalized.endDate.toISOString());
  }
  if (normalized.plan) {
    localStorage.setItem('licensePlan', normalized.plan);
  }
  localStorage.setItem('licenseModulos', JSON.stringify(normalized.modulos || {}));

  return normalized;
}

function clearReadOnlyMode() {
  if (!window._licenseReadOnlyApplied) return;

  console.log('🔓 Restableciendo modo interactivo...');

  document.querySelectorAll('[data-license-prev-disabled]').forEach((el) => {
    const prevDisabled = el.dataset.licensePrevDisabled === '1';
    const prevOnclick = el.dataset.licensePrevOnclick;

    el.disabled = prevDisabled;
    if (prevOnclick === '') {
      el.removeAttribute('onclick');
    } else if (typeof prevOnclick === 'string') {
      el.setAttribute('onclick', prevOnclick);
    }

    el.classList.remove('opacity-50', 'cursor-not-allowed');
    delete el.dataset.licensePrevDisabled;
    delete el.dataset.licensePrevOnclick;
  });

  document.querySelectorAll('.license-readonly-overlay').forEach((overlay) => overlay.remove());
  document.querySelectorAll('[data-license-readonly-applied="1"]').forEach((modal) => {
    modal.style.position = '';
    delete modal.dataset.licenseReadonlyApplied;
  });

  const banner = document.getElementById('licenseBanner');
  if (banner) {
    banner.remove();
  }

  document.body.style.paddingTop = '';
  window._licenseReadOnlyApplied = false;
}

// ========================================
// FUNCIONES DE VALIDACIÓN DE CÓDIGOS
// ========================================

/**
 * Validar código de activación
 */
async function validateActivationCode(code) {
  if (!code || code.trim() === '') {
    return { valid: false, error: 'Código vacío' };
  }

  const cleanCode = code.trim().toUpperCase();
  
  if (!window.firebase?.db) {
    console.error('❌ Firebase no disponible');
    return { valid: false, error: 'Error de conexión. Recarga la página.' };
  }

  try {
    console.log('🔍 Validando código:', cleanCode);
    
    const codeRef = window.firebase.doc(
      window.firebase.db,
      'activation_codes',
      cleanCode
    );
    
    const codeSnap = await window.firebase.getDoc(codeRef);
    
    if (!codeSnap.exists()) {
      console.log('❌ Código no encontrado');
      return { valid: false, error: 'Código inválido o no existe' };
    }
    
    const codeData = codeSnap.data();
    
    if (codeData.used === true) {
      console.log('❌ Código ya fue usado');
      return { valid: false, error: 'Este código ya fue utilizado' };
    }
    
    const createdAt = codeData.createdAt?.toDate ? codeData.createdAt.toDate() : new Date(codeData.createdAt);
    const expiresAt = new Date(createdAt);
    expiresAt.setDate(expiresAt.getDate() + LICENSE_CONFIG.CODE_EXPIRY_DAYS);
    
    if (new Date() > expiresAt) {
      console.log('❌ Código expirado');
      return { valid: false, error: 'Este código ha expirado. Solicita uno nuevo.' };
    }
    
    console.log('✅ Código válido:', codeData);
    return { 
      valid: true, 
      data: {
        code: cleanCode,
        plan: codeData.plan,
        createdAt: createdAt,
        expiresAt: expiresAt
      }
    };
    
  } catch (error) {
    console.error('❌ Error al validar código:', error);
    return { valid: false, error: 'Error al verificar el código' };
  }
}

/**
 * Marcar código como usado y crear licencia
 */
async function activateLicense(code, clubId, clubName, clubPhone, plan) {
  if (!window.firebase?.db) {
    console.error('❌ Firebase no disponible');
    return false;
  }

  try {
    const cleanCode = code.trim().toUpperCase();
    const now = new Date();
    
    const endDate = new Date(now);
    if (plan === 'anual') {
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else {
      endDate.setMonth(endDate.getMonth() + 1);
    }

    console.log('📝 Marcando código como usado...');
    await window.firebase.updateDoc(
      window.firebase.doc(window.firebase.db, 'activation_codes', cleanCode),
      {
        used: true,
        usedBy: clubId,
        usedAt: now.toISOString()
      }
    );

    console.log('📝 Creando licencia...');
    await window.firebase.setDoc(
      window.firebase.doc(window.firebase.db, 'licenses', clubId),
      {
        clubId: clubId,
        clubName: clubName,
        clubPhone: clubPhone || '',
        plan: plan,
        activationCode: cleanCode,
        startDate: now.toISOString(),
        endDate: endDate.toISOString(),
        status: 'activo',
        totalPlayers: 0,
        createdAt: now.toISOString(),
        paymentHistory: [{
          date: now.toISOString(),
          plan: plan,
          code: cleanCode,
          action: 'activation'
        }]
      }
    );

    localStorage.setItem('licenseStatus', 'activo');
    localStorage.setItem('licenseEndDate', endDate.toISOString());
    localStorage.setItem('licensePlan', plan);

    console.log('✅ Licencia activada correctamente');
    return true;

  } catch (error) {
    console.error('❌ Error al activar licencia:', error);
    return false;
  }
}

// ========================================
// VERIFICACIÓN DE ESTADO DE LICENCIA
// ========================================

/**
 * Verificar estado de licencia del club actual
 */
async function checkLicenseStatus() {
  const clubId = localStorage.getItem('clubId');
  
  if (!clubId) {
    return { status: 'sin_licencia', daysRemaining: 0, message: 'No hay club registrado' };
  }

  const cachedStatus = readCachedLicenseStatus(clubId);
  if (cachedStatus?.data && (cachedStatus.isFresh || !window.firebase?.db)) {
    console.log('💾 Usando caché de licencia:', cachedStatus.data);
    return applyCachedLicenseState(clubId, cachedStatus.data);
  }

  if (!window.firebase?.db) {
    await new Promise(resolve => setTimeout(resolve, 1500));
  }

  if (!window.firebase?.db) {
    if (cachedStatus?.data) {
      return applyCachedLicenseState(clubId, cachedStatus.data);
    }
    return { status: 'error', daysRemaining: 0, message: 'Sin conexión' };
  }

  try {
    console.log('🔍 Consultando licencia en Firebase...');
    const licenseRef = window.firebase.doc(window.firebase.db, 'licenses', clubId);
    const licenseSnap = await window.firebase.getDoc(licenseRef);

    if (!licenseSnap.exists()) {
      return { status: 'sin_licencia', daysRemaining: 0, message: 'Licencia no encontrada' };
    }

    const licenseData = licenseSnap.data();
    
    if (licenseData.status === 'inactivo') {
      console.log('🔴 Licencia desactivada por administrador');
      return persistLicenseStatus(clubId, {
        status: 'inactivo',
        daysRemaining: 0,
        endDate: new Date(licenseData.endDate),
        plan: licenseData.plan,
        modulos: licenseData.modulos || {},
        message: '🔴 Licencia desactivada - Contacta al administrador'
      });
    }

    const endDate = new Date(licenseData.endDate);
    const result = calculateLicenseState(endDate);

    // Mostrar botones de módulos si están activos
    if (licenseData.modulos?.inventario === true) {
      document.getElementById('btnInventarioWrapper')?.classList.remove('hidden');
    }
    if (licenseData.modulos?.portal_padres === true) {
      document.getElementById('btnPortalPadresWrapper')?.classList.remove('hidden');
    }
    if (licenseData.modulos?.asistencias === true) {
      document.getElementById('btnAsistenciasWrapper')?.classList.remove('hidden');
    }
    if (licenseData.modulos?.convocatoria === true) {
      document.getElementById('btnConvocatoriaWrapper')?.classList.remove('hidden');
    }

    const persisted = persistLicenseStatus(clubId, {
      ...result,
      plan: licenseData.plan,
      modulos: licenseData.modulos || {},
      endDate
    });

    console.log('📋 Estado de licencia:', persisted);
    return persisted;

  } catch (error) {
    console.error('❌ Error al verificar licencia:', error);
    
    if (cachedStatus?.data) {
      return applyCachedLicenseState(clubId, cachedStatus.data);
    }
    
    return { status: 'error', daysRemaining: 0, message: 'Error de conexión' };
  }
}

/**
 * Calcular estado de licencia basado en fecha de vencimiento
 */
function calculateLicenseState(endDate) {
  const now = new Date();
  const diffTime = endDate - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays > LICENSE_CONFIG.GRACE_PERIOD_DAYS) {
    return {
      status: 'activo',
      daysRemaining: diffDays,
      endDate: endDate,
      message: `Licencia activa - ${diffDays} días restantes`
    };
  } else if (diffDays > 0) {
    return {
      status: 'por_vencer',
      daysRemaining: diffDays,
      endDate: endDate,
      message: `⚠️ Tu licencia vence en ${diffDays} día${diffDays > 1 ? 's' : ''}`
    };
  } else if (diffDays > -LICENSE_CONFIG.GRACE_PERIOD_DAYS) {
    const graceDaysLeft = LICENSE_CONFIG.GRACE_PERIOD_DAYS + diffDays;
    return {
      status: 'gracia',
      daysRemaining: graceDaysLeft,
      endDate: endDate,
      message: `⚠️ Período de gracia - ${graceDaysLeft} día${graceDaysLeft > 1 ? 's' : ''} para renovar`
    };
  } else {
    return {
      status: 'inactivo',
      daysRemaining: 0,
      endDate: endDate,
      message: '🔴 Licencia vencida - Contacta al administrador'
    };
  }
}

// ========================================
// INTERFAZ DE USUARIO
// ========================================

function showLicenseBanner(status) {
  const existingBanner = document.getElementById('licenseBanner');
  if (existingBanner) {
    existingBanner.remove();
  }

  if (status.status === 'activo') {
    return;
  }

  const banner = document.createElement('div');
  banner.id = 'licenseBanner';
  
  let bgColor, textColor, icon;
  
  switch (status.status) {
    case 'por_vencer':
      bgColor = 'bg-yellow-500';
      textColor = 'text-yellow-900';
      icon = '⚠️';
      break;
    case 'gracia':
      bgColor = 'bg-orange-500';
      textColor = 'text-orange-900';
      icon = '⏰';
      break;
    case 'inactivo':
      bgColor = 'bg-red-600';
      textColor = 'text-white';
      icon = '🔴';
      break;
    default:
      bgColor = 'bg-gray-500';
      textColor = 'text-white';
      icon = 'ℹ️';
  }

  banner.className = `${bgColor} ${textColor} px-4 py-3 text-center font-medium text-sm fixed top-0 left-0 right-0 z-50 shadow-lg`;
  banner.innerHTML = `
    <div class="flex items-center justify-center gap-2">
      <span>${icon}</span>
      <span>${status.message}</span>
      ${status.status === 'inactivo' ? `
        <a href="https://wa.me/${ADMIN_WHATSAPP}?text=Hola,%20necesito%20renovar%20mi%20licencia%20de%20MY%20CLUB" 
           target="_blank" 
           class="ml-4 bg-white text-gray-800 px-3 py-1 rounded-lg text-xs font-bold hover:bg-gray-100">
          Contactar
        </a>
      ` : ''}
    </div>
  `;

  document.body.prepend(banner);
  document.body.style.paddingTop = '48px';
}

function applyReadOnlyMode() {
  if (window._licenseReadOnlyApplied) return;

  console.log('🔒 Aplicando modo solo lectura...');
  window._licenseReadOnlyApplied = true;
  
  const actionButtons = document.querySelectorAll('button[onclick*="show"], button[onclick*="add"], button[onclick*="save"], button[onclick*="delete"]');
  
  actionButtons.forEach(btn => {
    if (!btn.classList.contains('license-exempt')) {
      if (typeof btn.dataset.licensePrevDisabled === 'undefined') {
        btn.dataset.licensePrevDisabled = btn.disabled ? '1' : '0';
      }
      if (typeof btn.dataset.licensePrevOnclick === 'undefined') {
        btn.dataset.licensePrevOnclick = btn.getAttribute('onclick') ?? '';
      }
      btn.disabled = true;
      btn.classList.add('opacity-50', 'cursor-not-allowed');
      btn.onclick = function(e) {
        e.preventDefault();
        showToast('🔒 Licencia vencida - Modo solo lectura');
        return false;
      };
    }
  });

  const inputs = document.querySelectorAll('input:not([type="search"]), textarea, select');
  inputs.forEach(input => {
    if (!input.classList.contains('license-exempt')) {
      if (typeof input.dataset.licensePrevDisabled === 'undefined') {
        input.dataset.licensePrevDisabled = input.disabled ? '1' : '0';
      }
      input.disabled = true;
      input.classList.add('bg-gray-100', 'dark:bg-gray-700', 'cursor-not-allowed');
    }
  });

  const modals = document.querySelectorAll('[id*="Modal"]');
  modals.forEach(modal => {
    if (modal.dataset.licenseReadonlyApplied === '1') return;
    const overlay = document.createElement('div');
    overlay.className = 'absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 license-readonly-overlay';
    overlay.innerHTML = `
      <div class="bg-white dark:bg-gray-800 rounded-lg p-6 text-center max-w-sm">
        <div class="text-4xl mb-3">🔒</div>
        <h3 class="font-bold text-lg mb-2">Licencia Vencida</h3>
        <p class="text-gray-600 dark:text-gray-400 text-sm mb-4">
          Contacta al administrador para renovar tu suscripción.
        </p>
        <a href="https://wa.me/${ADMIN_WHATSAPP}?text=Hola,%20necesito%20renovar%20mi%20licencia%20de%20MY%20CLUB" 
           target="_blank"
           class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm inline-block">
          📱 Contactar por WhatsApp
        </a>
      </div>
    `;
    modal.style.position = 'relative';
    modal.dataset.licenseReadonlyApplied = '1';
    modal.appendChild(overlay);
  });

  showToast('🔒 Modo solo lectura activado');
}

// ========================================
// INICIALIZACIÓN
// ========================================

async function initLicenseSystem() {
  console.log('🔐 Inicializando sistema de licencias...');
  
  const clubId = localStorage.getItem('clubId');
  
  if (!clubId) {
    console.log('ℹ️ No hay club registrado, omitiendo verificación de licencia');
    return;
  }

  await new Promise(resolve => setTimeout(resolve, 1000));

  const status = await checkLicenseStatus();
  console.log('📋 Estado de licencia:', status);

  showLicenseBanner(status);

  if (status.status === 'inactivo') {
    applyReadOnlyMode();
  } else {
    clearReadOnlyMode();
  }

  updatePlayerCount();
}

async function updatePlayerCount() {
  const clubId = localStorage.getItem('clubId');
  if (!clubId || !window.firebase?.db) return;

  try {
    const players = JSON.parse(localStorage.getItem('players') || '[]');
    const totalPlayers = players.length;

    // ✅ Solo escribir si el número cambió — evita snapshot/reload innecesario
    const cachedCount = Number(localStorage.getItem('_cachedPlayerCount') ?? '-1');
    if (cachedCount === totalPlayers) {
      console.log('📊 Contador de jugadores sin cambios, omitiendo escritura a Firestore');
      return;
    }

    await window.firebase.updateDoc(
      window.firebase.doc(window.firebase.db, 'licenses', clubId),
      { totalPlayers: totalPlayers }
      // ⚠️ NO incluir lastUpdated — causaba que onSnapshot siempre detectara cambio
    );

    localStorage.setItem('_cachedPlayerCount', String(totalPlayers));

    console.log('📊 Contador de jugadores actualizado:', totalPlayers);
  } catch (error) {
    console.warn('⚠️ No se pudo actualizar contador de jugadores:', error);
  }
}

// ========================================
// 📡 LISTENER DE CAMBIOS EN TIEMPO REAL - ✅ CON MANEJO DE ERRORES
// ========================================

function listenToLicenseChanges() {
  const clubId = localStorage.getItem('clubId');
  
  if (!clubId) return;

  if (!window.firebase?.db) {
    // Máximo 5 intentos para no bloquear la app
    if (!window._licenseRetries) window._licenseRetries = 0;
    window._licenseRetries++;
    if (window._licenseRetries >= 5) {
      console.warn('⚠️ Firebase no disponible, omitiendo listener de licencia');
      window._licenseRetries = 0;
      return;
    }
    setTimeout(listenToLicenseChanges, 2000);
    return;
  }

  try {
    console.log('👂 Escuchando cambios en licencia:', clubId);
    
    const licenseRef = window.firebase.doc(window.firebase.db, 'licenses', clubId);
    
    // Cancelar listener anterior si existe (evita duplicados al reiniciar sesión)
    if (typeof window.licenseUnsubscribe === 'function') {
      window.licenseUnsubscribe();
      window.licenseUnsubscribe = null;
    }

    window.licenseUnsubscribe = window.firebase.onSnapshot(licenseRef,
      (doc) => {
        if (!doc.exists()) {
          console.log('⚠️ Licencia no encontrada');
          return;
        }

        const licenseData = doc.data();
        const currentStatus = localStorage.getItem('licenseStatus');
        const newStatus = licenseData.status;

        console.log('📡 Estado actual:', currentStatus, '→ Nuevo estado:', newStatus);

        const modulosChanged = JSON.stringify(licenseData.modulos) !== localStorage.getItem('licenseModulos');
        localStorage.setItem('licenseModulos', JSON.stringify(licenseData.modulos || {}));

        if ((currentStatus && currentStatus !== newStatus) || modulosChanged) {
          console.log('🔄 Estado de licencia cambió...');

          const daysRemaining = newStatus === 'activo'
            ? calculateLicenseState(new Date(licenseData.endDate)).daysRemaining
            : 0;
          const nextStatus = persistLicenseStatus(clubId, {
            status: newStatus,
            daysRemaining,
            endDate: licenseData.endDate ? new Date(licenseData.endDate) : null,
            plan: licenseData.plan,
            modulos: licenseData.modulos || {},
            message: newStatus === 'activo'
              ? 'Licencia activa'
              : '🔴 Licencia desactivada - Contacta al administrador'
          });

          showLicenseBanner(nextStatus);

          if (newStatus !== 'activo') {
            showToast(`🔴 Licencia desactivada. Contacta al administrador.`);
            applyReadOnlyMode();
          } else {
            clearReadOnlyMode();
            showToast(`✅ Licencia activada correctamente`);
          }
        } else {
          persistLicenseStatus(clubId, {
            status: newStatus,
            daysRemaining: newStatus === 'activo'
              ? calculateLicenseState(new Date(licenseData.endDate)).daysRemaining
              : 0,
            endDate: licenseData.endDate ? new Date(licenseData.endDate) : null,
            plan: licenseData.plan,
            modulos: licenseData.modulos || {},
            message: newStatus === 'activo'
              ? 'Licencia activa'
              : '🔴 Licencia desactivada - Contacta al administrador'
          });
        }
      }, 
      (error) => {
        // ✅ MANEJO DE ERRORES DE PERMISOS
        if (error.code === 'permission-denied') {
          console.warn('⚠️ Sin permisos para escuchar licencia (puede ser normal en algunos casos)');
        } else {
          console.error('❌ Error en listener de licencia:', error);
        }
      }
    );

    console.log('✅ Listener de licencia activado');
    
  } catch (error) {
    console.error('❌ Error al configurar listener:', error);
  }
}

window.addEventListener('load', () => {
  setTimeout(() => {
    listenToLicenseChanges();
  }, 3000);
});

// ========================================
// FUNCIONES GLOBALES
// ========================================
window.validateActivationCode = validateActivationCode;
window.activateLicense = activateLicense;
window.checkLicenseStatus = checkLicenseStatus;
window.initLicenseSystem = initLicenseSystem;
window.showLicenseBanner = showLicenseBanner;
window.applyReadOnlyMode = applyReadOnlyMode;
window.updatePlayerCount = updatePlayerCount;
window.listenToLicenseChanges = listenToLicenseChanges;


function abrirInventario() {
  const clubId = localStorage.getItem('clubId');
  window.open('https://myclub-inventario.vercel.app?clubId=' + clubId, '_blank');
}
window.abrirInventario = abrirInventario;

function abrirAsistencias() {
  const clubId = localStorage.getItem('clubId');
  window.open('https://myclub-asistencia.vercel.app/admin.html?clubId=' + clubId, '_blank');
}
window.abrirAsistencias = abrirAsistencias;

function abrirConvocatoria() {
  const clubId = localStorage.getItem('clubId');
  window.open('https://myclub-convocatoria.vercel.app?clubId=' + clubId, '_blank');
}
window.abrirConvocatoria = abrirConvocatoria;

console.log('✅ license-system.js cargado correctamente');
