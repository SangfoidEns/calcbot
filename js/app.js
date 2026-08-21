import { getTelegramUser, applyTelegramTheme } from './telegram.js';
import { setCurrentUserId, loadData, saveData } from './store.js';

// Глобальний стан застосунку (Application State)
let currentUser = null;
let purchases = [];
let isSyncing = false; // Прапорець для запобігання Race Conditions

/**
 * Ініціалізація користувача
 */
async function initUserSession() {
  currentUser = await getTelegramUser();
  setCurrentUserId(currentUser.id);

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
      userAvatarEl.innerHTML = `<img src="${currentUser.photoUrl}" class="w-full h-full rounded-full object-cover" alt="Avatar" loading="lazy">`;
    } else {
      userAvatarEl.textContent = (currentUser.firstName.charAt(0) || 'U').toUpperCase();
    }
  }
}

/**
 * Очищення та безпечне завантаження даних
 */
async function loadPurchases() {
  const container = document.getElementById('purchasesList');
  if (container) {
    container.innerHTML = `<p class="text-center text-gray-400 py-4 animate-pulse">Завантаження даних...</p>`;
  }

  const data = await loadData('purchases', []);
  purchases = Array.isArray(data) ? data : [];
  renderPurchases();
}

/**
 * Синхронізація зі сховищем
 */
async function syncState() {
  if (isSyncing) return;
  isSyncing = true;
  
  try {
    await saveData('purchases', purchases);
  } catch (error) {
    console.error('[State Error] Не вдалося зберегти стан:', error);
  } finally {
    isSyncing = false;
  }
}

/**
 * Рендеринг списку (Паттерн Data-Attributes замість суворих індексів)
 */
function renderPurchases() {
  const container = document.getElementById('purchasesList');
  if (!container) return;

  if (purchases.length === 0) {
    container.innerHTML = `
      <div class="text-center text-gray-400 py-8">
        <p class="text-lg">Список порожній 📦</p>
        <p class="text-sm text-gray-500">Додайте перший елемент вище</p>
      </div>
    `;
    return;
  }

  // Використовуємо dataset-атрибути data-id та data-action
  container.innerHTML = purchases.map((item) => `
    <div class="flex items-center justify-between p-3 bg-slate-800 border border-slate-700/50 rounded-lg mb-2 transition-all hover:border-slate-600" data-item-id="${item.id}">
      <div class="flex items-center gap-3 cursor-pointer select-none" data-action="toggle" data-id="${item.id}">
        <input 
          type="checkbox" 
          ${item.completed ? 'checked' : ''} 
          class="w-5 h-5 accent-cyan-500 rounded cursor-pointer pointer-events-none"
        />
        <span class="${item.completed ? 'line-through text-gray-500' : 'text-white'} font-medium transition-colors">
          ${escapeHtml(item.title)}
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
 * Безпека: Санітизація вводу для захисту від XSS-атак
 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * ГОЛОВНЕ ВИПРАВЛЕННЯ: Делегування подій (Event Delegation)
 * Один обробник на контейнер, що керує всіма динамічними кнопками
 */
function setupGlobalEventListeners() {
  const container = document.getElementById('purchasesList');
  if (!container) return;

  // Слухаємо кліки на самому контейнері
  container.addEventListener('click', async (event) => {
    // Шукаємо найближчий елемент з тригером дії
    const target = event.target.closest('[data-action]');
    if (!target) return;

    const action = target.dataset.action;
    const itemId = target.dataset.id;

    if (!itemId) return;

    if (action === 'delete') {
      event.preventDefault();
      event.stopPropagation();
      
      // Оптимістичне оновлення UI (Optimistic UI Pattern)
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

  // Форма додавання
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

      purchases.unshift(newItem); // Додаємо на початок
      input.value = '';
      renderPurchases();
      await syncState();
    });
  }
}

// Запуск програми
document.addEventListener('DOMContentLoaded', async () => {
  try {
    applyTelegramTheme();
    
    // 1. Прив'язуємо обробники ПОДІЙ ОДРАЗУ, не чекаючи мережі
    setupGlobalEventListeners();

    // 2. Асинхронно завантажуємо сесію та дані
    await initUserSession();
    await loadPurchases();
  } catch (criticalError) {
    console.error('[Critical Initialization Error]:', criticalError);
  }
});
