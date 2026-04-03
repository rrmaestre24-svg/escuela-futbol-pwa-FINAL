// ========================================
// UTILIDADES GENERALES
// ========================================

// Generar ID único
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// ========================================
// 🆕 FUNCIONES DE FECHA CORREGIDAS
// ========================================

// 🆕 Función auxiliar: Parsear fecha sin afectar zona horaria
function parseLocalDate(dateString) {
  if (!dateString) return new Date();
  
  // Si ya es un objeto Date, devolverlo
  if (dateString instanceof Date) return dateString;
  
  // Si es formato ISO YYYY-MM-DD
  if (typeof dateString === 'string' && dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  
  // 🆕 Si es formato DD/MM/YYYY
  if (typeof dateString === 'string' && dateString.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
    const [day, month, year] = dateString.split('/').map(Number);
    return new Date(year, month - 1, day);
  }
  
  // Para otros formatos, usar Date normal
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    console.warn('⚠️ Fecha inválida detectada:', dateString);
  }
  return date;
}

// ✅ Formatear fecha a dd/mm/yyyy (CORREGIDO)
function formatDate(dateString) {
  if (!dateString) return '-';
  
  const date = parseLocalDate(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  
  return `${day}/${month}/${year}`;
}

// ✅ Formatear fecha a texto legible (CORREGIDO)
function formatDateText(dateString) {
  if (!dateString) return '-';
  
  const date = parseLocalDate(dateString);
  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  
  return `${date.getDate()} de ${months[date.getMonth()]} de ${date.getFullYear()}`;
}

// ✅ Calcular edad (CORREGIDO)
function calculateAge(birthDate) {
  if (!birthDate) return 0;
  
  const today = new Date();
  const birth = parseLocalDate(birthDate);
  
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  
  return age;
}

// ✅ Calcular días entre fechas (CORREGIDO)
function daysBetween(date1, date2) {
  const oneDay = 24 * 60 * 60 * 1000;
  const firstDate = parseLocalDate(date1);
  const secondDate = parseLocalDate(date2);
  
  // Normalizar a medianoche para comparar solo días
  firstDate.setHours(0, 0, 0, 0);
  secondDate.setHours(0, 0, 0, 0);
  
  return Math.round((secondDate - firstDate) / oneDay);
}

// ✅ Verificar si es hoy (CORREGIDO)
function isToday(dateString) {
  const today = new Date();
  const date = parseLocalDate(dateString);
  
  return date.getDate() === today.getDate() &&
         date.getMonth() === today.getMonth() &&
         date.getFullYear() === today.getFullYear();
}

// ✅ Verificar si es este mes (CORREGIDO)
function isThisMonth(dateString) {
  const today = new Date();
  const date = parseLocalDate(dateString);
  
  return date.getMonth() === today.getMonth() &&
         date.getFullYear() === today.getFullYear();
}

// Obtener fecha actual en formato YYYY-MM-DD
function getCurrentDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Obtener la fecha de vencimiento = mismo día del mes siguiente
// Ej: si hoy es 02/04/2026, vence el 02/05/2026
function getEndOfMonth() {
  const today = new Date();
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, today.getDate());
  const year = nextMonth.getFullYear();
  const month = String(nextMonth.getMonth() + 1).padStart(2, '0');
  const day = String(nextMonth.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ✅ Añadir meses a una fecha (YYYY-MM-DD)
function addMonths(dateStr, months) {
  const date = parseLocalDate(dateStr);
  const d = date.getDate();
  date.setMonth(date.getMonth() + parseInt(months));
  
  // Manejo de fin de mes (ej: 31 de enero + 1 mes -> 28/29 de febrero)
  if (date.getDate() != d) {
    date.setDate(0);
  }
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ========================================
// FIN FUNCIONES DE FECHA
// ========================================

// Formatear moneda COP
function formatCurrency(amount) {
  const currency = getSchoolSettings().currency || 'COP';
  const formatted = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
  return formatted;
}

// Validar email
function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

// Validar teléfono colombiano
function isValidPhone(phone) {
  const re = /^\+?57?\s?3\d{9}$/;
  return re.test(phone.replace(/\s/g, ''));
}

// Convertir imagen a Base64 - VERSIÓN MEJORADA
function imageToBase64(file, callback) {
  // ✅ Validar que sea un archivo
  if (!file) {
    console.error('❌ No se proporcionó archivo');
    showToast('❌ No se seleccionó ningún archivo');
    return;
  }
  
  // ✅ Validar que sea una imagen
  if (!file.type.startsWith('image/')) {
    console.error('❌ Archivo no es imagen:', file.type);
    showToast('❌ Por favor selecciona una imagen válida');
    return;
  }
  
  // ✅ Validar tamaño (máximo 5MB antes de comprimir)
  const maxSizeBytes = 5 * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    console.error('❌ Imagen muy grande:', (file.size / 1024 / 1024).toFixed(2), 'MB');
    showToast('❌ La imagen es muy grande. Máximo 5MB');
    return;
  }
  
  console.log('📸 Procesando imagen:', {
    nombre: file.name,
    tipo: file.type,
    tamaño: (file.size / 1024).toFixed(2) + ' KB'
  });
  
  const reader = new FileReader();
  
  reader.onload = function(e) {
    const base64 = e.target.result;
    console.log('✅ Imagen cargada, tamaño Base64:', (base64.length / 1024).toFixed(2), 'KB');
    
    // Si la imagen es muy grande, comprimirla
    if (base64.length > 1024 * 1024) {
      console.log('🔄 Comprimiendo imagen...');
      
      if (typeof compressImageForFirestore === 'function') {
        compressImageForFirestore(base64, 800, function(compressedBase64) {
          console.log('✅ Imagen comprimida:', (compressedBase64.length / 1024).toFixed(2), 'KB');
          callback(compressedBase64);
        });
      } else {
        console.warn('⚠️ Función de compresión no disponible');
        callback(base64);
      }
    } else {
      callback(base64);
    }
  };
  
  reader.onerror = function(error) {
    console.error('❌ Error al leer archivo:', error);
    showToast('❌ Error al cargar la imagen');
  };
  
  reader.readAsDataURL(file);
}

// Mostrar toast notification
function showToast(message, duration = 3000) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.remove('hidden');
  
  setTimeout(() => {
    toast.classList.add('hidden');
  }, duration);
}

// Confirmar acción
function confirmAction(message) {
  return confirm(message);
}

// Obtener nombre del mes
function getMonthName(monthIndex) {
  const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  return months[monthIndex];
}

// Obtener días en mes
function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

// Obtener primer día del mes (0 = Domingo)
function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay();
}

