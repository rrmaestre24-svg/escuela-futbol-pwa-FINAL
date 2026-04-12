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
async function showManualWhatsAppModal(itemId, itemType) {
  const modal = document.getElementById('manualWhatsAppModal');
  
  if (!modal) {
    const phone = await showAppPrompt('El contacto no tiene teléfono registrado.\n\nIngresa el número de WhatsApp (con código de país):', {
      title: 'WhatsApp manual',
      type: 'info',
      confirmText: 'Continuar',
      placeholder: '+57XXXXXXXXXX'
    });
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
// 📷 MODAL DE SELECCIÓN DE FOTO (Tomar foto / Elegir galería)
// Usa cámara IN-APP (getUserMedia) para evitar el reinicio de
// la PWA en Android al abrir la app de cámara del sistema.
// ============================================================

let _pickerCameraStream  = null;
let _pickerFacingMode    = 'user'; // 'user'=frontal, 'environment'=trasera

/**
 * Mostrar modal de cambio de foto
 * @param {string} targetImgId   - ID del <img> que se actualizará con el preview
 * @param {string} targetInputId - ID del <input type="file"> que recibirá el archivo
 * @param {function} [onSelect]  - Callback opcional (base64) => void
 */
function showPhotoPickerModal(targetImgId, targetInputId, onSelect) {
  // Guardar contexto para usarlo después de capturar/seleccionar
  window._photoPickerCtx = { targetImgId, targetInputId, onSelect };

  // Eliminar modal anterior para recrearlo limpio
  const old = document.getElementById('photoPickerModal');
  if (old) old.remove();

  const modal = document.createElement('div');
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
          ✕
        </button>
      </div>

      <!-- Opciones -->
      <div class="px-4 pb-5 space-y-3">

        <!-- Tomar foto: abre cámara in-app (sin salir de la PWA) -->
        <button onclick="closePhotoPickerModal(); _openPickerCamera();"
          class="w-full bg-gradient-to-r from-blue-500 to-blue-600 active:scale-95 text-white rounded-2xl p-4 flex items-center gap-4 transition-all shadow-lg">
          <div class="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0 text-2xl">📷</div>
          <div class="text-left">
            <p class="font-bold text-base">Tomar foto</p>
            <p class="text-sm text-blue-100">Usar la cámara del dispositivo</p>
          </div>
        </button>

        <!-- Elegir de galería: input sin capture (solo galería) -->
        <label class="w-full bg-gradient-to-r from-purple-500 to-pink-500 active:scale-95 text-white rounded-2xl p-4 flex items-center gap-4 transition-all shadow-lg cursor-pointer">
          <div class="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0 text-2xl">🖼️</div>
          <div class="text-left">
            <p class="font-bold text-base">Elegir de galería</p>
            <p class="text-sm text-purple-100">Seleccionar foto existente</p>
          </div>
          <input type="file" accept="image/*" class="hidden"
                 onchange="photoPickerHandleFile(this)">
        </label>

        <!-- Cancelar -->
        <button onclick="closePhotoPickerModal()"
          class="w-full bg-gray-100 dark:bg-gray-700 active:scale-95 text-gray-700 dark:text-gray-200 rounded-2xl p-3.5 font-semibold transition-all">
          Cancelar
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

function closePhotoPickerModal() {
  const modal = document.getElementById('photoPickerModal');
  if (modal) modal.remove();
}

// ── Cámara in-app: abre un modal con video en vivo ──────────────────────────

async function _openPickerCamera() {
  // Fallback a galería si el navegador no soporta getUserMedia
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    _openPickerGalleryFallback();
    return;
  }

  _pickerFacingMode = 'user'; // empezar con cámara frontal
  _buildPickerCameraModal();
  await _startPickerCameraStream();
}

function _buildPickerCameraModal() {
  const old = document.getElementById('pickerCameraModal');
  if (old) old.remove();

  const modal = document.createElement('div');
  modal.id = 'pickerCameraModal';
  modal.className = 'fixed inset-0 z-[400] bg-black flex flex-col';
  modal.innerHTML = `
    <!-- Barra superior -->
    <div style="background:rgba(0,0,0,0.75)" class="flex items-center justify-between px-4 py-3 flex-shrink-0">
      <button onclick="_closePickerCamera()" class="text-white text-sm font-semibold px-3 py-2 rounded-xl" style="background:rgba(255,255,255,0.2)">✕ Cancelar</button>
      <span class="text-white font-bold text-sm">Tomar foto</span>
      <button onclick="_flipPickerCamera()" class="text-white text-sm font-semibold px-3 py-2 rounded-xl" style="background:rgba(255,255,255,0.2)">🔄 Voltear</button>
    </div>
    <!-- Video -->
    <div class="flex-1 relative overflow-hidden">
      <video id="pickerCameraVideo" autoplay playsinline muted class="w-full h-full object-cover"></video>
      <!-- Guía circular -->
      <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div style="width:220px;height:220px;border-radius:50%;border:4px solid rgba(255,255,255,0.5)"></div>
      </div>
    </div>
    <!-- Controles -->
    <div style="background:rgba(0,0,0,0.75)" class="flex-shrink-0 px-4 pt-4 pb-8 flex items-center justify-between">
      <!-- Galería como alternativa -->
      <label class="flex flex-col items-center gap-1 cursor-pointer">
        <div style="width:48px;height:48px;border-radius:12px;background:rgba(255,255,255,0.2)" class="flex items-center justify-center text-2xl">🖼</div>
        <span class="text-xs text-white/70">Galería</span>
        <input type="file" accept="image/*" class="hidden" onchange="_pickerGalleryFromCamera(this)">
      </label>
      <!-- Botón capturar (centro) -->
      <button onclick="_capturePickerPhoto()"
        style="width:80px;height:80px;border-radius:50%;border:4px solid #14b8a6;background:white;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 32px rgba(0,0,0,0.4)">
        <div style="width:56px;height:56px;border-radius:50%;background:#14b8a6"></div>
      </button>
      <!-- Espacio simétrico -->
      <div style="width:64px"></div>
    </div>
  `;
  document.body.appendChild(modal);
}

async function _startPickerCameraStream() {
  if (_pickerCameraStream) {
    _pickerCameraStream.getTracks().forEach(t => t.stop());
    _pickerCameraStream = null;
  }
  try {
    _pickerCameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: _pickerFacingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    });
    const video = document.getElementById('pickerCameraVideo');
    if (video) video.srcObject = _pickerCameraStream;
  } catch (err) {
    // Sin permiso de cámara → ir a galería
    _closePickerCamera();
    _openPickerGalleryFallback();
    showToast('ℹ️ Sin acceso a cámara — selecciona desde galería');
  }
}

