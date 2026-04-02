// ========================================
// MODALES AUXILIARES
// ========================================

// Modal de progreso de factura
function showInvoiceProgressModal(invoiceNumber) {
  const modal = document.getElementById('invoiceProgressModal');
  const invoiceText = document.getElementById('invoiceNumberText');
  
  if (!modal) {
    console.warn('⚠️ Modal invoiceProgressModal no encontrado');
    return;
  }
  
  if (invoiceText && invoiceNumber) {
    invoiceText.textContent = `Factura: ${invoiceNumber}`;
  }
  
  modal.classList.remove('hidden');
}

function closeInvoiceProgressModal() {
  const modal = document.getElementById('invoiceProgressModal');
  if (modal) modal.classList.add('hidden');
}

// Modal de WhatsApp manual
function showManualWhatsAppModal(itemId, itemType) {
  const modal = document.getElementById('manualWhatsAppModal');
  
  if (!modal) {
    const phone = prompt('El contacto no tiene teléfono registrado.\n\nIngresa el número de WhatsApp (con código de país):');
    if (phone && phone.trim() !== '') {
      const normalizedPhone = normalizePhone(phone);
      if (itemType === 'payment')          sendInvoiceWhatsAppManual(itemId, normalizedPhone);
      else if (itemType === 'expense')     sendExpenseInvoiceWhatsAppManual(itemId, normalizedPhone);
    }
    return;
  }
  
  modal.classList.remove('hidden');
  document.getElementById('manualWhatsAppItemId').value   = itemId;
  document.getElementById('manualWhatsAppItemType').value = itemType;
  
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function closeManualWhatsAppModal() {
  const modal = document.getElementById('manualWhatsAppModal');
  if (modal) {
    modal.classList.add('hidden');
    const phoneInput = document.getElementById('manualWhatsAppPhone');
    if (phoneInput) phoneInput.value = '';
  }
}

function sendManualWhatsApp() {
  const itemId   = document.getElementById('manualWhatsAppItemId').value;
  const itemType = document.getElementById('manualWhatsAppItemType').value;
  const phone    = document.getElementById('manualWhatsAppPhone').value;
  
  if (!phone || phone.trim() === '') {
    showToast('⚠️ Ingresa un número de teléfono');
    return;
  }
  
  const normalizedPhone = normalizePhone(phone);
  
  if (itemType === 'payment')              sendInvoiceWhatsAppManual(itemId, normalizedPhone);
  else if (itemType === 'expense')         sendExpenseInvoiceWhatsAppManual(itemId, normalizedPhone);
  else if (itemType === 'thirdPartyIncome') sendThirdPartyIncomeWhatsAppManual(itemId, normalizedPhone);
  
  closeManualWhatsAppModal();
}

function sendInvoiceWhatsAppManual(paymentId, phone) {
  const payment  = getPaymentById(paymentId);
  if (!payment) return;
  const settings = getSchoolSettings();
  const player   = getPlayerById(payment.playerId);
  if (!player) return;
  
  const message =
    `¡Hola! 👋\n\n` +
    `Te enviamos la factura de *${settings.name || 'MI CLUB'}*\n\n` +
    `📄 Factura: ${payment.invoiceNumber}\n` +
    `👤 Jugador: ${player.name}\n` +
    `💵 Monto: ${formatCurrency(payment.amount)}\n` +
    `✅ Estado: ${payment.status}\n\n` +
    `¡Gracias por tu preferencia! ⚽`;
  
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
  showToast('✅ Abriendo WhatsApp...');
}

function sendExpenseInvoiceWhatsAppManual(expenseId, phone) {
  const expense  = getExpenseById(expenseId);
  if (!expense) return;
  const settings = getSchoolSettings();
  
  const message =
    `¡Hola ${expense.beneficiaryName}! 👋\n\n` +
    `Te enviamos el comprobante de pago de *${settings.name || 'MI CLUB'}*\n\n` +
    `📄 Factura: ${expense.invoiceNumber}\n` +
    `💵 Monto: ${formatCurrency(expense.amount)}\n` +
    `📋 Concepto: ${expense.concept}\n` +
    `📅 Fecha: ${formatDate(expense.date)}\n\n` +
    `¡Gracias! ⚽`;
  
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
  showToast('✅ Abriendo WhatsApp...');
}

// ============================================================
// 🆕 MODAL DE SELECCIÓN DE FOTO (Tomar foto / Elegir galería)
// ============================================================

/**
 * Mostrar modal de cambio de foto
 * @param {string} targetImgId   - ID del <img> que se actualizará con el preview
 * @param {string} targetInputId - ID del <input type="file"> que recibirá el archivo
 * @param {function} [onSelect]  - Callback opcional (base64) => void
 */
function showPhotoPickerModal(targetImgId, targetInputId, onSelect) {
  // Guardar contexto
  window._photoPickerCtx = { targetImgId, targetInputId, onSelect };

  // Crear overlay si no existe
  let modal = document.getElementById('photoPickerModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'photoPickerModal';
    modal.className = 'fixed inset-0 bg-black/60 z-[300] flex items-end sm:items-center justify-center p-4';
    modal.innerHTML = `
      <div class="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">

        <!-- Header -->
        <div class="px-5 pt-5 pb-3 flex items-center justify-between">
          <h3 class="font-bold text-gray-800 dark:text-white text-lg flex items-center gap-2">
            📷 Cambiar foto
          </h3>
          <button onclick="closePhotoPickerModal()"
            class="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
            <i data-lucide="x" class="w-5 h-5 text-gray-500"></i>
          </button>
        </div>

        <!-- Opciones -->
        <div class="px-4 pb-5 space-y-3">

          <!-- Tomar foto -->
          <button onclick="photoPickerCapture()"
            class="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 active:scale-95 text-white rounded-2xl p-4 flex items-center gap-4 transition-all shadow-lg shadow-blue-500/20">
            <div class="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <i data-lucide="camera" class="w-6 h-6"></i>
            </div>
            <div class="text-left">
              <p class="font-bold text-base">Tomar foto</p>
              <p class="text-sm text-blue-100">Usar la cámara del dispositivo</p>
            </div>
          </button>

          <!-- Elegir de galería -->
          <button onclick="photoPickerGallery()"
            class="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 active:scale-95 text-white rounded-2xl p-4 flex items-center gap-4 transition-all shadow-lg shadow-purple-500/20">
            <div class="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <i data-lucide="image" class="w-6 h-6"></i>
            </div>
            <div class="text-left">
              <p class="font-bold text-base">Elegir de galería</p>
              <p class="text-sm text-purple-100">Seleccionar foto existente</p>
            </div>
          </button>

          <!-- Cancelar -->
          <button onclick="closePhotoPickerModal()"
            class="w-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 active:scale-95 text-gray-700 dark:text-gray-200 rounded-2xl p-3.5 font-semibold transition-all">
            Cancelar
          </button>
        </div>
      </div>

      <!-- Visor de cámara inline — se muestra al presionar "Tomar foto" -->
      <div id="_cameraViewer" class="hidden">
        <video id="_cameraStream" autoplay playsinline
          class="w-full rounded-xl bg-black" style="max-height:260px;object-fit:cover;"></video>
        <div class="flex gap-2 mt-3">
          <button onclick="photoCameraCapture()"
            class="flex-1 bg-blue-500 hover:bg-blue-600 active:scale-95 text-white rounded-xl py-3 font-bold transition-all">
            📸 Capturar
          </button>
          <button onclick="photoCameraStop()"
            class="bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 active:scale-95 text-gray-700 dark:text-gray-200 rounded-xl px-4 py-3 font-semibold transition-all">
            Cancelar
          </button>
        </div>
      </div>

      <!-- Input solo para galería -->
      <input type="file" id="_photoPickerGallery" accept="image/*" class="hidden"
             onchange="photoPickerHandleFile(this)">
    `;
    document.body.appendChild(modal);
  }

  modal.classList.remove('hidden');
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function closePhotoPickerModal() {
  // Detener cámara si estaba activa
  if (window._cameraStream) photoCameraStop();
  const modal = document.getElementById('photoPickerModal');
  if (modal) modal.classList.add('hidden');
}

// Abre el visor de cámara inline dentro del modal — sin salir del PWA
function photoPickerCapture() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    // Fallback: navegador sin soporte (muy raro) — abre selector de archivo
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.onchange = () => photoPickerHandleFile(input);
    input.click();
    return;
  }

  // Ocultar los botones de opciones y mostrar el visor
  const optionsDiv = document.querySelector('#photoPickerModal .px-4.pb-5');
  const viewer = document.getElementById('_cameraViewer');
  if (optionsDiv) optionsDiv.classList.add('hidden');
  if (viewer) viewer.classList.remove('hidden');

  // Iniciar stream de cámara trasera
  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
    .then(stream => {
      window._cameraStream = stream;
      const video = document.getElementById('_cameraStream');
      if (video) {
        video.srcObject = stream;
        video.play();
      }
    })
    .catch(() => {
      // Si niega el permiso o falla, cerrar visor y mostrar opciones
      photoCameraStop();
      showToast('❌ No se pudo acceder a la cámara');
    });
}

