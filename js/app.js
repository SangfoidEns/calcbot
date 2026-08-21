import { getTelegramUser, applyTelegramTheme } from './telegram.js';
import { setCurrentUserId, loadData, saveData } from './store.js';

// Стан застосунку (Application State)
let currentUser = null;
let purchases = [];

/**
 * Ініціалізація сесії користувача
 */
async function initUserSession() {
  currentUser = await getTelegramUser();
  setCurrentUserId(currentUser.id); // Фіксуємо ID у модулі store.js

  const userNameEl = document.getElementById('userName');
  const userHandleEl = document.getElementById('userHandle');
  const userAvatarEl = document.getElementById('userAvatar');

  if (userNameEl) {
    userNameEl.textContent = `${currentUser.firstName} ${currentUser.lastName}`.trim();
  }
  
  if (userHandleEl) {
    userHandleEl.textContent = currentUser.username || `ID: ${currentUser.id}`;
  }

  if (userAvatarEl) {
    if (currentUser.photoUrl) {
      userAvatarEl.innerHTML = `<img src="${currentUser.photoUrl}" class="w-full h-full rounded-full object-cover" alt="Avatar">`;
    } else {
      userAvatarEl.textContent = (currentUser.firstName.charAt(0) || 'U').toUpperCase();
    }
  }
}

/**
 * Завантаження списку
 */
async function loadPurchases() {
  const container = document.getElementById('purchasesList');
  if (container) {
    container.innerHTML = `<p class="text-center text-gray-400 py-4 animate-pulse">Завантаження...</p>`;
  }

  const data = await loadData('purchases', []);
  purchases = Array.isArray(data) ? data : [];
  renderPurchases();
}

/**
 * Синхронізація зі сховищем
 */
async function syncState() {
  try {
    await saveData('purchases', purchases);
  } catch (error) {
    console.error('[App] Помилка синхронізації стану:', error);
  }
}

/**
 * Захист від XSS атак (Санітизація)
 */
function sanitize(str) {
  const temp = document.createElement('div');
  temp.textContent = str;
  return temp.innerHTML;
}

/**
 * Відображення покупок у DOM
 */
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
    <div class="flex items-center justify-between p-3 bg-slate-800 border border-slate-700/50 rounded-lg mb-2 transition-all hover:border-slate-600" data-item-id="${item.id}">
      <div class="flex items-center gap-3 cursor-pointer select-none" data-action="toggle" data-id="${item.id}">
        <input 
          type="checkbox" 
          ${item.completed ? 'checked' : ''} 
          class="w-5 h-5 accent-cyan-500 rounded cursor-pointer pointer-events-none"
        />
        <span class="${item.completed ? 'line-through text-gray-500' : 'text-white'} font-medium transition-colors">
          ${sanitize(item.title)}
        </span>
      </div>
      <button 
        type="button"
        data-action="delete" 
        data-id="${item.id}"
        class="px-3 py-1.5 text-sm bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-md transition-colors active:scale-95 touch-manipulation"
        aria-label="Видалити"
      >
        Видалити
      </button>
    </div>
  `).join('');
}

/**
 * ДЕЛЕГУВАННЯ ПОДІЙ (Event Delegation)
 * Один обробник керує всіма динамічними елементами
 */
function setupGlobalEventListeners() {
  const container = document.getElementById('purchasesList');
  if (container) {
    container.addEventListener('click', async (event) => {
      const target = event.target.closest('[data-action]');
      if (!target) return;

      const action = target.dataset.action;
      const itemId = target.dataset.id;
      if (!itemId) return;

      if (action === 'delete') {
        event.preventDefault();
        event.stopPropagation();

        // Оптимістичний UI
        purchases = purchases.filter((p) => String(p.id) !== String(itemId));
        renderPurchases();
        await syncState();
      }

      if (action === 'toggle') {
        event.preventDefault();

        purchases = purchases.map((p) => {
          if (String(p.id) === String(itemId)) {
            return { ...p, completed: !p.completed };
          }
          return p;
        });

        renderPurchases();
        await syncState();
      }
    });
  }

  // Обробка форми додавання
  const addForm = document.getElementById('addPurchaseForm');
  if (addForm) {
    addForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = document.getElementById('purchaseInput');
      if (!input) return;

      const title = input.value.trim();
      if (!title) return;

      const newItem = {
        id: 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        title: title,
        completed: false,
        createdAt: new Date().toISOString()
      };

      purchases.unshift(newItem);
      input.value = '';
      renderPurchases();
      await syncState();
    });
  }
}

// Запуск додатка у правильній строгій послідовності
document.addEventListener('DOMContentLoaded', async () => {
  try {
    applyTelegramTheme();
    
    // 1. Прив'язуємо обробники подій
    setupGlobalEventListeners();

    // 2. СРОЧНО авторизуємо користувача, щоб встановити storageKey
    await initUserSession();

    // 3. Лише ПІСЛЯ цього завантажуємо персональні дані
    await loadPurchases();
  } catch (criticalError) {
    console.error('[App] Критична помилка ініціалізації:', criticalError);
  }
});
