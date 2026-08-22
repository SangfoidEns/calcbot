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
import { getTelegramUser } from './telegram.js';
import { exportArchiveToTxt } from './export.js';
import { generateForecasts } from './forecast.js';

let currentUser = null;
let purchases = {};
let myExpenses = [];
let currentRecordsBatch = [];
let globalArchiveRecords = [];
let currentPeriod = 'week';

let chartRevenueInstance = null;
let chartWeightInstance = null;
let chartBubbleInstance = null;

// Головна точка входу — гарантуємо прив'язку кнопок за будь-яких умов
document.addEventListener('DOMContentLoaded', () => {
  console.log('[HMS2.0] Ініціалізація додатку...');

  // 1. Авторизація
  try {
    currentUser = getTelegramUser();
    setCurrentUserId(currentUser?.id || 'dev_user');
    initUserUI();
  } catch (err) {
    console.warn('[HMS2.0] Помилка Telegram Auth, використовуємо Dev-режим:', err);
    setCurrentUserId('dev_user');
  }

  // 2. Завантаження даних
  try {
    purchases = loadPurchases() || {};
    myExpenses = loadMyExpenses() || [];
    globalArchiveRecords = loadGlobalArchive() || [];

    const rawInputEl = document.getElementById('rawInput');
    if (rawInputEl) rawInputEl.value = loadRawLogs() || '';
  } catch (err) {
    console.error('[HMS2.0] Помилка зчитування LocalStorage:', err);
  }

  // 3. БЕЗПЕЧНА ПРИВ'ЯЗКА ПОДІЙ ТА КНОПОК (не впаде, якщо якогось елемента немає)
  bindNavigation();
  bindButtons();
  bindQuickExpenseButtons();
  bindMyExpensesEvents();

  // 4. Первинний розрахунок
  try {
    processCurrentInput();
  } catch (err) {
    console.error('[HMS2.0] Помилка первинного обчислення:', err);
  }
});

function initUserUI() {
  const userNameEl = document.getElementById('userName');
  const userHandleEl = document.getElementById('userHandle');
  const userAvatarEl = document.getElementById('userAvatar');

  if (userNameEl) userNameEl.innerText = `${currentUser?.firstName || 'Dev'} ${currentUser?.lastName || ''}`.trim();
  if (userHandleEl) userHandleEl.innerText = currentUser?.username || `@id_${currentUser?.id || 'local'}`;
  if (userAvatarEl && currentUser?.firstName) userAvatarEl.innerText = currentUser.firstName.charAt(0).toUpperCase();
}

// Перемикання вкладок
function bindNavigation() {
  const tabs = [
    { btnId: 'tabDashboard', pageId: 'pageDashboard' },
    { btnId: 'tabAnalytics', pageId: 'pageAnalytics', onOpen: renderAnalyticsPage },
    { btnId: 'tabForecast', pageId: 'pageForecast', onOpen: renderForecastPage }
  ];

  tabs.forEach(t => {
    const btn = document.getElementById(t.btnId);
    if (!btn) return;

    btn.addEventListener('click', () => {
      tabs.forEach(item => {
        const p = document.getElementById(item.pageId);
        const b = document.getElementById(item.btnId);
        if (p) p.classList.add('hidden');
        if (b) b.className = 'px-4 py-2 text-xs font-bold rounded-lg text-gray-400 hover:text-white transition';
      });

      const activePage = document.getElementById(t.pageId);
      if (activePage) activePage.classList.remove('hidden');
      btn.className = 'px-4 py-2 text-xs font-bold rounded-lg bg-neonGreen/20 text-neonGreen border border-neonGreen/40 transition';

      if (t.onOpen) t.onOpen();
    });
  });
}

