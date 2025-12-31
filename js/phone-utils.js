// ========================================
// SISTEMA DE NORMALIZACIÃ"N DE TELÃ‰FONOS
// Detecta y formatea automÃ¡ticamente nÃºmeros colombianos
// ========================================

/**
 * Limpia y normaliza un nÃºmero de telÃ©fono colombiano
 * Agrega +57 automÃ¡ticamente si no tiene cÃ³digo de paÃ­s
 * @param {string} phone - NÃºmero de telÃ©fono sin formato
 * @returns {string} - NÃºmero normalizado en formato internacional (+57XXXXXXXXXX)
 */
function normalizePhone(phone) {
  if (!phone) return '';
  
  // Limpiar: eliminar espacios, guiones, parÃ©ntesis, puntos
  let cleaned = phone.replace(/[\s\-\(\)\.\+]/g, '');
  
  // Si empieza con 57 (sin +), agregarlo
  if (cleaned.startsWith('57') && cleaned.length === 12) {
    return '+' + cleaned;
  }
  
  // Si ya tiene +57, retornar tal cual
  if (cleaned.startsWith('57') && cleaned.length === 12) {
    return '+' + cleaned;
  }
  
  // Si es un nÃºmero colombiano de 10 dÃ­gitos (300XXXXXXX, 310XXXXXXX, etc.)
  if (cleaned.length === 10 && cleaned.match(/^3[0-9]{9}$/)) {
    return '+57' + cleaned;
  }
  
  // Si es de 7 dÃ­gitos (telÃ©fono fijo sin indicativo)
  if (cleaned.length === 7) {
    // Puedes agregar un indicativo por defecto si lo deseas
    // Por ahora retornar con +57
    return '+57' + cleaned;
  }
  
  // Si no cumple ninguna regla, intentar agregar +57
  if (cleaned.length >= 7 && !cleaned.startsWith('+')) {
    return '+57' + cleaned;
  }
  
  return cleaned;
}

/**
 * Formatea visualmente un nÃºmero de telÃ©fono
 * Ejemplo: +573001234567 â†' +57 300 123 4567
 * @param {string} phone - NÃºmero normalizado
 * @returns {string} - NÃºmero formateado visualmente
 */
function formatPhoneDisplay(phone) {
  const normalized = normalizePhone(phone);
  
  // Si tiene +57 y 10 dÃ­gitos despuÃ©s
  if (normalized.match(/^\+57[0-9]{10}$/)) {
    return normalized.replace(/^\+57([0-9]{3})([0-9]{3})([0-9]{4})$/, '+57 $1 $2 $3');
  }
  
  // Si tiene +57 y 7 dÃ­gitos (telÃ©fono fijo)
  if (normalized.match(/^\+57[0-9]{7}$/)) {
    return normalized.replace(/^\+57([0-9]{3})([0-9]{4})$/, '+57 $1 $2');
  }
  
  return normalized;
}

/**
 * Genera link de WhatsApp con un nÃºmero normalizado
 * @param {string} phone - NÃºmero de telÃ©fono
 * @param {string} message - Mensaje predeterminado (opcional)
 * @returns {string} - URL de WhatsApp
 */
function getWhatsAppLink(phone, message = '') {
  const normalized = normalizePhone(phone);
  const cleanNumber = normalized.replace(/\+/g, ''); // WhatsApp no usa el +
  
  if (message) {
    const encodedMessage = encodeURIComponent(message);
    return `https://wa.me/${cleanNumber}?text=${encodedMessage}`;
  }
  
  return `https://wa.me/${cleanNumber}`;
}

/**
 * Genera link para llamada telefÃ³nica
 * @param {string} phone - NÃºmero de telÃ©fono
 * @returns {string} - URL tel:
 */
function getCallLink(phone) {
  const normalized = normalizePhone(phone);
  return `tel:${normalized}`;
}

/**
 * Valida si un nÃºmero colombiano es vÃ¡lido
 * @param {string} phone - NÃºmero de telÃ©fono
 * @returns {boolean} - true si es vÃ¡lido
 */
