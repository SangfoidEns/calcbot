import { generateForecasts } from './forecast.js';

// --- Держава Додатку (State Management) ---
let currentRecordsBatch = [];
let globalArchiveRecords = [];
let purchases = {};
let activeTabIdx = 0;

const TAB_IDS = ['pageDashboard', 'pageAnalytics', 'pageForecast'];
const TAB_BUTTONS = ['tabDashboard', 'tabAnalytics', 'tabForecast'];

// --- Ініціалізація Telegram WebApp ---
function initTelegramApp() {
  if (window.Telegram?.WebApp) {
    const tg = window.Telegram.WebApp;
    tg.ready();
    tg.expand();
    
    const user = tg.initDataUnsafe?.user;
    if (user) {
      const avatarEl = document.getElementById('userAvatar');
      const nameEl = document.getElementById('userName');
      if (avatarEl) avatarEl.innerText = (user.first_name || 'U')[0].toUpperCase();
      if (nameEl) nameEl.innerText = user.first_name || 'Користувач';
    }
  }
}

// --- Управління Табами та Свайпами ---
function setActiveTab(index) {
  if (index < 0 || index >= TAB_IDS.length) return;
  
  activeTabIdx = index;

  TAB_IDS.forEach((id, i) => {
    const section = document.getElementById(id);
    if (section) {
      if (i === index) {
        section.classList.remove('hidden');
      } else {
        section.classList.add('hidden');
      }
    }
  });

  TAB_BUTTONS.forEach((btnId, i) => {
    const btn = document.getElementById(btnId);
    if (btn) {
      if (i === index) {
        btn.className = 'px-3 py-1.5 rounded-xl bg-tgBlue text-white shadow-lg transition-all duration-200';
      } else {
        btn.className = 'px-3 py-1.5 rounded-xl text-gray-400 hover:text-white transition-all duration-200';
      }
    }
  });

  // Третя сторінка — рахуємо прогноз при відкритті
  if (index === 2) {
    renderForecastPage();
  }
}

function initSwipeGestures() {
  let startX = 0;
  let startY = 0;
  const container = document.getElementById('swipeContainer');

  if (!container) return;

  container.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }, { passive: true });

  container.addEventListener('touchend', (e) => {
    const diffX = e.changedTouches[0].clientX - startX;
    const diffY = e.changedTouches[0].clientY - startY;

    // Перевіряємо, що свайп був горизонтальним (а не скролом сторінки)
    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 60) {
      if (diffX < 0 && activeTabIdx < TAB_IDS.length - 1) {
        setActiveTab(activeTabIdx + 1); // Свайп вліво -> Наступна вкладка
      } else if (diffX > 0 && activeTabIdx > 0) {
        setActiveTab(activeTabIdx - 1); // Свайп вправо -> Попередня вкладка
      }
    }
  }, { passive: true });
}

