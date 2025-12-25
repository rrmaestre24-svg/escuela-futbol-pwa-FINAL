// ========================================
// GENERADOR DE ICONOS PWA DESDE LOGO DEL CLUB
// ========================================

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
    ctx.drawImage(img, padding, padding, size, size);
    
    // Convertir a PNG
    const icon192 = canvas.toDataURL('image/png');
    
    // Generar icono 512x512
    canvas.width = 512;
    canvas.height = 512;
    ctx.fillStyle = primaryColor;
    ctx.fillRect(0, 0, 512, 512);
    
    const padding512 = 80;
    const size512 = 512 - (padding512 * 2);
    ctx.drawImage(img, padding512, padding512, size512, size512);
    
    const icon512 = canvas.toDataURL('image/png');
    
    // Guardar iconos en localStorage
    localStorage.setItem('pwa_icon_192', icon192);
    localStorage.setItem('pwa_icon_512', icon512);
    
    // Actualizar manifest
    updateManifestIcons();
    
    console.log('✅ Iconos PWA generados correctamente');
    showToast('✅ Logo de la app actualizado');
  };
  
  img.src = logo;
}

// Actualizar manifest con los nuevos iconos
function updateManifestIcons() {
  const icon192 = localStorage.getItem('pwa_icon_192');
  const icon512 = localStorage.getItem('pwa_icon_512');
  
  if (!icon192 || !icon512) return;
  
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
    manifestLink.href = manifestURL;
  }
  
  console.log('✅ Manifest actualizado con nuevos iconos');
}

// Generar iconos cuando se cambia el logo
function onLogoChange() {
  setTimeout(() => {
    generatePWAIcons();
  }, 500);
}

console.log('✅ pwa-icons.js cargado');