// Прив'язка основних дій
function bindButtons() {
  const safeClick = (id, handler) => {
    const el = document.getElementById(id);
    if (el) {
      // Видаляємо старі обробники, щоб не дублювати
      el.replaceWith(el.cloneNode(true));
      document.getElementById(id).addEventListener('click', handler);
    }
  };

  safeClick('btnCalculate', processCurrentInput);
  safeClick('btnAddPurchase', handleAddPurchase);

  safeClick('btnClearArchive', () => {
    if (confirm('Дійсно очистити весь глобальний архів?')) {
      clearGlobalArchive();
      globalArchiveRecords = [];
      processCurrentInput();
    }
  });

  safeClick('btnExportTxt', () => exportArchiveToTxt(globalArchiveRecords, currentPeriod));

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
}

function bindQuickExpenseButtons() {
  document.querySelectorAll('.btn-quick-expense').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const name = e.target.getAttribute('data-name') || e.target.innerText.trim();
      const noteInput = document.getElementById('myExpenseNote');
      const amountInput = document.getElementById('myExpenseAmount');
      if (noteInput) noteInput.value = name;
      if (amountInput) amountInput.focus();
    });
  });
}

function bindMyExpensesEvents() {
  const btnInc = document.getElementById('btnAddIncome');
  const btnExp = document.getElementById('btnAddExpense');

  if (btnInc) btnInc.onclick = () => addMyExpenseItem('income');
  if (btnExp) btnExp.onclick = () => addMyExpenseItem('expense');
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
      <div class="flex justify-between items-center bg-brandDark p-1.5 rounded border border-brandBorder text-[11px]">
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
    btn.onclick = (e) => {
      const idx = parseInt(e.target.getAttribute('data-idx'), 10);
      myExpenses.splice(idx, 1);
      saveMyExpenses(myExpenses);
      processCurrentInput();
    };
  });
}

