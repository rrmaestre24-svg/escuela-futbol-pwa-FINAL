// ========================================
// CONTABILIDAD COMPLETA - CON EGRESOS Y OTROS INGRESOS
// 🆕 CSV MEJORADO: Factura, Fecha, Otros Ingresos
// 🆕 INCLUYE DOCUMENTO DE IDENTIDAD
// ========================================

console.log('📄 Cargando accounting.js con egresos, otros ingresos y documento de identidad...');

let accountingCharts = {};

// Escape HTML para evitar XSS en texto ingresado por el usuario (motivo/observación)
function _accEscapeHtml(text) {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Retorna array de meses (YYYY-MM) que debieron facturarse y no aparecen en los pagos.
// Arranca desde la fecha de inscripción (o primer pago/fecha de creación) 
// y llega hasta el mes anterior al actual (el mes en curso aún no está vencido).
function _accMissingMonthsForPlayer(player, payments) {
  const billed = new Set(
    payments
      .filter(p => p.type === 'Mensualidad' && p.billingMonth)
      .map(p => p.billingMonth)
  );

  let startMonth = '';
  
  const firstBilled = billed.size > 0 ? Array.from(billed).sort()[0] : null;

  if (firstBilled) {
    // 1. Si ya tiene al menos una factura mensual, empezamos a contar estrictamente desde ese mes.
    startMonth = firstBilled;
  } else {
    // 2. Si NO tiene facturas, empezamos a contar desde que se inscribió o creó en el sistema.
    let baseStart = player.enrollmentDate ? String(player.enrollmentDate).substring(0, 7) : null;
    if (!baseStart && player.createdAt) {
      baseStart = String(player.createdAt).substring(0, 7);
    }
    startMonth = baseStart || '';
  }

  if (!startMonth || !/^\d{4}-\d{2}$/.test(startMonth)) return [];

  const today = new Date();
  let endY = today.getFullYear();
  let endM = today.getMonth(); // 0-indexed; equivale al mes anterior en base 1
  if (endM === 0) { endM = 12; endY--; }
  const endStr = `${endY}-${String(endM).padStart(2, '0')}`;
  if (startMonth > endStr) return [];

  let [y, m] = startMonth.split('-').map(Number);
  const missing = [];
  while (true) {
    const ms = `${y}-${String(m).padStart(2, '0')}`;
    if (ms > endStr) break;
    if (!billed.has(ms)) missing.push(ms);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return missing;
}

// Formatea "YYYY-MM" → "Mayo 2026"
function _accFormatBillingMonth(ms) {
  if (!ms || !/^\d{4}-\d{2}$/.test(ms)) return ms;
  const [y, m] = ms.split('-').map(Number);
  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  return `${meses[m-1]} ${y}`;
}

// FUNCIÓN PRINCIPAL - Mostrar vista de contabilidad
function showAccountingView() {
  console.log('📊 Botón de contabilidad presionado');
  
  try {
    // Ocultar todas las vistas
    const allViews = document.querySelectorAll('#appContainer > main > div');
    allViews.forEach(view => {
      view.classList.add('hidden');
    });
    
    // Mostrar vista de contabilidad
    const accountingView = document.getElementById('accountingView');
    
    if (!accountingView) {
      console.error('❌ ERROR: accountingView no existe en el HTML');
      showAppAlert('No se encontró la vista de contabilidad en el HTML.', {
        title: 'Error de interfaz',
        type: 'danger',
        confirmText: 'Cerrar'
      });
      return;
    }
    
    accountingView.classList.remove('hidden');
    console.log('✅ Vista de contabilidad mostrada');
    
    // Actualizar header
    document.getElementById('headerViewName').textContent = 'Contabilidad';
    
    // Desactivar navegación
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.remove('active');
    });
    
    // Renderizar contenido
    renderAccounting();
    
    // Scroll arriba
    window.scrollTo(0, 0);
    
  } catch (error) {
    console.error('❌ ERROR:', error);
    showAppAlert('Error: ' + error.message, {
      title: 'Error de contabilidad',
      type: 'danger',
      confirmText: 'Cerrar'
    });
  }
}

// Renderizar todo
function renderAccounting() {
  renderAccountingSummary();
  renderAccountingCharts();
  renderAccountingPlayersTable();
  renderVoidedPayments();
}

// 🆕 RESUMEN MEJORADO - CON EGRESOS Y OTROS INGRESOS
function renderAccountingSummary() {
  const payments = getPayments();
  const expenses = getExpenses();
  const thirdPartyIncomes = typeof getThirdPartyIncomes === 'function' ? getThirdPartyIncomes() : [];
  
  const paid = payments.filter(p => p.status === 'Pagado');
  const pending = payments.filter(p => p.status === 'Pendiente');
  
  // 💰 INGRESOS (Pagos de jugadores + Otros ingresos)
  const totalThirdParty = thirdPartyIncomes.reduce((sum, i) => sum + (i.amount || 0), 0);
  const totalPaymentsIncome = paid.reduce((sum, p) => sum + (p.finalAmount || p.amount || 0), 0);
  const totalIncome = totalPaymentsIncome + totalThirdParty;
  const totalPending = pending.reduce((sum, p) => sum + (p.finalAmount || p.amount || 0), 0);

  const thisMonth = paid.filter(p => p.paidDate && isThisMonth(p.paidDate));
  const thisMonthThirdParty = thirdPartyIncomes.filter(i => i.date && isThisMonth(i.date));
  const monthThirdParty = thisMonthThirdParty.reduce((sum, i) => sum + (i.amount || 0), 0);
  const monthPaymentsIncome = thisMonth.reduce((sum, p) => sum + (p.finalAmount || p.amount || 0), 0);
  const monthIncome = monthPaymentsIncome + monthThirdParty;
  
  // 💸 EGRESOS
  const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  
  const thisMonthExpenses = expenses.filter(e => e.date && isThisMonth(e.date));
  const monthExpenses = thisMonthExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  
  // 📊 UTILIDAD NETA
  const netProfit = totalIncome - totalExpenses;
  const monthNetProfit = monthIncome - monthExpenses;
  
  // Actualizar UI
  const accTotalIncome = document.getElementById('accTotalIncome');
  if (accTotalIncome) accTotalIncome.textContent = formatCurrency(totalIncome);
  
  const accMonthIncome = document.getElementById('accMonthIncome');
  if (accMonthIncome) accMonthIncome.textContent = formatCurrency(monthIncome);
  
  const accPending = document.getElementById('accPending');
  if (accPending) accPending.textContent = formatCurrency(totalPending);
  
  const accPaidCount = document.getElementById('accPaidCount');
  if (accPaidCount) accPaidCount.textContent = paid.length;
  
  // 🆕 Actualizar nuevos campos (si existen en el HTML)
  const totalExpensesEl = document.getElementById('accTotalExpenses');
  if (totalExpensesEl) {
    totalExpensesEl.textContent = formatCurrency(totalExpenses);
  }
  
  const monthExpensesEl = document.getElementById('accMonthExpenses');
  if (monthExpensesEl) {
    monthExpensesEl.textContent = formatCurrency(monthExpenses);
  }
  
  const netProfitEl = document.getElementById('accNetProfit');
  if (netProfitEl) {
    netProfitEl.textContent = formatCurrency(netProfit);
    
    // Cambiar color según sea positivo o negativo
    if (netProfit >= 0) {
      netProfitEl.classList.add('text-green-600');
      netProfitEl.classList.remove('text-red-600');
    } else {
      netProfitEl.classList.add('text-red-600');
      netProfitEl.classList.remove('text-green-600');
    }
  }
  
  const monthNetProfitEl = document.getElementById('accMonthNetProfit');
  if (monthNetProfitEl) {
    monthNetProfitEl.textContent = formatCurrency(monthNetProfit);
    
    if (monthNetProfit >= 0) {
      monthNetProfitEl.classList.add('text-green-600');
      monthNetProfitEl.classList.remove('text-red-600');
    } else {
      monthNetProfitEl.classList.add('text-red-600');
      monthNetProfitEl.classList.remove('text-green-600');
    }
  }
  
  console.log('📊 Resumen calculado:');
  console.log('  💰 Pagos jugadores:', formatCurrency(totalPaymentsIncome));
  console.log('  💜 Otros ingresos:', formatCurrency(totalThirdParty));
  console.log('  💰 Ingresos totales:', formatCurrency(totalIncome));
  console.log('  💸 Egresos totales:', formatCurrency(totalExpenses));
  console.log('  📊 Utilidad neta:', formatCurrency(netProfit));
  console.log('  📅 Este mes (neto):', formatCurrency(monthNetProfit));
}