// Ordenar array por campo
function sortBy(array, field, order = 'asc') {
  return array.sort((a, b) => {
    let valueA = a[field];
    let valueB = b[field];
    
    if (typeof valueA === 'string') {
      valueA = valueA.toLowerCase();
      valueB = valueB.toLowerCase();
    }
    
    if (order === 'asc') {
      return valueA > valueB ? 1 : valueA < valueB ? -1 : 0;
    } else {
      return valueA < valueB ? 1 : valueA > valueB ? -1 : 0;
    }
  });
}

// Filtrar array por búsqueda
function filterBySearch(array, searchTerm, fields) {
  if (!searchTerm) return array;
  
  const term = searchTerm.toLowerCase();
  return array.filter(item => {
    return fields.some(field => {
      const value = item[field];
      return value && value.toString().toLowerCase().includes(term);
    });
  });
}

// Generar color aleatorio
function getRandomColor() {
  const colors = ['#0d9488', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];
  return colors[Math.floor(Math.random() * colors.length)];
}

// Limpiar string de teléfono
function cleanPhone(phone) {
  return phone.replace(/\s/g, '').replace('+57', '');
}

// Avatar por defecto
function getDefaultAvatar() {
  return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='50' fill='%23e5e7eb'/%3E%3Ctext x='50' y='50' text-anchor='middle' dy='.3em' font-size='40' fill='%239ca3af'%3E👤%3C/text%3E%3C/svg%3E";
}

// Logo por defecto
function getDefaultLogo() {
  return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='48' fill='%230d9488'/%3E%3Ctext x='50' y='50' text-anchor='middle' dy='.35em' font-size='60'%3E⚽%3C/text%3E%3C/svg%3E";
}

