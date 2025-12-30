// ========================================
// CONFIGURACIÓN DE FIREBASE - CORREGIDO
// ========================================

// ⚠️ ESTE ARCHIVO NO SE SUBE A GITHUB
// Está protegido por .gitignore

const firebaseConfig = {
  apiKey:"AIzaSyBThVgzEsTLWSW7puKOVErZ_KOLDEq8v3A",
  authDomain:"my-club-fae98.firebaseapp.com",
  projectId: "my-club-fae98",
  storageBucket:"my-club-fae98.firebasestorage.app",
  messagingSenderId:"807792685568",
  appId:"1:807792685568:web:06097faad391a9fd8c9ee5",
  measurementId:"G-5HRKNKEYKY"
};

// Variables globales para Firebase
let db = null;
let auth = null;

/**
 * Inicializa Firebase usando la versión modular (v9+)
 * Carga los SDKs desde el CDN solo cuando se necesita
 */
async function initFirebase() {
  try {
    console.log('🔥 Inicializando Firebase...');

    // ⚠️ URLs corregidas: SIN ESPACIOS al final
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
    const { getFirestore, collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, query, where, enableNetwork, disableNetwork } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
    const { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');

    // Inicializar la app de Firebase
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);

    console.log('✅ Firebase inicializado correctamente');
    console.log('📊 Base de datos:', db);

    // Exponer funciones útiles en window para uso global
    window.firebase = {
      db,
      auth,
      collection,
      doc,
      setDoc,
      getDoc,
      getDocs,
      updateDoc,
      deleteDoc,
      query,
      where,
      signInWithEmailAndPassword,
      createUserWithEmailAndPassword,
      signOut,
      onAuthStateChanged,
      enableNetwork,
      disableNetwork
    };

    // 🔐 AUTENTICAR AUTOMÁTICAMENTE AL USUARIO LOCAL
    const authSuccess = await autoAuthenticateUser();
    
    if (authSuccess) {
      console.log('✅ Usuario autenticado correctamente');
      window.APP_STATE.firebaseReady = true;
      
      // Notificación visual si la función existe
      if (typeof showToast === 'function') {
        showToast('✅ Conectado a Firebase');
      }
    } else {
      console.log('⚠️ No se pudo autenticar, Firebase funcionará con limitaciones');
      window.APP_STATE.firebaseReady = true; // Igual marcamos como listo
      
      if (typeof showToast === 'function') {
        showToast('⚠️ Firebase conectado sin autenticación');
      }
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

/**
 * 🔐 Autentica automáticamente al usuario actual de localStorage
 */
async function autoAuthenticateUser() {
  try {
    const currentUser = getCurrentUser();
    
    if (!currentUser || !currentUser.email) {
      console.log('⚠️ No hay usuario local para autenticar');
      return false;
    }

    console.log('🔐 Autenticando usuario:', currentUser.email);

    // Intentar iniciar sesión con Firebase Auth
    try {
      const userCredential = await window.firebase.signInWithEmailAndPassword(
        window.firebase.auth,
        currentUser.email,
        currentUser.password || 'defaultPassword123'
      );
      
      console.log('✅ Usuario autenticado en Firebase:', userCredential.user.uid);
      window.APP_STATE.currentUser = userCredential.user;
      return true;
      
    } catch (authError) {
      // Si el error es "usuario no encontrado", crear la cuenta
      if (authError.code === 'auth/user-not-found' || authError.code === 'auth/invalid-credential') {
        console.log('⚠️ Usuario no existe en Firebase Auth, creando...');
        
        try {
          const newUserCredential = await window.firebase.createUserWithEmailAndPassword(
            window.firebase.auth,
            currentUser.email,
            currentUser.password || 'defaultPassword123'
          );
          
          console.log('✅ Usuario creado en Firebase Auth:', newUserCredential.user.uid);
          window.APP_STATE.currentUser = newUserCredential.user;
          return true;
          
        } catch (createError) {
          console.error('❌ Error al crear usuario en Firebase:', createError);
          return false;
        }
      } else {
        console.error('❌ Error de autenticación:', authError);
        return false;
      }
    }
  } catch (error) {
    console.error('❌ Error en autoAuthenticateUser:', error);
    return false;
  }
}

/**
 * 🔓 Cerrar sesión de Firebase
 */
async function firebaseLogout() {
  try {
    if (window.firebase && window.firebase.auth) {
      await window.firebase.signOut(window.firebase.auth);
      window.APP_STATE.currentUser = null;
      console.log('✅ Sesión de Firebase cerrada');
    }
  } catch (error) {
    console.error('❌ Error al cerrar sesión:', error);
  }
}

console.log('✅ firebase-config.js cargado');