// Renderizar gráficos
function renderAccountingCharts() {
  // Destruir gráficos anteriores
  Object.values(accountingCharts).forEach(chart => {
    if (chart) chart.destroy();
  });
  
  if (typeof Chart === 'undefined') {
    console.warn('⚠️ Chart.js no disponible');
    return;
  }
  
  renderIncomeVsExpensesChart();
  renderIncomeByCategoryChart();
  renderIncomeByTypeChart();
}

// 🆕 GRÁFICO DUAL: Ingresos vs Egresos (INCLUYE OTROS INGRESOS)
function renderIncomeVsExpensesChart() {
  const ctx = document.getElementById('incomeByMonthChart');
  if (!ctx) return;
  
  const payments = getPayments().filter(p => p.status === 'Pagado' && p.paidDate);
  const expenses = getExpenses();
  const thirdPartyIncomes = typeof getThirdPartyIncomes === 'function' ? getThirdPartyIncomes() : [];
  
  const today = new Date();
  const labels = [];
  const incomeData = [];
  const expenseData = [];
  
  for (let i = 11; i >= 0; i--) {
    const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const monthName = getMonthName(date.getMonth());
    labels.push(monthName.substring(0, 3));
    
    // Ingresos del mes (pagos + otros ingresos)
    const monthPayments = payments.filter(p => {
      const paymentDate = new Date(p.paidDate);
      return paymentDate.getMonth() === date.getMonth() && 
             paymentDate.getFullYear() === date.getFullYear();
    });
    const paymentsTotal = monthPayments.reduce((sum, p) => sum + (p.finalAmount || p.amount || 0), 0);
    
    // 🆕 Otros ingresos del mes
    const monthThirdParty = thirdPartyIncomes.filter(i => {
      if (!i.date) return false;
      const incomeDate = new Date(i.date);
      return incomeDate.getMonth() === date.getMonth() && 
             incomeDate.getFullYear() === date.getFullYear();
    });
    const thirdPartyTotal = monthThirdParty.reduce((sum, i) => sum + (i.amount || 0), 0);
    
    incomeData.push(paymentsTotal + thirdPartyTotal);
    
    // Egresos del mes
    const monthExpenses = expenses.filter(e => {
      if (!e.date) return false;
      const expenseDate = new Date(e.date);
      return expenseDate.getMonth() === date.getMonth() && 
             expenseDate.getFullYear() === date.getFullYear();
    });
    expenseData.push(monthExpenses.reduce((sum, e) => sum + (e.amount || 0), 0));
  }
  
  accountingCharts.byMonth = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Ingresos',
          data: incomeData,
          backgroundColor: 'rgba(13, 148, 136, 0.8)',
          borderColor: 'rgba(13, 148, 136, 1)',
          borderWidth: 1
        },
        {
          label: 'Egresos',
          data: expenseData,
          backgroundColor: 'rgba(220, 38, 38, 0.8)',
          borderColor: 'rgba(220, 38, 38, 1)',
          borderWidth: 1
        }
      ]
    },
    options: {
      responsive: true,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: { 
        legend: { 
          display: true,
          position: 'top'
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return context.dataset.label + ': ' + formatCurrency(context.parsed.y);
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              return formatCurrency(value);
            }
          }
        }
      }
    }
  });
  
  console.log('✅ Gráfico dual Ingresos vs Egresos creado');
}

// Gráfico: Ingresos por categoría
function renderIncomeByCategoryChart() {
  const ctx = document.getElementById('incomeByCategoryChart');
  if (!ctx) return;
  
  const players = getPlayers();
  const payments = getPayments().filter(p => p.status === 'Pagado');
  
  // Obtener categorías únicas de los jugadores
  const uniqueCategories = [...new Set(players.map(p => p.category))];
  const data = [];
  
  uniqueCategories.forEach(category => {
    const categoryPlayers = players.filter(p => p.category === category);
    const playerIds = categoryPlayers.map(p => p.id);
    const categoryPayments = payments.filter(p => playerIds.includes(p.playerId));
    data.push(categoryPayments.reduce((sum, p) => sum + (p.finalAmount || p.amount || 0), 0));
  });
  
  const colors = [
    'rgba(59, 130, 246, 0.8)',
    'rgba(16, 185, 129, 0.8)',
    'rgba(245, 158, 11, 0.8)',
    'rgba(139, 92, 246, 0.8)',
    'rgba(236, 72, 153, 0.8)',
    'rgba(13, 148, 136, 0.8)',
    'rgba(251, 146, 60, 0.8)'
  ];
  
  accountingCharts.byCategory = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: uniqueCategories,
      datasets: [{
        data: data,
        backgroundColor: colors.slice(0, uniqueCategories.length)
      }]
    },
    options: {
      responsive: true,
      plugins: { 
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label: function(context) {
              return context.label + ': ' + formatCurrency(context.parsed);
            }
          }
        }
      }
    }
  });
}

// Gráfico: Ingresos por tipo
function renderIncomeByTypeChart() {
  const ctx = document.getElementById('incomeByTypeChart');
  if (!ctx) return;
  
  const payments = getPayments().filter(p => p.status === 'Pagado');
  const types = ['Mensualidad', 'Uniforme', 'Torneo', 'Equipamiento', 'Otro'];
  const data = [];
  
  types.forEach(type => {
    const typePayments = payments.filter(p => p.type === type);
    data.push(typePayments.reduce((sum, p) => sum + (p.finalAmount || p.amount || 0), 0));
  });
  
  accountingCharts.byType = new Chart(ctx, {
    type: 'polarArea',
    data: {
      labels: types,
      datasets: [{
        data: data,
        backgroundColor: [
          'rgba(13, 148, 136, 0.8)',
          'rgba(139, 92, 246, 0.8)',
          'rgba(245, 158, 11, 0.8)',
          'rgba(34, 197, 94, 0.8)',
          'rgba(156, 163, 175, 0.8)'
        ]
      }]
    },
    options: {
      responsive: true,
      plugins: { 
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label: function(context) {
              return context.label + ': ' + formatCurrency(context.parsed.r);
            }
          }
        }
      }
    }
  });
}