// Captura el frame actual del video como foto
function photoCameraCapture() {
  const video = document.getElementById('_cameraStream');
  if (!video) return;

  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);

  const base64 = canvas.toDataURL('image/jpeg', 0.9);
  photoCameraStop();

  const ctx = window._photoPickerCtx || {};
  if (ctx.targetImgId) {
    const img = document.getElementById(ctx.targetImgId);
    if (img) img.src = base64;
  }
  if (typeof ctx.onSelect === 'function') ctx.onSelect(base64, null);

  showToast('✅ Foto tomada');
  closePhotoPickerModal();
}

// Detiene el stream y restaura los botones de opciones
function photoCameraStop() {
  if (window._cameraStream) {
    window._cameraStream.getTracks().forEach(t => t.stop());
    window._cameraStream = null;
  }
  const video = document.getElementById('_cameraStream');
  if (video) video.srcObject = null;

  const optionsDiv = document.querySelector('#photoPickerModal .px-4.pb-5');
  const viewer = document.getElementById('_cameraViewer');
  if (optionsDiv) optionsDiv.classList.remove('hidden');
  if (viewer) viewer.classList.add('hidden');
}

function photoPickerGallery() {
  document.getElementById('_photoPickerGallery')?.click();
}

function photoPickerHandleFile(input) {
  const file = input.files?.[0];
  if (!file) return;

  // Validaciones
  if (!file.type.startsWith('image/')) {
    showToast('❌ Selecciona una imagen válida');
    input.value = '';
    return;
  }
  if (file.size > 2 * 1024 * 1024) {
    showToast('❌ La imagen es muy grande. Máximo 2MB');
    input.value = '';
    return;
  }

  const ctx = window._photoPickerCtx || {};

  // Actualizar input file original (para que el formulario lo recoja)
  if (ctx.targetInputId) {
    const targetInput = document.getElementById(ctx.targetInputId);
    if (targetInput) {
      // Crear un nuevo DataTransfer para asignar el archivo
      try {
        const dt = new DataTransfer();
        dt.items.add(file);
        targetInput.files = dt.files;
      } catch(e) {
        // Fallback: algunos browsers no soportan DataTransfer en inputs
        console.warn('DataTransfer no soportado, usando base64 directo');
      }
    }
  }

  // Convertir a base64 y actualizar preview
  const reader = new FileReader();
  reader.onload = (e) => {
    const base64 = e.target.result;

    // Actualizar imagen preview
    if (ctx.targetImgId) {
      const img = document.getElementById(ctx.targetImgId);
      if (img) img.src = base64;
    }

    // Callback personalizado si existe
    if (typeof ctx.onSelect === 'function') {
      ctx.onSelect(base64, file);
    }

    showToast('✅ Foto seleccionada');
    closePhotoPickerModal();
  };
  reader.readAsDataURL(file);

  // Limpiar input interno
  input.value = '';
}

// Exports
window.showPhotoPickerModal   = showPhotoPickerModal;
window.closePhotoPickerModal  = closePhotoPickerModal;
window.photoPickerCapture     = photoPickerCapture;
window.photoPickerGallery     = photoPickerGallery;
window.photoPickerHandleFile  = photoPickerHandleFile;
window.photoCameraCapture     = photoCameraCapture;
window.photoCameraStop        = photoCameraStop;
window.showInvoiceProgressModal  = showInvoiceProgressModal;
window.closeInvoiceProgressModal = closeInvoiceProgressModal;
window.showManualWhatsAppModal   = showManualWhatsAppModal;
window.closeManualWhatsAppModal  = closeManualWhatsAppModal;
window.sendManualWhatsApp        = sendManualWhatsApp;

console.log('✅ modals.js cargado (+ PhotoPicker)');