function processCurrentInput() {
  const rawInput = document.getElementById('rawInput');
  const rawText = rawInput ? rawInput.value : '';
  saveRawLogs(rawText);

  currentRecordsBatch = parseLogs(rawText) || [];

  if (currentRecordsBatch.length > 0) {
    globalArchiveRecords = saveGlobalArchive(currentRecordsBatch);
  } else {
    globalArchiveRecords = loadGlobalArchive() || [];
  }

  currentRecordsBatch.forEach(r => {
    if (r.category && r.category !== 'UNCATEGORIZED' && purchases[r.category] === undefined) {
      purchases[r.category] = 600;
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
    totalRevenue += r.eurPaid || 0;
    if (r.isCard) totalCard += r.eurPaid || 0;
    else totalCash += r.eurPaid || 0;

    totalExactWeight += r.exactGramm || 0;
    totalBonusWeight += r.bonusGramm || 0;

    const costFor100g = purchases[r.category] || 0;
    const costPerExactGram = costFor100g / 110; 
    const costPerRawGram = costFor100g / 100;

    const baseCost = ((r.baseGramm || 0) * 1.1) * costPerExactGram;
    const bonusCost = (r.bonusGramm || 0) * costPerRawGram;

    totalCostOfGoods += (baseCost + bonusCost);
    totalBonusCost += bonusCost;

    totalNewDebts += r.debtNew || 0;
    totalRepaidDebts += r.debtRepaid || 0;

    const cName = r.clientName || 'Невідомий';
    if (!clientDebtsMap[cName]) clientDebtsMap[cName] = { newDebt: 0, repaidDebt: 0 };
    clientDebtsMap[cName].newDebt += r.debtNew || 0;
    clientDebtsMap[cName].repaidDebt += r.debtRepaid || 0;
  });

  let totalActiveDebt = 0;
  Object.keys(clientDebtsMap).forEach(client => {
    const netDebt = clientDebtsMap[client].newDebt - clientDebtsMap[client].repaidDebt;
    if (netDebt > 0) totalActiveDebt += netDebt;
  });

  const pureMyExpenses = myExpenses
    .filter(item => item.amount < 0)
    .reduce((acc, item) => acc + Math.abs(item.amount), 0);

  const netProfit = totalRevenue - totalCostOfGoods;
  const factNetProfit = netProfit - pureMyExpenses;
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
  setTxt('kpiCostOfGoods', `${totalCostOfGoods.toFixed(1)} €`);
  setTxt('kpiActiveDebt', `${totalActiveDebt.toFixed(1)} €`);
  setTxt('kpiExactWeight', `${totalExactWeight.toFixed(2)} г`);
  setTxt('kpiBonusWeight', `${totalBonusWeight.toFixed(2)} г`);
  setTxt('kpiDeals', currentRecordsBatch.length);

  setTxt('myCardTotal', `${totalCard.toFixed(1)} €`);
  setTxt('myBonusCostTotal', `${totalBonusCost.toFixed(1)} €`);

  renderTopClients();
  renderMyExpensesList();
  renderDebts(clientDebtsMap);
  renderCurrentTable(currentRecordsBatch);
}

function renderForecastPage() {
  const forecasts = generateForecasts(globalArchiveRecords);

  const setForecastData = (prefix, data) => {
    const revEl = document.getElementById(`${prefix}Rev`);
    const weightEl = document.getElementById(`${prefix}Weight`);
    const dealsEl = document.getElementById(`${prefix}Deals`);

    if (revEl) revEl.innerText = `${data.revenue} €`;
    if (weightEl) weightEl.innerText = `${data.weight} г`;
    if (dealsEl) dealsEl.innerText = `${data.deals}`;
  };

  if (forecasts) {
    setForecastData('fcTomorrow', forecasts.tomorrow);
    setForecastData('fcWeek', forecasts.week);
    setForecastData('fcMonth', forecasts.month);
    setForecastData('fcYear', forecasts.year);
  }
}

function renderTopClients() {
  const container = document.getElementById('topClientsList');
  if (!container) return;

  const topList = getTopClients(currentRecordsBatch, 3);
  if (!topList || topList.length === 0) {
    container.innerHTML = '<p class="text-xs text-gray-500 col-span-3">Немає даних по поточній таблиці</p>';
    return;
  }

  container.innerHTML = topList.map((c, i) => `
    <div class="bg-brandDark p-3 rounded-xl border border-brandBorder flex flex-col justify-between space-y-1">
      <div class="flex justify-between items-center">
        <span class="text-xs font-bold text-white">${i + 1}. ${c.clientName}</span>
        <span class="text-[10px] bg-neonBlue/20 text-neonBlue font-mono px-1.5 py-0.5 rounded">${c.dealsCount} угод</span>
      </div>
      <div class="text-[11px] font-mono flex justify-between pt-1">
        <span class="text-neonGreen font-bold">${c.totalSpent.toFixed(1)} €</span>
        <span class="text-gray-400">${c.totalWeight.toFixed(1)} г</span>
      </div>
    </div>
  `).join('');
}

function initPurchasesUI() {
  const container = document.getElementById('purchasesList');
  if (!container) return;
  container.innerHTML = Object.keys(purchases).map(cat => `
    <div class="flex justify-between items-center bg-brandDark p-1.5 rounded border border-brandBorder">
      <span class="font-bold text-gray-300">${cat}</span>
      <span class="font-mono text-neonYellow">${purchases[cat]} € / 100g</span>
    </div>
  `).join('');
}

function handleAddPurchase() {
  const nameInput = document.getElementById('newCatName');
  const costInput = document.getElementById('newCatCost');
  if (!nameInput || !costInput) return;

  const name = nameInput.value.trim().toUpperCase();
  const cost = parseFloat(costInput.value);

  if (name && !isNaN(cost) && cost > 0) {
    purchases[name] = cost;
    savePurchases(purchases);
    initPurchasesUI();
    processCurrentInput();
    nameInput.value = '';
    costInput.value = '';
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

  tbody.innerHTML = records.map(r => `
    <tr class="hover:bg-brandDark/40 transition">
      <td class="p-2 font-bold text-neonGreen">${r.category}</td>
      <td class="p-2 text-gray-200">${r.clientName}</td>
      <td class="p-2 font-mono">${r.baseGramm} ${r.bonusGramm > 0 ? `<span class="text-neonPurple">+!${r.bonusGramm}б</span>` : ''}</td>
      <td class="p-2 font-mono font-bold text-neonGreen">${(r.exactGramm || 0).toFixed(2)}г</td>
      <td class="p-2">${r.isCard ? '<span class="text-neonBlue font-bold">💳 Карта</span>' : '💵 Готівка'}</td>
      <td class="p-2 font-bold">${r.eurPaid} €</td>
      <td class="p-2 text-neonYellow">${r.rawDebtText || '-'}</td>
      <td class="p-2 text-gray-400 text-[10px]">${r.timeStr}</td>
    </tr>
  `).join('');
}

function renderAnalyticsPage() {
  const archiveTotalCountEl = document.getElementById('archiveTotalCount');
  if (archiveTotalCountEl) archiveTotalCountEl.innerText = globalArchiveRecords.length;

  const filtered = filterRecordsByPeriod(globalArchiveRecords, currentPeriod) || [];
  renderArchiveTable(filtered);
  renderHeatmap();

  if (typeof Chart === 'undefined') return;

  const grouped = groupRecordsByTimeSlot(filtered, currentPeriod) || {};
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
    chartRevenueInstance = new Chart(canvasR.getContext('2d'), {
      type: 'line',
      data: { labels, datasets: [{ label: 'Виручка (€)', data: revenues, borderColor: '#00FF88', backgroundColor: 'rgba(0,255,136,0.1)', fill: true }] },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }

  if (canvasW) {
    chartWeightInstance = new Chart(canvasW.getContext('2d'), {
      type: 'bar',
      data: { labels, datasets: [{ label: 'Точна вага (г)', data: weights, backgroundColor: '#9D00FF' }] },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }

  if (canvasB) {
    const bubbleData = filtered.map(r => {
      const d = safeParseDate(r.parsedDateObj);
      return { x: d.getHours(), y: r.eurPaid || 0, r: Math.min(Math.max((r.exactGramm || 0) * 1.2, 3), 20) };
    });

    chartBubbleInstance = new Chart(canvasB.getContext('2d'), {
      type: 'bubble',
      data: { datasets: [{ label: 'Угоди', data: bubbleData, backgroundColor: 'rgba(0, 240, 255, 0.4)' }] },
      options: { responsive: true, maintainAspectRatio: false }
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
    html += `<div class="grid grid-cols-[40px_repeat(24,1fr)] gap-1 items-center"><div class="text-gray-300 font-bold text-right pr-2">${dayName}</div>`;
    for (let h = 0; h < 24; h++) {
      const val = matrix[dayIdx][h];
      const alpha = val > 0 ? Math.max(maxVal > 0 ? val / maxVal : 0, 0.15).toFixed(2) : 0.03;
      html += `<div class="h-7 rounded flex items-center justify-center text-[9px]" style="background-color: rgba(0, 255, 136, ${alpha});">${val > 0 ? Math.round(val) : ''}</div>`;
    }
    html += `</div>`;
  });

  container.innerHTML = html;
}

function renderArchiveTable(records) {
  const tbody = document.getElementById('archiveTableBody');
  if (!tbody) return;

  if (records.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="p-4 text-center text-gray-500">Архів порожній за цей період</td></tr>';
    return;
  }

  tbody.innerHTML = records.map(r => `
    <tr class="hover:bg-brandDark/40 transition border-b border-brandBorder/50">
      <td class="p-2 font-bold text-neonGreen">${r.category}</td>
      <td class="p-2 text-gray-200">${r.clientName}</td>
      <td class="p-2 font-mono">${r.rawGramm}</td>
      <td class="p-2 font-mono font-bold text-neonGreen">${(r.exactGramm || 0).toFixed(2)}г</td>
      <td class="p-2">${r.isCard ? '<span class="text-neonBlue font-bold">💳 Карта</span>' : '💵 Готівка'}</td>
      <td class="p-2 font-bold">${r.eurPaid} €</td>
      <td class="p-2 text-neonYellow">${r.rawDebtText || '-'}</td>
      <td class="p-2 text-gray-400 text-[10px]">${r.timeStr}</td>
    </tr>
  `).join('');
}
