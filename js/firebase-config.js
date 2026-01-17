// ========================================
// CONFIGURACIÓN DE FIREBASE - AUTO-INICIALIZACIÓN
// ========================================

// 🔒 Intentar cargar configuración externa, si no existe usar valores por defecto
const firebaseConfig = window.APP_CONFIG?.firebase || {
  apiKey: "AIzaSyBThVgzEsTLWSW7puKOVErZ_KOLDEq8v3A",
  authDomain: "my-club-fae98.firebaseapp.com",
  projectId: "my-club-fae98",
  storageBucket: "my-club-fae98.firebasestorage.app",
  messagingSenderId: "807792685568",
  appId: "1:807792685568:web:06097faad391a9fd8c9ee5",
  measurementId: "G-5HRKNKEYKY"
};

// ℹ️ Informar si se está usando config externo o hardcodeado
if (window.APP_CONFIG?.firebase) {
  console.log('🔒 Usando configuración desde config.js (seguro)');
} else {
  console.warn('⚠️ Usando configuración hardcodeada (no recomendado para producción)');
}

let db = null;
let auth = null;

// Inicializar APP_STATE si no existe
if (!window.APP_STATE) {
  window.APP_STATE = { 
    firebaseReady: false,
    currentUser: null
  };
}

async function initFirebase() {
  try {
    console.log('🔥 Inicializando Firebase...');
    
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
    const { getFirestore } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
    const { getAuth } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
    
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    
    window.firebase = {
      db,
      auth,
      ...await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js'),
      ...await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js')
    };
    
    window.APP_STATE.firebaseReady = true;
    
    console.log('✅ Firebase inicializado correctamente');
    console.log('✅ Estado:', {
      firebaseReady: window.APP_STATE.firebaseReady,
      hasAuth: !!window.firebase.auth,
      hasDb: !!window.firebase.db
    });
    
    if (typeof showToast === 'function') {
      showToast('✅ Conectado a Firebase');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error al inicializar Firebase:', error);
    
    if (typeof showToast === 'function') {
      showToast('⚠️ Error de conexión con Firebase');
    }
    
    return false;
  }
}

async function firebaseLogout() {
  try {
    if (window.firebase?.auth) {
      await window.firebase.signOut(window.firebase.auth);
      window.APP_STATE.currentUser = null;
      console.log('✅ Sesión de Firebase cerrada');
    }
  } catch (error) {
    console.error('❌ Error al cerrar sesión:', error);
  }
}

console.log('✅ firebase-config.js cargado');

// ✅ AUTO-INICIALIZAR Firebase cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('🔄 DOM cargado, inicializando Firebase...');
    initFirebase();
  });
} else {
  // DOM ya está listo
  console.log('🔄 DOM ya listo, inicializando Firebase inmediatamente...');
  initFirebase();
}

console.log('🔥 Firebase se inicializará automáticamente...');