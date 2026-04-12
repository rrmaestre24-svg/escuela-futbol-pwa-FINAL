// ========================================
// GESTIÓN DE EGRESOS + 🆕 AUDITORÍA
// ========================================

console.log('📦 Cargando expenses.js...');

// Mostrar modal agregar egreso
function showAddExpenseModal() {
  console.log('🔵 Abriendo modal de egresos');
  
  try {
    const form = document.getElementById('expenseForm');
    if (form) {
      form.reset();
    }
    
    const expenseId = document.getElementById('expenseId');
    if (expenseId) {
      expenseId.value = '';
    }
    
    const internalRadio = document.getElementById('beneficiaryTypeInternal');
    if (internalRadio) {
      internalRadio.checked = true;
    }
    
    showBeneficiaryType('internal');
    
    // Llenar select de staff
    const users = getUsers();
    const select = document.getElementById('expenseBeneficiaryInternal');
    if (select) {
      select.innerHTML = '<option value="">Seleccionar usuario/staff...</option>' + 
        users.map(u => `<option value="${u.id}">${u.name}</option>`).join('');
    }
    
    // Establecer fecha actual
    const dateInput = document.getElementById('expenseDate');
    if (dateInput && !dateInput.value) {
      dateInput.value = getCurrentDate();
    }
    
    const modal = document.getElementById('expenseModal');
    if (modal) {
      modal.classList.remove('hidden');
      console.log('✅ Modal mostrado');
    } else {
      console.error('❌ Modal expenseModal no encontrado');
      showToast('❌ Error: Modal no encontrado');
    }
    
    // Recrear iconos
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
      setTimeout(() => lucide.createIcons(), 100);
    }
    
  } catch (error) {
    console.error('❌ Error al abrir modal:', error);
    showToast('❌ Error al abrir modal de egresos');
  }
}

// Cerrar modal egreso
function closeExpenseModal() {
  const modal = document.getElementById('expenseModal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

// Cambiar tipo de beneficiario
function showBeneficiaryType(type) {
  const internalSection = document.getElementById('internalBeneficiarySection');
  const externalSection = document.getElementById('externalBeneficiarySection');
  
  if (!internalSection || !externalSection) {
    console.warn('⚠️ Secciones de beneficiario no encontradas');
    return;
  }
  
  if (type === 'internal') {
    internalSection.classList.remove('hidden');
    externalSection.classList.add('hidden');
    
    // Limpiar campos externos
    const fieldsToReset = [
      'expenseBeneficiaryName',
      'expenseBeneficiaryPhone',
      'expenseBeneficiaryDocument',
      'expenseBeneficiaryEmail',
      'expenseBeneficiaryAddress'
    ];
    
    fieldsToReset.forEach(fieldId => {
      const field = document.getElementById(fieldId);
      if (field) field.value = '';
    });
    
  } else {
    internalSection.classList.add('hidden');
    externalSection.classList.remove('hidden');
    
    // Limpiar select interno
    const internalSelect = document.getElementById('expenseBeneficiaryInternal');
    if (internalSelect) {
      internalSelect.value = '';
    }
  }
}

// Auto-completar al cambiar categoría
const expenseCategorySelect = document.getElementById('expenseCategory');
if (expenseCategorySelect) {
  expenseCategorySelect.addEventListener('change', function() {
    const category = this.value;
    const conceptInput = document.getElementById('expenseConcept');
    
    if (!conceptInput) return;
    
    const templates = {
      'Salarios': 'Salario ' + getMonthName(new Date().getMonth()),
      'Servicios': 'Pago de servicio',
      'Materiales': 'Compra de materiales deportivos',
      'Mantenimiento': 'Mantenimiento de instalaciones',
      'Impuestos': 'Pago de impuestos',
      'Otro': ''
    };
    
    conceptInput.value = templates[category] || '';
  });
}

// 🆕 MODIFICADO: Guardar egreso (CON AUDITORÍA)
const expenseFormElement = document.getElementById('expenseForm');
if (expenseFormElement) {
  expenseFormElement.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    console.log('💾 Guardando egreso...');
    
    try {
      const expenseId = document.getElementById('expenseId').value;
      const beneficiaryTypeRadio = document.querySelector('input[name="beneficiaryType"]:checked');
      
      if (!beneficiaryTypeRadio) {
        showToast('❌ Selecciona tipo de beneficiario');
        return;
      }
      
      const beneficiaryType = beneficiaryTypeRadio.value;
      const category = document.getElementById('expenseCategory').value;
      const concept = document.getElementById('expenseConcept').value;
      const amount = parseFloat(document.getElementById('expenseAmount').value);
      const date = document.getElementById('expenseDate').value;
      const method = document.getElementById('expenseMethod').value;
      const notes = document.getElementById('expenseNotes').value || '';
      
      // Validaciones básicas
      if (!category || !concept || !amount || !date || !method) {
        showToast('❌ Completa todos los campos obligatorios');
        return;
      }
      
      let beneficiaryData = {};
      
      if (beneficiaryType === 'internal') {
        const beneficiaryId = document.getElementById('expenseBeneficiaryInternal').value;
        if (!beneficiaryId) {
          showToast('❌ Selecciona un beneficiario');
          return;
        }
        
        const user = getUsers().find(u => u.id === beneficiaryId);
        if (!user) {
          showToast('❌ Usuario no encontrado');
          return;
        }
        
        beneficiaryData = {
          beneficiaryType: 'internal',
          beneficiaryId: user.id,
          beneficiaryName: user.name,
          beneficiaryPhone: user.phone || '',
          beneficiaryEmail: user.email || ''
        };
        
      } else {
        const name = document.getElementById('expenseBeneficiaryName').value;
        if (!name) {
          showToast('❌ Ingresa el nombre del beneficiario');
          return;
        }
        
        const phone = document.getElementById('expenseBeneficiaryPhone').value;
        
        beneficiaryData = {
          beneficiaryType: 'external',
          beneficiaryName: name,
          beneficiaryPhone: phone ? normalizePhone(phone) : '',
          beneficiaryDocument: document.getElementById('expenseBeneficiaryDocument').value || '',
          beneficiaryEmail: document.getElementById('expenseBeneficiaryEmail').value || '',
          beneficiaryAddress: document.getElementById('expenseBeneficiaryAddress').value || ''
        };
      }
      
      const existingExpense = expenseId ? getExpenseById(expenseId) : null;
      const invoiceNumber = expenseId
        ? (existingExpense?.invoiceNumber || await getNextInvoiceNumber())
        : await getNextInvoiceNumber();
      
      const expenseData = {
        id: expenseId || generateId(),
        type: 'egreso',
        category,
        concept,
        amount,
        date,
        method,
        notes,
        invoiceNumber,
        createdAt: existingExpense?.createdAt || getCurrentDate(),
        ...beneficiaryData
      };
      
      console.log('💾 Datos del egreso:', expenseData);
      
      if (expenseId) {
        // 🆕 EDITAR: Agregar editedBy
        updateExpense(expenseId, {
          ...expenseData,
          createdBy: existingExpense?.createdBy || null,
          editedBy: getAuditInfo() // 🆕 AUDITORÍA
        });
        showToast('✅ Egreso actualizado');
      } else {
        // 🆕 CREAR: Agregar createdBy
        expenseData.createdBy = getAuditInfo(); // 🆕 AUDITORÍA
        
        saveExpense(expenseData);
        showToast('✅ Egreso registrado');
        
        // 🚀 AUTO-REDIRECT: Generar PDF + WhatsApp automáticamente
        setTimeout(() => {
          if (typeof generateExpenseInvoicePDFWithWhatsApp === 'function') {
            generateExpenseInvoicePDFWithWhatsApp(expenseData.id);
          }
        }, 500);
      }
      
      closeExpenseModal();
      
      // Renderizar en la vista de pagos (tab egresos)
      if (typeof renderPayments === 'function') {
        renderPayments();
      }
      
      if (typeof updateDashboard === 'function') {
        updateDashboard();
      }
      
    } catch (error) {
      console.error('❌ Error al guardar egreso:', error);
      showToast('❌ Error al guardar egreso');
    }
  });
}

