// ========================================
// PORTAL DE PADRES - LÓGICA COMPLETA
// ========================================
// 📍 CREAR ESTE ARCHIVO NUEVO: js/parent-portal.js
// ========================================

// Estado del portal
let currentPlayer = null;
let currentClubId = null;
let currentClubSettings = null;

// ========================================
// INICIALIZACIÓN
// ========================================

document.addEventListener('DOMContentLoaded', function() {
  console.log('👨‍👩‍👧 Portal de Padres iniciando...');
  checkSavedSession();
  const loginForm = document.getElementById('parentLoginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', handleParentLogin);
  }
  applyDarkModeParent();
});

// ========================================
// AUTENTICACIÓN
// ========================================

async function handleParentLogin(e) {
  e.preventDefault();
  
  const clubId = document.getElementById('parentClubId').value.trim().toLowerCase();
  const accessCode = document.getElementById('parentAccessCode').value.trim().toUpperCase();
  
  if (!clubId || !accessCode) {
    showParentToast('❌ Completa todos los campos');
    return;
  }
  
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const originalText = submitBtn.innerHTML;
  submitBtn.innerHTML = '<span class="animate-spin">⏳</span> Verificando...';
  submitBtn.disabled = true;
  
  try {
    const success = await loadClubDataFromFirebase(clubId, accessCode);
    
    if (success) {
      saveParentSession(clubId, accessCode);
      showPlayerProfile();
      showParentToast('✅ ¡Bienvenido!');
    } else {
      showParentToast('❌ Código o Club ID inválido');
    }
  } catch (error) {
    console.error('Error en login de padre:', error);
    showParentToast('❌ Error al verificar. Intenta de nuevo.');
  } finally {
    submitBtn.innerHTML = originalText;
    submitBtn.disabled = false;
  }
}

async function loadClubDataFromFirebase(clubId, accessCode) {
  try {
    if (!window.firebase?.db) {
      await initFirebaseForParent();
    }
    
    if (!window.firebase?.db) {
      console.error('Firebase no disponible');
      return false;
    }
    
    const codesRef = window.firebase.collection(window.firebase.db, `clubs/${clubId}/parentCodes`);
    const codesSnapshot = await window.firebase.getDocs(codesRef);
    
    let playerId = null;
    
    codesSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.code === accessCode) {
        playerId = data.playerId;
      }
    });
    
    if (!playerId) {
      console.log('Código no encontrado');
      return false;
    }
    
    const playerRef = window.firebase.doc(window.firebase.db, `clubs/${clubId}/players`, playerId);
    const playerSnap = await window.firebase.getDoc(playerRef);
    
    if (!playerSnap.exists()) {
      console.log('Jugador no encontrado');
      return false;
    }
    
    currentPlayer = { id: playerSnap.id, ...playerSnap.data() };
    
    const settingsRef = window.firebase.doc(window.firebase.db, `clubs/${clubId}/settings`, 'main');
    const settingsSnap = await window.firebase.getDoc(settingsRef);
    
    if (settingsSnap.exists()) {
      currentClubSettings = settingsSnap.data();
    } else {
      currentClubSettings = { name: 'Escuela de Fútbol' };
    }
    
    const paymentsRef = window.firebase.collection(window.firebase.db, `clubs/${clubId}/payments`);
    const paymentsSnapshot = await window.firebase.getDocs(paymentsRef);
    
    const playerPayments = [];
    paymentsSnapshot.forEach(doc => {
      const payment = { id: doc.id, ...doc.data() };
      if (payment.playerId === playerId) {
        playerPayments.push(payment);
      }
    });
    
    currentPlayer.payments = playerPayments;
    
    // 🆕 5. Cargar próximos eventos del club
    try {
      const eventsRef = window.firebase.collection(window.firebase.db, `clubs/${clubId}/events`);
      const eventsSnapshot = await window.firebase.getDocs(eventsRef);
      
      const today = new Date().toISOString().split('T')[0];
      const upcomingEvents = [];
      
      eventsSnapshot.forEach(doc => {
        const event = { id: doc.id, ...doc.data() };
        if (event.date >= today) {
          upcomingEvents.push(event);
        }
      });
      
      // Ordenar por fecha y tomar los próximos 5
      currentPlayer.upcomingEvents = upcomingEvents
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .slice(0, 5);
    } catch (e) {
      console.log('No se pudieron cargar eventos');
      currentPlayer.upcomingEvents = [];
    }
    
    currentClubId = clubId;
    
    console.log('✅ Datos cargados correctamente');
    return true;
    
  } catch (error) {
    console.error('Error al cargar datos:', error);
    return false;
  }
}

