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

  profileContainer.innerHTML = `
    <div class="bg-gradient-to-r from-teal-600 to-blue-600 text-white p-4 flex items-center gap-3">
      <img src="${currentClubSettings?.logo || getDefaultLogoParent()}" alt="Logo" class="w-12 h-12 rounded-lg object-cover">
      <div class="flex-1">
        <h1 class="font-bold text-lg">${currentClubSettings?.name || 'Escuela de Fútbol'}</h1>
        <p class="text-sm opacity-90">Portal de Padres</p>
      </div>
      <button onclick="parentLogout()" class="p-2 hover:bg-white/20 rounded-lg transition-colors" title="Cerrar sesión">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
        </svg>
      </button>
    </div>
    
    <div class="p-4 space-y-4">
      <div class="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg text-center">
        <img src="${currentPlayer.avatar || getDefaultAvatarParent()}" alt="${currentPlayer.name}" 
             class="w-32 h-32 rounded-full object-cover border-4 border-teal-500 mx-auto mb-4 shadow-lg">
        <h2 class="text-2xl font-bold text-gray-800 dark:text-white">${currentPlayer.name}</h2>
        <p class="text-gray-500 dark:text-gray-400">${currentPlayer.category} • ${age} años</p>
        ${currentPlayer.position ? `<p class="text-teal-600 dark:text-teal-400 font-medium mt-1">${currentPlayer.position} ${currentPlayer.jerseyNumber ? '• Dorsal #' + currentPlayer.jerseyNumber : ''}</p>` : ''}
        <span class="inline-block mt-2 px-4 py-1 rounded-full text-sm font-medium ${currentPlayer.status === 'Activo' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'}">
          ${currentPlayer.status || 'Activo'}
        </span>
      </div>
      
      <div class="grid grid-cols-2 gap-4">
        <div class="bg-green-50 dark:bg-green-900/30 rounded-xl p-4 text-center">
          <p class="text-xs text-green-600 dark:text-green-400 mb-1">Total Pagado</p>
          <p class="text-xl font-bold text-green-700 dark:text-green-300">${formatCurrencyParent(totalPaid)}</p>
        </div>
        <div class="bg-red-50 dark:bg-red-900/30 rounded-xl p-4 text-center">
          <p class="text-xs text-red-600 dark:text-red-400 mb-1">Pendiente</p>
          <p class="text-xl font-bold text-red-700 dark:text-red-300">${formatCurrencyParent(totalPending)}</p>
        </div>
      </div>
      
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden">
        <div class="bg-gray-50 dark:bg-gray-700 px-4 py-3 border-b border-gray-200 dark:border-gray-600">
          <h3 class="font-bold text-gray-800 dark:text-white">💰 Historial de Pagos</h3>
        </div>
        <div class="p-4">
          <div class="space-y-3 max-h-64 overflow-y-auto">${paymentsHTML}</div>
        </div>
      </div>
      
      <!-- Estado de cuenta -->
      ${totalPending > 0 ? `
        <div class="bg-orange-50 dark:bg-orange-900/30 rounded-2xl p-4 text-center border-2 border-orange-200 dark:border-orange-800">
          <span class="text-2xl">⚠️</span>
          <p class="text-orange-700 dark:text-orange-300 font-medium mt-2">Tienes pagos pendientes</p>
          <p class="text-sm text-orange-600 dark:text-orange-400">Contacta a la escuela para más información</p>
        </div>
      ` : `
        <div class="bg-green-100 dark:bg-green-900/30 rounded-2xl p-4 text-center">
          <span class="text-2xl">🎉</span>
          <p class="text-green-700 dark:text-green-300 font-medium mt-2">¡Todo al día!</p>
          <p class="text-sm text-green-600 dark:text-green-400">No tienes pagos pendientes</p>
        </div>
      `}
      
      <!-- 🆕 INFORMACIÓN MÉDICA (si existe) -->
      ${currentPlayer.medicalInfo?.bloodType || currentPlayer.medicalInfo?.allergies ? `
        <div class="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-lg">
          <h3 class="font-bold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
            🏥 Información Médica
          </h3>
          <div class="space-y-2 text-sm">
            ${currentPlayer.medicalInfo?.bloodType ? `
              <div class="flex justify-between">
                <span class="text-gray-500 dark:text-gray-400">Tipo de sangre:</span>
                <span class="font-medium text-gray-800 dark:text-white">${currentPlayer.medicalInfo.bloodType}</span>
              </div>
            ` : ''}
            ${currentPlayer.medicalInfo?.allergies ? `
              <div class="flex justify-between">
                <span class="text-gray-500 dark:text-gray-400">Alergias:</span>
                <span class="font-medium text-red-600 dark:text-red-400">${currentPlayer.medicalInfo.allergies}</span>
              </div>
            ` : ''}
            ${currentPlayer.medicalInfo?.conditions ? `
              <div class="flex justify-between">
                <span class="text-gray-500 dark:text-gray-400">Condiciones:</span>
                <span class="font-medium text-gray-800 dark:text-white">${currentPlayer.medicalInfo.conditions}</span>
              </div>
            ` : ''}
          </div>
        </div>
      ` : ''}
      
      ${currentClubSettings?.phone ? `
        <div class="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-lg">
          <h3 class="font-bold text-gray-800 dark:text-white mb-3">📞 Contacto del Club</h3>
          <a href="https://wa.me/${currentClubSettings.phone.replace(/[^0-9+]/g, '')}" target="_blank"
             class="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/30 rounded-xl hover:bg-green-100 transition-colors">
            <div class="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-white">📱</div>
            <div>
              <p class="font-medium text-gray-800 dark:text-white">WhatsApp</p>
              <p class="text-sm text-gray-500 dark:text-gray-400">${currentClubSettings.phone}</p>
            </div>
          </a>
        </div>
      ` : ''}
      
      <!-- 🆕 PRÓXIMOS EVENTOS -->
      ${(currentPlayer.upcomingEvents && currentPlayer.upcomingEvents.length > 0) ? `
        <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden">
          <div class="bg-blue-50 dark:bg-blue-900/30 px-4 py-3 border-b border-blue-200 dark:border-blue-800">
            <h3 class="font-bold text-blue-800 dark:text-blue-300 flex items-center gap-2">
              📅 Próximos Eventos
            </h3>
          </div>
          <div class="p-4 space-y-3">
            ${currentPlayer.upcomingEvents.map(event => `
              <div class="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-xl">
                <div class="text-center min-w-[50px]">
                  <p class="text-xs text-gray-500 dark:text-gray-400">${new Date(event.date).toLocaleDateString('es-CO', { month: 'short' }).toUpperCase()}</p>
                  <p class="text-xl font-bold text-gray-800 dark:text-white">${new Date(event.date).getDate()}</p>
                </div>
                <div class="flex-1">
                  <p class="font-medium text-gray-800 dark:text-white">${event.title}</p>
                  <p class="text-xs text-gray-500 dark:text-gray-400">${event.time || ''} ${event.location ? '• ' + event.location : ''}</p>
                </div>
                <span class="text-2xl">${getEventIcon(event.type)}</span>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
      
      <div id="installPrompt" class="hidden bg-gradient-to-r from-purple-500 to-blue-500 rounded-2xl p-4 text-white">
        <div class="flex items-center gap-3">
          <div class="text-3xl">📲</div>
          <div class="flex-1">
            <p class="font-bold">Instala la App</p>
            <p class="text-sm opacity-90">Accede más rápido</p>
          </div>
          <button onclick="installParentPWA()" class="bg-white text-purple-600 px-4 py-2 rounded-lg font-medium">Instalar</button>
        </div>
      </div>
      
      <!-- 🆕 BOTÓN DESCARGAR CARNET -->
      <button onclick="generatePlayerCard()" class="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white py-4 rounded-2xl font-bold text-lg shadow-lg flex items-center justify-center gap-3 transition-all transform hover:scale-[1.02]">
        <span class="text-2xl">🪪</span>
        Descargar Carnet del Jugador
      </button>
    </div>
  `;
  
  checkInstallPrompt();
}

// ========================================
// FUNCIONES DE PAGO
// ========================================

function parentLogout() {
  if (confirm('¿Cerrar sesión?')) {
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
    doc.text('CONTACTO DE EMERGENCIA:', 5, medY + 1);
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    const emergencyContact = currentPlayer.emergencyContact || currentPlayer.phone || 'No especificado';
    doc.text(emergencyContact, 5, medY + 6);
    
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