async function _flipPickerCamera() {
  _pickerFacingMode = _pickerFacingMode === 'user' ? 'environment' : 'user';
  await _startPickerCameraStream();
}

function _capturePickerPhoto() {
  const video = document.getElementById('pickerCameraVideo');
  if (!video || !video.videoWidth) { showToast('⏳ Cámara iniciando...'); return; }

  // Recortar cuadrado centrado para foto de perfil
  const size    = Math.min(video.videoWidth, video.videoHeight);
  const offsetX = (video.videoWidth  - size) / 2;
  const offsetY = (video.videoHeight - size) / 2;
  const MAX = 300;

  const canvas = document.createElement('canvas');
  canvas.width  = MAX;
  canvas.height = MAX;
  canvas.getContext('2d').drawImage(video, offsetX, offsetY, size, size, 0, 0, MAX, MAX);

  const base64 = canvas.toDataURL('image/jpeg', 0.85);
  _closePickerCamera();
  _applyPhotoToContext(base64);
}

function _pickerGalleryFromCamera(input) {
  _closePickerCamera();
  photoPickerHandleFile(input);
}

function _closePickerCamera() {
  if (_pickerCameraStream) {
    _pickerCameraStream.getTracks().forEach(t => t.stop());
    _pickerCameraStream = null;
  }
  const video = document.getElementById('pickerCameraVideo');
  if (video) video.srcObject = null;
  const modal = document.getElementById('pickerCameraModal');
  if (modal) modal.remove();
}

// Fallback: abre un input de galería temporal cuando no hay cámara
function _openPickerGalleryFallback() {
  const tmp = document.createElement('input');
  tmp.type = 'file';
  tmp.accept = 'image/*';
  tmp.className = 'hidden';
  tmp.onchange = function() { photoPickerHandleFile(tmp); };
  document.body.appendChild(tmp);
  tmp.click();
  setTimeout(() => tmp.remove(), 5000);
}

// Aplica el base64 capturado al contexto guardado (img preview + callback)
function _applyPhotoToContext(base64) {
  const ctx = window._photoPickerCtx || {};

  if (ctx.targetImgId) {
    const img = document.getElementById(ctx.targetImgId);
    if (img) img.src = base64;
  }
  if (typeof ctx.onSelect === 'function') {
    ctx.onSelect(base64, null);
  }
  showToast('✅ Foto capturada');
}

// Estas funciones se mantienen para no romper llamadas antiguas en el código
function photoPickerCapture() {}
function photoCameraCapture() {}
function photoCameraStop() {}
function photoPickerGallery() {}

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
// Cámara in-app
window._openPickerCamera      = _openPickerCamera;
window._closePickerCamera     = _closePickerCamera;
window._flipPickerCamera      = _flipPickerCamera;
window._capturePickerPhoto    = _capturePickerPhoto;
window._pickerGalleryFromCamera = _pickerGalleryFromCamera;
window.showInvoiceProgressModal  = showInvoiceProgressModal;
window.closeInvoiceProgressModal = closeInvoiceProgressModal;
window.showManualWhatsAppModal   = showManualWhatsAppModal;
window.closeManualWhatsAppModal  = closeManualWhatsAppModal;
window.sendManualWhatsApp        = sendManualWhatsApp;

console.log('✅ modals.js cargado (+ PhotoPicker)');