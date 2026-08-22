import { parseLogs } from './parser.js';
import { 
  setCurrentUserId, 
  savePurchases, 
  loadPurchases, 
  saveRawLogs, 
  loadRawLogs, 
  saveMyExpenses, 
  loadMyExpenses,
  saveGlobalArchive,
  loadGlobalArchive,
  clearGlobalArchive
} from './store.js';
import { 
  filterRecordsByPeriod, 
  groupRecordsByTimeSlot, 
  getTopClients, 
  calculateWeeklyHeatmap, 
  safeParseDate 
} from './analytics.js';
import { generateForecasts } from './forecasting.js';
import { getTelegramUser } from './telegram.js';
import { exportArchiveToTxt } from './export.js';

let currentUser = null;
let purchases = {};
let myExpenses = [];
let currentRecordsBatch = [];
let globalArchiveRecords = [];
let currentPeriod = 'week';
let activeTabIdx = 0;

let chartRevenueInstance = null;
let chartWeightInstance = null;
let chartBubbleInstance = null;

const categoryColorMap = {};
function getCategoryColor(categoryName) {
  if (!categoryColorMap[categoryName]) {
    let hash = 0;
    for (let i = 0; i < categoryName.length; i++) {
      hash = categoryName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    categoryColorMap[categoryName] = {
      bg: `hsla(${hue}, 85%, 60%, 0.15)`,
      border: `hsla(${hue}, 85%, 60%, 0.5)`,
      text: `hsl(${hue}, 90%, 65%)`
    };
  }
  return categoryColorMap[categoryName];
}

document.addEventListener('DOMContentLoaded', () => {
  initUserSession();

  purchases = loadPurchases();
  myExpenses = loadMyExpenses();
  globalArchiveRecords = loadGlobalArchive();

  initNavigation();
  initSwipeNavigation();
  initPurchasesUI();
  initQuickButtons();
  initMyExpensesEvents();

  const rawInputEl = document.getElementById('rawInput');
  if (rawInputEl) {
    rawInputEl.value = loadRawLogs();
  }

  processCurrentInput();

  const btnCalc = document.getElementById('btnCalculate');
  if (btnCalc) btnCalc.addEventListener('click', processCurrentInput);

  const btnClearInput = document.getElementById('btnClearInput');
  if (btnClearInput && rawInputEl) {
    btnClearInput.addEventListener('click', () => {
      rawInputEl.value = '';
      currentRecordsBatch = [];
      processCurrentInput();
      rawInputEl.focus();
    });
  }

  const btnAddPur = document.getElementById('btnAddPurchase');
  if (btnAddPur) btnAddPur.addEventListener('click', handleAddPurchase);

  const btnClearArch = document.getElementById('btnClearArchive');
  if (btnClearArch) {
    btnClearArch.addEventListener('click', () => {
      if (confirm('Дійсно очистити весь глобальний архів?')) {
        clearGlobalArchive();
        globalArchiveRecords = [];
        renderAnalyticsPage();
      }
    });
  }

  const btnExport = document.getElementById('btnExportTxt');
  if (btnExport) {
    btnExport.addEventListener('click', () => exportArchiveToTxt(globalArchiveRecords, currentPeriod));
  }

  document.querySelectorAll('.btn-period').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.btn-period').forEach(b => {
        b.className = 'btn-period px-3 py-1 text-xs font-bold rounded-lg text-gray-400 hover:text-white transition';
      });
      e.target.className = 'btn-period px-3 py-1 text-xs font-bold rounded-lg bg-neonGreen/20 text-neonGreen border border-neonGreen/40 transition';
      currentPeriod = e.target.getAttribute('data-period');
      renderAnalyticsPage();
    });
  });
});