async function initFirebaseForParent() {
  try {
    const firebaseConfig = {
      apiKey: "AIzaSyBThVgzEsTLWSW7puKOVErZ_KOLDEq8v3A",
      authDomain: "my-club-fae98.firebaseapp.com",
      projectId: "my-club-fae98",
      storageBucket: "my-club-fae98.firebasestorage.app",
      messagingSenderId: "807792685568",
      appId: "1:807792685568:web:06097faad391a9fd8c9ee5"
    };
    
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
    const { getFirestore, collection, doc, getDoc, getDocs } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
    
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    
    window.firebase = { db, collection, doc, getDoc, getDocs };
    
    console.log('✅ Firebase inicializado para portal de padres');
    return true;
  } catch (error) {
    console.error('Error al inicializar Firebase:', error);
    return false;
  }
}

// ========================================
// SESIÓN
// ========================================

function saveParentSession(clubId, accessCode) {
  localStorage.setItem('parentSession', JSON.stringify({ clubId, accessCode, savedAt: new Date().toISOString() }));
}

function getParentSession() {
  try {
    const session = localStorage.getItem('parentSession');
    return session ? JSON.parse(session) : null;
  } catch { return null; }
}

function clearParentSession() {
  localStorage.removeItem('parentSession');
  currentPlayer = null;
  currentClubId = null;
  currentClubSettings = null;
}

async function checkSavedSession() {
  const session = getParentSession();
  
  if (session && session.clubId && session.accessCode) {
    document.getElementById('loginContainer').innerHTML = `
      <div class="text-center py-8">
        <div class="animate-spin text-4xl mb-4">⚽</div>
        <p class="text-gray-600 dark:text-gray-400">Cargando...</p>
      </div>
    `;
    
    const success = await loadClubDataFromFirebase(session.clubId, session.accessCode);
    
    if (success) {
      showPlayerProfile();
    } else {
      clearParentSession();
      location.reload();
    }
  }
}

// ========================================
// RENDERIZADO DEL PERFIL
// ========================================