// --- Рендеринг Таблиці з підсвічуванням ≥ 50€ ---
function renderCurrentTable(records) {
  const tbody = document.getElementById('recordsTableBody');
  if (!tbody) return;

  if (!records || records.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="p-4 text-center text-gray-500 font-sans">Немає записів для відображення</td></tr>`;
    return;
  }

  tbody.innerHTML = records.map(r => {
    const isHighValue = (r.eurPaid || 0) >= 50;
    
    // Стилізація для високих чеків (≥ 50€)
    const rowStyle = isHighValue 
      ? 'bg-amber-500/10 border-l-4 border-amber-400 font-bold' 
      : 'hover:bg-white/5';

    return `
      <tr class="transition-colors ${rowStyle}">
        <td class="p-2.5 font-bold text-white">${r.category || 'Загальне'}</td>
        <td class="p-2.5 text-gray-200">${r.clientName || 'Гість'}</td>
        <td class="p-2.5 font-mono">${r.baseGramm || 0}g ${r.bonusGramm > 0 ? `<span class="text-neonPurple">+${r.bonusGramm}б</span>` : ''}</td>
        <td class="p-2.5 font-mono text-neonGreen">${(r.exactGramm || 0).toFixed(2)}g</td>
        <td class="p-2.5">${r.isCard ? '<span class="text-tgBlue font-medium">💳 Карта</span>' : '<span class="text-gray-300">💵 Готівка</span>'}</td>
        <td class="p-2.5 ${isHighValue ? 'text-amber-300 font-extrabold text-sm' : 'text-white'}">${r.eurPaid || 0} €</td>
        <td class="p-2.5 text-neonRed font-medium">${r.rawDebtText || '-'}</td>
        <td class="p-2.5 text-gray-400 text-[10px]">${r.timeStr || '--:--'}</td>
      </tr>
    `;
  }).join('');
}

// --- Рендеринг Топ Клієнтів з Аккордеоном (Останні 3 покупки) ---
function renderTopClients(records) {
  const container = document.getElementById('topClientsList');
  if (!container) return;

  // Агрегація даних по клієнтах
  const clientStats = {};
  records.forEach(r => {
    const name = r.clientName || 'Невідомий';
    if (!clientStats[name]) {
      clientStats[name] = { totalSpent: 0, totalWeight: 0, deals: [] };
    }
    clientStats[name].totalSpent += (r.eurPaid || 0);
    clientStats[name].totalWeight += (r.exactGramm || 0);
    clientStats[name].deals.push(r);
  });

  const sortedClients = Object.entries(clientStats)
    .map(([clientName, data]) => ({ clientName, ...data }))
    .sort((a, b) => b.totalSpent - a.totalSpent)
    .slice(0, 5);

  if (sortedClients.length === 0) {
    container.innerHTML = '<p class="text-xs text-gray-500">Список порожній</p>';
    return;
  }

  container.innerHTML = sortedClients.map((c, i) => {
    const lastThreeDeals = c.deals.slice(-3).reverse();

    return `
      <details class="group bg-slate-950/60 rounded-2xl border border-glassBorder overflow-hidden transition-all">
        <summary class="flex justify-between items-center p-3 cursor-pointer select-none hover:bg-white/5 transition">
          <div class="flex items-center gap-2">
            <span class="text-xs font-bold text-white">${i + 1}. ${c.clientName}</span>
            <span class="text-[10px] bg-tgBlue/20 text-tgBlue px-2 py-0.5 rounded-full font-mono font-bold">${c.deals.length} угод</span>
          </div>
          <div class="text-xs font-mono font-bold text-neonGreen">
            ${c.totalSpent.toFixed(1)} € / ${c.totalWeight.toFixed(1)}g
          </div>
        </summary>
        <div class="px-3 pb-3 space-y-1.5 pt-2 border-t border-glassBorder/40 bg-slate-900/40">
          <div class="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Останні 3 покупки:</div>
          ${lastThreeDeals.map(d => `
            <div class="flex justify-between items-center text-[11px] font-mono text-gray-300">
              <span>${d.category || 'Загальне'} (${(d.exactGramm || 0).toFixed(1)}g)</span>
              <span class="text-white font-bold">${d.eurPaid || 0} €</span>
            </div>
          `).join('')}
        </div>
      </details>
    `;
  }).join('');
}

// --- Обробка та Рендеринг Прогнозу (Сторінка 3) ---
function renderForecastPage() {
  const forecasts = generateForecasts(globalArchiveRecords);

  const updateCard = (prefix, data) => {
    const revEl = document.getElementById(`${prefix}Rev`);
    const detailsEl = document.getElementById(`${prefix}Details`);
    if (revEl) revEl.innerText = `${data.revenue} €`;
    if (detailsEl) detailsEl.innerText = `${data.weight}g • ${data.deals} угод`;
  };

  updateCard('fcDay', forecasts.tomorrow);
  updateCard('fcWeek', forecasts.week);
  updateCard('fcMonth', forecasts.month);
  updateCard('fcYear', forecasts.year);
}

// --- Події та завантаження ---
document.addEventListener('DOMContentLoaded', () => {
  initTelegramApp();
  initSwipeGestures();

  // Прив'язка кнопок перемикання вкладок
  TAB_BUTTONS.forEach((btnId, idx) => {
    document.getElementById(btnId)?.addEventListener('click', () => setActiveTab(idx));
  });

  // Кнопка очищення текстового поля вводу
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

  // Обробник додавання закупівель з грамами
  document.getElementById('btnAddPurchase')?.addEventListener('click', () => {
    const nameInput = document.getElementById('newCatName');
    const costInput = document.getElementById('newCatCost');
    const gramsInput = document.getElementById('newCatGrams');

    const name = nameInput.value.trim().toUpperCase();
    const cost = parseFloat(costInput.value);
    const grams = parseFloat(gramsInput.value) || 0;

    if (name && !isNaN(cost) && cost > 0) {
      purchases[name] = { costPer100g: cost, totalGramsPurchased: grams };
      nameInput.value = '';
      costInput.value = '';
      gramsInput.value = '';
    }
  });
});