function initUserSession() {
  currentUser = getTelegramUser();
  setCurrentUserId(currentUser.id);

  const userNameEl = document.getElementById('userName');
  const userHandleEl = document.getElementById('userHandle');
  const userAvatarEl = document.getElementById('userAvatar');

  if (userNameEl) userNameEl.innerText = `${currentUser.firstName} ${currentUser.lastName}`.trim();
  if (userHandleEl) userHandleEl.innerText = currentUser.username || `id: ${currentUser.id}`;

  if (userAvatarEl) {
    if (currentUser.photoUrl) {
      userAvatarEl.innerHTML = `<img src="${currentUser.photoUrl}" class="w-full h-full rounded-full object-cover">`;
    } else {
      userAvatarEl.innerText = (currentUser.firstName.charAt(0) || 'U').toUpperCase();
    }
  }
}

function setActiveTab(index) {
  activeTabIdx = index;
  
  document.getElementById('pageDashboard')?.classList.toggle('hidden', index !== 0);
  document.getElementById('pageAnalytics')?.classList.toggle('hidden', index !== 1);
  document.getElementById('pageForecast')?.classList.toggle('hidden', index !== 2);

  const btnDash = document.getElementById('tabDashboard');
  const btnAnal = document.getElementById('tabAnalytics');
  const btnFore = document.getElementById('tabForecast');

  if (btnDash) btnDash.className = index === 0 ? 'px-3 py-1.5 rounded-xl bg-tgBlue text-white shadow-lg transition-all' : 'px-3 py-1.5 rounded-xl text-gray-400 hover:text-white transition-all';
  if (btnAnal) btnAnal.className = index === 1 ? 'px-3 py-1.5 rounded-xl bg-tgBlue text-white shadow-lg transition-all' : 'px-3 py-1.5 rounded-xl text-gray-400 hover:text-white transition-all';
  if (btnFore) btnFore.className = index === 2 ? 'px-3 py-1.5 rounded-xl bg-tgBlue text-white shadow-lg transition-all' : 'px-3 py-1.5 rounded-xl text-gray-400 hover:text-white transition-all';

  if (index === 1) renderAnalyticsPage();
  if (index === 2) renderForecastPage();
}

function initNavigation() {
  document.getElementById('tabDashboard')?.addEventListener('click', () => setActiveTab(0));
  document.getElementById('tabAnalytics')?.addEventListener('click', () => setActiveTab(1));
  document.getElementById('tabForecast')?.addEventListener('click', () => setActiveTab(2));
}

function initSwipeNavigation() {
  let touchStartX = 0;
  let touchStartY = 0;
  const container = document.getElementById('swipeContainer');
  if (!container) return;

  container.addEventListener('touchstart', e => {
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
  }, { passive: true });

  container.addEventListener('touchend', e => {
    const diffX = e.changedTouches[0].screenX - touchStartX;
    const diffY = e.changedTouches[0].screenY - touchStartY;

    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 60) {
      if (diffX < 0 && activeTabIdx < 2) setActiveTab(activeTabIdx + 1);
      if (diffX > 0 && activeTabIdx > 0) setActiveTab(activeTabIdx - 1);
    }
  }, { passive: true });
}

function initQuickButtons() {
  document.querySelectorAll('.btn-quick-expense').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const name = e.target.getAttribute('data-name') || e.target.innerText.replace(/[^a-zA-Z]/g, '').trim();
      const noteInput = document.getElementById('myExpenseNote');
      const amountInput = document.getElementById('myExpenseAmount');
      if (noteInput) noteInput.value = name;
      if (amountInput) amountInput.focus();
    });
  });
}

function initMyExpensesEvents() {
  const btnInc = document.getElementById('btnAddIncome');
  const btnExp = document.getElementById('btnAddExpense');
  if (btnInc) btnInc.addEventListener('click', () => addMyExpenseItem('income'));
  if (btnExp) btnExp.addEventListener('click', () => addMyExpenseItem('expense'));
}

