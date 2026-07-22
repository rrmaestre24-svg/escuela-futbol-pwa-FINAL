// ========================================
// CONTABILIDAD COMPLETA - CON EGRESOS Y OTROS INGRESOS
// 🆕 CSV MEJORADO: Factura, Fecha, Otros Ingresos
// 🆕 INCLUYE DOCUMENTO DE IDENTIDAD
// ========================================

console.log('📄 Cargando accounting.js con egresos, otros ingresos y documento de identidad...');

let accountingCharts = {};
let _accMonthlyDetail = [];

// Escape HTML para evitar XSS en texto ingresado por el usuario (motivo/observación)
// Devuelve el monto efectivo de un pago considerando descuentos.
// Usa finalAmount si está definido (incluyendo 0 = descuento 100%);
// de lo contrario, usa amount. El patrón "finalAmount || amount" era
// incorrecto porque 0 es falsy y caía al amount sin descuento.
function _getAmt(p) {
  return (p.finalAmount != null) ? p.finalAmount : (p.amount || 0);
}

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
      .filter(p => p.type === 'Mensualidad')
      .map(p => extractBillingMonth(p))
      .filter(m => m && /^\d{4}-\d{2}$/.test(m))
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

// 🆕 Contabilidad debe calcular sobre TODOS los pagos, no solo la caché
// reciente: getPayments() trae únicamente los últimos meses (paginación
// f08e810) y dejaba totales y movimientos incompletos en todos los clubs.
// _getPaymentsAll() (payments.js) mezcla caché + históricos sin duplicar.
function _accPayments() {
  return (typeof _getPaymentsAll === 'function') ? _getPaymentsAll() : getPayments();
}
function _accPaymentsByPlayer(playerId) {
  return _accPayments().filter(p => p.playerId === playerId);
}

// Renderizar todo
async function renderAccounting() {
  // 1) Render inmediato con los datos disponibles (misma UX de siempre)
  renderAccountingSummary();
  renderAccountingCharts();
  renderAccountingPlayersTable();
  renderVoidedPayments();
  renderOverduePlayers();

  // 2) Cargar pagos históricos UNA vez (silencioso) y re-renderizar con los
  //    totales completos. Si falla (offline), la vista queda con lo local.
  if (typeof loadOlderPaymentsFromSupabase === 'function') {
    try {
      const loaded = await loadOlderPaymentsFromSupabase({ silent: true });
      if (loaded) {
        renderAccountingSummary();
        renderAccountingCharts();
        renderAccountingPlayersTable();
        renderVoidedPayments();
        renderOverduePlayers();
      }
    } catch (e) {
      console.warn('[accounting] Históricos no disponibles (se muestra caché reciente):', e?.message || e);
    }
  }
}