// Variables para scroll infinito en contabilidad
let accountingPlayersData = [];
let accountingCurrentRenderIndex = 0;
let accountingObserver = null;
const ACCOUNTING_CHUNK_SIZE = 15;

// Tabla de jugadores - 🆕 CON DOCUMENTO DE IDENTIDAD + última factura + WhatsApp + vista móvil
function renderAccountingPlayersTable() {
  const tbody = document.getElementById('accountingPlayersTable');
  const cards = document.getElementById('accountingPlayersCards');
  if (!tbody && !cards) return;

  const players = getPlayers();

  // Limpiar estado anterior
  if (accountingObserver) {
    accountingObserver.disconnect();
    accountingObserver = null;
  }
  accountingCurrentRenderIndex = 0;
  if (tbody) tbody.innerHTML = '';
  if (cards) cards.innerHTML = '';

  if (players.length === 0) {
    if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-gray-500 dark:text-gray-400">No hay jugadores</td></tr>';
    if (cards) cards.innerHTML = '<p class="text-center py-6 text-gray-500 dark:text-gray-400 text-sm">No hay jugadores</p>';
    return;
  }

  // Precalcular datos por jugador
  accountingPlayersData = players.map(player => {
    const payments = getPaymentsByPlayer(player.id);
    const paid     = payments.filter(p => p.status === 'Pagado');
    const pending  = payments.filter(p => p.status === 'Pendiente');

    const totalPaid    = paid.reduce((s, p) => s + (p.finalAmount || p.amount || 0), 0);
    const totalPending = pending.reduce((s, p) => s + (p.finalAmount || p.amount || 0), 0);
    const totalExpected = totalPaid + totalPending;
    const compliance    = totalExpected > 0 ? (totalPaid / totalExpected * 100) : 0;
    const color         = compliance >= 80 ? 'bg-green-500' : compliance >= 50 ? 'bg-yellow-500' : 'bg-red-500';

    const documentInfo = player.documentType && player.documentNumber
      ? `${player.documentType}: ${player.documentNumber}` : '-';

    const lastInvoice = paid.slice()
      .sort((a, b) => (b.paidDate || b.dueDate || '').localeCompare(a.paidDate || a.dueDate || ''))[0];

    const reasonText = (lastInvoice?.discountReason || lastInvoice?.notes || '').trim();
    const hasPhone   = !!(player.phone && String(player.phone).trim());
    const hasPending = totalPending > 0;

    // 🆕 Meses sin facturar (vencidos hasta hoy)
    const missingMonths = _accMissingMonthsForPlayer(player, payments);
    const hasMissing    = missingMonths.length > 0;

    return { player, totalPaid, totalPending, compliance, color, documentInfo, lastInvoice, reasonText, hasPhone, hasPending, missingMonths, hasMissing };
  });

  // Renderizar el primer lote
  renderAccountingChunk(tbody, cards);
}

// Función para renderizar lotes (scroll infinito)
function renderAccountingChunk(tbody, cards) {
  if (accountingCurrentRenderIndex >= accountingPlayersData.length) return;

  const nextIndex = Math.min(accountingCurrentRenderIndex + ACCOUNTING_CHUNK_SIZE, accountingPlayersData.length);
  const chunk = accountingPlayersData.slice(accountingCurrentRenderIndex, nextIndex);

  // Helpers de fragmentos reutilizables
  const lastInvoiceHtml = r => r.lastInvoice
    ? `<p class="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5 flex items-center gap-1" title="Última factura">
         <i data-lucide="file-text" class="w-3 h-3"></i>
         ${r.lastInvoice.invoiceNumber || '—'} · ${r.lastInvoice.paidDate || r.lastInvoice.dueDate || ''}
       </p>` : '';

  const reasonHtml = r => r.reasonText
    ? `<span class="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded text-[10px] bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300" title="Motivo/observación de la última factura">
         <i data-lucide="info" class="w-3 h-3"></i>${_accEscapeHtml(r.reasonText)}
       </span>` : '';

  const missingHtml = r => r.hasMissing
    ? `<span class="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded text-[10px] bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300"
             title="Meses vencidos sin factura: ${r.missingMonths.map(_accFormatBillingMonth).join(', ')}">
         <i data-lucide="alert-triangle" class="w-3 h-3"></i>
         ${r.missingMonths.length} ${r.missingMonths.length === 1 ? 'mes sin facturar' : 'meses sin facturar'}
       </span>` : '';

  const waButtonHtml = r => {
    if (!r.hasPhone) return '';
    const alerta = r.hasPending || r.hasMissing;
    const cls    = alerta
      ? 'text-red-600 border-red-600 hover:bg-red-600'
      : 'text-green-600 border-green-600 hover:bg-green-600';
    const title  = alerta ? 'Recordar pago por WhatsApp' : 'Enviar WhatsApp';
    return `<button onclick="sendPendingReminderWA('${r.player.id}')"
                    title="${title}"
                    class="inline-flex items-center justify-center w-8 h-8 rounded hover:text-white border transition-colors ${cls}">
              <i data-lucide="message-circle" class="w-4 h-4"></i>
            </button>`;
  };

  // Renderizar filas en tbody
  if (tbody) {
    chunk.forEach(r => {
      tbody.insertAdjacentHTML('beforeend', `
        <tr class="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
          <td class="py-3 text-gray-800 dark:text-white sm:min-w-[220px] align-top">
            <div class="flex items-start gap-2">
              <img src="${r.player.avatar || getDefaultAvatar()}" alt="${r.player.name}" class="w-8 h-8 rounded-full flex-shrink-0 mt-0.5">
              <div class="min-w-0 flex-1">
                <span class="font-medium block truncate">${r.player.name}</span>
                <p class="text-xs text-gray-500 dark:text-gray-400">${r.documentInfo}</p>
                <p class="text-xs text-gray-500 dark:text-gray-400 sm:hidden">${r.player.category}</p>
                ${lastInvoiceHtml(r)}
                <div class="flex flex-wrap gap-1 mt-1">
                  ${reasonHtml(r)}
                  ${missingHtml(r)}
                </div>
                <!-- Resumen compacto solo en mobile -->
                <div class="flex items-center gap-3 mt-2 sm:hidden text-xs">
                  <span class="text-green-600 font-semibold">${formatCurrency(r.totalPaid)}</span>
                  <span class="text-gray-400">·</span>
                  <span class="text-red-500 font-semibold">${formatCurrency(r.totalPending)}</span>
                  <div class="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                    <div class="${r.color} h-full rounded-full" style="width:${r.compliance}%"></div>
                  </div>
                  <span class="text-gray-500 dark:text-gray-400 text-[11px]">${Math.round(r.compliance)}%</span>
                </div>
              </div>
            </div>
          </td>
          <td class="py-3 text-gray-800 dark:text-white whitespace-nowrap hidden sm:table-cell">${r.player.category}</td>
          <td class="py-3 text-right text-green-600 whitespace-nowrap hidden sm:table-cell">${formatCurrency(r.totalPaid)}</td>
          <td class="py-3 text-right text-red-600 whitespace-nowrap hidden sm:table-cell">${formatCurrency(r.totalPending)}</td>
          <td class="py-3 min-w-[120px] hidden sm:table-cell">
            <div class="flex items-center gap-2">
              <div class="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                <div class="${r.color} h-full rounded-full transition-all" style="width: ${r.compliance}%"></div>
              </div>
              <span class="text-sm text-gray-600 dark:text-gray-400">${Math.round(r.compliance)}%</span>
            </div>
          </td>
          <td class="py-3 text-center align-top sm:align-middle">
            <div class="inline-flex flex-col sm:flex-row items-center gap-1 sm:gap-1">
              ${waButtonHtml(r)}
              <button onclick="generatePlayerAccountStatementPDF('${r.player.id}')" class="bg-teal-600 hover:bg-teal-700 text-white px-2 sm:px-3 py-1 rounded text-xs sm:text-sm whitespace-nowrap">
                <span class="hidden sm:inline">Estado </span>PDF
              </button>
            </div>
          </td>
        </tr>
      `);
    });
  }

  // Renderizar tarjetas (móvil alternativo, si aplica)
  if (cards) {
    chunk.forEach(r => {
      cards.insertAdjacentHTML('beforeend', `
        <div class="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-white/50 dark:bg-gray-800/40">
          <div class="flex items-start gap-3">
            <img src="${r.player.avatar || getDefaultAvatar()}" alt="${r.player.name}" class="w-10 h-10 rounded-full flex-shrink-0">
            <div class="flex-1 min-w-0">
              <p class="font-semibold text-gray-800 dark:text-white truncate">${r.player.name}</p>
              <p class="text-xs text-gray-500 dark:text-gray-400">${r.player.category} · ${r.documentInfo}</p>
              ${lastInvoiceHtml(r)}
              <div class="flex flex-wrap gap-1">
                ${reasonHtml(r)}
                ${missingHtml(r)}
              </div>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-2 mt-3 text-xs">
            <div class="bg-green-50 dark:bg-green-900/20 rounded px-2 py-1.5">
              <p class="text-green-700 dark:text-green-400 font-semibold">${formatCurrency(r.totalPaid)}</p>
              <p class="text-[10px] text-gray-500 dark:text-gray-400">Pagado</p>
            </div>
            <div class="bg-red-50 dark:bg-red-900/20 rounded px-2 py-1.5">
              <p class="text-red-700 dark:text-red-400 font-semibold">${formatCurrency(r.totalPending)}</p>
              <p class="text-[10px] text-gray-500 dark:text-gray-400">Pendiente</p>
            </div>
          </div>
          <div class="flex items-center gap-2 mt-2">
            <div class="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
              <div class="${r.color} h-full rounded-full transition-all" style="width: ${r.compliance}%"></div>
            </div>
            <span class="text-xs text-gray-600 dark:text-gray-400">${Math.round(r.compliance)}%</span>
          </div>
          <div class="flex items-center gap-2 mt-3">
            ${waButtonHtml(r)}
            <button onclick="generatePlayerAccountStatementPDF('${r.player.id}')" class="flex-1 bg-teal-600 hover:bg-teal-700 text-white px-3 py-2 rounded text-sm font-medium">
              Estado PDF
            </button>
          </div>
        </div>
      `);
    });
  }

  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    lucide.createIcons();
  }

  accountingCurrentRenderIndex = nextIndex;

  // Si quedan elementos, configurar el observer
  if (accountingCurrentRenderIndex < accountingPlayersData.length) {
    setupAccountingObserver(tbody, cards);
  }
}