// Exportar datos como JSON
function downloadJSON(data, filename) {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Exportar datos como CSV
function downloadCSV(data, filename) {
  const csv = arrayToCSV(data);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Convertir array a CSV
function arrayToCSV(array) {
  if (!array || array.length === 0) return '';
  
  const headers = Object.keys(array[0]);
  const csvRows = [];
  
  // Agregar encabezados
  csvRows.push(headers.join(','));
  
  // Agregar filas
  for (const row of array) {
    const values = headers.map(header => {
      const value = row[header];
      return `"${value}"`;
    });
    csvRows.push(values.join(','));
  }
  
  return csvRows.join('\n');
}

// ========================================
// COMPRIMIR IMAGEN PARA FIRESTORE
// ========================================
function compressImageForFirestore(base64String, maxSizeKB = 800, callback) {
  // Si es SVG o no es una imagen válida, devolver tal cual
  if (!base64String || base64String.startsWith('data:image/svg') || base64String.length < 1000) {
    callback(base64String);
    return;
  }

  const img = new Image();
  
  img.onload = function() {
    const canvas = document.createElement('canvas');
    let width = img.width;
    let height = img.height;
    
    // Calcular el tamaño aproximado en KB del base64
    const currentSizeKB = (base64String.length * 0.75) / 1024;
    
    if (currentSizeKB <= maxSizeKB) {
      // Ya está dentro del límite
      callback(base64String);
      return;
    }
    
    // Calcular el factor de reducción necesario
    const scaleFactor = Math.sqrt(maxSizeKB / currentSizeKB);
    
    // Redimensionar
    width = Math.floor(width * scaleFactor);
    height = Math.floor(height * scaleFactor);
    
    // Límites mínimos y máximos razonables
    if (width < 100) width = 100;
    if (height < 100) height = 100;
    if (width > 800) width = 800;
    if (height > 800) height = 800;
    
    canvas.width = width;
    canvas.height = height;
    
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, width, height);
    
    // Comprimir a JPEG con calidad ajustable
    let quality = 0.8;
    let compressed = canvas.toDataURL('image/jpeg', quality);
    
    // Si todavía es muy grande, reducir más
    let attempts = 0;
    while ((compressed.length * 0.75) / 1024 > maxSizeKB && quality > 0.3 && attempts < 5) {
      quality -= 0.1;
      compressed = canvas.toDataURL('image/jpeg', quality);
      attempts++;
    }
    
    console.log(`🖼️ Imagen comprimida: ${currentSizeKB.toFixed(0)}KB → ${((compressed.length * 0.75) / 1024).toFixed(0)}KB`);
    callback(compressed);
  };
  
  img.onerror = function() {
    console.error('❌ Error al cargar imagen para comprimir');
    callback(base64String);
  };
  
  img.src = base64String;
}

console.log('✅ utils.js cargado con correcciones de zona horaria');
console.log('📅 Fecha actual:', getCurrentDate());
console.log('📅 Fecha formateada:', formatDate(getCurrentDate()));
console.log('📅 Fecha en texto:', formatDateText(getCurrentDate()));

// ========================================
// 🆕 FUNCIÓN AUXILIAR PARA AUDITORÍA
// Agregar al final de utils.js
// ========================================

// Capturar información del usuario actual para auditoría
function getAuditInfo() {
  const currentUser = getCurrentUser();
  
  if (!currentUser) {
    return {
      name: 'Sistema',
      userId: 'system',
      date: getCurrentDate(),
      time: new Date().toLocaleTimeString('es-CO', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      })
    };
  }
  
  return {
    name: currentUser.name,
    userId: currentUser.id,
    email: currentUser.email,
    date: getCurrentDate(),
    time: new Date().toLocaleTimeString('es-CO', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    })
  };
}

// Formatear información de auditoría para mostrar
function formatAuditInfo(auditInfo) {
  if (!auditInfo) return '';
  return `${auditInfo.name} - ${formatDate(auditInfo.date)} ${auditInfo.time}`;
}

console.log('✅ Funciones de auditoría agregadas');