// ========================================
// GESTIÓN DE INGRESOS DE TERCEROS (OTROS INGRESOS)
// Rifas, Productos, Torneos, Integraciones, etc.
// ========================================

console.log('📦 Cargando third-party-income.js...');

// ========================================
// CATEGORÍAS DE OTROS INGRESOS
// ========================================
const THIRD_PARTY_CATEGORIES = [
  'Mensualidades',
  'Uniformes',
  'Rifas',
  'Productos',
  'Torneo',
  'Integración',
  'Festivales',
  'Otros'
];

// ========================================
// MODAL - MOSTRAR Y CERRAR
// ========================================

function showAddThirdPartyIncomeModal() {
  console.log('🔵 Abriendo modal de otros ingresos');
  
  const form = document.getElementById('thirdPartyIncomeForm');
  if (form) form.reset();
  
  const incomeId = document.getElementById('thirdPartyIncomeId');
  if (incomeId) incomeId.value = '';
  
  // Tipo persona por defecto
  const personRadio = document.getElementById('contributorTypePerson');
  if (personRadio) personRadio.checked = true;
  
  // Fecha actual
  const dateInput = document.getElementById('thirdPartyIncomeDate');
  if (dateInput) dateInput.value = getCurrentDate();
  
  // Cargar historial de aportantes
  loadContributorsDatalist();
  
  const modal = document.getElementById('thirdPartyIncomeModal');
  if (modal) {
    modal.classList.remove('hidden');
  } else {
    console.error('❌ Modal thirdPartyIncomeModal no encontrado');
    showToast('❌ Error: Modal no encontrado');
    return;
  }
  
  if (typeof lucide !== 'undefined') {
    setTimeout(() => lucide.createIcons(), 100);
  }
}

function closeThirdPartyIncomeModal() {
  const modal = document.getElementById('thirdPartyIncomeModal');
  if (modal) modal.classList.add('hidden');
}

// ========================================
// HISTORIAL DE APORTANTES (AUTOCOMPLETAR)
// ========================================

function getUniqueContributors() {
  const incomes = getThirdPartyIncomes();
  const contributors = {};
  
  incomes.forEach(income => {
    const key = income.contributorName?.toLowerCase();
    if (key && !contributors[key]) {
      contributors[key] = {
        name: income.contributorName,
        phone: income.contributorPhone || '',
        email: income.contributorEmail || '',
        document: income.contributorDocument || '',
        address: income.contributorAddress || '',
        type: income.contributorType || 'person'
      };
    }
  });
  
  return Object.values(contributors);
}

function loadContributorsDatalist() {
  const datalist = document.getElementById('contributorsList');
  if (!datalist) return;
  
  const contributors = getUniqueContributors();
  datalist.innerHTML = contributors.map(c => `<option value="${c.name}">`).join('');
}

function autoFillContributor() {
  const nameInput = document.getElementById('thirdPartyContributorName');
  if (!nameInput) return;
  
  const name = nameInput.value;
  const contributors = getUniqueContributors();
  const contributor = contributors.find(c => c.name.toLowerCase() === name.toLowerCase());
  
  if (contributor) {
    const phoneInput = document.getElementById('thirdPartyContributorPhone');
    const emailInput = document.getElementById('thirdPartyContributorEmail');
    const documentInput = document.getElementById('thirdPartyContributorDocument');
    const addressInput = document.getElementById('thirdPartyContributorAddress');
    
    if (phoneInput && contributor.phone) phoneInput.value = contributor.phone;
    if (emailInput && contributor.email) emailInput.value = contributor.email;
    if (documentInput && contributor.document) documentInput.value = contributor.document;
    if (addressInput && contributor.address) addressInput.value = contributor.address;
    
    if (contributor.type === 'company') {
      document.getElementById('contributorTypeCompany').checked = true;
    } else {
      document.getElementById('contributorTypePerson').checked = true;
    }
    
    showToast('✅ Datos cargados del historial');
  }
}

// ========================================
// AUTO-COMPLETAR CONCEPTO
// ========================================

function autoFillThirdPartyConcept() {
  const categorySelect = document.getElementById('thirdPartyIncomeCategory');
  const conceptInput = document.getElementById('thirdPartyIncomeConcept');
  
  if (!categorySelect || !conceptInput) return;
  
  const templates = {
    'Mensualidades': 'Pago de mensualidad',
    'Uniformes': 'Venta de uniforme',
    'Rifas': 'Boleta de rifa',
    'Productos': 'Venta de productos',
    'Torneo': 'Inscripción a torneo',
    'Integración': 'Cuota de integración',
    'Festivales': 'Aporte para festival',
    'Otros': ''
  };
  
  conceptInput.value = templates[categorySelect.value] || '';
}

