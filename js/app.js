import { getTelegramUser, applyTelegramTheme } from './telegram.js';
import { setCurrentUserId, loadData, saveData } from './store.js';

let currentUser = null;
let purchases = [];

/**
 * Ініціалізація та відображення профілю
 */
async function initUserSession() {
  currentUser = await getTelegramUser();
  setCurrentUserId(currentUser.id);

  const userNameEl = document.getElementById('userName');
  const userHandleEl = document.getElementById('userHandle');
  const userAvatarEl = document.getElementById('userAvatar');

  if (userNameEl) {
    userNameEl.innerText = `${currentUser.firstName} ${currentUser.lastName}`.trim();
  }
  
  if (userHandleEl) {
    userHandleEl.innerText = currentUser.username || `ID: ${currentUser.id}`;
  }

  if (userAvatarEl) {
    if (currentUser.photoUrl) {
      userAvatarEl.innerHTML = `<img src="${currentUser.photoUrl}" class="w-full h-full rounded-full object-cover" alt="Avatar">`;
    } else {
      userAvatarEl.innerText = (currentUser.firstName.charAt(0) || 'U').toUpperCase();
    }
  }
}

/**
 * Завантаження збережених списків покупця
 */
async function loadPurchases() {
  purchases = await loadData('purchases', []);
  renderPurchases();
}

/**
 * Збереження списків покупця
 */
async function savePurchases() {
  await saveData('purchases', purchases);
}

/**
 * Відображення покупок у DOM
 */
function renderPurchases() {
  const container = document.getElementById('purchasesList');
  if (!container) return;

  if (!purchases || purchases.length === 0) {
    container.innerHTML = `<p class="text-center text-gray-400 py-4">Список порожній</p>`;
    return;
  }

  container.innerHTML = purchases.map((item, index) => `
    <div class="flex items-center justify-between p-3 bg-slate-800 rounded-lg mb-2">
      <span class="${item.completed ? 'line-through text-gray-500' : 'text-white'}">${item.title}</span>
      <button data-index="${index}" class="delete-btn text-red-400 hover:text-red-300">Видалити</button>
    </div>
  `).join('');
}

// Запуск застосунку після завантаження сторінки
document.addEventListener('DOMContentLoaded', async () => {
  applyTelegramTheme();

  // 1. Гарантовано чекаємо авторизації та встановлення ID
  await initUserSession();

  // 2. Завантажуємо персональні дані користувача
  await loadPurchases();

  // Форма додавання
  const addForm = document.getElementById('addPurchaseForm');
  if (addForm) {
    addForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = document.getElementById('purchaseInput');
      if (!input || !input.value.trim()) return;

      purchases.push({
        id: Date.now(),
        title: input.value.trim(),
        completed: false
      });

      input.value = '';
      renderPurchases();
      await savePurchases();
    });
  }
});