function showPlayerProfile() {
  if (!currentPlayer) {
    showParentToast('❌ Error al cargar perfil');
    return;
  }
  
  document.getElementById('loginContainer').classList.add('hidden');
  const profileContainer = document.getElementById('profileContainer');
  profileContainer.classList.remove('hidden');
  
  const age = calculateAge(currentPlayer.birthDate);
  const payments = currentPlayer.payments || [];
  const totalPaid = payments.filter(p => p.status === 'Pagado').reduce((sum, p) => sum + (p.amount || 0), 0);
  const totalPending = payments.filter(p => p.status === 'Pendiente').reduce((sum, p) => sum + (p.amount || 0), 0);
  
  const paymentsHTML = payments.length > 0 
    ? payments.sort((a, b) => new Date(b.dueDate || b.createdAt) - new Date(a.dueDate || a.createdAt))
        .map(payment => `
          <div class="flex items-center justify-between p-3 rounded-xl ${payment.status === 'Pagado' ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}">
            <div>
              <p class="font-medium text-gray-800 dark:text-white">${payment.concept || payment.type}</p>
              <p class="text-xs text-gray-500 dark:text-gray-400">${formatDateParent(payment.paidDate || payment.dueDate)}</p>
            </div>
            <div class="text-right">
              <p class="font-bold text-gray-800 dark:text-white">${formatCurrencyParent(payment.amount)}</p>
              <span class="text-xs font-medium ${payment.status === 'Pagado' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}">
                ${payment.status === 'Pagado' ? '✅ Pagado' : '⏳ Pendiente'}
              </span>
            </div>
          </div>
        `).join('')
    : '<p class="text-center text-gray-500 dark:text-gray-400 py-8">No hay pagos registrados</p>';

  // Assuming unreadResponses is defined elsewhere or will be added. For now, setting to 0.
  const unreadResponses = 0; // Placeholder for unread suggestions count

  profileContainer.innerHTML = `
    <!-- Header Premium -->
    <div class="bg-slate-900/95 backdrop-blur-xl border-b border-slate-800/80 text-white p-4 flex items-center gap-3 sticky top-0 z-30 shadow-md">
      <img src="${currentClubSettings?.logo || getDefaultLogoParent()}" alt="Logo" class="w-11 h-11 rounded-xl object-contain bg-white/5 p-1 border border-white/10">
      <div class="flex-1">
        <h1 class="font-bold text-lg tracking-tight text-slate-100">${currentClubSettings?.name || 'Escuela de Fútbol'}</h1>
        <p class="text-xs font-medium text-emerald-400 uppercase tracking-wider">Portal de Padres</p>
      </div>
      <button onclick="openSuggestionModal()" class="p-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl transition-all border border-slate-700 hover:border-slate-600 relative group" title="Sugerencias">
        <span class="text-lg group-hover:scale-110 transition-transform block">💡</span>
        ${unreadResponses > 0 ? `<span class="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center border-2 border-slate-900 shadow-sm">${unreadResponses}</span>` : ''}
      </button>
      <button onclick="parentLogout()" class="p-2.5 bg-slate-800 hover:bg-rose-900/40 hover:text-rose-400 text-slate-400 rounded-xl transition-all border border-slate-700 hover:border-rose-900/50" title="Cerrar sesión">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
        </svg>
      </button>
    </div>
    <!-- Espacio Principal -->
    <div class="p-4 space-y-5 bg-[#0a0f1c] min-h-screen">
      
      <!-- Ficha del Jugador (Glassmorphism) -->
      <div class="bg-slate-800/60 backdrop-blur-md rounded-[24px] p-6 shadow-2xl border border-slate-700/50 text-center relative overflow-hidden">
        <!-- Brillo decorativo sutil -->
        <div class="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div class="absolute -bottom-24 -left-24 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
        
        <div class="relative inline-block">
          <img src="${currentPlayer.avatar || getDefaultAvatarParent()}" alt="${currentPlayer.name}" 
               class="w-32 h-32 rounded-full object-cover border-4 border-slate-800 mx-auto mb-4 shadow-[0_8px_30px_rgb(0,0,0,0.5)] ring-2 ring-emerald-500/30">
          <span class="absolute bottom-4 right-1 w-5 h-5 ${currentPlayer.status === 'Activo' ? 'bg-emerald-500' : 'bg-rose-500'} border-4 border-slate-800 rounded-full"></span>
        </div>
        
        <h2 class="text-2xl font-bold text-slate-100 tracking-tight">${currentPlayer.name}</h2>
        <p class="text-slate-400 font-medium text-sm mt-1 mb-2">${currentPlayer.category} <span class="mx-1">•</span> ${age} años</p>
        
        ${currentPlayer.position ? `<div class="inline-flex items-center gap-2 bg-slate-900/50 border border-slate-700/50 px-3 py-1.5 rounded-lg mb-4"><span class="text-emerald-400 font-semibold text-sm">${currentPlayer.position}</span> ${currentPlayer.jerseyNumber ? '<span class="text-slate-500 text-xs font-mono border-l border-slate-700/50 pl-2">#' + currentPlayer.jerseyNumber + '</span>' : ''}</div>` : ''}
        
        <button onclick="openEditProfileModal()" class="w-full mt-2 bg-slate-700/50 hover:bg-slate-700 border border-slate-600/50 text-slate-200 py-3 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 group shadow-sm">
          <span class="group-hover:rotate-12 transition-transform">✏️</span> Editar Datos
        </button>
      </div>
      
      <!-- Resumen Financiero Corporativo -->
      <div class="grid grid-cols-2 gap-3">
        <div class="bg-slate-800/80 backdrop-blur-md border border-slate-700/50 rounded-2xl p-4 flex flex-col items-center justify-center">
          <p class="text-[11px] uppercase tracking-wider text-slate-400 mb-1 font-semibold flex items-center gap-1.5"><span class="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>Abonado</p>
          <p class="text-lg font-bold text-slate-100">${formatCurrencyParent(totalPaid)}</p>
        </div>
        <div class="bg-slate-800/80 backdrop-blur-md border border-slate-700/50 rounded-2xl p-4 flex flex-col items-center justify-center relative overflow-hidden">
          ${totalPending > 0 ? '<div class="absolute top-0 right-0 w-8 h-8 bg-rose-500/20 blur-xl"></div>' : ''}
          <p class="text-[11px] uppercase tracking-wider text-slate-400 mb-1 font-semibold flex items-center gap-1.5"><span class="w-1.5 h-1.5 bg-rose-500 rounded-full"></span>Deuda</p>
          <p class="text-lg font-bold ${totalPending > 0 ? 'text-rose-400' : 'text-slate-100'}">${formatCurrencyParent(totalPending)}</p>
        </div>
      </div>
      
      ${nextPaymentHTML || paymentStatusHTML}
      
      <!-- Panel de Pagos Unificado -->
      <div class="bg-slate-800/60 backdrop-blur-md rounded-2xl border border-slate-700/50 overflow-hidden shadow-lg">
        <div class="bg-slate-800/80 px-5 py-3.5 border-b border-slate-700/50 flex items-center justify-between">
          <h3 class="font-bold text-slate-200 text-sm flex items-center gap-2"><span class="text-slate-400">📄</span> Historial de Movimientos</h3>
        </div>
        <div class="p-4 bg-slate-800/30">
          <div class="space-y-3 max-h-[250px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-transparent">
            ${paymentsHTML}
          </div>
        </div>
      </div>
      
      ${currentPlayer.medicalInfo?.bloodType || currentPlayer.medicalInfo?.allergies || currentPlayer.medicalInfo?.conditions ? `
        <div class="bg-slate-800/60 backdrop-blur-md border border-slate-700/50 rounded-2xl p-5 shadow-lg">
          <h3 class="font-bold text-slate-200 mb-4 flex items-center gap-2 text-sm border-b border-slate-700/50 pb-3">
            <span class="p-1.5 bg-rose-500/10 text-rose-400 rounded-lg">🏥</span> Ficha Médica
          </h3>
          <div class="space-y-3 text-sm">
            ${currentPlayer.medicalInfo?.bloodType ? `
              <div class="flex justify-between items-center bg-slate-900/30 p-2.5 rounded-lg border border-slate-700/30">
                <span class="text-slate-400">Tipo de sangre</span>
                <span class="font-bold text-slate-200 bg-slate-700/50 px-2 py-0.5 rounded">${currentPlayer.medicalInfo.bloodType}</span>
              </div>
            ` : ''}
            ${currentPlayer.medicalInfo?.allergies ? `
              <div class="flex justify-between items-center bg-rose-500/5 p-2.5 rounded-lg border border-rose-500/20">
                <span class="text-slate-400">Alergias</span>
                <span class="font-medium text-rose-400 text-right max-w-[60%] leading-tight">${currentPlayer.medicalInfo.allergies}</span>
              </div>
            ` : ''}
            ${currentPlayer.medicalInfo?.conditions ? `
              <div class="flex justify-between items-center bg-slate-900/30 p-2.5 rounded-lg border border-slate-700/30">
                <span class="text-slate-400">Condiciones</span>
                <span class="font-medium text-slate-300 text-right max-w-[60%] leading-tight">${currentPlayer.medicalInfo.conditions}</span>
              </div>
            ` : ''}
          </div>
        </div>
      ` : ''}
      
      ${currentClubSettings?.phone ? `
        <div class="bg-gradient-to-r from-emerald-900/60 to-emerald-800/40 backdrop-blur-md border border-emerald-700/30 rounded-2xl p-4 shadow-lg">
          <a href="https://wa.me/${currentClubSettings.phone.replace(/[^0-9+]/g, '')}" target="_blank"
             class="flex items-center gap-4 group">
            <div class="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform">
              <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            </div>
            <div class="flex-1">
              <p class="font-bold text-emerald-100">Dudas o consultas</p>
              <p class="text-sm text-emerald-400/80">Contactar al club vía WhatsApp</p>
            </div>
            <div class="text-emerald-500/50 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
            </div>
          </a>
        </div>
      ` : ''}
      
      
      <div id="installPrompt" class="hidden bg-slate-800 border border-slate-700 rounded-2xl p-4 shadow-lg item-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 bg-slate-700 rounded-xl flex items-center justify-center text-xl">📲</div>
          <div class="flex-1">
            <p class="font-bold text-slate-200 text-sm">Instala la App</p>
            <p class="text-xs text-slate-400">Acceso directo al portal</p>
          </div>
          <button onclick="installParentPWA()" class="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors">
            Instalar
          </button>
        </div>
      </div>
      
      <!-- Botón Descargar Carnet (Corporativo Solido) -->
      <button onclick="generatePlayerCard()" class="w-full bg-slate-100 hover:bg-white text-slate-900 shadow-md shadow-white/5 py-4 rounded-xl font-bold text-sm flex items-center justify-center gap-3 transition-transform active:scale-95 group mt-8">
        <svg class="w-5 h-5 text-slate-600 group-hover:text-emerald-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2"></path></svg>
        Descargar Carnet Virtual
      </button>
      
      <!-- Espacio final para scroll cómodo en móvil -->
      <div class="h-6"></div>
    </div>
  `;
  
  checkInstallPrompt();
}