// ========================================
// GUARDAR INGRESO
// ========================================

function saveThirdPartyIncomeFromForm() {
  console.log('💾 Guardando otro ingreso...');
  
  const incomeId = document.getElementById('thirdPartyIncomeId')?.value;
  const contributorTypeRadio = document.querySelector('input[name="contributorType"]:checked');
  
  if (!contributorTypeRadio) {
    showToast('❌ Selecciona tipo de aportante');
    return;
  }
  
  const contributorType = contributorTypeRadio.value;
  const contributorName = document.getElementById('thirdPartyContributorName')?.value;
  const contributorPhone = document.getElementById('thirdPartyContributorPhone')?.value;
  const contributorEmail = document.getElementById('thirdPartyContributorEmail')?.value || '';
  const contributorDocument = document.getElementById('thirdPartyContributorDocument')?.value || '';
  const contributorAddress = document.getElementById('thirdPartyContributorAddress')?.value || '';
  
  const category = document.getElementById('thirdPartyIncomeCategory')?.value;
  const concept = document.getElementById('thirdPartyIncomeConcept')?.value;
  const amount = parseFloat(document.getElementById('thirdPartyIncomeAmount')?.value);
  const date = document.getElementById('thirdPartyIncomeDate')?.value;
  const method = document.getElementById('thirdPartyIncomeMethod')?.value;
  const notes = document.getElementById('thirdPartyIncomeNotes')?.value || '';
  
  // Validaciones
  if (!contributorName) {
    showToast('❌ Ingresa el nombre del aportante');
    return;
  }
  
  if (!category || !concept || !amount || !date || !method) {
    showToast('❌ Completa todos los campos obligatorios');
    return;
  }
  
  const invoiceNumber = getNextInvoiceNumber();
  
  const incomeData = {
    id: incomeId || generateId(),
    type: 'third-party-income',
    contributorType,
    contributorName,
    contributorPhone: contributorPhone ? normalizePhone(contributorPhone) : '',
    contributorEmail,
    contributorDocument,
    contributorAddress,
    category,
    concept,
    amount,
    date,
    method,
    notes,
    invoiceNumber,
    createdAt: getCurrentDate()
  };
  
  if (incomeId) {
    incomeData.editedBy = getAuditInfo();
    updateThirdPartyIncome(incomeId, incomeData);
    showToast('✅ Ingreso actualizado');
  } else {
    incomeData.createdBy = getAuditInfo();
    saveThirdPartyIncome(incomeData);
    showToast('✅ Ingreso registrado');
    
    // Auto PDF + WhatsApp
    setTimeout(() => {
      generateThirdPartyIncomePDFWithWhatsApp(incomeData.id);
    }, 500);
  }
  
  closeThirdPartyIncomeModal();
  renderPayments();
  
  if (typeof updateDashboard === 'function') updateDashboard();
}

// ========================================
// EDITAR INGRESO
// ========================================

function editThirdPartyIncome(incomeId) {
  const income = getThirdPartyIncomeById(incomeId);
  if (!income) {
    showToast('❌ Ingreso no encontrado');
    return;
  }
  
  document.getElementById('thirdPartyIncomeId').value = income.id;
  document.getElementById('thirdPartyContributorName').value = income.contributorName || '';
  document.getElementById('thirdPartyContributorPhone').value = income.contributorPhone || '';
  document.getElementById('thirdPartyContributorEmail').value = income.contributorEmail || '';
  document.getElementById('thirdPartyContributorDocument').value = income.contributorDocument || '';
  document.getElementById('thirdPartyContributorAddress').value = income.contributorAddress || '';
  document.getElementById('thirdPartyIncomeCategory').value = income.category || '';
  document.getElementById('thirdPartyIncomeConcept').value = income.concept || '';
  document.getElementById('thirdPartyIncomeAmount').value = income.amount || '';
  document.getElementById('thirdPartyIncomeDate').value = income.date || '';
  document.getElementById('thirdPartyIncomeMethod').value = income.method || '';
  document.getElementById('thirdPartyIncomeNotes').value = income.notes || '';
  
  if (income.contributorType === 'company') {
    document.getElementById('contributorTypeCompany').checked = true;
  } else {
    document.getElementById('contributorTypePerson').checked = true;
  }
  
  document.getElementById('thirdPartyIncomeModal').classList.remove('hidden');
  lucide.createIcons();
}

// ========================================
// ELIMINAR INGRESO
// ========================================