function addMyExpenseItem(type) {
  const noteInput = document.getElementById('myExpenseNote');
  const amountInput = document.getElementById('myExpenseAmount');
  if (!noteInput || !amountInput) return;

  const note = noteInput.value.trim();
  const amount = parseFloat(amountInput.value);

  if (!note || isNaN(amount) || amount <= 0) return;

  myExpenses.push({
    id: Date.now(),
    note,
    amount: type === 'expense' ? -amount : amount,
    type
  });

  saveMyExpenses(myExpenses);
  noteInput.value = '';
  amountInput.value = '';
  processCurrentInput();
}

function renderMyExpensesList() {
  const container = document.getElementById('myExpensesList');
  if (!container) return;

  let totalCustom = 0;
  container.innerHTML = myExpenses.map((item, idx) => {
    totalCustom += item.amount;
    const isInc = item.amount > 0;
    return `
      <div class="flex justify-between items-center bg-slate-950/60 p-2 rounded-xl border border-glassBorder text-[11px]">
        <span class="text-gray-300">${item.note}</span>
        <div class="flex items-center gap-2">
          <span class="font-mono font-bold ${isInc ? 'text-emerald-400' : 'text-neonRed'}">
            ${isInc ? '+' : ''}${item.amount} €
          </span>
          <button data-idx="${idx}" class="btn-del-expense text-gray-500 hover:text-red-400 font-bold">✕</button>
        </div>
      </div>
    `;
  }).join('');

  const disp = document.getElementById('myTotalDisplay');
  if (disp) disp.innerText = `${totalCustom.toFixed(1)} €`;

  document.querySelectorAll('.btn-del-expense').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(e.target.getAttribute('data-idx'), 10);
      myExpenses.splice(idx, 1);
      saveMyExpenses(myExpenses);
      processCurrentInput();
    });
  });
}

function processCurrentInput() {
  const rawInput = document.getElementById('rawInput');
  const rawText = rawInput ? rawInput.value : '';
  saveRawLogs(rawText);

  currentRecordsBatch = parseLogs(rawText);

  if (currentRecordsBatch.length > 0) {
    globalArchiveRecords = saveGlobalArchive(currentRecordsBatch);
  } else {
    globalArchiveRecords = loadGlobalArchive();
  }

  currentRecordsBatch.forEach(r => {
    if (r.category && r.category !== 'UNCATEGORIZED' && purchases[r.category] === undefined) {
      purchases[r.category] = { costPer100g: 600, totalGramsPurchased: 0 };
      savePurchases(purchases);
    }
  });

  initPurchasesUI();

  let totalRevenue = 0;
  let totalCash = 0;
  let totalCard = 0;
  let totalCostOfGoods = 0;
  let totalExactWeight = 0;
  let totalBonusWeight = 0;
  let totalBonusCost = 0;

  let totalNewDebts = 0;
  let totalRepaidDebts = 0;

  const clientDebtsMap = {};

  currentRecordsBatch.forEach(r => {
    totalRevenue += r.eurPaid;
    if (r.isCard) {
      totalCard += r.eurPaid;
    } else {
      totalCash += r.eurPaid;
    }

    totalExactWeight += r.exactGramm;
    totalBonusWeight += r.bonusGramm;

    const purObj = purchases[r.category];
    const costFor100g = typeof purObj === 'object' ? (purObj.costPer100g || 0) : (purObj || 0);
    const costPerExactGram = costFor100g / 110; 
    const costPerRawGram = costFor100g / 100;

    const baseCost = (r.baseGramm * 1.1) * costPerExactGram;
    const bonusCost = r.bonusGramm * costPerRawGram;

    totalCostOfGoods += (baseCost + bonusCost);
    totalBonusCost += bonusCost;

    totalNewDebts += r.debtNew;
    totalRepaidDebts += r.debtRepaid;

    if (!clientDebtsMap[r.clientName]) {
      clientDebtsMap[r.clientName] = { newDebt: 0, repaidDebt: 0 };
    }
    clientDebtsMap[r.clientName].newDebt += r.debtNew;
    clientDebtsMap[r.clientName].repaidDebt += r.debtRepaid;
  });

  let totalActiveDebt = 0;
  Object.keys(clientDebtsMap).forEach(client => {
    const netDebt = clientDebtsMap[client].newDebt - clientDebtsMap[client].repaidDebt;
    if (netDebt > 0) totalActiveDebt += netDebt;
  });

  const pureMyExpenses = myExpenses
    .filter(item => item.amount < 0)
    .reduce((acc, item) => acc + Math.abs(item.amount), 0);

  const netProfit = totalRevenue - totalCostOfGoods - pureMyExpenses;
  const factNetProfit = netProfit;
  const factReceived = totalRevenue - totalNewDebts + totalRepaidDebts - pureMyExpenses;

  const setTxt = (id, txt) => {
    const el = document.getElementById(id);
    if (el) el.innerText = txt;
  };

  setTxt('kpiRevenue', `${totalRevenue.toFixed(1)} €`);
  setTxt('kpiFactReceived', `${factReceived.toFixed(1)} €`);
  setTxt('kpiNetProfit', `${netProfit.toFixed(1)} €`);
  setTxt('kpiFactNetProfit', `${factNetProfit.toFixed(1)} €`);

  setTxt('kpiCashCard', `${totalCash.toFixed(0)} / ${totalCard.toFixed(0)} €`);
  setTxt('kpiActiveDebt', `${totalActiveDebt.toFixed(1)} €`);

  setTxt('myCardTotal', `${totalCard.toFixed(1)} €`);
  setTxt('myBonusCostTotal', `${totalBonusCost.toFixed(1)} €`);

  renderTopClients();
  renderMyExpensesList();
  renderDebts(clientDebtsMap);
  renderCurrentTable(currentRecordsBatch);

  if (activeTabIdx === 1) renderAnalyticsPage();
  if (activeTabIdx === 2) renderForecastPage();
}

