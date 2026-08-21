/**
 * Main Controller with Safe DOM Guarding
 */

import { parseLogs } from './parser.js';
import { savePurchases, loadPurchases, saveRawLogs, loadRawLogs, saveMyExpenses, loadMyExpenses } from './store.js';
import { filterRecordsByPeriod, groupRecordsByTimeSlot } from './analytics.js';

let purchases = {};
let myExpenses = [];
let parsedRecordsGlobal = [];
let currentPeriod = 'week';

let chartRevenueInstance = null;
let chartWeightInstance = null;

document.addEventListener('DOMContentLoaded', () => {
  purchases = loadPurchases();
  myExpenses = loadMyExpenses();

  initNavigation();
  initPurchasesUI();
  initQuickButtons();
  initMyExpensesEvents();

  const rawInputEl = document.getElementById('rawInput');
  if (rawInputEl) {
    rawInputEl.value = loadRawLogs();
  }

  processAllData();

  const btnCalc = document.getElementById('btnCalculate');
  if (btnCalc) btnCalc.addEventListener('click', processAllData);

  const btnAddPur = document.getElementById('btnAddPurchase');
  if (btnAddPur) btnAddPur.addEventListener('click', handleAddPurchase);

  document.querySelectorAll('.btn-period').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.btn-period').forEach(b => {
        b.className = 'btn-period px-4 py-1.5 text-xs font-bold rounded-lg bg-brandDark border border-brandBorder text-gray-400 hover:text-white transition';
      });
      e.target.className = 'btn-period px-4 py-1.5 text-xs font-bold rounded-lg bg-neonGreen/20 text-neonGreen border border-neonGreen/40 transition';
      currentPeriod = e.target.getAttribute('data-period');
      renderAnalyticsPage();
    });
  });
});

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
  renderMyExpensesList();
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
      renderMyExpensesList();
    });
  });
}

function processAllData() {
  const rawInput = document.getElementById('rawInput');
  const rawText = rawInput ? rawInput.value : '';
  saveRawLogs(rawText);

  parsedRecordsGlobal = parseLogs(rawText);

  parsedRecordsGlobal.forEach(r => {
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

  const clientDebtsMap = {};

  parsedRecordsGlobal.forEach(r => {
    totalRevenue += r.eurPaid;
    if (r.isCard) {
      totalCard += r.eurPaid;
    } else {
      totalCash += r.eurPaid;
    }

    totalExactWeight += r.exactGramm;
    
    const bonusGramm = r.bonusGramm;
    totalBonusWeight += bonusGramm;

    const costFor100g = purchases[r.category] || 0;
    const costPerExactGram = costFor100g / 110; 
    const costPerRawGram = costFor100g / 100;

    const baseCost = (r.baseGramm * 1.1) * costPerExactGram;
    const bonusCost = bonusGramm * costPerRawGram;

    totalCostOfGoods += (baseCost + bonusCost);
    totalBonusCost += bonusCost;

    if (!clientDebtsMap[r.clientName]) {
      clientDebtsMap[r.clientName] = { newDebt: 0, repaidDebt: 0 };
    }
    clientDebtsMap[r.clientName].newDebt += r.debtNew;
    clientDebtsMap[r.clientName].repaidDebt += r.debtRepaid;
  });

  let totalActiveDebt = 0;
  Object.keys(clientDebtsMap).forEach(client => {
    const netDebt = clientDebtsMap[client].newDebt - clientDebtsMap[client].repaidDebt;
    if (netDebt > 0) {
      totalActiveDebt += netDebt;
    }
  });

  const netProfit = totalRevenue - totalCostOfGoods;

  const setTxt = (id, txt) => {
    const el = document.getElementById(id);
    if (el) el.innerText = txt;
  };

  setTxt('kpiRevenue', `${totalRevenue.toFixed(1)} €`);
  setTxt('kpiNetProfit', `${netProfit.toFixed(1)} €`);
  setTxt('kpiCashCard', `${totalCash.toFixed(0)} / ${totalCard.toFixed(0)} €`);
  setTxt('kpiCostOfGoods', `${totalCostOfGoods.toFixed(1)} €`);
  setTxt('kpiActiveDebt', `${totalActiveDebt.toFixed(1)} €`);
  setTxt('kpiExactWeight', `${totalExactWeight.toFixed(2)} г`);
  setTxt('kpiBonusWeight', `${totalBonusWeight.toFixed(2)} г`);
  setTxt('kpiDeals', parsedRecordsGlobal.length);

  setTxt('myCardTotal', `${totalCard.toFixed(1)} €`);
  setTxt('myBonusCostTotal', `${totalBonusCost.toFixed(1)} €`);

  renderMyExpensesList();
  renderDebts(clientDebtsMap);
  renderTable(parsedRecordsGlobal);

  const pageAnalytics = document.getElementById('pageAnalytics');
  if (pageAnalytics && !pageAnalytics.classList.contains('hidden')) {
    renderAnalyticsPage();
  }
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
    processAllData();
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

function renderTable(records) {
  const tbody = document.getElementById('recordsTableBody');
  if (!tbody) return;

  tbody.innerHTML = records.map(r => `
    <tr class="hover:bg-brandDark/40 transition">
      <td class="p-2 font-bold text-neonGreen">${r.category}</td>
      <td class="p-2 text-gray-200">${r.clientName}</td>
      <td class="p-2 font-mono">${r.baseGramm} ${r.bonusGramm > 0 ? `<span class="text-neonPurple">+!${r.bonusGramm}б</span>` : ''}</td>
      <td class="p-2 font-mono font-bold text-neonGreen">${r.exactGramm.toFixed(2)}г</td>
      <td class="p-2">${r.isCard ? '<span class="text-neonBlue font-bold">💳 Карта</span>' : '💵 Готівка'}</td>
      <td class="p-2 font-bold">${r.eurPaid} €</td>
      <td class="p-2 text-neonYellow">${r.rawDebtText || '-'}</td>
      <td class="p-2 text-gray-400 text-[10px]">${r.timeStr}</td>
    </tr>
  `).join('');
}

function renderAnalyticsPage() {
  if (typeof Chart === 'undefined') return;

  const filtered = filterRecordsByPeriod(parsedRecordsGlobal, currentPeriod);
  const grouped = groupRecordsByTimeSlot(filtered, currentPeriod);

  const labels = Object.keys(grouped);
  const revenues = labels.map(k => grouped[k].revenue);
  const weights = labels.map(k => grouped[k].weight);

  if (chartRevenueInstance) chartRevenueInstance.destroy();
  if (chartWeightInstance) chartWeightInstance.destroy();

  const canvasR = document.getElementById('chartTimeRevenue');
  const canvasW = document.getElementById('chartTimeWeight');

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
}