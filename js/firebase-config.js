// ========================================
// CONFIGURACION DE FIREBASE - AUTO-INICIALIZACION
// CON SOPORTE PARA SINCRONIZACION EN TIEMPO REAL
// CON PERSISTENCIA DE SESION
// ========================================

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

async function initFirebase() {
  try {
    console.log('[FIREBASE] Inicializando...');
    
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
    
    const firestoreModule = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
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
      serverTimestamp 
    } = firestoreModule;
    
    const authModule = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
    const { 
      getAuth, 
      signInWithEmailAndPassword, 
      createUserWithEmailAndPassword, 
      signOut, 
      onAuthStateChanged,
      sendPasswordResetEmail,
      browserLocalPersistence,
      setPersistence
    } = authModule;
    
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    
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
      browserLocalPersistence
    };
    
    // LISTENER DE ESTADO DE AUTENTICACION
    // Restaura la sesion automaticamente al recargar/reabrir la PWA
    onAuthStateChanged(auth, async (user) => {
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
                  window.location.reload();
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