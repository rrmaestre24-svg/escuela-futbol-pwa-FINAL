// ========================================
// MULTI-INVOICE — Facturación múltiple
// Genera facturas de meses vencidos, actuales o adelantados.
// No toca el flujo de factura única (ya existente).
// ========================================

// Estado interno del modal (variables privadas con prefijo _mi_)
let _mi_playerId       = null;
let _mi_selectedMonths = [];  // ["2026-02", "2026-03", ...]
let _mi_mode           = null; // 'current' | 'overdue' | 'advance'

// ========================================
// UTILIDADES DE MES
// ========================================

// Retorna "YYYY-MM" del mes actual
function _mi_currentMonth() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// Retorna "YYYY-MM" de N meses antes/después del actual
function _mi_relativeMonth(offset) {
    const now = new Date();
    const d   = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// "2026-04" → "Abril 2026" (primera letra mayúscula)
function _mi_formatMonth(yyyyMm) {
    const [year, month] = yyyyMm.split('-');
    const label = new Date(parseInt(year), parseInt(month) - 1, 1)
        .toLocaleString('es-ES', { month: 'long', year: 'numeric' });
    return label.charAt(0).toUpperCase() + label.slice(1);
}

// Último día del mes para usar como dueDate
function _mi_lastDayOfMonth(yyyyMm) {
    const [year, month] = yyyyMm.split('-');
    const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
    return `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
}

// ========================================
// ANTI-DUPLICADO
// Verifica si ya hay una factura activa para ese jugador + mes
// ========================================
function _mi_monthExists(playerId, billingMonth) {
    return getPaymentsByPlayer(playerId).some(
        p => p.billingMonth === billingMonth && p.status !== 'Anulado'
    );
}

// ========================================
// PASO 0: SELECTOR DE JUGADOR
// Se abre desde el modal de tipo de pago (4ta opción)
// ========================================
function showMultiInvoicePlayerPicker() {
    // Limpiar estado
    _mi_playerId       = null;
    _mi_selectedMonths = [];
    _mi_mode           = null;

    // Eliminar instancia anterior si existe
    document.getElementById('_miPickerOverlay')?.remove();

    const players = getActivePlayers ? getActivePlayers() : [];
    const settings = getSchoolSettings();
    const clubColor = settings?.primaryColor || '#0d9488';

    const overlay = document.createElement('div');
    overlay.id = '_miPickerOverlay';
    overlay.className = 'fixed inset-0 bg-black/60 z-[300] flex items-center justify-center p-4';

    overlay.innerHTML = `
        <div class="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
            <!-- Header -->
            <div style="background:${clubColor}" class="px-5 py-4 text-white flex items-center justify-between">
                <div>
                    <p class="font-bold">🧾 Facturación Múltiple</p>
                    <p class="text-xs text-white/80">Seleccioná el jugador</p>
                </div>
                <button onclick="document.getElementById('_miPickerOverlay').remove()"
                    class="text-white/80 hover:text-white text-2xl leading-none">&times;</button>
            </div>
            <!-- Buscador -->
            <div class="px-4 pt-3 pb-2">
                <input type="text" id="_miSearchInput"
                    placeholder="Buscar jugador..."
                    oninput="_mi_filterPlayers(this.value)"
                    class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-teal-500"
                    autocomplete="off">
            </div>
            <!-- Lista -->
            <div id="_miPlayerList" class="overflow-y-auto max-h-64 px-2 pb-3 space-y-1">
                ${_mi_renderPlayerItems(players)}
            </div>
        </div>
    `;

    document.body.appendChild(overlay);
    setTimeout(() => document.getElementById('_miSearchInput')?.focus(), 100);
}

// Renderizar ítems de la lista de jugadores
function _mi_renderPlayerItems(players) {
    if (players.length === 0) {
        return `<p class="text-center text-sm text-gray-400 py-4">No hay jugadores activos</p>`;
    }
    return players.map(p => {
        const avatarSrc = p.avatar || (typeof getDefaultAvatar === 'function' ? getDefaultAvatar() : '');
        const avatarHtml = avatarSrc
            ? `<img src="${avatarSrc}" alt="${p.name}" class="w-9 h-9 rounded-full object-cover flex-shrink-0">`
            : `<div class="w-9 h-9 rounded-full bg-teal-100 dark:bg-teal-800 flex items-center justify-center text-sm font-bold text-teal-700 dark:text-teal-300 flex-shrink-0">${(p.name || '?').charAt(0).toUpperCase()}</div>`;
        return `
        <button onclick="_mi_selectPlayer('${p.id}')"
            class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors text-left">
            ${avatarHtml}
            <div>
                <p class="text-sm font-medium text-gray-800 dark:text-white">${p.name}</p>
                <p class="text-xs text-gray-400">${p.category || ''}</p>
            </div>
        </button>`;
    }).join('');
}

// Filtrar jugadores mientras el admin escribe
function _mi_filterPlayers(query) {
    const all = getActivePlayers ? getActivePlayers() : [];
    const q   = query.toLowerCase().trim();
    const filtered = q
        ? all.filter(p => (p.name || '').toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q))
        : all;
    document.getElementById('_miPlayerList').innerHTML = _mi_renderPlayerItems(filtered);
}

// Jugador seleccionado → abrir modal de modos
function _mi_selectPlayer(playerId) {
    document.getElementById('_miPickerOverlay')?.remove();
    showMultiInvoiceModal(playerId);
}

// ========================================
// PASO 1: MODAL PRINCIPAL — ELEGIR MODO
// ========================================
function showMultiInvoiceModal(playerId) {
    const player = getPlayerById(playerId);
    if (!player) { showToast('❌ Jugador no encontrado'); return; }

    _mi_playerId       = playerId;
    _mi_selectedMonths = [];
    _mi_mode           = null;

    document.getElementById('_miMainOverlay')?.remove();

    const settings  = getSchoolSettings();
    const clubColor = settings?.primaryColor || '#0d9488';
    const curMonth  = _mi_currentMonth();

    const overlay = document.createElement('div');
    overlay.id = '_miMainOverlay';
    overlay.className = 'fixed inset-0 bg-black/60 z-[300] flex items-center justify-center p-4';

    overlay.innerHTML = `
        <div class="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
            <!-- Header -->
            <div style="background:${clubColor}" class="px-5 py-4 text-white flex items-center justify-between">
                <div>
                    <p class="font-bold">🧾 Generar Facturas</p>
                    <p class="text-xs text-white/80">${player.name} · ${player.category || ''}</p>
                </div>
                <button onclick="closeMultiInvoiceModal()" class="text-white/80 hover:text-white text-2xl leading-none">&times;</button>
            </div>

            <!-- PASO 1: elegir tipo -->
            <div id="_miStep1" class="p-4 space-y-2">
                <p class="text-sm text-gray-500 dark:text-gray-400 mb-3">¿Qué tipo de factura querés generar?</p>

                <!-- Mes actual -->
                <button onclick="_mi_goToStep2('current')"
                    class="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-gray-200 dark:border-gray-600 hover:border-teal-500 transition-all text-left">
                    <span class="text-2xl">📅</span>
                    <div>
                        <p class="font-semibold text-gray-800 dark:text-white text-sm">Mes actual</p>
                        <p class="text-xs text-gray-400">${_mi_formatMonth(curMonth)}</p>
                    </div>
                </button>

                <!-- Meses vencidos -->
                <button onclick="_mi_goToStep2('overdue')"
                    class="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-gray-200 dark:border-gray-600 hover:border-orange-400 transition-all text-left">
                    <span class="text-2xl">⏪</span>
                    <div>
                        <p class="font-semibold text-gray-800 dark:text-white text-sm">Meses vencidos</p>
                        <p class="text-xs text-gray-400">Hasta 2 meses atrás</p>
                    </div>
                </button>

                <!-- Meses adelantados -->
                <button onclick="_mi_goToStep2('advance')"
                    class="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-gray-200 dark:border-gray-600 hover:border-blue-400 transition-all text-left">
                    <span class="text-2xl">⏩</span>
                    <div>
                        <p class="font-semibold text-gray-800 dark:text-white text-sm">Meses adelantados</p>
                        <p class="text-xs text-gray-400">Hasta 2 meses adelante</p>
                    </div>
                </button>
            </div>

            <!-- PASO 2: seleccionar meses + datos del pago -->
            <div id="_miStep2" class="hidden overflow-y-auto" style="max-height:80vh">
                <div class="p-4">
                    <button onclick="_mi_backToStep1()"
                        class="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 mb-3 flex items-center gap-1">
                        ← Volver
                    </button>
                    <p id="_miStep2Title" class="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3"></p>
                    <!-- Lista de meses -->
                    <div id="_miMonthList" class="space-y-2 mb-4"></div>

                    <!-- Separador -->
                    <hr class="border-gray-200 dark:border-gray-600 mb-4">

                    <!-- Monto -->
                    <div class="mb-3">
                        <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                            Monto *
                        </label>
                        <input type="number" id="_miAmount" min="0" step="0.01"
                            value="${settings?.monthlyFee || ''}"
                            placeholder="0"
                            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-teal-500"
                            style="font-size:16px">
                    </div>

                    <!-- Fecha de pago -->
                    <div class="mb-3">
                        <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                            Fecha de Pago *
                        </label>
                        <input type="date" id="_miPaidDate"
                            value="${getCurrentDate()}"
                            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-teal-500">
                    </div>

                    <!-- Método de pago -->
                    <div class="mb-3">
                        <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                            Método de Pago *
                        </label>
                        <select id="_miMethod"
                            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-teal-500">
                            <option value="Efectivo">Efectivo</option>
                            <option value="Transferencia">Transferencia</option>
                            <option value="Tarjeta">Tarjeta</option>
                        </select>
                    </div>

                    <!-- Descuento (opcional) -->
                    <div class="mb-3">
                        <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                            Descuento <span class="text-gray-400 font-normal">(opcional)</span>
                        </label>
                        <div class="flex gap-2">
                            <!-- Toggle % / $ -->
                            <div class="flex rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600 flex-shrink-0">
                                <button type="button" id="_miDiscTypePct"
                                    onclick="_mi_setDiscountType('pct')"
                                    class="px-3 py-2 text-sm font-bold bg-teal-600 text-white transition-colors">%</button>
                                <button type="button" id="_miDiscTypeFixed"
                                    onclick="_mi_setDiscountType('fixed')"
                                    class="px-3 py-2 text-sm font-bold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors">$</button>
                            </div>
                            <input type="number" id="_miDiscount" min="0" step="0.01" placeholder="0"
                                oninput="_mi_updateDiscountPreview()"
                                class="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-teal-500"
                                style="font-size:16px">
                        </div>
                        <input type="text" id="_miDiscountReason" placeholder="Motivo (ej: beca, acuerdo)"
                            class="w-full mt-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-teal-500 text-sm">
                        <!-- Preview del total con descuento -->
                        <p id="_miDiscountPreview" class="text-xs text-teal-600 dark:text-teal-400 mt-1 hidden"></p>
                    </div>

                    <!-- Observación (opcional) -->
                    <div class="mb-4">
                        <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                            Observación <span class="text-gray-400 font-normal">(opcional)</span>
                        </label>
                        <textarea id="_miNotes" rows="2" placeholder="Ej: Acuerdo de pago en cuotas, beca deportiva..."
                            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-teal-500 text-sm resize-none"></textarea>
                    </div>

                    <button onclick="_mi_confirm()" id="_miConfirmBtn"
                        style="background:${clubColor}"
                        class="w-full text-white py-3 rounded-xl font-bold text-sm transition-opacity disabled:opacity-40"
                        disabled>
                        Generar factura(s)
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);
}