function renderTopClients() {
  const container = document.getElementById('topClientsList');
  if (!container) return;

  const topList = getTopClients(currentRecordsBatch, 3);
  if (topList.length === 0) {
    container.innerHTML = '<p class="text-xs text-gray-500">Немає даних</p>';
    return;
  }

  container.innerHTML = topList.map((c, i) => {
    const clientDeals = currentRecordsBatch
      .filter(r => (r.clientName || '').toLowerCase() === c.clientName.toLowerCase())
      .slice(-3)
      .reverse();

    return `
      <details class="group bg-slate-900/60 rounded-2xl border border-glassBorder overflow-hidden transition">
        <summary class="flex justify-between items-center p-3 cursor-pointer select-none">
          <div>
            <span class="text-xs font-bold text-white">${i + 1}. ${c.clientName}</span>
            <span class="ml-2 text-[10px] bg-tgBlue/20 text-tgBlue px-2 py-0.5 rounded-full font-mono">${c.dealsCount} угод</span>
          </div>
          <div class="text-xs font-mono font-bold text-neonGreen">
            ${c.totalSpent.toFixed(1)} € / ${c.totalWeight.toFixed(1)}г
          </div>
        </summary>
        <div class="px-3 pb-3 space-y-1.5 pt-1 border-t border-glassBorder/50 bg-slate-950/40">
          <div class="text-[10px] text-gray-400 font-bold uppercase">Останні 3 покупки:</div>
          ${clientDeals.length > 0 ? clientDeals.map(d => `
            <div class="flex justify-between text-[11px] font-mono text-gray-300">
              <span>${d.category} (${d.exactGramm.toFixed(1)}г)</span>
              <span class="text-white font-bold">${d.eurPaid} €</span>
            </div>
          `).join('') : '<div class="text-[10px] text-gray-500">Немає деталей</div>'}
        </div>
      </details>
    `;
  }).join('');
}