// ========================================
// FUNCIONES DE PAGO
// ========================================

async function parentLogout() {
  const confirmed = await showAppConfirm('¿Cerrar sesión?', {
    type: 'warning',
    title: 'Salir del portal',
    confirmText: 'Sí, cerrar sesión'
  });
  if (confirmed) {
    clearParentSession();
    location.reload();
  }
}

// ========================================
// UTILIDADES
// ========================================

function calculateAge(birthDate) {
  if (!birthDate) return '-';
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function formatCurrencyParent(amount) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount || 0);
}

function formatDateParent(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getDefaultLogoParent() {
  return 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Ccircle cx="50" cy="50" r="45" fill="%230d9488"/%3E%3Ctext x="50" y="65" font-size="50" text-anchor="middle" fill="white"%3E⚽%3C/text%3E%3C/svg%3E';
}

function getDefaultAvatarParent() {
  return 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Ccircle cx="50" cy="50" r="45" fill="%236b7280"/%3E%3Ctext x="50" y="65" font-size="50" text-anchor="middle" fill="white"%3E👤%3C/text%3E%3C/svg%3E';
}

// 🆕 Obtener icono según tipo de evento
function getEventIcon(type) {
  const icons = {
    'Entrenamiento': '⚽',
    'Partido': '🏆',
    'Torneo': '🎖️',
    'Reunión': '👥',
    'Festivo': '🎉',
    'Otro': '📌'
  };
  return icons[type] || '📅';
}

function showParentToast(message) {
  const toast = document.getElementById('parentToast');
  if (toast) {
    toast.textContent = message;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 3000);
  }
}