function closeMultiInvoiceModal() {
    document.getElementById('_miMainOverlay')?.remove();
    _mi_playerId       = null;
    _mi_selectedMonths = [];
    _mi_mode           = null;
}

function _mi_backToStep1() {
    _mi_mode           = null;
    _mi_selectedMonths = [];
    document.getElementById('_miStep1').classList.remove('hidden');
    document.getElementById('_miStep2').classList.add('hidden');
}

// ========================================
// PASO 2: MOSTRAR MESES DISPONIBLES
// ========================================
function _mi_goToStep2(mode) {
    _mi_mode           = mode;
    _mi_selectedMonths = [];

    document.getElementById('_miStep1').classList.add('hidden');
    document.getElementById('_miStep2').classList.remove('hidden');

    const titleEl = document.getElementById('_miStep2Title');
    const listEl  = document.getElementById('_miMonthList');
    const btnEl   = document.getElementById('_miConfirmBtn');
    const curMonth = _mi_currentMonth();

    let months = [];

    if (mode === 'current') {
        titleEl.textContent = 'Mes actual';
        if (_mi_monthExists(_mi_playerId, curMonth)) {
            // Ya existe → bloquear
            listEl.innerHTML = `
                <div class="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-xl text-sm text-yellow-700 dark:text-yellow-300">
                    ⚠️ Ya existe una factura para <strong>${_mi_formatMonth(curMonth)}</strong>.
                </div>
            `;
            btnEl.disabled = true;
            return;
        }
        // Disponible → auto-seleccionar
        _mi_selectedMonths = [curMonth];
        listEl.innerHTML = `
            <div class="p-3 bg-teal-50 dark:bg-teal-900/20 border border-teal-300 dark:border-teal-700 rounded-xl text-sm text-teal-700 dark:text-teal-300">
                ✅ <strong>${_mi_formatMonth(curMonth)}</strong> disponible para facturar
            </div>
        `;
        btnEl.disabled = false;
        return;
    }

    if (mode === 'overdue') {
        titleEl.textContent = 'Seleccioná los meses vencidos';
        months = [_mi_relativeMonth(-2), _mi_relativeMonth(-1)];
    } else {
        titleEl.textContent = 'Seleccioná los meses adelantados';
        months = [_mi_relativeMonth(1), _mi_relativeMonth(2)];
    }

    // Renderizar checkboxes — bloqueados si ya tienen factura
    listEl.innerHTML = months.map(month => {
        const exists = _mi_monthExists(_mi_playerId, month);
        const label  = _mi_formatMonth(month);
        if (exists) {
            return `
                <div class="flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-600 opacity-50 cursor-not-allowed select-none">
                    <div class="w-5 h-5 rounded border-2 border-gray-300 flex-shrink-0"></div>
                    <div>
                        <p class="text-sm text-gray-400 line-through">${label}</p>
                        <p class="text-xs text-gray-400">Ya tiene factura</p>
                    </div>
                </div>
            `;
        }
        return `
            <label id="_miLabel_${month}" class="flex items-center gap-3 p-3 rounded-xl border-2 border-gray-200 dark:border-gray-600 cursor-pointer transition-all">
                <input type="checkbox" value="${month}"
                    onchange="_mi_toggleMonth('${month}', this.checked)"
                    class="w-4 h-4 accent-teal-600 flex-shrink-0">
                <span class="text-sm text-gray-800 dark:text-white">${label}</span>
            </label>
        `;
    }).join('');

    btnEl.disabled = true;
}

