import { generateForecasts } from './forecast.js';

// --- ТВІЙ ІСНУЮЧИЙ СТАН ДОДАТКУ ---
let currentRecordsBatch = [];
let globalArchiveRecords = [];
let purchases = {};
let activeTabIdx = 0;

const TAB_IDS = ['pageDashboard', 'pageAnalytics', 'pageForecast'];

// --- ТВІЙ ІСНУЮЧИЙ МЕХАНІЗМ ВКАДОК (РАЗШИРЕНИЙ НА 3 СТОРОНИ) ---
function setActiveTab(index) {
  activeTabIdx = index;
  
  // Перемикаємо видимість контейнерів
  document.getElementById('pageDashboard')?.classList.toggle('hidden', index !== 0);
  document.getElementById('pageAnalytics')?.classList.toggle('hidden', index !== 1);
  document.getElementById('pageForecast')?.classList.toggle('hidden', index !== 2);

  // Оновлюємо кнопки
  const btnDash = document.getElementById('tabDashboard');
  const btnAnal = document.getElementById('tabAnalytics');
  const btnFore = document.getElementById('tabForecast');

  if (btnDash) btnDash.className = index === 0 ? 'px-3 py-1.5 rounded-xl bg-tgBlue text-white shadow-lg transition-all' : 'px-3 py-1.5 rounded-xl text-gray-400 hover:text-white transition-all';
  if (btnAnal) btnAnal.className = index === 1 ? 'px-3 py-1.5 rounded-xl bg-tgBlue text-white shadow-lg transition-all' : 'px-3 py-1.5 rounded-xl text-gray-400 hover:text-white transition-all';
  if (btnFore) btnFore.className = index === 2 ? 'px-3 py-1.5 rounded-xl bg-tgBlue text-white shadow-lg transition-all' : 'px-3 py-1.5 rounded-xl text-gray-400 hover:text-white transition-all';

  // Якщо відкрили 3 сторінку - рахуємо прогноз
  if (index === 2) {
    renderForecastPage();
  }
}

// --- ТВІЙ ІСНУЮЧИЙ РЕНДЕР ТАБЛИЦІ (+ ПІДСВІЧУВАННЯ ≥ 50€) ---
function renderCurrentTable(records) {
  const tbody = document.getElementById('recordsTableBody');
  if (!tbody) return;

  tbody.innerHTML = records.map(r => {
    // ДОДАНО: Перевірка чеку ≥ 50€
    const isHighValue = (r.eurPaid || 0) >= 50;
    const rowClass = isHighValue ? 'bg-amber-500/10 font-bold border-l-2 border-amber-400' : 'hover:bg-white/5';

    return `
      <tr class="${rowClass} transition">
        <td class="p-2.5 font-bold">${r.category || 'Загальне'}</td>
        <td class="p-2.5 text-gray-200">${r.clientName || 'Гість'}</td>
        <td class="p-2.5 font-mono">${r.baseGramm || 0}${r.bonusGramm > 0 ? `<span class="text-neonPurple">+!${r.bonusGramm}б</span>` : ''}</td>
        <td class="p-2.5 font-mono text-neonGreen">${(r.exactGramm || 0).toFixed(2)}г</td>
        <td class="p-2.5">${r.isCard ? '<span class="text-tgBlue">💳 Карта</span>' : '💵 Готівка'}</td>
        <td class="p-2.5 ${isHighValue ? 'text-amber-300 font-extrabold text-sm' : ''}">${r.eurPaid || 0} €</td>
        <td class="p-2.5 text-neonYellow">${r.rawDebtText || '-'}</td>
        <td class="p-2.5 text-gray-400 text-[10px]">${r.timeStr || '--:--'}</td>
      </tr>
    `;
  }).join('');
}

// --- ТВІЙ РЕНДЕР ТОП КЛІЄНТІВ (+ АККОРДЕОН ОСТАННІХ 3 ПОКУПОК) ---
function renderTopClients(topList) {
  const container = document.getElementById('topClientsList');
  if (!container) return;

  if (!topList || topList.length === 0) {
    container.innerHTML = '<p class="text-xs text-gray-500">Немає даних</p>';
    return;
  }

  container.innerHTML = topList.map((c, i) => {
    // Знаходимо останні 3 покупки цього клієнта з поточного батчу
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

// --- НОВА ФУНКЦІЯ: ВИКЛИК FORECAST.JS СТОРІНКИ ---
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

// --- НОВА ФУНКЦІЯ: НАВІГАЦІЯ СВАЙПАМИ НА IPHONE ---
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

// --- ПРИВ'ЯЗКА ПОДІЙ СТОРІНКИ ---
document.addEventListener('DOMContentLoaded', () => {
  initSwipeNavigation();

  // Прив'язка кнопок меню
  document.getElementById('tabDashboard')?.addEventListener('click', () => setActiveTab(0));
  document.getElementById('tabAnalytics')?.addEventListener('click', () => setActiveTab(1));
  document.getElementById('tabForecast')?.addEventListener('click', () => setActiveTab(2));

  // ДОДАНО: Кнопка очищення текстового поля (Хрестик)
  const btnClearInput = document.getElementById('btnClearInput');
  const rawInput = document.getElementById('rawInput');
  if (btnClearInput && rawInput) {
    btnClearInput.addEventListener('click', () => {
      rawInput.value = '';
      currentRecordsBatch = [];
      renderCurrentTable([]);
      renderTopClients([]);
      rawInput.focus();
    });
  }

  // ДОДАНО: Збереження закупівлі з 3 полями (з грамами)
  document.getElementById('btnAddPurchase')?.addEventListener('click', () => {
    const nameInput = document.getElementById('newCatName');
    const costInput = document.getElementById('newCatCost');
    const gramsInput = document.getElementById('newCatGrams');

    const name = nameInput.value.trim().toUpperCase();
    const cost = parseFloat(costInput.value);
    const grams = parseFloat(gramsInput.value) || 0;

    if (name && !isNaN(cost) && cost > 0) {
      purchases[name] = { costPer100g: cost, totalGramsPurchased: grams };
      nameInput.value = ''; costInput.value = ''; gramsInput.value = '';
    }
  });
});
