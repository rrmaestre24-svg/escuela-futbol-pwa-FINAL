// ========================================
// GENERADOR DE ICONOS PWA DESDE LOGO DEL CLUB
// VERSIÓN CORREGIDA - CARGA PRIORITARIA
// ========================================

// 🔥 EJECUTAR INMEDIATAMENTE al cargar el script
(function() {
  console.log('🎨 Inicializando sistema de iconos PWA...');
  
  // Verificar si ya existe manifest dinámico
  const hasDynamicManifest = localStorage.getItem('pwa_icon_192');
  
  if (!hasDynamicManifest) {
    console.log('⚠️ No hay iconos guardados, generando ahora...');
    // Esperar a que storage.js esté disponible
    const checkStorage = setInterval(() => {
      if (typeof getSchoolSettings === 'function') {
        clearInterval(checkStorage);
        generatePWAIcons();
      }
    }, 100);
  } else {
    console.log('✅ Iconos guardados encontrados, cargando...');
    loadSavedIcons();
  }
})();

// Generar iconos PWA desde el logo del club
function generatePWAIcons() {
  const settings = getSchoolSettings();
  const logo = settings.logo;
  
  if (!logo || !logo.startsWith('data:image')) {
    console.log('⚠️ No hay logo del club, usando icono por defecto');
    return;
  }
  
  console.log('🎨 Generando iconos PWA desde logo del club...');
  
  // Crear canvas para generar iconos
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const img = new Image();
  
  img.onload = function() {
    // Generar icono 192x192
    canvas.width = 192;
    canvas.height = 192;
    
    // Fondo con color primario del club
    const primaryColor = settings.primaryColor || '#0d9488';
    ctx.fillStyle = primaryColor;
    ctx.fillRect(0, 0, 192, 192);
    
    // Dibujar logo centrado con padding
    const padding = 30;
    const size = 192 - (padding * 2);
    
    // Centrar y escalar manteniendo proporción
    const scale = Math.min(size / img.width, size / img.height);
    const x = (192 - img.width * scale) / 2;
    const y = (192 - img.height * scale) / 2;
    
    ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
    
    // Convertir a PNG
    const icon192 = canvas.toDataURL('image/png');
    
    // Generar icono 512x512
    canvas.width = 512;
    canvas.height = 512;
    ctx.fillStyle = primaryColor;
    ctx.fillRect(0, 0, 512, 512);
    
    const padding512 = 80;
    const size512 = 512 - (padding512 * 2);
    const scale512 = Math.min(size512 / img.width, size512 / img.height);
    const x512 = (512 - img.width * scale512) / 2;
    const y512 = (512 - img.height * scale512) / 2;
    
    ctx.drawImage(img, x512, y512, img.width * scale512, img.height * scale512);
    
    const icon512 = canvas.toDataURL('image/png');
    
    // Guardar iconos en localStorage
    localStorage.setItem('pwa_icon_192', icon192);
    localStorage.setItem('pwa_icon_512', icon512);
    
    // Actualizar manifest INMEDIATAMENTE
    updateManifestIcons();
    
    // Actualizar favicon dinámicamente
    updateFavicon(icon192);
    
    console.log('✅ Iconos PWA generados correctamente');
    
    // Solo mostrar toast si la función existe
    if (typeof showToast === 'function') {
      showToast('✅ Logo de la app actualizado');
    }
  };
  
  img.onerror = function() {
    console.error('❌ Error al cargar el logo');
  };
  
  img.src = logo;
}

// Actualizar manifest con los nuevos iconos
function updateManifestIcons() {
  const icon192 = localStorage.getItem('pwa_icon_192');
  const icon512 = localStorage.getItem('pwa_icon_512');
  
  if (!icon192 || !icon512) {
    console.warn('⚠️ No hay iconos para actualizar');
    return;
  }
  
  // Crear nuevo manifest
  const settings = getSchoolSettings();
  const manifest = {
    name: `${settings.name || 'MY CLUB'} - Gestión de Fútbol`,
    short_name: settings.name || 'MY CLUB',
    description: 'Aplicación completa para gestión de escuelas de fútbol infantil',
    start_url: './',
    scope: './',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: settings.primaryColor || '#0d9488',
    orientation: 'portrait-primary',
    icons: [
      {
        src: icon192,
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: icon512,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: icon512,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable'
      }
    ],
    categories: ['sports', 'business', 'productivity'],
    shortcuts: [
      {
        name: 'Jugadores',
        short_name: 'Jugadores',
        description: 'Ver jugadores',
        url: './?view=players',
        icons: [{ src: icon192, sizes: '192x192' }]
      },
      {
        name: 'Pagos',
        short_name: 'Pagos',
        description: 'Gestionar pagos',
        url: './?view=payments',
        icons: [{ src: icon192, sizes: '192x192' }]
      },
      {
        name: 'Calendario',
        short_name: 'Calendario',
        description: 'Ver eventos',
        url: './?view=calendar',
        icons: [{ src: icon192, sizes: '192x192' }]
      }
    ]
  };
  
  // Convertir a JSON y crear blob
  const manifestJSON = JSON.stringify(manifest, null, 2);
  const blob = new Blob([manifestJSON], { type: 'application/json' });
  const manifestURL = URL.createObjectURL(blob);
  
  // Actualizar link del manifest
  let manifestLink = document.querySelector('link[rel="manifest"]');
  if (manifestLink) {
    // Revocar URL anterior si existe
    if (manifestLink.href.startsWith('blob:')) {
      URL.revokeObjectURL(manifestLink.href);
    }
    manifestLink.href = manifestURL;
    console.log('✅ Manifest actualizado:', manifestURL);
  } else {
    manifestLink = document.createElement('link');
    manifestLink.rel = 'manifest';
    manifestLink.href = manifestURL;
    document.head.appendChild(manifestLink);
    console.log('✅ Manifest creado:', manifestURL);
  }
}

// Actualizar favicon en tiempo real
function updateFavicon(iconUrl) {
  // Actualizar favicon normal
  let favicon = document.querySelector('link[rel="icon"]');
  if (favicon) {
    favicon.href = iconUrl;
  } else {
    favicon = document.createElement('link');
    favicon.rel = 'icon';
    favicon.href = iconUrl;
    document.head.appendChild(favicon);
  }
  
  // Actualizar apple-touch-icon
  let appleTouchIcon = document.querySelector('link[rel="apple-touch-icon"]');
  if (appleTouchIcon) {
    appleTouchIcon.href = iconUrl;
  } else {
    appleTouchIcon = document.createElement('link');
    appleTouchIcon.rel = 'apple-touch-icon';
    appleTouchIcon.href = iconUrl;
    document.head.appendChild(appleTouchIcon);
  }
  
  console.log('✅ Favicon actualizado');
}

// Cargar iconos guardados al iniciar
function loadSavedIcons() {
  const icon192 = localStorage.getItem('pwa_icon_192');
  
  if (icon192) {
    updateManifestIcons();
    updateFavicon(icon192);
    console.log('✅ Iconos PWA cargados desde localStorage');
  } else {
    console.log('⚠️ No hay iconos guardados en localStorage');
  }
}

// Generar iconos cuando se cambia el logo
function onLogoChange() {
  setTimeout(() => {
    generatePWAIcons();
  }, 500);
}

console.log('✅ pwa-icons.js cargado');