function initPurchasesUI() {
  const container = document.getElementById('purchasesList');
  if (!container) return;
  container.innerHTML = Object.keys(purchases).map(cat => {
    const p = purchases[cat];
    const cost = typeof p === 'object' ? p.costPer100g : p;
    const grams = typeof p === 'object' ? (p.totalGramsPurchased || 0) : 0;
    return `
      <div class="flex justify-between items-center bg-slate-950/60 p-2 rounded-xl border border-glassBorder">
        <span class="font-bold text-gray-300">${cat}</span>
        <span class="font-mono text-neonYellow">${cost} € / 100g ${grams ? `(${grams}г)` : ''}</span>
      </div>
    `;
  }).join('');
}

function handleAddPurchase() {
  const nameInput = document.getElementById('newCatName');
  const costInput = document.getElementById('newCatCost');
  const gramsInput = document.getElementById('newCatGrams');
  if (!nameInput || !costInput) return;

  const name = nameInput.value.trim().toUpperCase();
  const cost = parseFloat(costInput.value);
  const grams = gramsInput ? parseFloat(gramsInput.value) || 0 : 0;

  if (name && !isNaN(cost) && cost > 0) {
    purchases[name] = { costPer100g: cost, totalGramsPurchased: grams };
    savePurchases(purchases);
    initPurchasesUI();
    processCurrentInput();
    nameInput.value = '';
    costInput.value = '';
    if (gramsInput) gramsInput.value = '';
  }
}

function renderDebts(debtsMap) {
  const activeContainer = document.getElementById('activeDebtsList');
  const repaidContainer = document.getElementById('repaidDebtsList');
  if (!activeContainer || !repaidContainer) return;

  let activeHtml = '';
  let repaidHtml = '';

  Object.keys(debtsMap).forEach(client => {
    const { newDebt, repaidDebt } = debtsMap[client];
    const balance = newDebt - repaidDebt;

    if (balance > 0) {
      activeHtml += `<div class="flex justify-between"><span>${client}</span><span class="text-neonRed font-bold">-${balance.toFixed(1)} €</span></div>`;
    }
    if (repaidDebt > 0) {
      repaidHtml += `<div class="flex justify-between"><span>${client}</span><span class="text-emerald-400 font-bold">+${repaidDebt.toFixed(1)} €</span></div>`;
    }
  });

  activeContainer.innerHTML = activeHtml || '<p class="text-gray-500">Немає боргів</p>';
  repaidContainer.innerHTML = repaidHtml || '<p class="text-gray-500">Немає погашень</p>';
}

function renderCurrentTable(records) {
  const tbody = document.getElementById('recordsTableBody');
  if (!tbody) return;

  tbody.innerHTML = records.map(r => {
    const isHighValue = (r.eurPaid || 0) >= 50;
    const rowClass = isHighValue ? 'bg-amber-500/10 font-bold border-l-2 border-amber-400' : 'hover:bg-white/5';
    const color = getCategoryColor(r.category);

    return `
      <tr class="${rowClass} transition border-b border-glassBorder/30">
        <td class="p-2.5 font-bold" style="color: ${color.text}">${r.category || 'UNCATEGORIZED'}</td>
        <td class="p-2.5 text-gray-200">${r.clientName || 'Гість'}</td>
        <td class="p-2.5 font-mono">${r.baseGramm || 0}${r.bonusGramm > 0 ? `<span class="text-neonPurple">+!${r.bonusGramm}б</span>` : ''}</td>
        <td class="p-2.5 font-mono font-bold text-neonGreen">${(r.exactGramm || 0).toFixed(2)}г</td>
        <td class="p-2.5">${r.isCard ? '<span class="text-tgBlue font-bold">💳 Карта</span>' : '💵 Готівка'}</td>
        <td class="p-2.5 ${isHighValue ? 'text-amber-300 font-extrabold text-sm' : ''}">${r.eurPaid || 0} €</td>
        <td class="p-2.5 text-neonYellow">${r.rawDebtText || '-'}</td>
        <td class="p-2.5 text-gray-400 text-[10px]">${r.timeStr || '--:--'}</td>
      </tr>
    `;
  }).join('');
}