// 🆕 RESUMEN MEJORADO - CON EGRESOS Y OTROS INGRESOS
function renderAccountingSummary() {
  const payments = _accPayments();
  const expenses = getExpenses();
  const thirdPartyIncomes = typeof getThirdPartyIncomes === 'function' ? getThirdPartyIncomes() : [];
  
  const paid = payments.filter(p => p.status === 'Pagado');
  const pending = payments.filter(p => p.status === 'Pendiente');
  
  // 💰 INGRESOS (Pagos de jugadores + Otros ingresos)
  const totalThirdParty = thirdPartyIncomes.reduce((sum, i) => sum + (i.amount || 0), 0);
  const totalPaymentsIncome = paid.reduce((sum, p) => sum + _getAmt(p), 0);
  const totalIncome = totalPaymentsIncome + totalThirdParty;
  const totalPending = pending.reduce((sum, p) => sum + _getAmt(p), 0);

  const thisMonth = paid.filter(p => p.paidDate && isThisMonth(p.paidDate));
  const thisMonthThirdParty = thirdPartyIncomes.filter(i => i.date && isThisMonth(i.date));
  const monthThirdParty = thisMonthThirdParty.reduce((sum, i) => sum + (i.amount || 0), 0);
  const monthPaymentsIncome = thisMonth.reduce((sum, p) => sum + _getAmt(p), 0);
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
  
  const payments = _accPayments().filter(p => p.status === 'Pagado' && p.paidDate);
  const expenses = getExpenses();
  const thirdPartyIncomes = typeof getThirdPartyIncomes === 'function' ? getThirdPartyIncomes() : [];
  
  const today = new Date();
  const labels = [];
  const incomeData = [];
  const expenseData = [];
  
  _accMonthlyDetail = [];

  for (let i = 11; i >= 0; i--) {
    const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const monthName = getMonthName(date.getMonth());
    const label = `${monthName} ${date.getFullYear()}`;
    labels.push(monthName.substring(0, 3));
    
    // Ingresos del mes (pagos + otros ingresos)
    const monthPayments = payments.filter(p => {
      const paymentDate = parseLocalDate(p.paidDate);
      return paymentDate.getMonth() === date.getMonth() && 
             paymentDate.getFullYear() === date.getFullYear();
    });
    const paymentsTotal = monthPayments.reduce((sum, p) => sum + _getAmt(p), 0);
    
    // 🆕 Otros ingresos del mes
    const monthThirdParty = thirdPartyIncomes.filter(i => {
      if (!i.date) return false;
      const incomeDate = parseLocalDate(i.date);
      return incomeDate.getMonth() === date.getMonth() && 
             incomeDate.getFullYear() === date.getFullYear();
    });
    const thirdPartyTotal = monthThirdParty.reduce((sum, i) => sum + (i.amount || 0), 0);
    
    incomeData.push(paymentsTotal + thirdPartyTotal);
    
    // Egresos del mes
    const monthExpenses = expenses.filter(e => {
      if (!e.date) return false;
      const expenseDate = parseLocalDate(e.date);
      return expenseDate.getMonth() === date.getMonth() && 
             expenseDate.getFullYear() === date.getFullYear();
    });
    expenseData.push(monthExpenses.reduce((sum, e) => sum + (e.amount || 0), 0));

    _accMonthlyDetail.push({
      label,
      payments: monthPayments,
      expenses: monthExpenses,
      thirdParty: monthThirdParty,
      incomeTotal: paymentsTotal + thirdPartyTotal,
      expenseTotal: monthExpenses.reduce((sum, e) => sum + (e.amount || 0), 0)
    });
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
      },
      onClick: function(_, activeElements) {
        if (activeElements.length > 0) {
          showMonthlyDetail(activeElements[0].index);
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
  const payments = _accPayments().filter(p => p.status === 'Pagado');
  
  // Obtener categorías únicas de los jugadores
  const uniqueCategories = [...new Set(players.map(p => p.category))];
  const data = [];
  
  uniqueCategories.forEach(category => {
    const categoryPlayers = players.filter(p => p.category === category);
    const playerIds = categoryPlayers.map(p => p.id);
    const categoryPayments = payments.filter(p => playerIds.includes(p.playerId));
    data.push(categoryPayments.reduce((sum, p) => sum + _getAmt(p), 0));
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
  
  const payments = _accPayments().filter(p => p.status === 'Pagado');
  const types = ['Mensualidad', 'Uniforme', 'Torneo', 'Equipamiento', 'Otro'];
  const data = [];
  
  types.forEach(type => {
    const typePayments = payments.filter(p => p.type === type);
    data.push(typePayments.reduce((sum, p) => sum + _getAmt(p), 0));
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
    const payments = _accPaymentsByPlayer(player.id);
    const paid     = payments.filter(p => p.status === 'Pagado');
    const pending  = payments.filter(p => p.status === 'Pendiente');

    const totalPaid    = paid.reduce((s, p) => s + _getAmt(p), 0);
    const totalPending = pending.reduce((s, p) => s + _getAmt(p), 0);
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

  const allPayments = _accPaymentsByPlayer(playerId);
  const pending     = allPayments.filter(p => p.status === 'Pendiente');
  const missing     = _accMissingMonthsForPlayer(player, allPayments);
  const totalPending = pending.reduce((s, p) => s + _getAmt(p), 0);

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
          .map(p => `• ${p.concept || p.type || 'Pago'}${p.dueDate ? ` (vence ${p.dueDate})` : ''} — ${formatCurrency(_getAmt(p))}`)
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
  const payments = _accPayments();
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
      'Monto': _getAmt(payment),
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
    const payments = _accPaymentsByPlayer(player.id);
    const paid = payments.filter(p => p.status === 'Pagado');
    const pending = payments.filter(p => p.status === 'Pendiente');
    
    // Obtener última factura
    const lastPayment = paid.sort((a, b) => new Date(b.paidDate || 0) - new Date(a.paidDate || 0))[0];
    
    return {
      'Jugador': player.name || 'N/A',
      'Tipo Documento': player.documentType || 'N/A', // 🆕
      'Número Documento': player.documentNumber || 'N/A', // 🆕
      'Categoría': player.category || 'N/A',
      'Total Pagado': paid.reduce((sum, p) => sum + _getAmt(p), 0),
      'Total Pendiente': pending.reduce((sum, p) => sum + _getAmt(p), 0),
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
  const payments = _accPayments();
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
      'Ingreso': payment.status === 'Pagado' ? _getAmt(payment) : 0,
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
    const clubId = localStorage.getItem('clubId');
    if (!clubId) return;

    let voidedRows = [];
    if (window.MODO_SUPABASE) {
      const res = await fetch(
        `${window.SUPA_URL}/rest/v1/voided_payments?club_id=eq.${encodeURIComponent(clubId)}&order=voided_at.desc`,
        { headers: { apikey: window.SUPA_ANON, Authorization: `Bearer ${window.SUPA_ANON}` } }
      );
      if (res.ok) {
        const rows = await res.json();
        voidedRows = rows.map(r => ({
          id:            r.id,
          invoiceNumber: r.invoice_number,
          voidedAt:      r.voided_at,
          voidedBy:      r.voided_by,
          reason:        r.reason,
          ...(r.original_data || {}),
        }));
      }
    }

    if (voidedRows.length === 0) {
      container.innerHTML = '<p class="text-gray-400 text-sm text-center py-6">Sin facturas anuladas</p>';
      // Limpiar badge
      const badge = document.getElementById('voidedCountBadge');
      if (badge) badge.textContent = '';
      return;
    }

    // Guardar para exportar y actualizar badge de cantidad
    window._voidedPaymentsCache = voidedRows;
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

function toggleOverdueSection() {
  const body = document.getElementById('overdueSectionBody');
  const chevron = document.getElementById('overdueChevron');
  if (!body) return;
  const isHidden = body.classList.toggle('hidden');
  if (chevron) chevron.style.transform = isHidden ? 'rotate(-90deg)' : 'rotate(0deg)';
}
window.toggleOverdueSection = toggleOverdueSection;

function toggleVoidedSection() {
  const body = document.getElementById('voidedSectionBody');
  const chevron = document.getElementById('voidedChevron');
  if (!body) return;
  const isHidden = body.classList.toggle('hidden');
  if (chevron) chevron.style.transform = isHidden ? 'rotate(-90deg)' : 'rotate(0deg)';
}
window.toggleVoidedSection = toggleVoidedSection;

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
  const payments = _accPayments().filter(p => p.status === 'Pagado' && (
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
      const amt = _getAmt(p);
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
  const payments = _accPayments();
  const players  = typeof getPlayers  === 'function' ? getPlayers()  : [];

  const getPlayerName = id => {
    const p = players.find(p => p.id === id);
    return p ? p.name : 'Desconocido';
  };

  // Caso 1: Pagos con finalAmount desincronizado (EL BUG)
  // Pueden ser editados, o pagos antiguos mal creados sin descuento legítimo
  const buggedEdited = payments.filter(p =>
    p.finalAmount !== undefined && p.finalAmount !== p.amount && !p.discount
  );

  // Caso 2: Pagos con finalAmount != amount (descuentos legítimos)
  const withDiscount = payments.filter(p =>
    p.finalAmount !== undefined && p.finalAmount !== p.amount && p.discount
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

// ========================================
// 📊 DETALLE MENSUAL (CLICK EN BARRA DEL GRÁFICO)
// ========================================

function showMonthlyDetail(monthIndex) {
  const data = _accMonthlyDetail && _accMonthlyDetail[monthIndex];
  if (!data) { showToast('⚠️ No hay datos para este mes'); return; }

  const payments = data.payments || [];
  const expenses = data.expenses || [];
  const thirdParty = data.thirdParty || [];
  const totalIncome = payments.reduce((s, p) => s + _getAmt(p), 0) + thirdParty.reduce((s, i) => s + (i.amount || 0), 0);
  const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);
  const neto = totalIncome - totalExpenses;

  let html = `<div class="space-y-3 text-sm">`;

  html += `<div class="grid grid-cols-3 gap-2 text-center">
    <div class="bg-green-50 dark:bg-green-900/20 rounded-lg p-2">
      <div class="text-lg font-bold text-green-600">${formatCurrency(totalIncome)}</div>
      <div class="text-xs text-gray-500">Ingresos</div>
    </div>
    <div class="bg-red-50 dark:bg-red-900/20 rounded-lg p-2">
      <div class="text-lg font-bold text-red-600">${formatCurrency(totalExpenses)}</div>
      <div class="text-xs text-gray-500">Egresos</div>
    </div>
    <div class="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-2">
      <div class="text-lg font-bold ${neto >= 0 ? 'text-green-600' : 'text-red-600'}">${formatCurrency(neto)}</div>
      <div class="text-xs text-gray-500">Neto</div>
    </div>
  </div>`;

  const allIncomes = [...payments, ...thirdParty].sort((a, b) => {
    const da = a.paidDate || a.date || '';
    const db = b.paidDate || b.date || '';
    return db.localeCompare(da);
  });

  if (allIncomes.length > 0) {
    html += `<h5 class="font-bold text-gray-700 dark:text-gray-300 mt-3">💰 Ingresos</h5>`;
    html += `<div class="max-h-60 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg">`;
    allIncomes.forEach(p => {
      const isThirdParty = !p.playerId;
      const playerName = isThirdParty ? (p.contributorName || 'Otro ingreso') : (getPlayerById(p.playerId)?.name || 'Desconocido');
      const billMonth = isThirdParty ? '-' : (extractBillingMonth(p) || '-');
      html += `<div class="px-3 py-2 flex justify-between items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-800/50">
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <span class="font-mono text-xs text-gray-400">${p.invoiceNumber || 'N/A'}</span>
            <span class="text-gray-700 dark:text-gray-200 truncate font-medium">${_accEscapeHtml(playerName)}</span>
          </div>
          <div class="text-xs text-gray-400 mt-0.5">
            ${_accEscapeHtml(p.concept || p.type || '')}
            ${billMonth !== '-' ? ` · <span class="text-teal-600 dark:text-teal-400">${billMonth}</span>` : ''}
          </div>
        </div>
        <div class="text-right shrink-0">
          <div class="font-semibold text-green-600">${formatCurrency(_getAmt(p))}</div>
          <div class="text-xs text-gray-400">${(p.paidDate || p.date || '').substring(0, 10)}</div>
        </div>
      </div>`;
    });
    html += `</div>`;
  }

  if (expenses.length > 0) {
    html += `<h5 class="font-bold text-gray-700 dark:text-gray-300 mt-3">💸 Egresos</h5>`;
    html += `<div class="max-h-40 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg">`;
    expenses.forEach(e => {
      html += `<div class="px-3 py-2 flex justify-between items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-800/50">
        <div class="min-w-0 flex-1">
          <span class="text-gray-700 dark:text-gray-200 font-medium">${_accEscapeHtml(e.concept || e.description || '')}</span>
          <div class="text-xs text-gray-400">${_accEscapeHtml(e.beneficiaryName || '')}</div>
        </div>
        <div class="text-right shrink-0">
          <div class="font-semibold text-red-600">${formatCurrency(e.amount || 0)}</div>
        </div>
      </div>`;
    });
    html += `</div>`;
  }

  html += `<div class="grid grid-cols-2 gap-2 mt-3">
    <button onclick="exportMonthlyDetailCSV(${monthIndex})"
      class="py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2">
      <i data-lucide="download" class="w-4 h-4"></i>
      CSV
    </button>
    <button onclick="generateMonthlyDetailPDF(${monthIndex})"
      class="py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2">
      <i data-lucide="file-text" class="w-4 h-4"></i>
      PDF
    </button>
  </div>`;

  html += `</div>`;

  let modal = document.getElementById('monthlyDetailModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'monthlyDetailModal';
    modal.className = 'fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col animate-scale-in">
      <div class="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
        <h2 class="font-bold text-gray-800 dark:text-white text-lg">${data.label}</h2>
        <button onclick="closeMonthlyDetailModal()" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl leading-none">&times;</button>
      </div>
      <div class="overflow-y-auto flex-1 p-4">
        ${html}
      </div>
    </div>
  `;

  modal.classList.remove('hidden');
  modal.onclick = e => { if (e.target === modal) closeMonthlyDetailModal(); };

  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    setTimeout(() => { try { lucide.createIcons(); } catch(e) { /* noop */ } }, 50);
  }
}

function closeMonthlyDetailModal() {
  const modal = document.getElementById('monthlyDetailModal');
  if (modal) modal.classList.add('hidden');
}

function exportMonthlyDetailCSV(monthIndex) {
  const data = _accMonthlyDetail && _accMonthlyDetail[monthIndex];
  if (!data) { showToast('⚠️ No hay datos'); return; }

  const rows = [];

  data.payments.forEach(p => {
    const player = getPlayerById(p.playerId);
    rows.push({
      Tipo: 'Ingreso',
      Factura: p.invoiceNumber || '',
      Fecha: (p.paidDate || '').substring(0, 10),
      Jugador: player ? player.name : 'Desconocido',
      Concepto: p.concept || p.type || '',
      'Mes Facturación': extractBillingMonth(p) || '',
      Monto: _getAmt(p),
      Método: p.method || ''
    });
  });

  data.thirdParty.forEach(i => {
    rows.push({
      Tipo: 'Otro Ingreso',
      Factura: i.invoiceNumber || '',
      Fecha: (i.date || '').substring(0, 10),
      Jugador: i.contributorName || 'Otro ingreso',
      Concepto: i.concept || '',
      'Mes Facturación': '',
      Monto: i.amount || 0,
      Método: ''
    });
  });

  data.expenses.forEach(e => {
    rows.push({
      Tipo: 'Egreso',
      Factura: e.invoiceNumber || '',
      Fecha: (e.date || '').substring(0, 10),
      Jugador: e.beneficiaryName || '',
      Concepto: e.concept || e.description || '',
      'Mes Facturación': '',
      Monto: -(e.amount || 0),
      Método: ''
    });
  });

  rows.sort((a, b) => (a.Jugador || '').localeCompare(b.Jugador || '') || a.Fecha.localeCompare(b.Fecha));

  downloadCSV(rows, `detalle-mensual-${data.label.replace(/\s+/g, '-')}.csv`);
  showToast('✅ CSV descargado');
}

function _loadPdfLibs(callback) {
  if (typeof window.jspdf !== 'undefined') {
    try { const t = new window.jspdf.jsPDF(); if (typeof t.autoTable === 'function') { callback(); return; } } catch(e) {}
  }
  showToast('📄 Cargando librería PDF...');
  const s = document.createElement('script');
  s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
  s.onload = () => {
    const s2 = document.createElement('script');
    s2.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.3/jspdf.plugin.autotable.min.js';
    s2.onload = callback;
    s2.onerror = () => showToast('❌ Error al cargar plugin de tablas');
    document.head.appendChild(s2);
  };
  s.onerror = () => showToast('❌ Error al cargar jsPDF');
  document.head.appendChild(s);
}

function generateMonthlyDetailPDF(monthIndex) {
  const data = _accMonthlyDetail && _accMonthlyDetail[monthIndex];
  if (!data) { showToast('⚠️ No hay datos'); return; }

  _loadPdfLibs(() => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const settings = typeof getSchoolSettings === 'function' ? getSchoolSettings() : {};
    const pc = [13, 148, 136];

  doc.setFillColor(...pc);
  doc.rect(0, 0, 210, 40, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont(undefined, 'bold');
  doc.text(`Detalle Mensual: ${data.label}`, 105, 18, { align: 'center' });
  doc.setFontSize(9);
  doc.setFont(undefined, 'normal');
  doc.text(settings.name || 'MI CLUB', 105, 28, { align: 'center' });

  doc.setTextColor(31, 41, 55);
  doc.setFontSize(8);
  doc.text(`Generado: ${formatDateText(getCurrentDate())}`, 15, 48);
  doc.text(`Ingresos: ${formatCurrency(data.incomeTotal)}  |  Egresos: ${formatCurrency(data.expenseTotal)}  |  Neto: ${formatCurrency(data.incomeTotal - data.expenseTotal)}`, 15, 55);

  const allIncomes = [...(data.payments || []), ...(data.thirdParty || [])].sort((a, b) => {
    const na = getPlayerById(a.playerId)?.name || a.contributorName || '';
    const nb = getPlayerById(b.playerId)?.name || b.contributorName || '';
    return na.localeCompare(nb) || (a.paidDate || a.date || '').localeCompare(b.paidDate || b.date || '');
  });

  let startY = 62;
  if (allIncomes.length > 0) {
    const incomeRows = allIncomes.map(p => {
      const isThirdParty = !p.playerId;
      const player = isThirdParty ? null : getPlayerById(p.playerId);
      return [
        isThirdParty ? (p.contributorName || 'Otro ingreso') : (player?.name || 'Desconocido'),
        p.invoiceNumber || '-',
        (p.paidDate || p.date || '').substring(0, 10),
        p.concept || p.type || '',
        isThirdParty ? '-' : (extractBillingMonth(p) || '-'),
        formatCurrency(_getAmt(p))
      ];
    });

    doc.setFontSize(9);
    doc.setFont(undefined, 'bold');
    doc.text('INGRESOS', 15, startY);
    startY += 4;

    doc.autoTable({
      startY,
      head: [['Jugador / Origen', 'Factura', 'Fecha', 'Concepto', 'Mes Fact.', 'Monto']],
      body: incomeRows,
      headStyles: { fillColor: pc, fontSize: 7 },
      bodyStyles: { fontSize: 6 },
      styles: { cellPadding: 1.5 },
      margin: { left: 15, right: 15 },
      didDrawPage: () => {}
    });
    startY = doc.lastAutoTable.finalY + 8;
  }

  const expenses = data.expenses || [];
  if (expenses.length > 0) {
    const expenseRows = expenses.map(e => [
      e.beneficiaryName || '',
      e.invoiceNumber || '-',
      (e.date || '').substring(0, 10),
      e.concept || e.description || '',
      formatCurrency(e.amount || 0)
    ]);

    doc.setFontSize(9);
    doc.setFont(undefined, 'bold');
    doc.text('EGRESOS', 15, startY);
    startY += 4;

    doc.autoTable({
      startY,
      head: [['Beneficiario', 'Factura', 'Fecha', 'Concepto', 'Monto']],
      body: expenseRows,
      headStyles: { fillColor: [220, 38, 38], fontSize: 7 },
      bodyStyles: { fontSize: 6 },
      styles: { cellPadding: 1.5 },
      margin: { left: 15, right: 15 }
    });
  }

  doc.save(`detalle-mensual-${data.label.replace(/\s+/g, '-')}.pdf`);
  showToast('✅ PDF descargado');
  });
}

// ========================================
// ⏰ JUGADORES CON PAGOS VENCIDOS
// ========================================

function renderOverduePlayers() {
  const container = document.getElementById('overduePlayersList');
  if (!container) return;

  const players = getPlayers();
  const payments = _accPayments();
  const settings = typeof getSchoolSettings === 'function' ? getSchoolSettings() : {};
  const defaultMonthlyFee = parseFloat(settings.monthlyFee) || 0;
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const overdue = [];

  players.forEach(player => {
    // Solo jugadores ACTIVOS: los inactivos no cuentan como morosos
    const _st = (player.status || 'Activo').toString().trim().toLowerCase();
    if (_st === 'inactivo' || _st === 'inactive') return;

    const playerPayments = payments.filter(p => p.playerId === player.id);

    // 1) Pagos Pendiente explícitos con dueDate vencido
    const explicitPending = playerPayments.filter(p => p.status === 'Pendiente' && p.dueDate);
    explicitPending.forEach(p => {
      const due = new Date(p.dueDate + 'T23:59:59');
      const daysOverdue = Math.floor((now - due) / (1000 * 60 * 60 * 24));
      if (daysOverdue >= 0) {
        overdue.push({ player, payment: p, daysOverdue, amount: _getAmt(p) });
      }
    });

    // 2) Meses faltantes (nunca se generó factura)
    const missing = _accMissingMonthsForPlayer(player, playerPayments);
    const monthlyTypeAmount = _getMonthlyTypeAmount(playerPayments) || defaultMonthlyFee;
    missing.forEach(ms => {
      const [y, m] = ms.split('-').map(Number);
      const due = new Date(y, m, 0, 23, 59, 59);
      const daysOverdue = Math.floor((now - due) / (1000 * 60 * 60 * 24));
      if (daysOverdue >= 0) {
        overdue.push({
          player,
          payment: { concept: `Mensualidad ${ms}`, dueDate: `${ms}-01`, amount: monthlyTypeAmount, type: 'Mensualidad' },
          daysOverdue,
          amount: monthlyTypeAmount
        });
      }
    });
  });

  overdue.sort((a, b) => b.daysOverdue - a.daysOverdue);

  const badge = document.getElementById('overdueCountBadge');
  const uniquePlayers = new Set(overdue.map(o => o.player.id));
  if (badge) badge.textContent = `${uniquePlayers.size} jugador(es) vencido(s)`;

  if (overdue.length === 0) {
    container.innerHTML = `
      <div class="flex flex-col items-center justify-center py-8 text-center">
        <div class="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-2">
          <i data-lucide="check-circle" class="w-6 h-6 text-green-500"></i>
        </div>
        <p class="text-sm text-gray-500 dark:text-gray-400">No hay jugadores activos con pagos vencidos</p>
      </div>`;
    window._overdueData = [];
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
      setTimeout(() => { try { lucide.createIcons(); } catch(e) { /* noop */ } }, 50);
    }
    return;
  }

  const grouped = {};
  overdue.forEach(o => {
    if (!grouped[o.player.id]) {
      grouped[o.player.id] = { player: o.player, totalDue: 0, items: [], maxDays: 0 };
    }
    grouped[o.player.id].totalDue += o.amount;
    grouped[o.player.id].items.push(o);
    if (o.daysOverdue > grouped[o.player.id].maxDays) grouped[o.player.id].maxDays = o.daysOverdue;
  });

  const sortedPlayers = Object.values(grouped).sort((a, b) => b.maxDays - a.maxDays);
  window._overdueData = sortedPlayers;

  // ── Render AGRUPADO POR CATEGORÍA ──
  // Una lista plana de 23 morosos no dice nada; agrupada muestra de una qué
  // categoría está más atrasada y cuánto debe cada una.
  const _daysBadge = (d) => d >= 60
    ? 'bg-red-500 text-white'
    : d >= 30
      ? 'bg-orange-500 text-white'
      : 'bg-amber-500 text-white';
  const _defAv = (typeof getDefaultAvatar === 'function') ? getDefaultAvatar() : '';

  // Agrupar por categoría (los jugadores sin categoría van juntos al final)
  const byCat = {};
  sortedPlayers.forEach(g => {
    const cat = (g.player.category || '').toString().trim() || 'Sin categoría';
    if (!byCat[cat]) byCat[cat] = { cat, players: [], totalDue: 0, maxDays: 0 };
    byCat[cat].players.push(g);
    byCat[cat].totalDue += g.totalDue;
    if (g.maxDays > byCat[cat].maxDays) byCat[cat].maxDays = g.maxDays;
  });

  // Orden natural por nombre de categoría ("Categoría 2014" antes que "2015"),
  // pero "Sin categoría" siempre al final.
  const cats = Object.values(byCat).sort((a, b) => {
    if (a.cat === 'Sin categoría') return 1;
    if (b.cat === 'Sin categoría') return -1;
    return a.cat.localeCompare(b.cat, 'es', { numeric: true });
  });

  const _playerCard = (g) => {
    const monthsStr = _getOverdueMonths(g.items);
    const guardian = g.player.guardianName || g.player.parentName || g.player.phone || '';
    const avatar = g.player.avatar || _defAv;
    const monthChips = monthsStr
      ? monthsStr.split(', ').map(m => `<span class="inline-block text-[9px] font-medium px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">${_accEscapeHtml(m)}</span>`).join('')
      : '';
    return `
      <div class="glass-card rounded-xl p-3 shadow-sm flex items-center gap-3">
        <img src="${_accEscapeHtml(avatar)}" alt="" loading="lazy" class="w-11 h-11 rounded-full object-cover border-2 border-teal-500 shrink-0">
        <div class="flex-1 min-w-0">
          <div class="text-sm font-semibold text-gray-800 dark:text-white truncate">${_accEscapeHtml(g.player.name)}</div>
          ${guardian ? `<div class="text-[11px] text-gray-500 dark:text-gray-400 truncate">${_accEscapeHtml(guardian)}</div>` : ''}
          ${monthChips ? `<div class="flex flex-wrap gap-1 mt-1.5">${monthChips}</div>` : ''}
        </div>
        <div class="text-right shrink-0">
          <div class="text-sm font-bold text-gray-900 dark:text-white whitespace-nowrap">${formatCurrency(g.totalDue)}</div>
          <span class="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${_daysBadge(g.maxDays)}">${g.maxDays}d</span>
        </div>
        <button type="button" data-ov-wa="${_accEscapeHtml(g.player.id)}" class="shrink-0 w-9 h-9 rounded-full bg-green-500 hover:bg-green-600 text-white flex items-center justify-center transition-colors shadow-sm" title="Recordar por WhatsApp">
          <i data-lucide="message-circle" class="w-4 h-4"></i>
        </button>
      </div>`;
  };

  container.innerHTML = `<div class="space-y-3">` + cats.map(c => {
    const collapsed = _ovCollapsed.has(c.cat);
    const n = c.players.length;
    return `
      <div class="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
        <button type="button" data-ov-cat="${_accEscapeHtml(c.cat)}"
          class="w-full flex items-center justify-between gap-2 px-3 py-2.5 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700/70 transition-colors text-left">
          <div class="flex items-center gap-2 min-w-0">
            <i data-lucide="chevron-down" class="w-4 h-4 text-gray-400 shrink-0 transition-transform duration-200" style="${collapsed ? 'transform:rotate(-90deg)' : ''}"></i>
            <span class="text-sm font-bold text-gray-800 dark:text-white truncate">${_accEscapeHtml(c.cat)}</span>
            <span class="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500 text-white">${n}</span>
          </div>
          <div class="text-right shrink-0">
            <div class="text-sm font-bold text-red-600 dark:text-red-400 whitespace-nowrap">${formatCurrency(c.totalDue)}</div>
            <div class="text-[10px] text-gray-500 dark:text-gray-400">${n} jugador${n === 1 ? '' : 'es'}</div>
          </div>
        </button>
        <div class="p-2 space-y-2.5 bg-white/40 dark:bg-gray-900/30 ${collapsed ? 'hidden' : ''}">
          ${c.players.map(_playerCard).join('')}
        </div>
      </div>`;
  }).join('') + `</div>`;

  _ovWireCategories(container);

  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    setTimeout(() => { try { lucide.createIcons(); } catch(e) { /* noop */ } }, 50);
  }
}

// Categorías plegadas por el usuario. Se guarda en memoria para que un
// re-render (ej. al registrar un pago) no vuelva a abrir todo.
const _ovCollapsed = new Set();

// Listeners por delegación: el nombre de la categoría y el id del jugador van
// en data-* y NUNCA interpolados en onclick (evita romper el HTML o inyectar
// código si un dato trae comillas).
function _ovWireCategories(container) {
  if (!container || container._ovWired) return;
  container._ovWired = true;

  container.addEventListener('click', function (ev) {
    const catBtn = ev.target.closest('[data-ov-cat]');
    if (catBtn) {
      const cat = catBtn.getAttribute('data-ov-cat');
      if (_ovCollapsed.has(cat)) _ovCollapsed.delete(cat); else _ovCollapsed.add(cat);
      const body = catBtn.nextElementSibling;
      const chev = catBtn.querySelector('[data-lucide="chevron-down"], .lucide-chevron-down, svg');
      if (body) body.classList.toggle('hidden', _ovCollapsed.has(cat));
      if (chev) chev.style.transform = _ovCollapsed.has(cat) ? 'rotate(-90deg)' : '';
      return;
    }

    const waBtn = ev.target.closest('[data-ov-wa]');
    if (waBtn && typeof sendPendingReminderWA === 'function') {
      sendPendingReminderWA(waBtn.getAttribute('data-ov-wa'));
    }
  });
}

function _getMonthlyTypeAmount(playerPayments) {
  const paid = playerPayments.filter(p => (p.type === 'Mensualidad' || p.concept === 'Mensualidad') && p.status === 'Pagado' && p.amount);
  if (paid.length === 0) return 0;
  const total = paid.reduce((s, p) => s + _getAmt(p), 0);
  return Math.round(total / paid.length);
}

function _getOverdueMonths(items) {
  const months = new Set();
  items.forEach(item => {
    const p = item.payment;
    const bm = extractBillingMonth(p);
    if (bm) { months.add(bm); return; }
    if (p.concept && p.concept.startsWith('Mensualidad ')) {
      const parts = p.concept.split(' ');
      if (parts[1] && /^\d{4}-\d{2}$/.test(parts[1])) { months.add(parts[1]); return; }
    }
    if (p.dueDate && /^\d{4}-\d{2}/.test(p.dueDate)) months.add(p.dueDate.substring(0, 7));
  });
  return Array.from(months).sort().map(m => _accFormatBillingMonth(m)).join(', ');
}

function generateOverduePDF() {
  const data = window._overdueData || [];
  if (data.length === 0) { showToast('⚠️ No hay jugadores vencidos'); return; }

  _loadPdfLibs(() => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const settings = getSchoolSettings();
    const primaryColor = [13, 148, 136];

    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text('JUGADORES CON PAGOS VENCIDOS', 105, 20, { align: 'center' });
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(settings.name || 'MI CLUB', 105, 30, { align: 'center' });

    doc.setTextColor(31, 41, 55);
    doc.setFontSize(8);
    doc.text(`Generado: ${formatDateText(getCurrentDate())}`, 15, 48);

    // Mismo criterio que la vista: agrupado por categoría, y dentro por nombre.
    const sorted = [...data].sort((a, b) => {
      const ca = (a.player.category || 'zzz').toString();
      const cb = (b.player.category || 'zzz').toString();
      const c = ca.localeCompare(cb, 'es', { numeric: true });
      if (c !== 0) return c;
      return (a.player.name || '').localeCompare(b.player.name || '');
    });
    const rows = sorted.map(g => [
      g.player.category || '—',
      g.player.name || '',
      g.player.guardianName || g.player.parentName || g.player.phone || '-',
      formatCurrency(g.totalDue),
      `${g.maxDays} día(s)`,
      g.player.phone || ''
    ]);

    doc.autoTable({
      startY: 55,
      head: [['Categoría', 'Jugador', 'Acudiente', 'Monto Adeudado', 'Días Vencido', 'Teléfono']],
      body: rows,
      headStyles: { fillColor: primaryColor, fontSize: 8 },
      bodyStyles: { fontSize: 7 },
      styles: { cellPadding: 2 },
      margin: { top: 55 }
    });

    doc.save(`jugadores-vencidos-${getCurrentDate()}.pdf`);
    showToast('✅ PDF descargado');
  });
}

function toggleMorososSection() {
  const content = document.getElementById('morososContent');
  const btnText = document.getElementById('morososBtnText');
  const chevron = document.getElementById('morososBtnChevron');
  if (!content) return;
  const isNowHidden = content.classList.toggle('hidden');
  if (!isNowHidden) {
    renderOverduePlayers();
    renderAccountingPlayersTable();
    if (btnText) btnText.textContent = 'Morosos';
    if (chevron) chevron.style.transform = 'rotate(0deg)';
  } else {
    if (btnText) btnText.textContent = 'Ver Morosos';
    if (chevron) chevron.style.transform = '';
  }
}
window.toggleMorososSection = toggleMorososSection;

window.showMonthlyDetail = showMonthlyDetail;
window.closeMonthlyDetailModal = closeMonthlyDetailModal;
window.exportMonthlyDetailCSV = exportMonthlyDetailCSV;
window.generateOverduePDF = generateOverduePDF;
window.generateMonthlyDetailPDF = generateMonthlyDetailPDF;
