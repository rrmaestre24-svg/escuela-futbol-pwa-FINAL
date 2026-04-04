// ========================================
// INTEGRACIÓN WHATSAPP
// ✅ CORREGIDO PARA iOS - Usa location.href en lugar de window.open
// 🆕 INCLUYE DOCUMENTO DE IDENTIDAD EN MENSAJES
// ========================================

// ========================================
// 🆕 FUNCIÓN PRINCIPAL CORREGIDA PARA iOS
// ========================================
function openWhatsApp(phone, message = '') {
  const cleanedPhone = cleanPhone(phone);
  const encodedMessage = encodeURIComponent(message);

  // URL web como fallback si WhatsApp no está instalado
  const webUrl = `https://wa.me/${cleanedPhone}?text=${encodedMessage}`;
  // Deep link directo — abre WhatsApp sin pasar por el navegador
  const deepLink = `whatsapp://send?phone=${cleanedPhone}&text=${encodedMessage}`;

  const isIOS     = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isAndroid = /Android/.test(navigator.userAgent);
  const isPWA     = window.matchMedia('(display-mode: standalone)').matches
                    || window.navigator.standalone === true;

  if (isIOS) {
    // iOS: deep link directo también funciona
    window.location.href = deepLink;
  } else if (isAndroid) {
    // Android: usar intent:// que abre WhatsApp directo si está instalado,
    // y redirige a wa.me como fallback si no lo tiene
    const intentUrl = `intent://send/${cleanedPhone}#Intent;scheme=whatsapp;package=com.whatsapp;action=android.intent.action.VIEW;S.browser_fallback_url=${encodeURIComponent(webUrl)};end`;
    if (isPWA) {
      // En PWA instalada: el deep link es suficiente
      window.location.href = deepLink;
    } else {
      window.location.href = intentUrl;
    }
  } else {
    // Desktop: abrir en nueva pestaña
    window.open(webUrl, '_blank');
  }
}

