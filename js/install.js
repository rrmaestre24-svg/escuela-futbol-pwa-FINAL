// ========================================
// GESTIÓN DE INSTALACIÓN PWA
// ========================================

let deferredPrompt;
let installButtonHeader;
let installButtonLogin;

// Detectar si la app ya está instalada
function isAppInstalled() {
  // Detectar si está en modo standalone (instalada)
  if (window.matchMedia('(display-mode: standalone)').matches) {
    return true;
  }
  // Detectar en iOS
  if (window.navigator.standalone === true) {
    return true;
  }
  return false;
}

// Detectar iOS — Safari nunca dispara beforeinstallprompt, hay que mostrar botón a mano
function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

// Inicializar botones de instalación
window.addEventListener('DOMContentLoaded', () => {
  installButtonHeader = document.getElementById('installButton');
  installButtonLogin = document.getElementById('installButtonLogin');

  // Si ya está instalada, ocultar botones
  if (isAppInstalled()) {
    console.log('✅ App ya instalada');
    if (installButtonHeader) installButtonHeader.classList.add('hidden');
    if (installButtonLogin) installButtonLogin.classList.add('hidden');
    return;
  }

  // En iOS: mostrar botones desde el inicio (beforeinstallprompt nunca llegará).
  // Al tocarlos, installPWA() detecta que no hay deferredPrompt y muestra las instrucciones iOS.
  if (isIOS()) {
    console.log('📱 iOS detectado - Mostrando botones con instrucciones manuales');
    if (installButtonHeader) installButtonHeader.classList.remove('hidden');
    if (installButtonLogin) installButtonLogin.classList.remove('hidden');
    return;
  }

  console.log('📱 App no instalada - Esperando beforeinstallprompt');
});

// Escuchar el evento beforeinstallprompt
window.addEventListener('beforeinstallprompt', (e) => {
  console.log('🎯 beforeinstallprompt disparado');
  
  // Prevenir que Chrome muestre el banner automático
  e.preventDefault();
  
  // Guardar el evento para usarlo después
  deferredPrompt = e;
  
  // Mostrar botones de instalación
  if (installButtonHeader) {
    installButtonHeader.classList.remove('hidden');
  }
  if (installButtonLogin) {
    installButtonLogin.classList.remove('hidden');
  }
  
  console.log('✅ Botones de instalación mostrados');
});

// Función para instalar la PWA
async function installPWA() {
  console.log('🚀 Iniciando instalación...');
  
  if (!deferredPrompt) {
    console.log('⚠️ No hay prompt disponible');
    
    // Instrucciones manuales según el navegador
    if (navigator.userAgent.includes('iPhone') || navigator.userAgent.includes('iPad')) {
      await showAppAlert('📱 Para instalar en iOS:\n\n1. Toca el botón de Compartir (⬆️)\n2. Selecciona "Agregar a pantalla de inicio"\n3. Toca "Agregar"', {
        title: 'Instalar MY CLUB',
        type: 'info',
        confirmText: 'Entendido'
      });
    } else if (navigator.userAgent.includes('Android')) {
      await showAppAlert('📱 Para instalar:\n\n1. Toca el menú (⋮) arriba a la derecha\n2. Selecciona "Instalar aplicación" o "Agregar a pantalla de inicio"', {
        title: 'Instalar MY CLUB',
        type: 'info',
        confirmText: 'Entendido'
      });
    } else {
      await showAppAlert('💻 Para instalar:\n\n1. Busca el ícono de instalación en la barra de direcciones\n2. O ve al menú del navegador y busca "Instalar MY CLUB"', {
        title: 'Instalar MY CLUB',
        type: 'info',
        confirmText: 'Entendido'
      });
    }
    return;
  }
  
  // Mostrar el prompt de instalación
  deferredPrompt.prompt();
  
  // Esperar la respuesta del usuario
  const { outcome } = await deferredPrompt.userChoice;
  
  console.log(`👤 Usuario eligió: ${outcome}`);
  
  if (outcome === 'accepted') {
    console.log('✅ Usuario aceptó la instalación');
    showToast('✅ Instalando MY CLUB...');
    
    // Ocultar botones
    if (installButtonHeader) installButtonHeader.classList.add('hidden');
    if (installButtonLogin) installButtonLogin.classList.add('hidden');
  } else {
    console.log('❌ Usuario rechazó la instalación');
    showToast('ℹ️ Puedes instalar la app desde el menú del navegador');
  }
  
  // Limpiar el prompt
  deferredPrompt = null;
}

// Detectar cuando la app se instala
window.addEventListener('appinstalled', (evt) => {
  console.log('🎉 PWA instalada exitosamente');
  showToast('🎉 ¡MY CLUB instalada correctamente!');
  
  // Ocultar botones
  if (installButtonHeader) installButtonHeader.classList.add('hidden');
  if (installButtonLogin) installButtonLogin.classList.add('hidden');
  
  // Guardar estado de instalación
  localStorage.setItem('pwaInstalled', 'true');
});

// Verificar cambios en el modo de visualización
window.matchMedia('(display-mode: standalone)').addEventListener('change', (evt) => {
  if (evt.matches) {
    console.log('✅ App ahora en modo standalone');
    if (installButtonHeader) installButtonHeader.classList.add('hidden');
    if (installButtonLogin) installButtonLogin.classList.add('hidden');
  }
});

console.log('✅ install.js cargado');