// Marcar/desmarcar mes y actualizar estilo del label
function _mi_toggleMonth(month, checked) {
    if (checked) {
        if (!_mi_selectedMonths.includes(month)) _mi_selectedMonths.push(month);
    } else {
        _mi_selectedMonths = _mi_selectedMonths.filter(m => m !== month);
    }

    // Resaltar label del mes seleccionado
    const label = document.getElementById(`_miLabel_${month}`);
    if (label) {
        label.classList.toggle('border-teal-500', checked);
        label.classList.toggle('bg-teal-50',      checked);
        label.classList.toggle('dark:bg-teal-900/20', checked);
    }

    document.getElementById('_miConfirmBtn').disabled = _mi_selectedMonths.length === 0;
}

// ========================================
// DESCUENTO — toggle % / $ y preview
// ========================================
let _mi_discountType = 'pct'; // 'pct' | 'fixed'

function _mi_setDiscountType(type) {
    _mi_discountType = type;
    const pctBtn   = document.getElementById('_miDiscTypePct');
    const fixedBtn = document.getElementById('_miDiscTypeFixed');
    if (!pctBtn || !fixedBtn) return;
    pctBtn.className   = type === 'pct'
        ? 'px-3 py-2 text-sm font-bold bg-teal-600 text-white transition-colors'
        : 'px-3 py-2 text-sm font-bold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors';
    fixedBtn.className = type === 'fixed'
        ? 'px-3 py-2 text-sm font-bold bg-teal-600 text-white transition-colors'
        : 'px-3 py-2 text-sm font-bold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors';
    _mi_updateDiscountPreview();
}