// Eliminar egresos
async function deleteExpenseConfirm(expenseId) {
  if (await confirmAction('¿Estás seguro de eliminar este egreso?', {
    type: 'danger',
    title: 'Eliminar egreso',
    confirmText: 'Sí, eliminar'
  })) {
    deleteExpense(expenseId);
    showToast('✅ Egreso eliminado');
    
    // Renderizar en la vista de pagos
    if (typeof renderPayments === 'function') {
      renderPayments();
    }
    
    if (typeof updateDashboard === 'function') {
      updateDashboard();
    }
  }
}

// ========================================
// 🚀 AUTO-REDIRECT: PDF + WHATSAPP PARA EGRESOS
// ========================================

// Generar factura de egreso con flujo automático
function generateExpenseInvoicePDFWithWhatsApp(expenseId) {
  console.log('📄 Generando PDF de egreso:', expenseId);
  
  try {
    // Primero generar el PDF
    if (typeof generateExpenseInvoicePDF !== 'function') {
      console.warn('⚠️ generateExpenseInvoicePDF no está definida');
      showToast('⚠️ Función PDF no disponible');
      return;
    }
    
    const pdfGenerated = generateExpenseInvoicePDF(expenseId, true);
    
    if (!pdfGenerated) {
      console.warn('⚠️ No se pudo generar el PDF');
      return;
    }
    
    const expense = getExpenseById(expenseId);
    if (!expense) {
      console.error('❌ Egreso no encontrado');
      return;
    }
    
    // Mostrar modal informativo
    if (typeof showInvoiceProgressModal === 'function') {
      showInvoiceProgressModal(expense.invoiceNumber);
    }
    
    // Esperar 1.5 segundos y luego verificar WhatsApp
    setTimeout(() => {
      if (typeof closeInvoiceProgressModal === 'function') {
        closeInvoiceProgressModal();
      }
      
      // Verificar si tiene WhatsApp
      if (expense.beneficiaryPhone && expense.beneficiaryPhone.trim() !== '') {
        // Tiene WhatsApp → Abrir automáticamente
        if (typeof sendExpenseInvoiceWhatsApp === 'function') {
          sendExpenseInvoiceWhatsApp(expenseId);
        } else {
          console.warn('⚠️ sendExpenseInvoiceWhatsApp no disponible');
        }
      } else {
        // NO tiene WhatsApp → Pedir número manual
        if (typeof showManualWhatsAppModal === 'function') {
          showManualWhatsAppModal(expenseId, 'expense');
        } else {
          console.warn('⚠️ showManualWhatsAppModal no disponible');
        }
      }
    }, 1500);
    
  } catch (error) {
    console.error('❌ Error en generateExpenseInvoicePDFWithWhatsApp:', error);
  }
}

// Verificar que la función esté disponible globalmente
window.showAddExpenseModal = showAddExpenseModal;
window.closeExpenseModal = closeExpenseModal;
window.showBeneficiaryType = showBeneficiaryType;
window.deleteExpenseConfirm = deleteExpenseConfirm;
window.generateExpenseInvoicePDFWithWhatsApp = generateExpenseInvoicePDFWithWhatsApp;

console.log('✅ expenses.js cargado correctamente CON AUDITORÍA');
console.log('✅ showAddExpenseModal disponible:', typeof showAddExpenseModal);