function applyDarkModeParent() {
  if (localStorage.getItem('parentDarkMode') === 'true') {
    document.documentElement.classList.add('dark');
  }
}

function toggleDarkModeParent() {
  const isDark = document.documentElement.classList.toggle('dark');
  localStorage.setItem('parentDarkMode', isDark.toString());
}

// ========================================
// PWA INSTALL
// ========================================

let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  checkInstallPrompt();
});

function checkInstallPrompt() {
  const installDiv = document.getElementById('installPrompt');
  if (installDiv && deferredPrompt) installDiv.classList.remove('hidden');
}

async function installParentPWA() {
  if (!deferredPrompt) {
    showParentToast('La app ya está instalada');
    return;
  }
  
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  
  if (outcome === 'accepted') showParentToast('✅ ¡App instalada!');
  
  deferredPrompt = null;
  document.getElementById('installPrompt')?.classList.add('hidden');
}

console.log('✅ parent-portal.js cargado');

// ========================================
// 🆕 GENERAR CARNET DEL JUGADOR (PDF)
// ========================================

async function generatePlayerCard() {
  if (!currentPlayer) {
    showParentToast('❌ No hay datos del jugador');
    return;
  }
  
  showParentToast('⏳ Generando carnet...');
  
  try {
    // Cargar jsPDF dinámicamente si no está cargado
    if (typeof window.jspdf === 'undefined') {
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
    }
    
    const { jsPDF } = window.jspdf;
    
    // Crear PDF en formato carnet (tamaño tarjeta de crédito aprox)
    // 85.6mm x 53.98mm estándar, pero usaremos algo más grande para legibilidad
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: [90, 55]
    });
    
    const width = 90;
    const height = 55;
    
    // ========== LADO FRONTAL ==========
    
    // Fondo degradado (simulado con rectángulos)
    doc.setFillColor(13, 148, 136); // Teal
    doc.rect(0, 0, width, 18, 'F');
    
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 18, width, height - 18, 'F');
    
    // Logo del club (si existe)
    if (currentClubSettings?.logo && currentClubSettings.logo.startsWith('data:image')) {
      try {
        doc.addImage(currentClubSettings.logo, 'PNG', 3, 3, 12, 12);
      } catch (e) {
        // Si falla, dibujar círculo con emoji
        doc.setFillColor(255, 255, 255);
        doc.circle(9, 9, 6, 'F');
      }
    } else {
      doc.setFillColor(255, 255, 255);
      doc.circle(9, 9, 6, 'F');
      doc.setFontSize(8);
      doc.setTextColor(13, 148, 136);
      doc.text('⚽', 6.5, 11);
    }
    
    // Nombre del club
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    const clubName = currentClubSettings?.name || 'Escuela de Fútbol';
    doc.text(clubName.substring(0, 25), 18, 8);
    
    // Subtítulo
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.text('CARNET DE JUGADOR', 18, 13);
    
    // Foto del jugador
    const photoX = 5;
    const photoY = 22;
    const photoW = 20;
    const photoH = 25;
    
    // Marco de la foto
    doc.setDrawColor(13, 148, 136);
    doc.setLineWidth(0.5);
    doc.rect(photoX, photoY, photoW, photoH, 'S');
    
    // Agregar foto si existe
    if (currentPlayer.avatar && currentPlayer.avatar.startsWith('data:image')) {
      try {
        doc.addImage(currentPlayer.avatar, 'JPEG', photoX + 0.5, photoY + 0.5, photoW - 1, photoH - 1);
      } catch (e) {
        // Placeholder si falla
        doc.setFillColor(230, 230, 230);
        doc.rect(photoX + 0.5, photoY + 0.5, photoW - 1, photoH - 1, 'F');
        doc.setFontSize(16);
        doc.setTextColor(150, 150, 150);
        doc.text('👤', photoX + 6, photoY + 15);
      }
    } else {
      doc.setFillColor(230, 230, 230);
      doc.rect(photoX + 0.5, photoY + 0.5, photoW - 1, photoH - 1, 'F');
      doc.setFontSize(16);
      doc.setTextColor(150, 150, 150);
      doc.text('👤', photoX + 6, photoY + 15);
    }
    
    // Información del jugador
    const infoX = 28;
    let infoY = 24;
    
    // Nombre
    doc.setFontSize(9);
    doc.setTextColor(30, 30, 30);
    doc.setFont('helvetica', 'bold');
    const playerName = currentPlayer.name || 'Sin nombre';
    doc.text(playerName.substring(0, 22), infoX, infoY);
    
    // Categoría
    infoY += 5;
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text(`Categoría: ${currentPlayer.category || '-'}`, infoX, infoY);
    
    // Posición
    infoY += 4;
    doc.text(`Posición: ${currentPlayer.position || '-'}`, infoX, infoY);
    
    // Dorsal
    if (currentPlayer.jerseyNumber) {
      infoY += 4;
      doc.text(`Dorsal: #${currentPlayer.jerseyNumber}`, infoX, infoY);
    }
    
    // Documento
    if (currentPlayer.documentNumber) {
      infoY += 4;
      const docType = currentPlayer.documentType || 'Doc';
      doc.text(`${docType}: ${currentPlayer.documentNumber}`, infoX, infoY);
    }
    
    // Fecha de nacimiento
    if (currentPlayer.birthDate) {
      infoY += 4;
      const birthDate = formatDateParent(currentPlayer.birthDate);
      doc.text(`Nac: ${birthDate}`, infoX, infoY);
    }
    
    // Número de dorsal grande (decorativo)
    if (currentPlayer.jerseyNumber) {
      doc.setFontSize(20);
      doc.setTextColor(13, 148, 136);
      doc.setFont('helvetica', 'bold');
      doc.text(`#${currentPlayer.jerseyNumber}`, 75, 45);
    }
    
    // Línea decorativa inferior
    doc.setDrawColor(13, 148, 136);
    doc.setLineWidth(1);
    doc.line(0, height - 2, width, height - 2);
    
    // Código QR simulado (cuadrado con texto)
    doc.setFillColor(240, 240, 240);
    doc.rect(72, 22, 14, 14, 'F');
    doc.setFontSize(4);
    doc.setTextColor(100, 100, 100);
    doc.text('ID:', 74, 26);
    doc.setFontSize(3);
    const shortId = (currentPlayer.id || 'N/A').substring(0, 8);
    doc.text(shortId, 74, 29);
    
    // Vigencia
    const currentYear = new Date().getFullYear();
    doc.setFontSize(5);
    doc.setTextColor(100, 100, 100);
    doc.text(`Vigencia: ${currentYear}`, 5, height - 3);
    
    // ========== AGREGAR SEGUNDA PÁGINA (REVERSO) ==========
    doc.addPage([90, 55], 'landscape');
    
    // Fondo
    doc.setFillColor(250, 250, 250);
    doc.rect(0, 0, width, height, 'F');
    
    // Header
    doc.setFillColor(13, 148, 136);
    doc.rect(0, 0, width, 10, 'F');
    
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text('INFORMACIÓN DE EMERGENCIA', 5, 7);
    
    // Información médica
    let medY = 16;
    doc.setFontSize(6);
    doc.setTextColor(60, 60, 60);
    doc.setFont('helvetica', 'normal');
    
    // Tipo de sangre
    doc.setFont('helvetica', 'bold');
    doc.text('Tipo de Sangre:', 5, medY);
    doc.setFont('helvetica', 'normal');
    const bloodType = currentPlayer.medicalInfo?.bloodType || 'No especificado';
    doc.text(bloodType, 35, medY);
    
    // Alergias
    medY += 5;
    doc.setFont('helvetica', 'bold');
    doc.text('Alergias:', 5, medY);
    doc.setFont('helvetica', 'normal');
    const allergies = currentPlayer.medicalInfo?.allergies || 'Ninguna conocida';
    doc.text(allergies.substring(0, 35), 35, medY);
    
    // Condiciones
    medY += 5;
    doc.setFont('helvetica', 'bold');
    doc.text('Condiciones:', 5, medY);
    doc.setFont('helvetica', 'normal');
    const conditions = currentPlayer.medicalInfo?.conditions || 'Ninguna';
    doc.text(conditions.substring(0, 35), 35, medY);
    
    // Contacto de emergencia
    medY += 8;
    doc.setFillColor(255, 240, 240);
    doc.rect(3, medY - 3, width - 6, 12, 'F');
    doc.setDrawColor(220, 50, 50);
    doc.setLineWidth(0.3);
    doc.rect(3, medY - 3, width - 6, 12, 'S');
    
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(180, 0, 0);
    doc.text('PADRE / ACUDIENTE:', 5, medY + 1);
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    const fatherPhone = currentPlayer.phone || 'No especificado';
    doc.text(fatherPhone, 5, medY + 6);
    
    if (currentPlayer.emergencyContact) {
      medY += 8;
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(180, 0, 0);
      doc.text('MADRE:', 5, medY + 1);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      doc.text(currentPlayer.emergencyContact, 5, medY + 6);
    }
    
    // Contacto del club
    medY += 16;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(13, 148, 136);
    doc.text('Contacto del Club:', 5, medY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    const clubPhone = currentClubSettings?.phone || 'No disponible';
    doc.text(clubPhone, 35, medY);
    
    // Pie de página
    doc.setFontSize(4);
    doc.setTextColor(150, 150, 150);
    doc.text('Este carnet es propiedad de ' + (currentClubSettings?.name || 'la escuela'), 5, height - 3);
    doc.text('En caso de encontrarlo, favor comunicarse al número indicado', 5, height - 1);
    
    // Descargar PDF
    const fileName = `carnet_${currentPlayer.name.replace(/\s+/g, '_')}_${currentYear}.pdf`;
    doc.save(fileName);
    
    showParentToast('✅ Carnet descargado');
    
  } catch (error) {
    console.error('Error al generar carnet:', error);
    showParentToast('❌ Error al generar carnet');
  }
}

// Función auxiliar para cargar scripts dinámicamente
function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}