function renderAnalyticsPage() {
  const archiveTotalCountEl = document.getElementById('archiveTotalCount');
  if (archiveTotalCountEl) archiveTotalCountEl.innerText = globalArchiveRecords.length;

  const filtered = filterRecordsByPeriod(globalArchiveRecords, currentPeriod);

  const sortedArchive = [...filtered].sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return safeParseDate(a.parsedDateObj) - safeParseDate(b.parsedDateObj);
  });

  renderArchiveTable(sortedArchive);
  renderHeatmap();

  if (typeof Chart === 'undefined') return;

  const grouped = groupRecordsByTimeSlot(filtered, currentPeriod);
  const labels = Object.keys(grouped);
  const revenues = labels.map(k => grouped[k].revenue);
  const weights = labels.map(k => grouped[k].weight);

  if (chartRevenueInstance) chartRevenueInstance.destroy();
  if (chartWeightInstance) chartWeightInstance.destroy();
  if (chartBubbleInstance) chartBubbleInstance.destroy();

  const canvasR = document.getElementById('chartTimeRevenue');
  const canvasW = document.getElementById('chartTimeWeight');
  const canvasB = document.getElementById('chartBubbleDeals');

  if (canvasR) {
    const ctxR = canvasR.getContext('2d');
    chartRevenueInstance = new Chart(ctxR, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Виручка (€)',
          data: revenues,
          borderColor: '#00FF88',
          backgroundColor: 'rgba(0,255,136,0.1)',
          fill: true,
          tension: 0.3
        }]
      },
      options: { 
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color: '#fff' } } },
        scales: {
          x: { ticks: { color: '#9ca3af' }, grid: { color: 'rgba(255,255,255,0.05)' } },
          y: { ticks: { color: '#9ca3af' }, grid: { color: 'rgba(255,255,255,0.05)' }, beginAtZero: true }
        }
      }
    });
  }

  if (canvasW) {
    const ctxW = canvasW.getContext('2d');
    chartWeightInstance = new Chart(ctxW, {
      type: 'bar',
      data: {
        labels,
        datasets: [{ label: 'Точна вага (г)', data: weights, backgroundColor: '#9D00FF' }]
      },
      options: { 
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color: '#fff' } } },
        scales: {
          x: { ticks: { color: '#9ca3af' }, grid: { color: 'rgba(255,255,255,0.05)' } },
          y: { ticks: { color: '#9ca3af' }, grid: { color: 'rgba(255,255,255,0.05)' }, beginAtZero: true }
        }
      }
    });
  }

  if (canvasB) {
    const ctxB = canvasB.getContext('2d');
    const bubbleData = filtered.map(r => {
      const d = safeParseDate(r.parsedDateObj);
      const hours = d.getHours() + (d.getMinutes() / 60);
      return { x: parseFloat(hours.toFixed(2)), y: r.eurPaid || 0, r: Math.min(Math.max((r.exactGramm || 0) * 1.2, 3), 20) };
    }).filter(item => !isNaN(item.x) && !isNaN(item.y));

    chartBubbleInstance = new Chart(ctxB, {
      type: 'bubble',
      data: {
        datasets: [{
          label: 'Угоди (Година vs Оплата vs Вага)',
          data: bubbleData,
          backgroundColor: 'rgba(36, 161, 222, 0.4)',
          borderColor: '#24A1DE',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color: '#fff' } } },
        scales: {
          x: { title: { display: true, text: 'Година доби (0-24h)', color: '#9ca3af' }, min: 0, max: 24, ticks: { color: '#9ca3af' }, grid: { color: 'rgba(255,255,255,0.05)' } },
          y: { title: { display: true, text: 'Сума (€)', color: '#9ca3af' }, beginAtZero: true, ticks: { color: '#9ca3af' }, grid: { color: 'rgba(255,255,255,0.05)' } }
        }
      }
    });
  }
}