function setupAccountingObserver(tbody, cards) {
  if (accountingObserver) {
    accountingObserver.disconnect();
  }

  const options = {
    root: null,
    rootMargin: '200px', // Cargar un poco antes de llegar al final
    threshold: 0.1
  };

  accountingObserver = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) {
      accountingObserver.disconnect();
      renderAccountingChunk(tbody, cards);
    }
  }, options);

  // Observar el último elemento renderizado
  let target = null;
  if (tbody && tbody.lastElementChild) {
    target = tbody.lastElementChild;
  } else if (cards && cards.lastElementChild) {
    target = cards.lastElementChild;
  }
  
  if (target) {
    accountingObserver.observe(target);
  }
}

// 🆕 Enviar recordatorio por WhatsApp (pendientes registrados + meses sin facturar)
function sendPendingReminderWA(playerId) {
  const player = getPlayerById(playerId);
  if (!player) { showToast('❌ Jugador no encontrado'); return; }
  if (!player.phone || !String(player.phone).trim()) {
    showToast('⚠️ Este jugador no tiene teléfono registrado');
    return;
  }

  const allPayments = getPaymentsByPlayer(playerId);
  const pending     = allPayments.filter(p => p.status === 'Pendiente');
  const missing     = _accMissingMonthsForPlayer(player, allPayments);
  const totalPending = pending.reduce((s, p) => s + (p.finalAmount || p.amount || 0), 0);

  // 🆕 Detectar si nunca ha tenido facturas mensuales
  const monthlyPayments = allPayments.filter(p => p.type === 'Mensualidad' || p.concept === 'Mensualidad');
  const hasNeverBeenInvoiced = monthlyPayments.length === 0;

  const settings  = (typeof getSchoolSettings === 'function') ? getSchoolSettings() : {};
  const clubName  = settings?.schoolName || 'la escuela';
  const firstName = (player.name || '').split(' ')[0] || '';

  let message;
  if (pending.length === 0 && missing.length === 0) {
    // Al día → saludo genérico (el admin puede editar antes de enviar)
    message = `Hola ${firstName}, te saludamos desde ${clubName}.`;
  } else {
    const detallePendientes = pending.length > 0
      ? '📌 *Facturas pendientes:*\n' + pending.slice(0, 5)
          .map(p => `• ${p.concept || p.type || 'Pago'}${p.dueDate ? ` (vence ${p.dueDate})` : ''} — ${formatCurrency(p.finalAmount || p.amount || 0)}`)
          .join('\n')
      : '';

    let detalleMissing = '';
    if (missing.length > 0) {
      const mesesList = missing.slice(0, 6).map(m => `• ${_accFormatBillingMonth(m)}`).join('\n')
        + (missing.length > 6 ? `\n• … y ${missing.length - 6} mes(es) más` : '');
        
      if (hasNeverBeenInvoiced) {
        let regDateStr = player.enrollmentDate || player.createdAt || '';
        let fechaTexto = 'recientemente';
        if (regDateStr) {
          // Extraer YYYY-MM-DD por si viene con formato de hora
          const isoDate = regDateStr.split('T')[0];
          const parts = isoDate.split('-');
          if (parts.length === 3) fechaTexto = `el ${parts[2]}/${parts[1]}/${parts[0]}`;
        }
        detalleMissing = `⚠️ *Primera factura pendiente:*\nRegistrado ${fechaTexto}. Meses a cobrar:\n${mesesList}`;
      } else {
        detalleMissing = `⚠️ *Meses sin factura registrada:*\n${mesesList}`;
      }
    }

    let intro = `Hola ${firstName}, te recordamos que tienes pendiente la mensualidad en ${clubName}.`;
    if (pending.length === 0 && hasNeverBeenInvoiced && missing.length > 0) {
       intro = `Hola ${firstName}, te saludamos desde la administración de ${clubName}.`;
    }

    message = [
      intro,
      detallePendientes,
      detalleMissing,
      totalPending > 0 ? `\nTotal pendiente de pago: *${formatCurrency(totalPending)}*.` : '',
      `\nAgradecemos tu atención. ¡Gracias!`
    ].filter(Boolean).join('\n\n');
  }

  if (typeof openWhatsAppWithConfirm === 'function') {
    openWhatsAppWithConfirm(player.phone, message, player.name);
  } else if (typeof openWhatsApp === 'function') {
    openWhatsApp(player.phone, message);
  } else {
    showToast('❌ WhatsApp no disponible');
  }
}