function _mi_updateDiscountPreview() {
    const amount      = parseFloat(document.getElementById('_miAmount')?.value) || 0;
    const discVal     = parseFloat(document.getElementById('_miDiscount')?.value) || 0;
    const previewEl   = document.getElementById('_miDiscountPreview');
    if (!previewEl) return;

    if (discVal <= 0 || amount <= 0) { previewEl.classList.add('hidden'); return; }

    const discAmount  = _mi_discountType === 'pct'
        ? (amount * discVal / 100)
        : discVal;
    const finalAmount = Math.max(0, amount - discAmount);

    previewEl.textContent = `Descuento: -${formatCurrency(discAmount)} → Total: ${formatCurrency(finalAmount)}`;
    previewEl.classList.remove('hidden');
}

// Calcula el descuento en $ a partir de los campos del form
function _mi_calcDiscount(amount) {
    const discVal = parseFloat(document.getElementById('_miDiscount')?.value) || 0;
    if (discVal <= 0) return 0;
    return _mi_discountType === 'pct'
        ? Math.round(amount * discVal / 100 * 100) / 100
        : discVal;
}

// ========================================
// CONFIRMAR Y GENERAR FACTURAS
// ========================================
async function _mi_confirm() {
    if (_mi_selectedMonths.length === 0) return;

    const btn = document.getElementById('_miConfirmBtn');
    btn.disabled    = true;
    btn.textContent = 'Generando...';

    const player = getPlayerById(_mi_playerId);
    if (!player) {
        showToast('❌ Jugador no encontrado');
        closeMultiInvoiceModal();
        return;
    }

    // Leer los valores ingresados por el admin
    const amount         = parseFloat(document.getElementById('_miAmount')?.value) || 0;
    const paidDate       = document.getElementById('_miPaidDate')?.value || getCurrentDate();
    const method         = document.getElementById('_miMethod')?.value || 'Efectivo';
    const discountAmount = _mi_calcDiscount(amount);
    const finalAmount    = Math.max(0, amount - discountAmount);
    const discountReason = document.getElementById('_miDiscountReason')?.value.trim() || '';
    const notes          = document.getElementById('_miNotes')?.value.trim() || '';
    const today          = getCurrentDate();

    // Ordenar cronológicamente para que los números de factura queden en orden
    const sortedMonths = [..._mi_selectedMonths].sort();

    const createdIds  = [];
    const skippedList = [];

    // Generar UNA POR UNA — nunca en paralelo
    for (const billingMonth of sortedMonths) {
        // Doble verificación antes de escribir
        if (_mi_monthExists(_mi_playerId, billingMonth)) {
            skippedList.push(billingMonth);
            continue;
        }

        try {
            // Número de factura con transacción atómica (nunca duplicado)
            const invoiceNumber = await getNextInvoiceNumberFromFirebase();

            const newPayment = {
                id:            generateId(),
                playerId:      _mi_playerId,
                type:          'Mensualidad',
                concept:       `Mensualidad ${_mi_formatMonth(billingMonth)}`,
                amount:        amount,
                dueDate:       _mi_lastDayOfMonth(billingMonth),
                status:        'Pagado',
                paidDate:      paidDate,
                method:        method,
                invoiceNumber:  invoiceNumber,
                billingMonth:   billingMonth,
                discount:       discountAmount || null,
                discountType:   discountAmount ? _mi_discountType : null,
                discountReason: discountReason || null,
                finalAmount:    discountAmount ? finalAmount : amount,
                notes:          notes || null,
                createdAt:      today,
                createdBy:      getAuditInfo()
            };

            savePayment(newPayment);
            createdIds.push(newPayment.id);

        } catch (err) {
            console.error('❌ Error generando factura para', billingMonth, err);
            showToast(`❌ Error al generar ${_mi_formatMonth(billingMonth)}`);
        }
    }

    closeMultiInvoiceModal();
    renderPayments();
    updateDashboard();
    updateNotifications();

    if (createdIds.length === 0) {
        showToast('⚠️ No se generaron facturas (todas ya existen)');
        return;
    }

    if (skippedList.length > 0) {
        showToast(`⚠️ ${skippedList.length} mes(es) omitido(s) — ya tenían factura`);
    }

    // Mostrar modal de WA/PDF según cantidad generada
    setTimeout(() => {
        if (createdIds.length === 1) {
            // 1 factura → flujo existente sin ningún cambio
            mostrarOpcionWAPayment(createdIds[0]);
        } else {
            // Varias → modal agrupado nuevo
            _mi_showMultiWAModal(createdIds, player);
        }
    }, 400);
}

