// ========================================
// PWA ICONS - ICONOS ESTÁTICOS
// El manifest.json usa /assets/icons/ directamente
// ========================================

(function() {
  console.log('🎨 pwa-icons.js: iconos estáticos activos');
})();

// Mantenidas por compatibilidad con settings.js
function generatePWAIcons() {
  console.log('🎨 Usando iconos estáticos de /assets/icons/');
}

function onLogoChange() {
  console.log('🎨 Logo guardado en Firebase');
}

function loadSavedIcons() {}

function updateManifestIcons() {}

function updateFavicon(iconUrl) {
  if (!iconUrl) return;
  let favicon = document.querySelector('link[rel="icon"]');
  if (!favicon) {
    favicon = document.createElement('link');
    favicon.rel = 'icon';
    document.head.appendChild(favicon);
  }
  favicon.href = iconUrl;
}

console.log('✅ pwa-icons.js cargado');