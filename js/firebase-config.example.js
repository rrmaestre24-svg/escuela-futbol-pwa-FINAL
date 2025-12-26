// ========================================
// CONFIGURACIÓN DE FIREBASE - EJEMPLO
// ========================================

// INSTRUCCIONES:
// 1. Copia este archivo y renómbralo a "firebase-config.js"
// 2. Reemplaza los valores con tus credenciales de Firebase
// 3. NO subas firebase-config.js a GitHub

const firebaseConfig = {
  apiKey: "TU_API_KEY_AQUI",
  authDomain: "TU_AUTH_DOMAIN_AQUI",
  projectId: "TU_PROJECT_ID_AQUI",
  storageBucket: "TU_STORAGE_BUCKET_AQUI",
  messagingSenderId: "TU_MESSAGING_SENDER_ID_AQUI",
  appId: "TU_APP_ID_AQUI",
  measurementId: "TU_MEASUREMENT_ID_AQUI"
};

// Inicializar Firebase
let db = null;
let auth = null;

async function initFirebase() {
  try {
    console.log('🔥 Inicializando Firebase...');
    
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
    const { getFirestore, collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, query, where } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
    const { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
    
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    
    console.log('✅ Firebase inicializado correctamente');
    console.log('📊 Base de datos:', db);
    
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
      signOut
    };
    
    showToast('✅ Conectado a Firebase');
    return true;
  } catch (error) {
    console.error('❌ Error al inicializar Firebase:', error);
    showToast('⚠️ Error de conexión con Firebase');
    return false;
  }
}

console.log('✅ firebase-config.js cargado');