function renderHeatmap() {
  const container = document.getElementById('heatmapGrid');
  const selectEl = document.getElementById('heatmapMonthSelect');
  if (!container) return;

  const monthVal = selectEl ? selectEl.value : 'all';
  const { matrix, maxVal } = calculateWeeklyHeatmap(globalArchiveRecords, monthVal);
  const dayLabels = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  
  let html = `<div class="grid grid-cols-[40px_repeat(24,1fr)] gap-1 items-center font-bold text-gray-400 text-center mb-1"><div></div>`;
  for (let h = 0; h < 24; h++) html += `<div>${h}h</div>`;
  html += `</div>`;

  dayLabels.forEach((dayName, dayIdx) => {
    html += `<div class="grid grid-cols-[40px_repeat(24,1fr)] gap-1 items-center">`;
    html += `<div class="text-gray-300 font-bold text-right pr-2">${dayName}</div>`;

    for (let h = 0; h < 24; h++) {
      const val = matrix[dayIdx][h];
      const intensity = maxVal > 0 ? (val / maxVal) : 0;
      const alpha = val > 0 ? Math.max(intensity, 0.15).toFixed(2) : 0.03;
      const bgColor = val > 0 ? `rgba(0, 255, 136, ${alpha})` : `rgba(255, 255, 255, 0.03)`;
      const textColor = intensity > 0.5 ? '#000' : '#fff';

      html += `
        <div class="h-7 rounded flex items-center justify-center text-[9px] transition hover:scale-110 cursor-pointer border border-glassBorder"
             style="background-color: ${bgColor}; color: ${textColor};"
             title="${dayName}, ${h}:00 - Виручка: ${val.toFixed(1)} €">
          ${val > 0 ? `${Math.round(val)}` : ''}
        </div>
      `;
    }
    html += `</div>`;
  });

  container.innerHTML = html;

  if (selectEl && !selectEl.dataset.initialized) {
    selectEl.addEventListener('change', () => renderHeatmap());
    selectEl.dataset.initialized = 'true';
  }
}

function renderArchiveTable(records) {
  const tbody = document.getElementById('archiveTableBody');
  if (!tbody) return;

  if (records.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="p-4 text-center text-gray-500">Архів порожній за цей період</td></tr>';
    return;
  }

  tbody.innerHTML = records.map(r => {
    const color = getCategoryColor(r.category);
    return `
      <tr class="hover:bg-white/5 transition border-b border-glassBorder">
        <td class="p-2 font-bold" style="color: ${color.text}">${r.category}</td>
        <td class="p-2 text-gray-200">${r.clientName}</td>
        <td class="p-2 font-mono">${r.rawGramm}</td>
        <td class="p-2 font-mono font-bold text-neonGreen">${(r.exactGramm || 0).toFixed(2)}г</td>
        <td class="p-2">${r.isCard ? '<span class="text-tgBlue font-bold">💳 Карта</span>' : '💵 Готівка'}</td>
        <td class="p-2 font-bold">${r.eurPaid} €</td>
        <td class="p-2 text-neonYellow">${r.rawDebtText || '-'}</td>
        <td class="p-2 text-gray-400 text-[10px]">${r.timeStr}</td>
      </tr>
    `;
  }).join('');
}

function renderForecastPage() {
  const forecasts = generateForecasts(globalArchiveRecords);

  const updateCard = (prefix, data) => {
    const rev = document.getElementById(`${prefix}Rev`);
    const det = document.getElementById(`${prefix}Details`);
    if (rev) rev.innerText = `${data.revenue} €`;
    if (det) det.innerText = `${data.weight}г • ${data.deals} угод`;
  };

  updateCard('fcDay', forecasts.tomorrow);
  updateCard('fcWeek', forecasts.week);
  updateCard('fcMonth', forecasts.month);
  updateCard('fcYear', forecasts.year);
}
