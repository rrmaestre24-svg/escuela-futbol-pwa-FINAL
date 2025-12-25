// ========================================
// PERSONALIZACIÓN DE TEMA
// ========================================

// Aplicar color primario del club
function applyPrimaryColor() {
  const settings = getSchoolSettings();
  const primaryColor = settings.primaryColor || '#0d9488';
  
  console.log('🎨 Aplicando color primario:', primaryColor);
  
  // Convertir HEX a RGB
  const rgb = hexToRgb(primaryColor);
  
  if (rgb) {
    // Crear variables CSS personalizadas
    const root = document.documentElement;
    
    // Color base
    root.style.setProperty('--primary-color', primaryColor);
    root.style.setProperty('--primary-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);
    
    // Variaciones de color (más claras y más oscuras)
    root.style.setProperty('--primary-light', lightenColor(primaryColor, 20));
    root.style.setProperty('--primary-dark', darkenColor(primaryColor, 20));
    
    // Aplicar a elementos específicos
    applyColorToElements(primaryColor);
    
    console.log('✅ Color primario aplicado');
  }
}

// Convertir HEX a RGB
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

// Aclarar color
function lightenColor(hex, percent) {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  
  const r = Math.min(255, Math.floor(rgb.r + (255 - rgb.r) * (percent / 100)));
  const g = Math.min(255, Math.floor(rgb.g + (255 - rgb.g) * (percent / 100)));
  const b = Math.min(255, Math.floor(rgb.b + (255 - rgb.b) * (percent / 100)));
  
  return `rgb(${r}, ${g}, ${b})`;
}

// Oscurecer color
function darkenColor(hex, percent) {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  
  const r = Math.max(0, Math.floor(rgb.r * (1 - percent / 100)));
  const g = Math.max(0, Math.floor(rgb.g * (1 - percent / 100)));
  const b = Math.max(0, Math.floor(rgb.b * (1 - percent / 100)));
  
  return `rgb(${r}, ${g}, ${b})`;
}

// Aplicar color a elementos específicos
function applyColorToElements(color) {
  // Crear un estilo dinámico
  let styleElement = document.getElementById('dynamic-theme');
  
  if (!styleElement) {
    styleElement = document.createElement('style');
    styleElement.id = 'dynamic-theme';
    document.head.appendChild(styleElement);
  }
  
  const rgb = hexToRgb(color);
  const lightColor = lightenColor(color, 20);
  const darkColor = darkenColor(color, 20);
  
  styleElement.textContent = `
    /* Color primario personalizado */
    .bg-teal-600,
    .bg-primary {
      background-color: ${color} !important;
    }
    
    .bg-teal-700,
    .hover\\:bg-teal-700:hover {
      background-color: ${darkColor} !important;
    }
    
    .text-teal-600,
    .text-primary {
      color: ${color} !important;
    }
    
    .border-teal-600,
    .border-primary {
      border-color: ${color} !important;
    }
    
    .from-teal-600 {
      --tw-gradient-from: ${color} !important;
    }
    
    /* Active states */
    .nav-item.active {
      color: ${color} !important;
      background-color: rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.1) !important;
    }
    
    /* Focus rings */
    .focus\\:ring-teal-500:focus {
      --tw-ring-color: ${color} !important;
    }
    
    /* Botón de instalación */
    #installButtonFloat,
    #installButtonLogin {
      background: linear-gradient(135deg, ${color}, ${darkColor}) !important;
    }
    
    /* Badges y elementos destacados */
    .bg-teal-100 {
      background-color: rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.1) !important;
    }
    
    .dark\\:bg-teal-900:is(.dark *) {
      background-color: rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.2) !important;
    }
  `;
  
  // Actualizar meta theme-color
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    metaTheme.setAttribute('content', color);
  }
}

// Vista previa de color en configuración
function previewPrimaryColor(color) {
  const preview = document.getElementById('colorPreview');
  if (preview) {
    preview.style.backgroundColor = color;
  }
}

console.log('✅ theme.js cargado');