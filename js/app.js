import { getTelegramUser, applyTelegramTheme } from './telegram.js';
import { setCurrentUserId, loadData, saveData } from './store.js';
import { parseInputText } from './parser.js';
import { getPurchaseAnalytics, getForecastedItems } from './analytics.js';

let currentUser = null;
let purchases = [];
let purchasesHistory = [];

async function initUserSession() {
  currentUser = await getTelegramUser();
  setCurrentUserId(currentUser.id);

  const userNameEl = document.getElementById('userName');
  const userHandleEl = document.getElementById('userHandle');
  const userAvatarEl = document.getElementById('userAvatar');

  if (userNameEl) userNameEl.textContent = `${currentUser.firstName} ${currentUser.lastName}`.trim();
  if (userHandleEl) userHandleEl.textContent = currentUser.username || `ID: ${currentUser.id}`;

  if (userAvatarEl) {
    if (currentUser.photoUrl) {
      userAvatarEl.innerHTML = `<img src="${currentUser.photoUrl}" class="w-full h-full rounded-full object-cover">`;
    } else {
      userAvatarEl.textContent = (currentUser.firstName.charAt(0) || 'U').toUpperCase();
    }
  }
}

async function loadPurchases() {
  const container = document.getElementById('purchasesList');
  if (container) {
    container.innerHTML = `<p class="text-center text-gray-400 py-4 animate-pulse">Завантаження...</p>`;
  }

  purchases = await loadData('purchases', []);
  purchasesHistory = await loadData('purchases_history', []);
  
  renderPurchases();
  renderAnalytics();
}

async function syncState() {
  try {
    await saveData('purchases', purchases);
    await saveData('purchases_history', purchasesHistory);
    renderAnalytics();
  } catch (error) {
    console.error('[App Sync Error]:', error);
  }
}

function sanitize(str) {
  const temp = document.createElement('div');
  temp.textContent = str;
  return temp.innerHTML;
}

function renderAnalytics() {
  const statsEl = document.getElementById('analyticsStats');
  const forecastEl = document.getElementById('forecastList');

  if (statsEl) {
    const stats = getPurchaseAnalytics(purchases);
    statsEl.innerHTML = `
      <div class="flex justify-between items-center text-xs text-gray-400 bg-slate-800/40 p-3 rounded-lg border border-slate-700/40">
        <span>Всього: <b class="text-white">${stats.total}</b></span>
        <span>Куплено: <b class="text-emerald-400">${stats.completed}</b></span>
        <span>Прогрес: <b class="text-cyan-400">${stats.completionRate}%</b></span>
      </div>
    `;
  }

  if (forecastEl) {
    const predictions = getForecastedItems(purchases, purchasesHistory);
    forecastEl.innerHTML = predictions.map(item => `
      <button type="button" data-action="add-forecast" data-value="${sanitize(item)}" class="text-xs bg-cyan-950/60 hover:bg-cyan-900/60 text-cyan-300 border border-cyan-800/50 px-2.5 py-1 rounded-full transition-all">
        + ${sanitize(item)}
      </button>
    `).join('');
  }
}

function renderPurchases() {
  const container = document.getElementById('purchasesList');
  if (!container) return;

  if (purchases.length === 0) {
    container.innerHTML = `
      <div class="text-center text-gray-400 py-8">
        <p class="text-lg">Список порожній 📦</p>
        <p class="text-sm text-gray-500">Додайте новий пункт вище</p>
      </div>
    `;
    return;
  }

  container.innerHTML = purchases.map((item) => `
    <div class="purchase-item flex items-center justify-between p-3 ${item.priority === 'high' ? 'bg-red-950/20 border-red-500/40' : 'bg-slate-800 border-slate-700/50'} border rounded-lg mb-2">
      <div class="flex items-center gap-3 cursor-pointer select-none" data-action="toggle" data-id="${item.id}">
        <input type="checkbox" ${item.completed ? 'checked' : ''} class="w-5 h-5 accent-cyan-500 rounded pointer-events-none" />
        <div>
          <span class="${item.completed ? 'line-through text-gray-500' : 'text-white'} font-medium block">
            ${sanitize(item.title)} ${item.priority === 'high' ? '<span class="text-red-400 font-bold">!</span>' : ''}
          </span>
          <span class="text-xs text-cyan-400/80">${sanitize(item.amount)} • ${sanitize(item.category)}</span>
        </div>
      </div>
      <button type="button" data-action="delete" data-id="${item.id}" class="px-3 py-1.5 text-sm bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-md transition-colors">
        Видалити
      </button>
    </div>
  `).join('');
}

function setupGlobalEventListeners() {
  const container = document.getElementById('purchasesList');
  const forecastEl = document.getElementById('forecastList');

  if (container) {
    container.addEventListener('click', async (event) => {
      const target = event.target.closest('[data-action]');
      if (!target) return;

      const action = target.dataset.action;
      const itemId = target.dataset.id;

      if (action === 'delete') {
        purchases = purchases.filter((p) => String(p.id) !== String(itemId));
        renderPurchases();
        await syncState();
      }

      if (action === 'toggle') {
        purchases = purchases.map((p) => {
          if (String(p.id) === String(itemId)) {
            const updated = { ...p, completed: !p.completed };
            if (updated.completed) {
              purchasesHistory.push({ title: updated.title, timestamp: Date.now() });
            }
            return updated;
          }
          return p;
        });
        renderPurchases();
        await syncState();
      }
    });
  }

  if (forecastEl) {
    forecastEl.addEventListener('click', async (event) => {
      const target = event.target.closest('[data-action="add-forecast"]');
      if (!target) return;

      const val = target.dataset.value;
      const parsedData = parseInputText(val);

      purchases.unshift({
        id: 'item_' + Date.now(),
        ...parsedData,
        completed: false
      });

      renderPurchases();
      await syncState();
    });
  }

  const addForm = document.getElementById('addPurchaseForm');
  if (addForm) {
    addForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = document.getElementById('purchaseInput');
      if (!input || !input.value.trim()) return;

      const parsedData = parseInputText(input.value.trim());

      purchases.unshift({
        id: 'item_' + Date.now(),
        ...parsedData,
        completed: false
      });

      input.value = '';
      renderPurchases();
      await syncState();
    });
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    applyTelegramTheme();
    setupGlobalEventListeners();
    await initUserSession();
    await loadPurchases();
  } catch (err) {
    console.error('[App Critical Error]:', err);
  }
});