window.sendPendingReminderWA = sendPendingReminderWA;

// Generar reporte PDF
function generateFullReport() {
  if (typeof generateFullAccountingReportPDF === 'function') {
    generateFullAccountingReportPDF();
  } else {
    showToast('❌ Función PDF no disponible');
  }
}

// ========================================
// 🆕 EXPORTAR CSV COMPLETO - CON DOCUMENTO DE IDENTIDAD
// ========================================

function exportCSV() {
  const payments = getPayments();
  const thirdPartyIncomes = typeof getThirdPartyIncomes === 'function' ? getThirdPartyIncomes() : [];
  
  if (payments.length === 0 && thirdPartyIncomes.length === 0) {
    showToast('⚠️ No hay datos para exportar');
    return;
  }
  
  // 🆕 Exportar pagos individuales con factura, fecha y DOCUMENTO
  const csvData = [];
  
  // Agregar pagos de jugadores
  payments.forEach(payment => {
    const player = getPlayerById(payment.playerId);
    csvData.push({
      'Tipo': 'Pago Jugador',
      'Factura': payment.invoiceNumber || 'N/A',
      'Fecha': payment.paidDate ? formatDate(payment.paidDate) : formatDate(payment.dueDate),
      'Jugador/Aportante': player ? player.name : 'Desconocido',
      'Tipo Documento': player ? (player.documentType || 'N/A') : 'N/A', // 🆕
      'Número Documento': player ? (player.documentNumber || 'N/A') : 'N/A', // 🆕
      'Categoría': player ? player.category : 'N/A',
      'Concepto': payment.concept || payment.type || 'N/A',
      'Monto': payment.finalAmount || payment.amount || 0,
      'Estado': payment.status || 'N/A',
      'Método': payment.method || 'N/A',
      'Teléfono': player ? (player.phone || '') : '',
      'Email': player ? (player.email || '') : ''
    });
  });
  
  // 🆕 Agregar otros ingresos
  thirdPartyIncomes.forEach(income => {
    csvData.push({
      'Tipo': 'Otro Ingreso',
      'Factura': income.invoiceNumber || 'N/A',
      'Fecha': income.date ? formatDate(income.date) : 'N/A',
      'Jugador/Aportante': income.contributorName || 'N/A',
      'Tipo Documento': 'N/A',
      'Número Documento': 'N/A',
      'Categoría': income.category || 'N/A',
      'Concepto': income.concept || 'N/A',
      'Monto': income.amount || 0,
      'Estado': 'Pagado',
      'Método': income.method || 'N/A',
      'Teléfono': income.contributorPhone || '',
      'Email': income.contributorEmail || ''
    });
  });
  
  // Ordenar por fecha (más reciente primero)
  csvData.sort((a, b) => {
    const dateA = a['Fecha'] !== 'N/A' ? new Date(a['Fecha'].split('/').reverse().join('-')) : new Date(0);
    const dateB = b['Fecha'] !== 'N/A' ? new Date(b['Fecha'].split('/').reverse().join('-')) : new Date(0);
    return dateB - dateA;
  });
  
  if (csvData.length === 0) {
    showToast('⚠️ No hay datos para exportar');
    return;
  }
  
  downloadCSV(csvData, `Contabilidad-Ingresos-${getCurrentDate()}.csv`);
  showToast('✅ CSV de ingresos exportado');
  
  console.log('📊 CSV exportado con', csvData.length, 'registros');
}

// 🆕 Exportar resumen por jugador (función adicional) - CON DOCUMENTO
function exportPlayersSummaryCSV() {
  const players = getPlayers();
  if (players.length === 0) {
    showToast('⚠️ No hay jugadores para exportar');
    return;
  }
  
  const csvData = players.map(player => {
    const payments = getPaymentsByPlayer(player.id);
    const paid = payments.filter(p => p.status === 'Pagado');
    const pending = payments.filter(p => p.status === 'Pendiente');
    
    // Obtener última factura
    const lastPayment = paid.sort((a, b) => new Date(b.paidDate || 0) - new Date(a.paidDate || 0))[0];
    
    return {
      'Jugador': player.name || 'N/A',
      'Tipo Documento': player.documentType || 'N/A', // 🆕
      'Número Documento': player.documentNumber || 'N/A', // 🆕
      'Categoría': player.category || 'N/A',
      'Total Pagado': paid.reduce((sum, p) => sum + (p.finalAmount || p.amount || 0), 0),
      'Total Pendiente': pending.reduce((sum, p) => sum + (p.finalAmount || p.amount || 0), 0),
      'Cantidad Pagos': paid.length,
      'Última Factura': lastPayment ? (lastPayment.invoiceNumber || 'N/A') : 'N/A',
      'Último Pago': lastPayment ? formatDate(lastPayment.paidDate) : 'N/A',
      'Estado': player.status || 'N/A',
      'Teléfono': player.phone || '',
      'Email': player.email || ''
    };
  });
  
  downloadCSV(csvData, `Resumen-Jugadores-${getCurrentDate()}.csv`);
  showToast('✅ Resumen de jugadores exportado');
}

// 🆕 Exportar reporte completo de egresos
function exportExpensesCSV() {
  const expenses = getExpenses();
  if (expenses.length === 0) {
    showToast('⚠️ No hay egresos para exportar');
    return;
  }
  
  const csvData = expenses.map(expense => {
    return {
      'Factura': expense.invoiceNumber || 'N/A',
      'Fecha': expense.date ? formatDate(expense.date) : 'N/A',
      'Beneficiario': expense.beneficiaryName || 'N/A',
      'Tipo': expense.beneficiaryType === 'internal' ? 'Usuario interno' : 'Proveedor externo',
      'Categoría': expense.category || 'N/A',
      'Concepto': expense.concept || 'N/A',
      'Monto': expense.amount || 0,
      'Método': expense.method || 'N/A',
      'Teléfono': expense.beneficiaryPhone || '',
      'Documento': expense.beneficiaryDocument || '',
      'Notas': expense.notes || ''
    };
  });
  
  downloadCSV(csvData, `Egresos-${getCurrentDate()}.csv`);
  showToast('✅ Egresos exportados');
}

