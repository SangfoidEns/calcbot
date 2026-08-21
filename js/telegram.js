/**
 * Безпечний модуль ініціалізації Telegram WebApp SDK
 */

const CACHE_KEY = 'hms2_user_session';

export async function getTelegramUser() {
  const tg = window.Telegram?.WebApp;

  if (tg) {
    tg.ready();
    tg.expand();
  }

  // 1. Спроба отримати актуального користувача з Telegram SDK
  const tgUser = tg?.initDataUnsafe?.user;
  if (tgUser && tgUser.id) {
    const userProfile = {
      id: String(tgUser.id),
      firstName: tgUser.first_name || 'Користувач',
      lastName: tgUser.last_name || '',
      username: tgUser.username ? `@${tgUser.username}` : '',
      photoUrl: tgUser.photo_url || '',
      isRealTg: true
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(userProfile));
    return userProfile;
  }

  // 2. Якщо Telegram WebView завантажився без initData - беремо з кешу
  const cached = localStorage.getItem(CACHE_KEY);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (e) {
      console.warn('[Telegram SDK] Помилка зчитування кешу');
    }
  }

  // 3. Тільки для локальної розробки поза Telegram
  const fallbackUser = {
    id: 'dev_user_' + Math.random().toString(36).substring(2, 7),
    firstName: 'Dev',
    lastName: 'User',
    username: '@dev_mode',
    photoUrl: '',
    isRealTg: false
  };
  localStorage.setItem(CACHE_KEY, JSON.stringify(fallbackUser));
  return fallbackUser;
}

export function applyTelegramTheme() {
  const tg = window.Telegram?.WebApp;
  if (tg?.colorScheme === 'dark' || !tg?.colorScheme) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}
