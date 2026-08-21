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
import { filterRecordsByPeriod, groupRecordsByTimeSlot, getTopClients } from './analytics.js';
import { getTelegramUser } from './telegram.js';

let currentUser = null;
let purchases = {};
let myExpenses = [];
let currentRecordsBatch = [];
let globalArchiveRecords = [];
let currentPeriod = 'week';

let chartRevenueInstance = null;
let chartWeightInstance = null;
let chartBubbleInstance = null;

// Генератор кольорів для сортів (Category Color Map)
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
  if (btnExport) btnExport.addEventListener('click', exportArchiveToTxt);

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

function initNavigation() {
  const tabDashboard = document.getElementById('tabDashboard');
  const tabAnalytics = document.getElementById('tabAnalytics');
  const pageDashboard = document.getElementById('pageDashboard');
  const pageAnalytics = document.getElementById('pageAnalytics');

  if (!tabDashboard || !tabAnalytics || !pageDashboard || !pageAnalytics) return;

  tabDashboard.addEventListener('click', () => {
    pageDashboard.classList.remove('hidden');
    pageAnalytics.classList.add('hidden');
    tabDashboard.className = 'px-5 py-2 text-xs font-bold rounded-lg bg-neonGreen/20 text-neonGreen border border-neonGreen/40 transition';
    tabAnalytics.className = 'px-5 py-2 text-xs font-bold rounded-lg text-gray-400 hover:text-white transition';
  });

  tabAnalytics.addEventListener('click', () => {
    pageAnalytics.classList.remove('hidden');
    pageDashboard.classList.add('hidden');
    tabAnalytics.className = 'px-5 py-2 text-xs font-bold rounded-lg bg-neonGreen/20 text-neonGreen border border-neonGreen/40 transition';
    tabDashboard.className = 'px-5 py-2 text-xs font-bold rounded-lg text-gray-400 hover:text-white transition';
    renderAnalyticsPage();
  });
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

  // 1. Парсимо ТІЛЬКИ поточний блок
  currentRecordsBatch = parseLogs(rawText);

  // 2. Мержимо у глобальний архів без дублікатів
  if (currentRecordsBatch.length > 0) {
    globalArchiveRecords = saveGlobalArchive(currentRecordsBatch);
  } else {
    globalArchiveRecords = loadGlobalArchive();
  }

  currentRecordsBatch.forEach(r => {
    if (r.category && r.category !== 'UNCATEGORIZED' && purchases[r.category] === undefined) {
      purchases[r.category] = 600;
      savePurchases(purchases);
    }
  });

  initPurchasesUI();

  // Розрахунок KPI тільки для Поточного Логу (Перша Сторінка)
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

    const costFor100g = purchases[r.category] || 0;
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

  const pageAnalytics = document.getElementById('pageAnalytics');
  if (pageAnalytics && !pageAnalytics.classList.contains('hidden')) {
    renderAnalyticsPage();
  }
}