// ========================================
// MODAL WA AGRUPADO (2+ facturas)
// ========================================
function _mi_showMultiWAModal(paymentIds, player) {
    const settings  = getSchoolSettings();
    const clubColor = settings?.primaryColor || '#0d9488';
    const tieneWA   = !!(player?.phone && player.phone.trim() !== '');
    const payments  = paymentIds.map(id => getPaymentById(id)).filter(Boolean);
    const total     = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const curMonth  = _mi_currentMonth();

    document.getElementById('_miWAOverlay')?.remove();

    // Icono WA reutilizado
    const waIcon = `<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>`;

    const idsCsv = paymentIds.join(',');

    const facturasList = payments.map(p => {
        const tipo = !p.billingMonth ? '' :
                     p.billingMonth < curMonth ? ' · ⏪ Vencida' :
                     p.billingMonth > curMonth ? ' · ⏩ Adelantada' : ' · 📅 Mes actual';
        return `
            <div class="flex justify-between items-start py-1.5 border-b border-gray-100 dark:border-gray-700 last:border-0">
                <div>
                    <p class="text-xs font-mono font-medium text-gray-700 dark:text-gray-200">${p.invoiceNumber}</p>
                    <p class="text-xs text-gray-400">${p.billingMonth ? _mi_formatMonth(p.billingMonth) : p.concept}${tipo}</p>
                </div>
                <span class="text-xs font-bold text-gray-800 dark:text-white ml-2">${formatCurrency(p.amount)}</span>
            </div>
        `;
    }).join('');

    const overlay = document.createElement('div');
    overlay.id = '_miWAOverlay';
    overlay.className = 'fixed inset-0 bg-black/60 z-[300] flex items-center justify-center p-4';

    overlay.innerHTML = `
        <div class="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-xs shadow-2xl overflow-hidden">
            <!-- Header -->
            <div style="background:${clubColor}" class="px-5 py-4 text-white">
                <div class="flex items-center gap-3">
                    <div class="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
                        </svg>
                    </div>
                    <div>
                        <p class="font-bold text-sm">¡${payments.length} facturas generadas!</p>
                        <p class="text-xs text-white/70">${player.name}</p>
                    </div>
                </div>
            </div>

            <!-- Detalle -->
            <div class="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                <p class="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Detalle</p>
                ${facturasList}
                <div class="flex justify-between items-center pt-2 mt-1">
                    <span class="text-xs font-bold text-gray-600 dark:text-gray-300">TOTAL</span>
                    <span class="font-bold text-sm" style="color:${clubColor}">${formatCurrency(total)}</span>
                </div>
            </div>

            <!-- Pregunta WA -->
            ${tieneWA ? `
            <div class="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                <p class="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-0.5">¿Enviar resumen por WhatsApp?</p>
                <p class="text-xs text-gray-400">${player.name} · ${player.phone}</p>
                <p class="text-xs text-gray-400 mt-0.5">Los PDFs se descargarán automáticamente</p>
            </div>` : ''}

            <!-- Botones -->
            <div class="p-4 space-y-2">
                ${tieneWA ? `
                <button onclick="_mi_sendWA('${idsCsv}')"
                    class="w-full bg-green-500 hover:bg-green-600 active:scale-95 text-white py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2">
                    ${waIcon}
                    Sí, enviar resumen por WhatsApp
                </button>` : ''}

                <button onclick="_mi_downloadPDFs('${idsCsv}')"
                    style="background:${clubColor}"
                    class="w-full active:scale-95 text-white py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                    </svg>
                    Solo descargar PDFs
                </button>

                <button onclick="document.getElementById('_miWAOverlay').remove()"
                    class="w-full text-gray-500 dark:text-gray-400 py-2 text-sm hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
                    Cerrar sin descargar
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);
}

// ========================================
// ENVIAR WA AGRUPADO
// ========================================
function _mi_sendWA(idsCsv) {
    const paymentIds = idsCsv.split(',');
    const payments   = paymentIds.map(id => getPaymentById(id)).filter(Boolean);
    if (payments.length === 0) return;

    const player = getPlayerById(payments[0].playerId);
    if (!player?.phone) {
        showToast('❌ Jugador sin número de WhatsApp');
        return;
    }

    const settings = getSchoolSettings();
    const curMonth = _mi_currentMonth();

    const lineas = payments.map(p => {
        const tipo = !p.billingMonth ? '' :
                     p.billingMonth < curMonth ? ' — _VENCIDA_' :
                     p.billingMonth > curMonth ? ' — _ADELANTADA_' : ' — _MES ACTUAL_';
        // Mostrar monto original y final si hay descuento
        const montoStr = p.discount
            ? `${formatCurrency(p.amount)} → *${formatCurrency(p.finalAmount)}*`
            : formatCurrency(p.amount);
        return `📄 *${p.invoiceNumber}* | ${p.billingMonth ? _mi_formatMonth(p.billingMonth) : p.concept} | ${montoStr}${tipo}`;
    }).join('\n');

    // Totales con/sin descuento
    const totalBruto    = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const totalFinal    = payments.reduce((sum, p) => sum + (p.finalAmount || p.amount || 0), 0);
    const totalDescuento = totalBruto - totalFinal;

    let docLine = '';
    if (player.documentType && player.documentNumber) {
        docLine = `\n🪪 *Documento:* ${player.documentType} ${player.documentNumber}`;
    }

    // Líneas de descuento y observación (solo si aplican)
    const descLines = totalDescuento > 0
        ? [`🏷️ *Descuento:* -${formatCurrency(totalDescuento)}${payments[0].discountReason ? ` (${payments[0].discountReason})` : ''}`,
           `💰 *TOTAL A PAGAR: ${formatCurrency(totalFinal)}*`]
        : [`💰 *TOTAL: ${formatCurrency(totalFinal)}*`];

    const notesLines = payments[0].notes
        ? [`📝 *Observación:* ${payments[0].notes}`]
        : [];

    const message = [
        `🏆 *${settings.name || 'Club'}*`,
        `🧾 RESUMEN DE FACTURAS`,
        ``,
        `👤 *Jugador:* ${player.name}`,
        `⚽ *Categoría:* ${player.category || 'N/A'}${docLine}`,
        `📅 *Fecha:* ${formatDate(getCurrentDate())}`,
        ``,
        lineas,
        ``,
        ...descLines,
        ...notesLines,
        ``,
        `✅ Todos los pagos fueron registrados correctamente.`,
        `Gracias por confiar en nosotros. ⚽`,
        ``,
        `_${settings.name || 'Club'}_`,
        settings.phone || ''
    ].join('\n').trim();

    // 1) Abrir WhatsApp PRIMERO — debe ser sincrónico con el gesto del usuario
    //    para que Android, iOS y PC no lo bloqueen como popup
    openWhatsApp(player.phone, message);

    // 2) Cerrar overlay y descargar PDFs después (no necesitan gesto directo)
    document.getElementById('_miWAOverlay')?.remove();
    setTimeout(() => _mi_downloadPDFs(idsCsv), 400);

    showToast('✅ Abriendo WhatsApp...');
}

// ========================================
// DESCARGAR PDFs UNO POR UNO
// ========================================
function _mi_downloadPDFs(idsCsv) {
    const paymentIds = idsCsv.split(',');
    document.getElementById('_miWAOverlay')?.remove();

    // Descargar con delay entre cada uno para no bloquear el navegador
    paymentIds.forEach((id, index) => {
        setTimeout(() => {
            if (typeof generateInvoicePDF === 'function') {
                generateInvoicePDF(id, true);
            }
        }, index * 700);
    });

    showToast(`✅ Descargando ${paymentIds.length} PDF(s)...`);
}

// ========================================
// MENSAJE "AL DÍA"
// ========================================
function sendUpToDateWhatsApp(playerId) {
    const player = getPlayerById(playerId);
    if (!player) { showToast('❌ Jugador no encontrado'); return; }

    if (!player.phone?.trim()) {
        showToast('❌ Este jugador no tiene número de WhatsApp');
        return;
    }

    const settings = getSchoolSettings();
    const curMonth  = _mi_currentMonth();

    const message = [
        `🏆 *${settings.name || 'Club'}*`,
        `✅ PAGO AL DÍA`,
        ``,
        `Estimado(a) acudiente de *${player.name}*,`,
        ``,
        `Nos complace informarle que el jugador se encuentra`,
        `*al día* con todos sus pagos de *${_mi_formatMonth(curMonth)}*. 🙌`,
        ``,
        `¡Muchas gracias por su puntualidad y compromiso!`,
        ``,
        `_${settings.name || 'Club'}_`,
        settings.phone || ''
    ].join('\n').trim();

    // Siempre confirm modal para consistencia con el resto
    openWhatsAppWithConfirm(player.phone, message, player.name);
    showToast('✅ Preparando WhatsApp...');
}

// ========================================
// EXPORTAR FUNCIONES GLOBALES
// ========================================
window.showMultiInvoicePlayerPicker = showMultiInvoicePlayerPicker;
window.showMultiInvoiceModal        = showMultiInvoiceModal;
window.closeMultiInvoiceModal       = closeMultiInvoiceModal;
window.sendUpToDateWhatsApp         = sendUpToDateWhatsApp;
// Las funciones internas (_mi_*) se usan desde el HTML generado dinámicamente
window._mi_setDiscountType      = _mi_setDiscountType;
window._mi_updateDiscountPreview = _mi_updateDiscountPreview;
window._mi_filterPlayers        = _mi_filterPlayers;
window._mi_selectPlayer    = _mi_selectPlayer;
window._mi_goToStep2       = _mi_goToStep2;
window._mi_backToStep1     = _mi_backToStep1;
window._mi_toggleMonth     = _mi_toggleMonth;
window._mi_confirm         = _mi_confirm;
window._mi_sendWA          = _mi_sendWA;
window._mi_downloadPDFs    = _mi_downloadPDFs;

console.log('✅ multi-invoice.js cargado');