function deleteThirdPartyIncomeConfirm(incomeId) {
  if (confirmAction('¿Estás seguro de eliminar este ingreso?')) {
    deleteThirdPartyIncome(incomeId);
    showToast('✅ Ingreso eliminado');
    renderPayments();
    if (typeof updateDashboard === 'function') updateDashboard();
  }
}

// ========================================
// RENDERIZAR LISTA
// ========================================

function renderThirdPartyIncomes(incomes) {
  const container = document.getElementById('thirdPartyIncomesContent');
  
  if (!container) {
    console.warn('⚠️ Container thirdPartyIncomesContent no encontrado');
    return;
  }
  
  if (!incomes || incomes.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">💰</div>
        <p class="text-gray-500 dark:text-gray-400">No hay otros ingresos registrados</p>
        <p class="text-sm text-gray-400 dark:text-gray-500 mt-2">Usa el botón "Registrar Pago" → "Otro Ingreso"</p>
      </div>
    `;
    return;
  }
  
  const sorted = sortBy([...incomes], 'date', 'desc');
  container.innerHTML = sorted.map(income => renderThirdPartyIncomeCard(income)).join('');
  lucide.createIcons();
}

function renderThirdPartyIncomeCard(income) {
  const categoryIcons = {
    'Mensualidades': '📅',
    'Uniformes': '👕',
    'Rifas': '🎟️',
    'Productos': '📦',
    'Torneo': '🏆',
    'Integración': '🎉',
    'Festivales': '🎊',
    'Otros': '💵'
  };
  
  const icon = categoryIcons[income.category] || '💵';
  const contributorIcon = income.contributorType === 'company' ? '🏢' : '👤';
  
  return `
    <div class="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border-l-4 border-purple-500 animate-slide-in">
      <div class="flex items-start justify-between mb-3">
        <div class="flex items-center gap-3">
          <div class="text-3xl">${icon}</div>
          <div>
            <h4 class="font-bold text-gray-800 dark:text-white">${income.concept}</h4>
            <p class="text-sm text-gray-500 dark:text-gray-400">${contributorIcon} ${income.contributorName}</p>
          </div>
        </div>
        <span class="px-2 py-1 text-xs rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300">
          ${income.category}
        </span>
      </div>
      
      <div class="grid grid-cols-2 gap-2 text-sm mb-3">
        <div>
          <span class="text-gray-500 dark:text-gray-400">Monto:</span>
          <span class="font-bold text-green-600 dark:text-green-400">${formatCurrency(income.amount)}</span>
        </div>
        <div>
          <span class="text-gray-500 dark:text-gray-400">Fecha:</span>
          <span class="text-gray-800 dark:text-white">${formatDate(income.date)}</span>
        </div>
        <div>
          <span class="text-gray-500 dark:text-gray-400">Método:</span>
          <span class="text-gray-800 dark:text-white">${income.method}</span>
        </div>
        <div>
          <span class="text-gray-500 dark:text-gray-400">Factura:</span>
          <span class="text-gray-800 dark:text-white">${income.invoiceNumber || 'N/A'}</span>
        </div>
      </div>
      
      ${income.notes ? `<div class="text-sm text-gray-500 dark:text-gray-400 mb-3 italic">📝 ${income.notes}</div>` : ''}
      
      <div class="flex gap-2">
        <button onclick="generateThirdPartyIncomePDF('${income.id}')" 
          class="flex-1 bg-gray-800 hover:bg-gray-900 dark:bg-gray-700 dark:hover:bg-gray-600 text-white text-sm py-2 rounded-lg flex items-center justify-center gap-1">
          <i data-lucide="file-text" class="w-4 h-4"></i>
          PDF
        </button>
        <button onclick="sendThirdPartyIncomeWhatsApp('${income.id}')" 
          class="flex-1 bg-green-600 hover:bg-green-700 text-white text-sm py-2 rounded-lg flex items-center justify-center gap-1">
          <i data-lucide="message-circle" class="w-4 h-4"></i>
          WhatsApp
        </button>
        <button onclick="editThirdPartyIncome('${income.id}')" 
          class="bg-blue-600 hover:bg-blue-700 text-white text-sm py-2 px-3 rounded-lg" title="Editar">
          <i data-lucide="edit" class="w-4 h-4"></i>
        </button>
        <button onclick="deleteThirdPartyIncomeConfirm('${income.id}')" 
          class="bg-red-600 hover:bg-red-700 text-white text-sm py-2 px-3 rounded-lg" title="Eliminar">
          <i data-lucide="trash-2" class="w-4 h-4"></i>
        </button>
      </div>
    </div>
  `;
}

// ========================================
// GENERAR PDF
// ========================================

function generateThirdPartyIncomePDF(incomeId, autoDownload = true) {
  const income = getThirdPartyIncomeById(incomeId);
  if (!income) {
    showToast('❌ Ingreso no encontrado');
    return null;
  }
  
  const settings = getSchoolSettings();
  
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    const primaryColor = [139, 92, 246]; // Púrpura
    const textColor = [31, 41, 55];
    
    // Logo
    try {
      if (settings.logo && settings.logo.startsWith('data:image')) {
        doc.addImage(settings.logo, 'PNG', 15, 15, 30, 30);
      }
    } catch (e) {}
    
    // Encabezado
    doc.setFontSize(20);
    doc.setTextColor(...primaryColor);
    doc.setFont(undefined, 'bold');
    doc.text(settings.name || 'MI CLUB', 50, 25);
    
    doc.setFontSize(10);
    doc.setTextColor(...textColor);
    doc.setFont(undefined, 'normal');
    if (settings.email) doc.text(settings.email, 50, 32);
    if (settings.phone) doc.text(settings.phone, 50, 37);
    if (settings.address) doc.text(settings.address, 50, 42);
    
    // Título
    doc.setFontSize(24);
    doc.setTextColor(...primaryColor);
    doc.setFont(undefined, 'bold');
    doc.text('RECIBO', 150, 25);
    
    doc.setFontSize(12);
    doc.setTextColor(...textColor);
    doc.text(income.invoiceNumber || 'N/A', 150, 35);
    doc.setFontSize(10);
    doc.text(`Fecha: ${formatDate(income.date)}`, 150, 42);
    
    // Línea
    doc.setDrawColor(...primaryColor);
    doc.setLineWidth(0.5);
    doc.line(15, 50, 195, 50);
    
    // Datos del aportante
    doc.setFontSize(12);
    doc.setTextColor(...primaryColor);
    doc.setFont(undefined, 'bold');
    doc.text('DATOS DEL APORTANTE', 15, 60);
    
    doc.setFontSize(10);
    doc.setTextColor(...textColor);
    doc.setFont(undefined, 'normal');
    
    let y = 68;
    doc.text(`Tipo: ${income.contributorType === 'company' ? 'Empresa' : 'Persona'}`, 15, y); y += 6;
    doc.text(`Nombre: ${income.contributorName}`, 15, y); y += 6;
    if (income.contributorDocument) { doc.text(`Documento/NIT: ${income.contributorDocument}`, 15, y); y += 6; }
    if (income.contributorPhone) { doc.text(`Teléfono: ${income.contributorPhone}`, 15, y); y += 6; }
    if (income.contributorEmail) { doc.text(`Email: ${income.contributorEmail}`, 15, y); y += 6; }
    
    y += 5;
    
    // Detalle
    doc.setFontSize(12);
    doc.setTextColor(...primaryColor);
    doc.setFont(undefined, 'bold');
    doc.text('DETALLE DEL INGRESO', 15, y);
    y += 10;
    
    // Tabla
    doc.setFillColor(240, 240, 240);
    doc.rect(15, y, 180, 8, 'F');
    doc.setFontSize(9);
    doc.setTextColor(...textColor);
    doc.setFont(undefined, 'bold');
    doc.text('Categoría', 18, y + 5.5);
    doc.text('Concepto', 55, y + 5.5);
    doc.text('Método', 120, y + 5.5);
    doc.text('Monto', 160, y + 5.5);
    y += 8;
    
    doc.setFont(undefined, 'normal');
    doc.text(income.category, 18, y + 5.5);
    doc.text(income.concept.substring(0, 30), 55, y + 5.5);
    doc.text(income.method, 120, y + 5.5);
    doc.text(formatCurrency(income.amount), 160, y + 5.5);
    y += 12;
    
    // Total
    doc.setFillColor(...primaryColor);
    doc.rect(130, y, 65, 10, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont(undefined, 'bold');
    doc.setFontSize(11);
    doc.text('TOTAL:', 135, y + 7);
    doc.text(formatCurrency(income.amount), 165, y + 7);
    y += 20;
    
    // Notas
    if (income.notes) {
      doc.setTextColor(...textColor);
      doc.setFontSize(9);
      doc.setFont(undefined, 'italic');
      doc.text(`Notas: ${income.notes}`, 15, y);
      y += 10;
    }
    
    // Agradecimiento
    doc.setFontSize(10);
    doc.setTextColor(...primaryColor);
    doc.setFont(undefined, 'bold');
    doc.text('¡Gracias por tu aporte!', 105, y + 15, { align: 'center' });
    
    // Firma
    if (typeof addSignatureToDocument === 'function') {
      addSignatureToDocument(doc, 230);
    }
    
    // Pie
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Generado el ${formatDate(getCurrentDate())} - ${settings.name || 'MI CLUB'}`, 105, 285, { align: 'center' });
    
    if (autoDownload) {
      doc.save(`Recibo-${income.invoiceNumber || income.id}.pdf`);
      showToast('✅ PDF generado');
    }
    
    return doc;
  } catch (error) {
    console.error('❌ Error al generar PDF:', error);
    showToast('❌ Error al generar PDF');
    return null;
  }
}

