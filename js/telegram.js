// Модуль для роботи з Telegram WebApp SDK та авторизацією

// Генерируємо або отримуємо стабільний унікальний ID для пристрою поза Telegram
function getOrCreateFallbackDeviceId() {
  let fallbackId = localStorage.getItem('hms2_fallback_user_id');
  if (!fallbackId) {
    fallbackId = 'usr_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
    localStorage.setItem('hms2_fallback_user_id', fallbackId);
  }
  return fallbackId;
}

// Завантаження збереженого профілю з кешу
function getCachedUser() {
  try {
    const cached = localStorage.getItem('hms2_telegram_user_cache');
    return cached ? JSON.parse(cached) : null;
  } catch (e) {
    return null;
  }
}

// Збереження профілю в кеш
function setCachedUser(userObj) {
  try {
    localStorage.setItem('hms2_telegram_user_cache', JSON.stringify(userObj));
  } catch (e) {
    console.error('Не вдалося зберегти кеш користувача:', e);
  }
}

/**
 * Отримання та надійне збереження об'єкта користувача
 */
export async function getTelegramUser() {
  const tg = window.Telegram?.WebApp;

  if (tg) {
    tg.ready();
    tg.expand();
  }

  const tgUser = tg?.initDataUnsafe?.user;

  // 1. Спроба авторизації через прямі дані Telegram SDK
  if (tgUser && tgUser.id) {
    const userProfile = {
      id: String(tgUser.id),
      firstName: tgUser.first_name || 'Користувач',
      lastName: tgUser.last_name || '',
      username: tgUser.username ? `@${tgUser.username}` : '',
      photoUrl: tgUser.photo_url || ''
    };

    setCachedUser(userProfile);
    return userProfile;
  }

  // 2. Якщо відкрито повторно або WebView не передав initData відразу — беремо з кешу
  const cachedUser = getCachedUser();
  if (cachedUser && cachedUser.id) {
    return cachedUser;
  }

  // 3. Резервний локальний режим (запуск поза Telegram)
  const fallbackId = getOrCreateFallbackDeviceId();
  const defaultUser = {
    id: fallbackId,
    firstName: 'Локальний',
    lastName: 'Користувач',
    username: 'offline_mode',
    photoUrl: ''
  };

  setCachedUser(defaultUser);
  return defaultUser;
}

/**
 * Застосування теми Telegram
 */
export function applyTelegramTheme() {
  const tg = window.Telegram?.WebApp;
  if (!tg || !tg.colorScheme) return;

  if (tg.colorScheme === 'dark') {
    document.documentElement.classList.add('dark');
  }
}
