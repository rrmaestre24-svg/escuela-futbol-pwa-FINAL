// ========================================
// UTILIDADES GENERALES
// ========================================

// Generar ID único
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Formatear fecha a dd/mm/yyyy
function formatDate(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

// Formatear fecha a texto legible
function formatDateText(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  return `${date.getDate()} de ${months[date.getMonth()]} de ${date.getFullYear()}`;
}

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

// Calcular edad
function calculateAge(birthDate) {
  if (!birthDate) return 0;
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

// Calcular días entre fechas
function daysBetween(date1, date2) {
  const oneDay = 24 * 60 * 60 * 1000;
  const firstDate = new Date(date1);
  const secondDate = new Date(date2);
  return Math.round((secondDate - firstDate) / oneDay);
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

// Convertir imagen a Base64
function imageToBase64(file, callback) {
  const reader = new FileReader();
  reader.onload = function(e) {
    callback(e.target.result);
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

// Obtener fecha actual en formato YYYY-MM-DD
function getCurrentDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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

// Verificar si es hoy
function isToday(dateString) {
  const today = new Date();
  const date = new Date(dateString);
  return date.getDate() === today.getDate() &&
         date.getMonth() === today.getMonth() &&
         date.getFullYear() === today.getFullYear();
}

// Verificar si es este mes
function isThisMonth(dateString) {
  const today = new Date();
  const date = new Date(dateString);
  return date.getMonth() === today.getMonth() &&
         date.getFullYear() === today.getFullYear();
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

console.log('✅ utils.js cargado');
// ========================================
// DIAGNÓSTICO RE-LOGIN
// Copiar y pegar en consola (F12) ANTES de intentar hacer login
// ========================================

console.clear();
console.log('%c🔍 DIAGNÓSTICO RE-LOGIN', 'background: #0d9488; color: white; font-size: 16px; padding: 10px; border-radius: 5px;');
console.log('═══════════════════════════════════════\n');

// 1. Verificar HTML
console.log('📋 1. VERIFICACIÓN HTML:');
console.log('───────────────────────────────────────');
const loginClubIdInput = document.getElementById('loginClubId');
const loginEmailInput = document.getElementById('loginEmail');
const loginPasswordInput = document.getElementById('loginPassword');

console.log('Campo loginClubId:', loginClubIdInput ? '✅ Existe' : '❌ NO EXISTE');
console.log('Campo loginEmail:', loginEmailInput ? '✅ Existe' : '❌ NO EXISTE');
console.log('Campo loginPassword:', loginPasswordInput ? '✅ Existe' : '❌ NO EXISTE');
console.log('\n');

// 2. Verificar localStorage
console.log('💾 2. DATOS EN LOCALSTORAGE:');
console.log('───────────────────────────────────────');
const clubId = localStorage.getItem('clubId');
const currentUser = localStorage.getItem('currentUser');
const users = localStorage.getItem('users');

console.log('clubId:', clubId || '❌ NO EXISTE');
console.log('currentUser:', currentUser ? '✅ Existe' : '❌ NO EXISTE');

if (currentUser) {
  try {
    const user = JSON.parse(currentUser);
    console.log('  - Email:', user.email);
    console.log('  - Nombre:', user.name);
    console.log('  - schoolId:', user.schoolId);
  } catch (e) {
    console.log('  ❌ Error al parsear currentUser');
  }
}

if (users) {
  try {
    const usersList = JSON.parse(users);
    console.log('users:', `✅ ${usersList.length} usuario(s)`);
    usersList.forEach(u => {
      console.log(`  - ${u.email} (schoolId: ${u.schoolId})`);
    });
  } catch (e) {
    console.log('  ❌ Error al parsear users');
  }
}
console.log('\n');

// 3. Verificar Firebase
console.log('🔥 3. ESTADO DE FIREBASE:');
console.log('───────────────────────────────────────');
console.log('APP_STATE existe:', typeof window.APP_STATE);
console.log('APP_STATE.firebaseReady:', window.APP_STATE?.firebaseReady);
console.log('window.firebase:', typeof window.firebase);
console.log('firebase.auth:', window.firebase?.auth ? '✅ Disponible' : '❌ NO DISPONIBLE');
console.log('firebase.db:', window.firebase?.db ? '✅ Disponible' : '❌ NO DISPONIBLE');

if (window.firebase?.auth?.currentUser) {
  console.log('Firebase currentUser:', {
    uid: window.firebase.auth.currentUser.uid,
    email: window.firebase.auth.currentUser.email
  });
} else {
  console.log('Firebase currentUser: ❌ No hay sesión');
}
console.log('\n');

// 4. Verificar funciones
console.log('⚙️ 4. FUNCIONES NECESARIAS:');
console.log('───────────────────────────────────────');
const functions = [
  'waitForFirebase',
  'getClubIdForUser',
  'downloadAllClubData',
  'saveUserClubMapping',
  'getUsers',
  'getCurrentUser',
  'imageToBase64'
];

functions.forEach(fn => {
  const exists = typeof window[fn] === 'function';
  console.log(`${exists ? '✅' : '❌'} ${fn}()`);
});
console.log('\n');

// 5. Simular lectura de campos
console.log('🎯 5. SIMULACIÓN DE LOGIN:');
console.log('───────────────────────────────────────');
if (loginClubIdInput && loginEmailInput && loginPasswordInput) {
  console.log('Valores actuales en los campos:');
  console.log('  clubId:', loginClubIdInput.value || '(vacío)');
  console.log('  email:', loginEmailInput.value || '(vacío)');
  console.log('  password:', loginPasswordInput.value ? '***' : '(vacío)');
} else {
  console.log('❌ No se pueden leer los campos (no existen)');
}
console.log('\n');

// 6. Diagnóstico
console.log('🎯 6. DIAGNÓSTICO:');
console.log('───────────────────────────────────────');

if (!window.APP_STATE?.firebaseReady) {
  console.log('⚠️ PROBLEMA: Firebase NO está inicializado');
  console.log('');
  console.log('SOLUCIÓN:');
  console.log('1. Espera 5 segundos y vuelve a intentar');
  console.log('2. Si persiste, ejecuta: initFirebase()');
  console.log('3. Recarga la página si es necesario');
} else if (!clubId) {
  console.log('⚠️ PROBLEMA: clubId NO está en localStorage');
  console.log('');
  console.log('SOLUCIÓN:');
  console.log('1. Ingresa el clubId manualmente en el campo');
  console.log('2. O registra el club de nuevo');
} else if (!loginClubIdInput) {
  console.log('❌ PROBLEMA GRAVE: Campo loginClubId NO existe en HTML');
  console.log('');
  console.log('SOLUCIÓN:');
  console.log('Verifica que el index.html tenga:');
  console.log('<input type="text" id="loginClubId" ...>');
} else {
  console.log('✅ TODO PARECE CORRECTO');
  console.log('');
  console.log('Ahora intenta hacer login y mira qué error aparece en la consola');
}

console.log('\n═══════════════════════════════════════');
console.log('🔍 DIAGNÓSTICO COMPLETADO\n');

// Instrucciones
console.log('%c💡 SIGUIENTE PASO:', 'background: #3b82f6; color: white; font-size: 14px; padding: 5px;');
console.log('1. Ingresa tus datos en el formulario de login');
console.log('2. Click en "Entrar"');
console.log('3. Observa qué errores aparecen aquí en la consola');
console.log('4. Copia el error COMPLETO y envíamelo\n');

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

console.log('✅ utils.js cargado');