// 🆕 Exportar reporte completo (todo junto) - CON DOCUMENTO
function exportFullReportCSV() {
  const payments = getPayments();
  const expenses = getExpenses();
  const thirdPartyIncomes = typeof getThirdPartyIncomes === 'function' ? getThirdPartyIncomes() : [];
  
  if (payments.length === 0 && expenses.length === 0 && thirdPartyIncomes.length === 0) {
    showToast('⚠️ No hay datos para exportar');
    return;
  }
  
  const csvData = [];
  
  // Pagos de jugadores
  payments.forEach(payment => {
    const player = getPlayerById(payment.playerId);
    csvData.push({
      'Tipo Registro': 'INGRESO - Pago Jugador',
      'Factura': payment.invoiceNumber || 'N/A',
      'Fecha': payment.paidDate ? formatDate(payment.paidDate) : formatDate(payment.dueDate),
      'Nombre': player ? player.name : 'Desconocido',
      'Tipo Documento': player ? (player.documentType || 'N/A') : 'N/A', // 🆕
      'Número Documento': player ? (player.documentNumber || 'N/A') : 'N/A', // 🆕
      'Categoría': player ? player.category : 'N/A',
      'Concepto': payment.concept || payment.type || 'N/A',
      'Ingreso': payment.status === 'Pagado' ? (payment.finalAmount || payment.amount || 0) : 0,
      'Egreso': 0,
      'Estado': payment.status || 'N/A',
      'Método': payment.method || 'N/A'
    });
  });
  
  // Otros ingresos
  thirdPartyIncomes.forEach(income => {
    csvData.push({
      'Tipo Registro': 'INGRESO - Otro',
      'Factura': income.invoiceNumber || 'N/A',
      'Fecha': income.date ? formatDate(income.date) : 'N/A',
      'Nombre': income.contributorName || 'N/A',
      'Tipo Documento': 'N/A',
      'Número Documento': 'N/A',
      'Categoría': income.category || 'N/A',
      'Concepto': income.concept || 'N/A',
      'Ingreso': income.amount || 0,
      'Egreso': 0,
      'Estado': 'Pagado',
      'Método': income.method || 'N/A'
    });
  });
  
  // Egresos
  expenses.forEach(expense => {
    csvData.push({
      'Tipo Registro': 'EGRESO',
      'Factura': expense.invoiceNumber || 'N/A',
      'Fecha': expense.date ? formatDate(expense.date) : 'N/A',
      'Nombre': expense.beneficiaryName || 'N/A',
      'Tipo Documento': 'N/A',
      'Número Documento': expense.beneficiaryDocument || 'N/A',
      'Categoría': expense.category || 'N/A',
      'Concepto': expense.concept || 'N/A',
      'Ingreso': 0,
      'Egreso': expense.amount || 0,
      'Estado': 'Pagado',
      'Método': expense.method || 'N/A'
    });
  });
  
  // Ordenar por fecha
  csvData.sort((a, b) => {
    const dateA = a['Fecha'] !== 'N/A' ? new Date(a['Fecha'].split('/').reverse().join('-')) : new Date(0);
    const dateB = b['Fecha'] !== 'N/A' ? new Date(b['Fecha'].split('/').reverse().join('-')) : new Date(0);
    return dateB - dateA;
  });
  
  downloadCSV(csvData, `Reporte-Completo-${getCurrentDate()}.csv`);
  showToast('✅ Reporte completo exportado');
  
  // Mostrar resumen
  const totalIngresos = csvData.reduce((sum, r) => sum + (r['Ingreso'] || 0), 0);
  const totalEgresos = csvData.reduce((sum, r) => sum + (r['Egreso'] || 0), 0);
  console.log('📊 Reporte exportado:');
  console.log('  - Total registros:', csvData.length);
  console.log('  - Total ingresos:', formatCurrency(totalIngresos));
  console.log('  - Total egresos:', formatCurrency(totalEgresos));
  console.log('  - Utilidad:', formatCurrency(totalIngresos - totalEgresos));
}

// ========================================
// FACTURAS ANULADAS
// ========================================

async function renderVoidedPayments() {
  const container = document.getElementById('voidedPaymentsList');
  if (!container) return;

  container.innerHTML = '<p class="text-gray-400 text-sm text-center py-4">Cargando...</p>';

  try {
    if (!window.firebase?.db) {
      container.innerHTML = '<p class="text-gray-400 text-sm text-center py-4">Sin conexión</p>';
      return;
    }

    const clubId = localStorage.getItem('clubId');
    if (!clubId) return;

    const snap = await window.firebase.getDocs(
      window.firebase.query(
        window.firebase.collection(window.firebase.db, `clubs/${clubId}/voided_payments`),
        window.firebase.orderBy('voidedAt', 'desc')
      )
    );

    if (snap.empty) {
      container.innerHTML = '<p class="text-gray-400 text-sm text-center py-6">Sin facturas anuladas</p>';
      // Limpiar badge
      const badge = document.getElementById('voidedCountBadge');
      if (badge) badge.textContent = '';
      return;
    }

    // Guardar para exportar y actualizar badge de cantidad
    window._voidedPaymentsCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const badge = document.getElementById('voidedCountBadge');
    if (badge) badge.textContent = `${window._voidedPaymentsCache.length} registros`;

    // Renderizar como filas de tabla en lugar de tarjetas separadas
    container.innerHTML = window._voidedPaymentsCache.map((v, i) => {
      const rowBg = i % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-red-50/50 dark:bg-red-900/10';
      return `
      <div class="flex items-center justify-between px-4 py-2.5 ${rowBg} text-sm">
        <div class="flex items-center gap-3 min-w-0">
          <span class="font-mono text-xs font-bold text-red-600 dark:text-red-400 shrink-0">${v.invoiceNumber}</span>
          <span class="text-gray-400 text-xs shrink-0">${formatDate(v.voidedAt)}</span>
          <span class="text-gray-700 dark:text-gray-300 truncate">${v.playerName}</span>
          <span class="text-gray-400 text-xs truncate hidden sm:block">${v.concept}</span>
        </div>
        <div class="flex items-center gap-4 shrink-0 ml-2">
          <span class="text-xs text-gray-500 hidden md:block">${v.reason}</span>
          <span class="font-bold text-red-600 dark:text-red-400">${formatCurrency(v.amount)}</span>
          <span class="text-xs text-gray-400 hidden sm:block">Por: ${v.voidedBy}</span>
        </div>
      </div>`;
    }).join('');

  } catch (err) {
    container.innerHTML = '<p class="text-red-400 text-sm text-center py-4">Error al cargar</p>';
  }
}

function exportVoidedCSV() {
  const voided = window._voidedPaymentsCache || [];
  if (voided.length === 0) {
    showToast('⚠️ No hay facturas anuladas para exportar');
    return;
  }

  const csvData = voided.map(v => ({
    'Tipo': 'ANULADA',
    'Factura': v.invoiceNumber,
    'Fecha Anulación': formatDate(v.voidedAt),
    'Jugador': v.playerName,
    'Categoría': v.playerCategory || 'N/A',
    'Concepto': v.concept,
    'Monto': v.amount,
    'Motivo': v.reason,
    'Anulado por': v.voidedBy
  }));

  downloadCSV(csvData, `Facturas-Anuladas-${getCurrentDate()}.csv`);
  showToast('✅ Exportado');
}

// Hacer funciones globales
window.exportCSV = exportCSV;
window.exportExpensesCSV = exportExpensesCSV;
window.exportPlayersSummaryCSV = exportPlayersSummaryCSV;
window.exportFullReportCSV = exportFullReportCSV;
window.renderVoidedPayments = renderVoidedPayments;
window.exportVoidedCSV = exportVoidedCSV;