function isValidColombianPhone(phone) {
  if (!phone) return false;
  
  const cleaned = phone.replace(/[\s\-\(\)\.\+]/g, '');
  
  // Celular: 10 dÃ­gitos empezando con 3
  if (cleaned.match(/^3[0-9]{9}$/)) return true;
  
  // Con +57: 12 dÃ­gitos
  if (cleaned.match(/^573[0-9]{9}$/)) return true;
  
  // Fijo: 7 dÃ­gitos
  if (cleaned.match(/^[0-9]{7}$/)) return true;
  
  return false;
}

/**
 * Formatea un input de telÃ©fono mientras se escribe
 * Uso: <input oninput="formatPhoneInput(this)">
 * @param {HTMLInputElement} input - Campo de input
 */
function formatPhoneInput(input) {
  const cursorPosition = input.selectionStart;
  const oldLength = input.value.length;
  
  // Guardar solo los dÃ­gitos
  let cleaned = input.value.replace(/[^0-9+]/g, '');
  
  // Formatear visualmente
  if (cleaned.startsWith('+57')) {
    const digits = cleaned.substring(3);
    if (digits.length <= 3) {
      input.value = '+57 ' + digits;
    } else if (digits.length <= 6) {
      input.value = '+57 ' + digits.substring(0, 3) + ' ' + digits.substring(3);
    } else if (digits.length <= 10) {
      input.value = '+57 ' + digits.substring(0, 3) + ' ' + digits.substring(3, 6) + ' ' + digits.substring(6, 10);
    } else {
      input.value = '+57 ' + digits.substring(0, 3) + ' ' + digits.substring(3, 6) + ' ' + digits.substring(6, 10);
    }
  } else if (cleaned.length >= 1) {
    // Si no empieza con +57, formatear como celular colombiano
    if (cleaned.length <= 3) {
      input.value = cleaned;
    } else if (cleaned.length <= 6) {
      input.value = cleaned.substring(0, 3) + ' ' + cleaned.substring(3);
    } else if (cleaned.length <= 10) {
      input.value = cleaned.substring(0, 3) + ' ' + cleaned.substring(3, 6) + ' ' + cleaned.substring(6);
    } else {
      input.value = cleaned.substring(0, 3) + ' ' + cleaned.substring(3, 6) + ' ' + cleaned.substring(6, 10);
    }
  }
  
  // Restaurar posiciÃ³n del cursor
  const newLength = input.value.length;
  const newPosition = cursorPosition + (newLength - oldLength);
  input.setSelectionRange(newPosition, newPosition);
}

/**
 * Detecta el tipo de telÃ©fono
 * @param {string} phone - NÃºmero de telÃ©fono
 * @returns {string} - 'celular', 'fijo', o 'desconocido'
 */
function getPhoneType(phone) {
  const cleaned = phone.replace(/[\s\-\(\)\.\+]/g, '');
  
  if (cleaned.match(/^(57)?3[0-9]{9}$/)) {
    return 'celular';
  }
  
  if (cleaned.match(/^[0-9]{7}$/)) {
    return 'fijo';
  }
  
  return 'desconocido';
}

// â­ FUNCIÃ"N LEGACY: Mantener compatibilidad con cÃ³digo existente
function cleanPhone(phone) {
  return normalizePhone(phone).replace(/\+/g, '');
}

// ========================================
// EJEMPLOS DE USO
// ========================================

/*
// EJEMPLO 1: Normalizar al guardar
const phoneInput = document.getElementById('playerPhone').value;
const normalized = normalizePhone(phoneInput);
// normalized = "+573001234567"

// EJEMPLO 2: Mostrar formateado
const display = formatPhoneDisplay(normalized);
// display = "+57 300 123 4567"

// EJEMPLO 3: Link de WhatsApp
const whatsappUrl = getWhatsAppLink(normalized, "Hola, soy del club");
// whatsappUrl = "https://wa.me/573001234567?text=Hola%2C%20soy%20del%20club"

// EJEMPLO 4: Link de llamada
const callUrl = getCallLink(normalized);
// callUrl = "tel:+573001234567"

// EJEMPLO 5: Validar
const isValid = isValidColombianPhone("300 123 4567");
// isValid = true

// EJEMPLO 6: Input con formato automÃ¡tico
<input 
  type="tel" 
  oninput="formatPhoneInput(this)"
  placeholder="+57 300 123 4567"
>
*/

console.log('âœ… phone-utils.js cargado - Sistema de normalizaciÃ³n de telÃ©fonos');