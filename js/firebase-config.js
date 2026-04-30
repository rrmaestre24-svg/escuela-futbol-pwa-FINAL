// ========================================
// CONFIGURACION DE FIREBASE - AUTO-INICIALIZACION
// CON SOPORTE PARA SINCRONIZACION EN TIEMPO REAL
// CON PERSISTENCIA DE SESION
// ========================================

// Silenciar console.log en producción — no rompe nada, solo deja de imprimir
// Para ver logs en desarrollo: abre consola y escribe: window._debugMode = true
(function() {
  var _log = console.log.bind(console);
  var _warn = console.warn.bind(console);
  console.log  = function() { if (window._debugMode) _log.apply(console, arguments); };
  console.warn = function() { if (window._debugMode) _warn.apply(console, arguments); };
})();

const firebaseConfig = window.APP_CONFIG?.firebase || {
  apiKey: "AIzaSyBThVgzEsTLWSW7puKOVErZ_KOLDEq8v3A",
  authDomain: "my-club-fae98.firebaseapp.com",
  projectId: "my-club-fae98",
  storageBucket: "my-club-fae98.firebasestorage.app",
  messagingSenderId: "807792685568",
  appId: "1:807792685568:web:06097faad391a9fd8c9ee5",
  measurementId: "G-5HRKNKEYKY"
};

if (window.APP_CONFIG?.firebase) {
  console.log('[OK] Usando configuracion desde config.js');
} else {
  console.warn('[WARN] Usando configuracion hardcodeada');
}

let db = null;
let auth = null;

if (!window.APP_STATE) {
  window.APP_STATE = {
    firebaseReady: false,
    currentUser: null,
    authRestored: false
  };
}
// Marca el momento en que la app empezó a cargar
if (!window._appStartTime) window._appStartTime = Date.now();

async function initFirebase() {
  try {
    console.log('[FIREBASE] Inicializando...');
    
    // Cargar todos los módulos de Firebase en paralelo — evita el freeze al inicio
    const [
      { initializeApp },
      firestoreModule,
      storageModule,
      authModule,
      { getFunctions, httpsCallable }
    ] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js'),
      import('https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js'),
      import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js')
    ]);

    const {
      getFirestore,
      collection,
      doc,
      getDoc,
      getDocs,
      setDoc,
      addDoc,
      updateDoc,
      deleteDoc,
      query,
      where,
      orderBy,
      limit,
      onSnapshot,
      runTransaction,
      serverTimestamp,
      deleteField
    } = firestoreModule;

    const {
      getStorage,
      ref,
      uploadBytes,
      uploadString,
      getDownloadURL,
      deleteObject
    } = storageModule;

    const {
      getAuth,
      signInWithEmailAndPassword,
      createUserWithEmailAndPassword,
      signOut,
      onAuthStateChanged,
      sendPasswordResetEmail,
      browserLocalPersistence,
      setPersistence,
      GoogleAuthProvider,
      signInWithPopup,
      signInWithRedirect,
      getRedirectResult
    } = authModule;

    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    const storage = getStorage(app);
    const functions = getFunctions(app, 'us-central1');
    
    // CONFIGURAR PERSISTENCIA LOCAL - La sesion sobrevive al cerrar el navegador/PWA
    try {
      await setPersistence(auth, browserLocalPersistence);
      console.log('[OK] Persistencia de sesion configurada (LOCAL)');
    } catch (persistError) {
      console.warn('[WARN] No se pudo configurar persistencia:', persistError);
    }
    
    window.firebase = {
      app,
      db,
      auth,
      collection,
      doc,
      getDoc,
      getDocs,
      setDoc,
      addDoc,
      updateDoc,
      deleteDoc,
      query,
      where,
      orderBy,
      limit,
      onSnapshot,
      runTransaction,
      serverTimestamp,
      signInWithEmailAndPassword,
      createUserWithEmailAndPassword,
      signOut,
      onAuthStateChanged,
      sendPasswordResetEmail,
      setPersistence,
      browserLocalPersistence,
      GoogleAuthProvider,
      signInWithPopup,
      signInWithRedirect,
      getRedirectResult,
      storage,
      ref,
      uploadBytes,
      uploadString,
      getDownloadURL,
      deleteObject,
      deleteField,
      functions,
      httpsCallable
    };

    // LISTENER DE ESTADO DE AUTENTICACION
    // Restaura la sesion automaticamente al recargar/reabrir la PWA
    // Cancelar suscripción anterior si existe (evita listeners duplicados)
    if (typeof window.APP_STATE._authUnsubscribe === 'function') {
      window.APP_STATE._authUnsubscribe();
    }
    window.APP_STATE._authUnsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('[AUTH] Estado cambio:', user ? user.email : 'No autenticado');
      
      if (user) {
        window.APP_STATE.currentUser = user;
        
        const localUser = localStorage.getItem('currentUser');
        if (!localUser) {
          console.log('[AUTH] Restaurando sesion desde Firebase Auth...');
          
          const clubId = localStorage.getItem('clubId');
          if (clubId) {
            try {
              const userRef = doc(db, 'clubs/' + clubId + '/users', user.uid);
              const userSnap = await getDoc(userRef);
              
              if (userSnap.exists()) {
                const userData = userSnap.data();
                const sessionData = {
                  id: user.uid,
                  email: user.email,
                  name: userData.name || user.email.split('@')[0],
                  schoolId: clubId,
                  isMainAdmin: userData.isMainAdmin || false,
                  role: userData.role || 'admin',
                  avatar: userData.avatar || '',
                  phone: userData.phone || ''
                };
                
                localStorage.setItem('currentUser', JSON.stringify(sessionData));
                console.log('[OK] Sesion restaurada automaticamente');
                
                const loginScreen = document.getElementById('loginScreen');
                if (loginScreen && !loginScreen.classList.contains('hidden')) {
                console.log('[AUTH] Sesión restaurada, esperando flujo normal');
}
              }
            } catch (restoreError) {
              console.warn('[WARN] No se pudo restaurar sesion completa:', restoreError);
            }
          }
        }
      } else {
        window.APP_STATE.currentUser = null;
      }
      
      window.APP_STATE.authRestored = true;
    });
    
    window.APP_STATE.firebaseReady = true;
    
    console.log('[OK] Firebase inicializado correctamente');
    
    return true;
  } catch (error) {
    console.error('[ERROR] Error al inicializar Firebase:', error);
    return false;
  }
}

async function firebaseLogout() {
  try {
    if (typeof stopRealtimeSync === 'function') {
      stopRealtimeSync();
    }
    
    localStorage.removeItem('currentUser');
    
    if (window.firebase?.auth) {
      await window.firebase.signOut(window.firebase.auth);
      window.APP_STATE.currentUser = null;
      console.log('[OK] Sesion de Firebase cerrada');
    }
  } catch (error) {
    console.error('[ERROR] Error al cerrar sesion:', error);
  }
}

console.log('[OK] firebase-config.js cargado');

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    initFirebase();
  });
} else {
  initFirebase();
}