// Colapsa o expande la tabla "Estado por Jugador"
function toggleAccountingTable() {
  const body     = document.getElementById('accountingTableBody');
  const chevron  = document.getElementById('accountingTableChevron');
  if (!body) return;

  const isHidden = body.classList.toggle('hidden');
  // Rotar la flecha: apunta arriba cuando está abierto, abajo cuando está cerrado
  chevron.style.transform = isHidden ? 'rotate(-90deg)' : 'rotate(0deg)';
}
window.toggleAccountingTable = toggleAccountingTable;

// ========================================
// 🆕 ARQUEO DE CAJA DIARIO (Cierre de Caja)
// ========================================

function openCashRegisterModal() {
  const modal = document.getElementById('cashRegisterModal');
  if (!modal) return;
  
  const todayDateStr = formatDate(new Date().toISOString());
  document.getElementById('crDateDisplay').textContent = "Fecha: " + todayDateStr;
  
  // Calcular todo de HOY usando timezone local
  const todayISO = new Date();
  const year = todayISO.getFullYear();
  const month = (todayISO.getMonth() + 1).toString().padStart(2, '0');
  const day = todayISO.getDate().toString().padStart(2, '0');
  const currentLocalISODate = `${year}-${month}-${day}`;
  
  // Ingresos (Payments) de HOY
  const payments = (typeof getPayments === 'function' ? getPayments() : []).filter(p => p.status === 'Pagado' && (
      (p.paidDate && p.paidDate.startsWith(currentLocalISODate)) || 
      (p.paymentDate && p.paymentDate.startsWith(currentLocalISODate))
  ));
  
  // Otros Ingresos (Third Party) de HOY
  const thirdPartyIncomes = (typeof getThirdPartyIncomes === 'function' ? getThirdPartyIncomes() : [])
      .filter(i => i.date && i.date.startsWith(currentLocalISODate));
      
  // Egresos (Expenses) de HOY
  const expenses = (typeof getExpenses === 'function' ? getExpenses() : [])
      .filter(e => e.date && e.date.startsWith(currentLocalISODate));
  
  // Cálculos totales
  let totalIncomeAmount = 0;
  let expectedCashIncome = 0;
  let expectedBankIncome = 0;
  
  payments.forEach(p => {
      const amt = parseFloat(p.finalAmount || p.amount || 0);
      totalIncomeAmount += amt;
      if (p.method === 'Efectivo') expectedCashIncome += amt;
      else expectedBankIncome += amt;
  });
  
  thirdPartyIncomes.forEach(i => {
      const amt = parseFloat(i.amount || 0);
      totalIncomeAmount += amt;
      if (i.method === 'Efectivo') expectedCashIncome += amt;
      else expectedBankIncome += amt;
  });
  
  let totalExpenseAmount = 0;
  let expectedCashExpense = 0;
  let expectedBankExpense = 0;
  
  expenses.forEach(e => {
      const amt = parseFloat(e.amount || 0);
      totalExpenseAmount += amt;
      if (e.method === 'Efectivo') expectedCashExpense += amt;
      else expectedBankExpense += amt;
  });
  
  const finalCashExpected = expectedCashIncome - expectedCashExpense;
  const finalBankExpected = expectedBankIncome - expectedBankExpense;
  
  document.getElementById('crTotalIncome').textContent = formatCurrency(totalIncomeAmount);
  document.getElementById('crTotalExpenses').textContent = formatCurrency(totalExpenseAmount);
  
  document.getElementById('crCashExpected').textContent = formatCurrency(finalCashExpected);
  document.getElementById('crCashExpected').dataset.val = finalCashExpected;
  document.getElementById('crBankExpected').textContent = formatCurrency(finalBankExpected);
  document.getElementById('crBankExpected').dataset.val = finalBankExpected;
  
  // Limpiar campos
  const crCashCounted = document.getElementById('crCashCounted');
  if(crCashCounted) crCashCounted.value = '';
  const crNotes = document.getElementById('crNotes');
  if(crNotes) crNotes.value = '';
  const crAlert = document.getElementById('crDiscrepancyAlert');
  if(crAlert) crAlert.classList.add('hidden');
  
  modal.classList.remove('hidden');
}

function closeCashRegisterModal() {
  const modal = document.getElementById('cashRegisterModal');
  if(modal) modal.classList.add('hidden');
}

function calculateCashRegisterDiscrepancy() {
  const cashExpected = parseFloat(document.getElementById('crCashExpected').dataset.val || 0);
  const countedInput = document.getElementById('crCashCounted').value;
  const alertBox = document.getElementById('crDiscrepancyAlert');
  
  if (countedInput === '') {
      alertBox.classList.add('hidden');
      return;
  }
  
  const cashCounted = parseFloat(countedInput) || 0;
  const diff = cashCounted - cashExpected;
  
  alertBox.classList.remove('hidden', 'bg-green-100', 'text-green-800', 'border-green-300', 'bg-red-100', 'text-red-800', 'border-red-300', 'bg-yellow-100', 'text-yellow-800', 'border-yellow-300');
  
  if (Math.abs(diff) < 0.01) {
      alertBox.classList.add('bg-green-100', 'text-green-800', 'border-green-300');
      alertBox.innerHTML = `<span><i data-lucide="check-circle" class="w-4 h-4 inline mr-1"></i> Cuadre Exacto</span> <span>$0</span>`;
  } else if (diff > 0) {
      alertBox.classList.add('bg-yellow-100', 'text-yellow-800', 'border-yellow-300');
      alertBox.innerHTML = `<span><i data-lucide="alert-triangle" class="w-4 h-4 inline mr-1"></i> Sobrante</span> <span class="font-bold text-yellow-900">+${formatCurrency(diff)}</span>`;
  } else {
      alertBox.classList.add('bg-red-100', 'text-red-800', 'border-red-300');
      alertBox.innerHTML = `<span><i data-lucide="x-circle" class="w-4 h-4 inline mr-1"></i> Faltante</span> <span class="font-bold text-red-900">${formatCurrency(Math.abs(diff))}</span>`;
  }
  
  if (window.lucide) {
      lucide.createIcons();
  }
}

async function saveCashRegister() {
  const countedInput = document.getElementById('crCashCounted').value;
  if (!countedInput || countedInput === '') {
      showToast('⚠️ Debes ingresar el conteo físico de efectivo');
      return;
  }

  const btnSave = document.getElementById('btnSaveCashRegister');
  const btnText = document.getElementById('btnSaveCashRegisterText');
  const originalText = btnText.innerText;
  
  btnSave.disabled = true;
  btnText.innerText = 'Guardando Arqueo...';

  try {
      const cashCounted = parseFloat(countedInput) || 0;
      const cashExpected = parseFloat(document.getElementById('crCashExpected').dataset.val || 0);
      const bankExpected = parseFloat(document.getElementById('crBankExpected').dataset.val || 0);
      const notes = document.getElementById('crNotes').value.trim();
      const currentUser = typeof getCurrentUser === 'function' ? getCurrentUser() : { name: 'Administrador' };
      
      const newArqueo = {
          id: 'closure_' + Date.now().toString(36),
          date: new Date().toISOString(),
          cashExpected: cashExpected,
          cashCounted: cashCounted,
          bankExpected: bankExpected,
          discrepancy: cashCounted - cashExpected,
          notes: notes,
          auditedBy: currentUser.name || currentUser.email || 'Administrador'
      };

      if (typeof saveCashRegisterToFirebase === 'function') {
          await saveCashRegisterToFirebase(newArqueo);
      }
      
      showToast('✅ Arqueo de caja guardado con éxito');
      
      closeCashRegisterModal();
      
      if (typeof generateCashRegisterClosurePDF === 'function') {
          generateCashRegisterClosurePDF(newArqueo, document.getElementById('crTotalIncome').textContent, document.getElementById('crTotalExpenses').textContent);
      } else {
          console.warn('Función generateCashRegisterClosurePDF no encontrada');
      }
      
  } catch (error) {
      console.error(error);
      showToast('❌ Error al guardar el arqueo');
  } finally {
      btnSave.disabled = false;
      btnText.innerText = originalText;
  }
}