function renderTopClients() {
  const container = document.getElementById('topClientsList');
  if (!container) return;

  const topList = getTopClients(currentRecordsBatch, 3);
  if (topList.length === 0) {
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

  tbody.innerHTML = records.map(r => {
    const color = getCategoryColor(r.category);
    return `
      <tr class="hover:bg-brandDark/40 transition">
        <td class="p-2 font-bold" style="color: ${color.text}">${r.category}</td>
        <td class="p-2 text-gray-200">${r.clientName}</td>
        <td class="p-2 font-mono">${r.baseGramm} ${r.bonusGramm > 0 ? `<span class="text-neonPurple">+!${r.bonusGramm}б</span>` : ''}</td>
        <td class="p-2 font-mono font-bold text-neonGreen">${r.exactGramm.toFixed(2)}г</td>
        <td class="p-2">${r.isCard ? '<span class="text-neonBlue font-bold">💳 Карта</span>' : '💵 Готівка'}</td>
        <td class="p-2 font-bold">${r.eurPaid} €</td>
        <td class="p-2 text-neonYellow">${r.rawDebtText || '-'}</td>
        <td class="p-2 text-gray-400 text-[10px]">${r.timeStr}</td>
      </tr>
    `;
  }).join('');
}

function renderAnalyticsPage() {
  const archiveTotalCountEl = document.getElementById('archiveTotalCount');
  if (archiveTotalCountEl) archiveTotalCountEl.innerText = globalArchiveRecords.length;

  const filtered = filterRecordsByPeriod(globalArchiveRecords, currentPeriod);

  // Сортування архівних записів: спочатку за СОРТОМ (Категорією), потім за ДАТОЮ
  const sortedArchive = [...filtered].sort((a, b) => {
    if (a.category !== b.category) {
      return a.category.localeCompare(b.category);
    }
    return new Date(a.parsedDateObj) - new Date(b.parsedDateObj);
  });

  renderArchiveTable(sortedArchive);

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
      options: { responsive: true, maintainAspectRatio: false }
    });
  }

  if (canvasW) {
    const ctxW = canvasW.getContext('2d');
    chartWeightInstance = new Chart(ctxW, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Точна вага (г)',
          data: weights,
          backgroundColor: '#9D00FF'
        }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }

  if (canvasB) {
    const ctxB = canvasB.getContext('2d');
    const bubbleData = filtered.map(r => {
      const d = new Date(r.parsedDateObj);
      return {
        x: d.getHours() + (d.getMinutes() / 60),
        y: r.eurPaid,
        r: Math.min(Math.max(r.exactGramm * 1.5, 4), 25)
      };
    });

    chartBubbleInstance = new Chart(ctxB, {
      type: 'bubble',
      data: {
        datasets: [{
          label: 'Угоди (X: Година, Y: Оплата, R: Вага)',
          data: bubbleData,
          backgroundColor: 'rgba(0, 240, 255, 0.4)',
          borderColor: '#00F0FF',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { title: { display: true, text: 'Година доби (0-24h)' }, min: 0, max: 24 },
          y: { title: { display: true, text: 'Сума (€)' }, beginAtZero: true }
        }
      }
    });
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
      <tr class="hover:bg-brandDark/40 transition border-b border-brandBorder/50">
        <td class="p-2 font-bold" style="color: ${color.text}">
          <span class="px-2 py-0.5 rounded text-[10px]" style="background: ${color.bg}; border: 1px solid ${color.border}">
            ${r.category}
          </span>
        </td>
        <td class="p-2 text-gray-200">${r.clientName}</td>
        <td class="p-2 font-mono">${r.rawGramm}</td>
        <td class="p-2 font-mono font-bold text-neonGreen">${r.exactGramm.toFixed(2)}г</td>
        <td class="p-2">${r.isCard ? '<span class="text-neonBlue font-bold">💳 Карта</span>' : '💵 Готівка'}</td>
        <td class="p-2 font-bold">${r.eurPaid} €</td>
        <td class="p-2 text-neonYellow">${r.rawDebtText || '-'}</td>
        <td class="p-2 text-gray-400 text-[10px]">${r.timeStr}</td>
      </tr>
    `;
  }).join('');
}

// Генератор Текстового Файлу для Друку
function exportArchiveToTxt() {
  const filtered = filterRecordsByPeriod(globalArchiveRecords, currentPeriod);

  if (filtered.length === 0) {
    alert('Немає даних у цьому періоді для експорту.');
    return;
  }

  // Групуємо записи за Категоріями (Сортами)
  const groupedByCat = {};
  filtered.forEach(r => {
    if (!groupedByCat[r.category]) {
      groupedByCat[r.category] = [];
    }
    groupedByCat[r.category].push(r);
  });

  let txtLines = [];

  Object.keys(groupedByCat).forEach(cat => {
    txtLines.push(`| name | gramm | € | time |`);

    // Сортуємо записи категорії за датою
    groupedByCat[cat].sort((a, b) => new Date(a.parsedDateObj) - new Date(b.parsedDateObj));

    groupedByCat[cat].forEach(r => {
      txtLines.push(`| ${r.clientName} | ${r.rawGramm} | ${r.rawMoney} | ${r.timeStr} |`);
    });
  });

  const txtContent = txtLines.join('\n');
  const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `HMS2_Report_${currentPeriod}_${new Date().toISOString().slice(0, 10)}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