function generateThirdPartyIncomePDFWithWhatsApp(incomeId) {
  const pdfGenerated = generateThirdPartyIncomePDF(incomeId, true);
  if (!pdfGenerated) return;
  
  const income = getThirdPartyIncomeById(incomeId);
  if (!income) return;
  
  if (typeof showInvoiceProgressModal === 'function') {
    showInvoiceProgressModal(income.invoiceNumber);
  }
  
  setTimeout(() => {
    if (typeof closeInvoiceProgressModal === 'function') {
      closeInvoiceProgressModal();
    }
    
    if (income.contributorPhone && income.contributorPhone.trim() !== '') {
      sendThirdPartyIncomeWhatsApp(incomeId);
    } else {
      if (typeof showManualWhatsAppModal === 'function') {
        showManualWhatsAppModal(incomeId, 'thirdPartyIncome');
      }
    }
  }, 1500);
}

// ========================================
// WHATSAPP
// ========================================

function sendThirdPartyIncomeWhatsApp(incomeId) {
  const income = getThirdPartyIncomeById(incomeId);
  if (!income) {
    showToast('❌ Ingreso no encontrado');
    return;
  }
  
  const settings = getSchoolSettings();
  
  const message = `¡Hola ${income.contributorName}! 👋\n\n` +
    `Desde *${settings.name || 'MI CLUB'}* te enviamos tu recibo:\n\n` +
    `📄 Recibo: ${income.invoiceNumber}\n` +
    `💵 Monto: ${formatCurrency(income.amount)}\n` +
    `📋 Concepto: ${income.concept}\n` +
    `🏷️ Categoría: ${income.category}\n` +
    `📅 Fecha: ${formatDate(income.date)}\n\n` +
    `¡Gracias por tu aporte! ⚽🙏`;
  
  const phone = normalizePhone(income.contributorPhone);
  const url = `https://wa.me/${phone.replace('+', '')}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank');
  showToast('✅ Abriendo WhatsApp...');
}

function sendThirdPartyIncomeWhatsAppManual(incomeId, phone) {
  const income = getThirdPartyIncomeById(incomeId);
  if (!income) {
    showToast('❌ Ingreso no encontrado');
    return;
  }
  
  const settings = getSchoolSettings();
  
  const message = `¡Hola ${income.contributorName}! 👋\n\n` +
    `Desde *${settings.name || 'MI CLUB'}* te enviamos tu recibo:\n\n` +
    `📄 Recibo: ${income.invoiceNumber}\n` +
    `💵 Monto: ${formatCurrency(income.amount)}\n` +
    `📋 Concepto: ${income.concept}\n` +
    `📅 Fecha: ${formatDate(income.date)}\n\n` +
    `¡Gracias! ⚽🙏`;
  
  const normalizedPhone = normalizePhone(phone);
  const url = `https://wa.me/${normalizedPhone.replace('+', '')}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank');
  showToast('✅ Abriendo WhatsApp...');
}

// ========================================
// FUNCIONES GLOBALES
// ========================================
window.showAddThirdPartyIncomeModal = showAddThirdPartyIncomeModal;
window.closeThirdPartyIncomeModal = closeThirdPartyIncomeModal;
window.saveThirdPartyIncomeFromForm = saveThirdPartyIncomeFromForm;
window.editThirdPartyIncome = editThirdPartyIncome;
window.deleteThirdPartyIncomeConfirm = deleteThirdPartyIncomeConfirm;
window.renderThirdPartyIncomes = renderThirdPartyIncomes;
window.generateThirdPartyIncomePDF = generateThirdPartyIncomePDF;
window.generateThirdPartyIncomePDFWithWhatsApp = generateThirdPartyIncomePDFWithWhatsApp;
window.autoFillContributor = autoFillContributor;
window.autoFillThirdPartyConcept = autoFillThirdPartyConcept;
window.sendThirdPartyIncomeWhatsApp = sendThirdPartyIncomeWhatsApp;
window.sendThirdPartyIncomeWhatsAppManual = sendThirdPartyIncomeWhatsAppManual;

console.log('✅ third-party-income.js cargado correctamente');