// Hacer globales las funciones del modal
window.openCashRegisterModal = openCashRegisterModal;
window.closeCashRegisterModal = closeCashRegisterModal;
window.calculateCashRegisterDiscrepancy = calculateCashRegisterDiscrepancy;
window.saveCashRegister = saveCashRegister;

console.log('✅ accounting.js cargado correctamente CON DOCUMENTO DE IDENTIDAD');

// ========================================
// AUDITORÍA DE MONTOS - DETECTA DISCREPANCIAS finalAmount vs amount
// ========================================
function runAmountAudit() {
  const payments = typeof getPayments === 'function' ? getPayments() : [];
  const players  = typeof getPlayers  === 'function' ? getPlayers()  : [];

  const getPlayerName = id => {
    const p = players.find(p => p.id === id);
    return p ? p.name : 'Desconocido';
  };

  // Caso 1: Editados con finalAmount desincronizado (EL BUG)
  const buggedEdited = payments.filter(p =>
    p.editedBy && p.finalAmount !== undefined && p.finalAmount !== p.amount
  );

  // Caso 2: Sin editar pero tienen finalAmount != amount (descuentos legítimos)
  const withDiscount = payments.filter(p =>
    !p.editedBy && p.finalAmount !== undefined && p.finalAmount !== p.amount
  );

  // Caso 3: Pagados sin ningún monto
  const noAmount = payments.filter(p =>
    p.status === 'Pagado' && !p.finalAmount && !p.amount
  );

  // Totales
  const totalPaid   = payments.filter(p => p.status === 'Pagado').length;
  const totalAll    = payments.length;

  // Mostrar modal de resultados
  const lines = [];

  lines.push(`<div class="space-y-4 text-sm">`);

  // Resumen general
  lines.push(`
    <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 grid grid-cols-3 gap-2 text-center">
      <div><div class="text-xl font-bold text-blue-600">${totalAll}</div><div class="text-gray-500 text-xs">Total facturas</div></div>
      <div><div class="text-xl font-bold text-green-600">${totalPaid}</div><div class="text-gray-500 text-xs">Pagadas</div></div>
      <div><div class="text-xl font-bold text-red-600">${buggedEdited.length}</div><div class="text-gray-500 text-xs">Con error</div></div>
    </div>
  `);

  // ERRORES (editados desincronizados)
  if (buggedEdited.length > 0) {
    lines.push(`<div class="border border-red-300 dark:border-red-700 rounded-lg overflow-hidden">`);
    lines.push(`<div class="bg-red-100 dark:bg-red-900/40 px-3 py-2 font-semibold text-red-700 dark:text-red-300">
      ⚠️ Facturas editadas con monto desactualizado (${buggedEdited.length})
    </div>`);
    lines.push(`<div class="divide-y divide-gray-100 dark:divide-gray-700">`);
    buggedEdited.forEach(p => {
      lines.push(`
        <div class="px-3 py-2 flex justify-between items-center gap-2">
          <div class="min-w-0">
            <span class="font-mono text-xs text-gray-500">${p.invoiceNumber || p.id}</span>
            <span class="ml-2 text-gray-700 dark:text-gray-300 truncate">${getPlayerName(p.playerId)}</span>
            <span class="ml-2 text-gray-400 text-xs truncate hidden sm:inline">${p.concept || p.type || ''}</span>
          </div>
          <div class="shrink-0 text-right">
            <span class="line-through text-red-400 text-xs">${formatCurrency(p.finalAmount)}</span>
            <span class="ml-1 font-bold text-green-600">${formatCurrency(p.amount)}</span>
          </div>
        </div>
      `);
    });
    lines.push(`</div></div>`);
  } else {
    lines.push(`<div class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg px-3 py-2 text-green-700 dark:text-green-400">
      ✅ Sin facturas editadas con error de monto
    </div>`);
  }

  // DESCUENTOS LEGÍTIMOS
  if (withDiscount.length > 0) {
    lines.push(`<div class="border border-yellow-300 dark:border-yellow-700 rounded-lg overflow-hidden">`);
    lines.push(`<div class="bg-yellow-50 dark:bg-yellow-900/30 px-3 py-2 font-semibold text-yellow-700 dark:text-yellow-300">
      🏷️ Facturas con descuento aplicado (${withDiscount.length})
    </div>`);
    lines.push(`<div class="divide-y divide-gray-100 dark:divide-gray-700">`);
    withDiscount.forEach(p => {
      const disc = p.amount - p.finalAmount;
      lines.push(`
        <div class="px-3 py-2 flex justify-between items-center gap-2">
          <div class="min-w-0">
            <span class="font-mono text-xs text-gray-500">${p.invoiceNumber || p.id}</span>
            <span class="ml-2 text-gray-700 dark:text-gray-300 truncate">${getPlayerName(p.playerId)}</span>
          </div>
          <div class="shrink-0 text-right text-xs">
            <span class="text-gray-400">${formatCurrency(p.amount)}</span>
            <span class="mx-1 text-yellow-600">- ${formatCurrency(disc)}</span>
            <span class="font-bold text-gray-700 dark:text-gray-200">= ${formatCurrency(p.finalAmount)}</span>
          </div>
        </div>
      `);
    });
    lines.push(`</div></div>`);
  }

  // SIN MONTO
  if (noAmount.length > 0) {
    lines.push(`<div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg px-3 py-2 text-red-700 dark:text-red-400">
      ❌ Facturas pagadas sin monto registrado: ${noAmount.length}
    </div>`);
  }

  // Botón reparar si hay errores
  if (buggedEdited.length > 0) {
    lines.push(`
      <button onclick="repairFinalAmounts(); closeAuditModal()"
        class="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium">
        Reparar ${buggedEdited.length} factura(s) ahora
      </button>
    `);
  }

  lines.push(`</div>`);

  // Crear y mostrar modal
  let modal = document.getElementById('auditModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'auditModal';
    modal.className = 'fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
      <div class="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
        <h2 class="font-bold text-gray-800 dark:text-white text-lg">Auditoría de Montos</h2>
        <button onclick="closeAuditModal()" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl leading-none">&times;</button>
      </div>
      <div class="overflow-y-auto flex-1 p-4">
        ${lines.join('')}
      </div>
    </div>
  `;

  modal.classList.remove('hidden');
  modal.onclick = e => { if (e.target === modal) closeAuditModal(); };
}

function closeAuditModal() {
  const modal = document.getElementById('auditModal');
  if (modal) modal.classList.add('hidden');
}

window.runAmountAudit = runAmountAudit;
window.closeAuditModal = closeAuditModal;