// ========================================
// 🆕 FUNCIÓN ALTERNATIVA: Crear link clickeable
// Usar cuando openWhatsApp no funcione (ej: después de async)
// ========================================
function createWhatsAppLink(phone, message = '') {
  const cleanedPhone = cleanPhone(phone);
  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${cleanedPhone}?text=${encodedMessage}`;
}

// ========================================
// 🆕 FUNCIÓN: Abrir WhatsApp con confirmación
// Muestra un modal con el link para que el usuario haga click
// ========================================
function openWhatsAppWithConfirm(phone, message = '', playerName = '') {
  const url = createWhatsAppLink(phone, message);
  
  // Crear modal de confirmación
  const modalHTML = `
    <div id="whatsappConfirmModal" class="fixed inset-0 bg-black bg-opacity-50 z-[9999] flex items-center justify-center p-4">
      <div class="bg-white dark:bg-gray-800 rounded-2xl max-w-sm w-full p-6 text-center animate-scale-in">
        <div class="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg class="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
        </div>
        <h3 class="text-xl font-bold text-gray-800 dark:text-white mb-2">Enviar por WhatsApp</h3>
        <p class="text-gray-600 dark:text-gray-400 mb-4">
          ${playerName ? `Mensaje para: <strong>${playerName}</strong>` : 'Toca el botón para abrir WhatsApp'}
        </p>
        <div class="space-y-3">
          <a href="${url}" 
             target="_blank"
             class="block w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-medium transition-colors"
             onclick="closeWhatsAppConfirmModal()">
            📱 Abrir WhatsApp
          </a>
          <button onclick="closeWhatsAppConfirmModal()" 
                  class="w-full border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 py-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  `;
  
  // Remover modal anterior si existe
  const existingModal = document.getElementById('whatsappConfirmModal');
  if (existingModal) existingModal.remove();
  
  // Agregar nuevo modal
  document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function closeWhatsAppConfirmModal() {
  const modal = document.getElementById('whatsappConfirmModal');
  if (modal) modal.remove();
}

// ========================================
// ENVIAR FACTURA POR WHATSAPP - CON DOCUMENTO
// ========================================
function sendInvoiceWhatsApp(paymentId) {
  const payment = getPaymentById(paymentId);
  if (!payment) {
    showToast('❌ Pago no encontrado');
    return;
  }
  
  const player = getPlayerById(payment.playerId);
  if (!player) {
    showToast('❌ Jugador no encontrado');
    return;
  }
  
  const settings = getSchoolSettings();
  
  // 🆕 Formatear documento si existe
  let documentLine = '';
  if (player.documentType && player.documentNumber) {
    documentLine = `🪪 *Documento:* ${player.documentType} ${player.documentNumber}\n`;
  }
  
  const message = `
\u{1F3C6} *${settings.name}*
\u{26BD} FACTURA DE PAGO

\u{1F4CB} *Factura:* ${payment.invoiceNumber}
\u{1F464} *Jugador:* ${player.name}
${documentLine}\u{1F4B0} *Concepto:* ${payment.concept}
\u{1F4B5} *Monto:* ${formatCurrency(payment.amount)}
\u{1F4C5} *Fecha:* ${formatDate(payment.paidDate)}
\u{1F4B3} *Método:* ${payment.method || 'No especificado'}

\u{2705} *Estado:* PAGADO

Gracias por tu pago.

_${settings.name}_
${settings.phone}
  `.trim();
  
  // ✅ Usar la versión con confirmación para iOS
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  
  if (isIOS) {
    // En iOS, mostrar modal con link clickeable
    openWhatsAppWithConfirm(player.phone, message, player.name);
  } else {
    // En Android/Desktop, abrir directamente
    openWhatsApp(player.phone, message);
  }
  
  showToast('✅ Preparando WhatsApp...');
}

// ========================================
// NOTIFICACIÓN DE VENCIMIENTO - CON DOCUMENTO
// ========================================
function sendPaymentNotificationWhatsApp(paymentId) {
  const payment = getPaymentById(paymentId);
  if (!payment) {
    showToast('❌ Pago no encontrado');
    return;
  }
  
  const player = getPlayerById(payment.playerId);
  if (!player) {
    showToast('❌ Jugador no encontrado');
    return;
  }
  
  const settings = getSchoolSettings();
  const today = new Date();
  const dueDate = new Date(payment.dueDate);
  const daysDiff = daysBetween(today, dueDate);
  
  // 🆕 Formatear documento si existe
  let documentLine = '';
  if (player.documentType && player.documentNumber) {
    documentLine = `🪪 *Documento:* ${player.documentType} ${player.documentNumber}\n`;
  }
  
  const stateText = daysDiff < 0 
    ? `⏱️ *Estado:* ${Math.abs(daysDiff)} días de atraso` 
    : `📅 *Estado:* Próximo a vencer en ${daysDiff} días`;

  const message = `
📌 *${settings.name}*
💳 *Recordatorio de pago - ${payment.concept.toUpperCase()}*

Estimado(a) acudiente de *${player.name}*,

Le compartimos un recordatorio amable sobre el siguiente pago pendiente:

📄 *Documento:* ${player.documentType || 'DNI'} ${player.documentNumber || 'N/A'}
⚽ *Categoría:* ${player.category || 'N/A'}
📘 *Concepto:* ${payment.concept}
💰 *Monto:* ${formatCurrency(payment.amount)}
📅 *Fecha sugerida de pago:* ${formatDate(payment.dueDate)}
${stateText}

Sabemos que en ocasiones pueden presentarse imprevistos. Le agradeceríamos ponerse al día cuando le sea posible o comunicarse con nosotros si necesita apoyo.

Quedamos atentos a cualquier inquietud. 🤝

*${settings.name}*
📞 ${settings.phone}
  `.trim();
  
  // ✅ Usar la versión con confirmación para iOS
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  
  if (isIOS) {
    openWhatsAppWithConfirm(player.phone, message, player.name);
  } else {
    openWhatsApp(player.phone, message);
  }
  
  showToast('✅ Preparando WhatsApp...');
}

// ========================================
// 🆕 RECORDATORIO VIRTUAL (POR HISTORIAL)
// ========================================
function sendVirtualReminderWhatsApp(playerId, nextDueDate) {
  const player = getPlayerById(playerId);
  if (!player) {
    showToast('❌ Jugador no encontrado');
    return;
  }
  
  const settings = getSchoolSettings();
  const today = new Date();
  const dueDate = new Date(nextDueDate);
  const daysDiff = daysBetween(today, dueDate);
  
  const monthName = parseLocalDate(nextDueDate).toLocaleString('es-ES', {month: 'long'});
  const yearName = parseLocalDate(nextDueDate).getFullYear();
  
  const stateText = daysDiff < 0 
    ? `⏱️ *Estado:* ${Math.abs(daysDiff)} días de atraso` 
    : `📅 *Estado:* Próximo a vencer en ${daysDiff} días`;

  const message = `
📌 *${settings.name}*
💳 *Recordatorio de pago - ${monthName.toUpperCase()}*

Estimado(a) acudiente de *${player.name}*,

Le compartimos un recordatorio amable sobre el siguiente pago pendiente:

📄 *Documento:* ${player.documentType || 'DNI'} ${player.documentNumber || 'N/A'}
⚽ *Categoría:* ${player.category || 'N/A'}
📘 *Concepto:* Mensualidad ${monthName} ${yearName}
📅 *Fecha sugerida de pago:* ${formatDate(nextDueDate)}
${stateText}

Sabemos que en ocasiones pueden presentarse imprevistos. Le agradeceríamos ponerse al día cuando le sea posible o comunicarse con nosotros si necesita apoyo.

Quedamos atentos a cualquier inquietud. 🤝

*${settings.name}*
📞 ${settings.phone}
  `.trim();
  
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  if (isIOS) {
    openWhatsAppWithConfirm(player.phone, message, player.name);
  } else {
    openWhatsApp(player.phone, message);
  }
  
  showToast('✅ Preparando Recordatorio Amable...');
}

// Hacer funciones globales
window.sendVirtualReminderWhatsApp = sendVirtualReminderWhatsApp;

// ========================================
// FELICITAR CUMPLEAÑOS
// ========================================
function sendBirthdayWhatsApp(personId, isStaff = false) {
  let person, phone, name;
  
  if (isStaff) {
    person = getUsers().find(u => u.id === personId);
    if (!person) {
      showToast('❌ Usuario no encontrado');
      return;
    }
    phone = person.phone;
    name = person.name;
  } else {
    person = getPlayerById(personId);
    if (!person) {
      showToast('❌ Jugador no encontrado');
      return;
    }
    phone = person.phone;
    name = person.name;
  }
  
  const settings = getSchoolSettings();
  const age = calculateAge(person.birthDate);
  
  const message = `
\u{1F389}\u{1F382} *¡FELIZ CUMPLEAÑOS!* \u{1F382}\u{1F389}

Querido(a) *${name}*,

Desde *${settings.name}* queremos desearte un feliz cumpleaños #${age}.

Que este nuevo año de vida esté lleno de:
\u{26BD} Goles
\u{1F3C6} Triunfos
\u{1F60A} Alegrías
\u{1F4AA} Salud

¡Que lo disfrutes al máximo!

_${settings.name}_
  `.trim();
  
  // ✅ Usar la versión con confirmación para iOS
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  
  if (isIOS) {
    openWhatsAppWithConfirm(phone, message, name);
  } else {
    openWhatsApp(phone, message);
  }
  
  showToast('✅ Preparando WhatsApp...');
}

// ========================================
// MENSAJE PERSONALIZADO
// ========================================
function sendCustomWhatsApp(phone, message) {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  
  if (isIOS) {
    openWhatsAppWithConfirm(phone, message);
  } else {
    openWhatsApp(phone, message);
  }
  
  showToast('✅ Preparando WhatsApp...');
}

// ========================================
// ESTADO DE CUENTA - CON DOCUMENTO
// ========================================
function sendAccountStatementWhatsApp(playerId) {
  const player = getPlayerById(playerId);
  if (!player) {
    showToast('❌ Jugador no encontrado');
    return;
  }
  
  const payments = getPaymentsByPlayer(playerId);
  const settings = getSchoolSettings();
  
  const paid = payments.filter(p => p.status === 'Pagado');
  const pending = payments.filter(p => p.status === 'Pendiente');
  
  const totalPaid = paid.reduce((sum, p) => sum + p.amount, 0);
  const totalPending = pending.reduce((sum, p) => sum + p.amount, 0);
  
  // 🆕 Formatear documento si existe
  let documentLine = '';
  if (player.documentType && player.documentNumber) {
    documentLine = `\u{1FA} *Documento:* ${player.documentType} ${player.documentNumber}\n`;
  }
  
  let message = `
\u{1F3C6} *${settings.name}*
\u{1F4CA} ESTADO DE CUENTA

\u{1F464} *Jugador:* ${player.name}
${documentLine}\u{1F4C5} *Fecha:* ${formatDate(getCurrentDate())}

\u{1F4B0} *Resumen:*
\u{2705} Total Pagado: ${formatCurrency(totalPaid)}
\u{23F3} Total Pendiente: ${formatCurrency(totalPending)}

\u{1F4CB} *Pagos Pendientes:*
`;

  if (pending.length === 0) {
    message += '\n✅ No hay pagos pendientes';
  } else {
    pending.forEach(p => {
      message += `\n• ${p.concept}: ${formatCurrency(p.amount)} (Vence: ${formatDate(p.dueDate)})`;
    });
  }
  
  message += `

_${settings.name}_
${settings.phone}
  `.trim();
  
  // ✅ Usar la versión con confirmación para iOS
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  
  if (isIOS) {
    openWhatsAppWithConfirm(player.phone, message, player.name);
  } else {
    openWhatsApp(player.phone, message);
  }
  
  showToast('✅ Preparando WhatsApp...');
}

console.log('✅ whatsapp.js cargado (CORREGIDO PARA iOS)');

// ========================================
// WHATSAPP - FUNCIONES PARA EGRESOS
// ========================================

// Enviar comprobante de egreso por WhatsApp
function sendExpenseInvoiceWhatsApp(expenseId) {
  const expense = getExpenseById(expenseId);
  if (!expense) {
    showToast('❌ Egreso no encontrado');
    return;
  }
  
  const settings = getSchoolSettings();
  
  // Construir mensaje
  const message = `¡Hola ${expense.beneficiaryName}! \u{1F44B}\n\n` +
    `Te enviamos el comprobante de pago de *${settings.name || 'MI CLUB'}*\n\n` +
    `\u{1F4C4} Comprobante: ${expense.invoiceNumber}\n` +
    `\u{1F4B5} Monto: ${formatCurrency(expense.amount)}\n` +
    `\u{1F4CB} Concepto: ${expense.concept}\n` +
    `\u{1F3F7}\u{FE0F} Categoría: ${expense.category}\n` +
    `\u{1F4C5} Fecha de pago: ${formatDate(expense.date)}\n` +
    `\u{1F4B3} Método: ${expense.method}\n\n` +
    `Gracias por tus servicios \u{26BD}`;
  
  // Normalizar teléfono
  const phone = normalizePhone(expense.beneficiaryPhone);
  
  // ✅ Usar la versión con confirmación para iOS
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  
  if (isIOS) {
    openWhatsAppWithConfirm(phone, message, expense.beneficiaryName);
  } else {
    openWhatsApp(phone, message);
  }
  
  showToast('✅ Preparando WhatsApp...');
}

// Enviar por WhatsApp con número manual (para egresos)
function sendExpenseInvoiceWhatsAppManual(expenseId, phone) {
  const expense = getExpenseById(expenseId);
  if (!expense) {
    showToast('❌ Egreso no encontrado');
    return;
  }
  
  const settings = getSchoolSettings();
  
  const message = `¡Hola ${expense.beneficiaryName}! \u{1F44B}\n\n` +
    `Te enviamos el comprobante de pago de *${settings.name || 'MI CLUB'}*\n\n` +
    `\u{1F4C4} Comprobante: ${expense.invoiceNumber}\n` +
    `\u{1F4B5} Monto: ${formatCurrency(expense.amount)}\n` +
    `\u{1F4CB} Concepto: ${expense.concept}\n` +
    `\u{1F4C5} Fecha: ${formatDate(expense.date)}\n\n` +
    `Gracias por tus servicios \u{26BD}`;
  
  const normalizedPhone = normalizePhone(phone);
  
  // ✅ Usar la versión con confirmación para iOS
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  
  if (isIOS) {
    openWhatsAppWithConfirm(normalizedPhone, message, expense.beneficiaryName);
  } else {
    openWhatsApp(normalizedPhone, message);
  }
  
  showToast('✅ Preparando WhatsApp...');
}

// Hacer funciones globales
window.openWhatsApp = openWhatsApp;
window.createWhatsAppLink = createWhatsAppLink;
window.openWhatsAppWithConfirm = openWhatsAppWithConfirm;
window.closeWhatsAppConfirmModal = closeWhatsAppConfirmModal;
window.sendInvoiceWhatsApp = sendInvoiceWhatsApp;
window.sendPaymentNotificationWhatsApp = sendPaymentNotificationWhatsApp;
window.sendBirthdayWhatsApp = sendBirthdayWhatsApp;
window.sendCustomWhatsApp = sendCustomWhatsApp;
window.sendAccountStatementWhatsApp = sendAccountStatementWhatsApp;
window.sendExpenseInvoiceWhatsApp = sendExpenseInvoiceWhatsApp;
window.sendExpenseInvoiceWhatsAppManual = sendExpenseInvoiceWhatsAppManual;

console.log('✅ Funciones de WhatsApp para egresos cargadas (CORREGIDO iOS)');