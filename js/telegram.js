// Модуль ініціалізації Telegram WebApp SDK

function getOrCreateFallbackDeviceId() {
  let fallbackId = localStorage.getItem('hms2_fallback_user_id');
  if (!fallbackId) {
    fallbackId = 'usr_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
    localStorage.setItem('hms2_fallback_user_id', fallbackId);
  }
  return fallbackId;
}

function getCachedUser() {
  try {
    const cached = localStorage.getItem('hms2_telegram_user_cache');
    return cached ? JSON.parse(cached) : null;
  } catch (e) {
    console.error('[Telegram SDK] Помилка зчитування кешу:', e);
    return null;
  }
}

function setCachedUser(userObj) {
  try {
    localStorage.setItem('hms2_telegram_user_cache', JSON.stringify(userObj));
  } catch (e) {
    console.error('[Telegram SDK] Помилка збереження кешу:', e);
  }
}

/**
 * Отримання профілю користувача з гарантією відсутності втрати ID
 * @returns {Promise<{id: string, firstName: string, lastName: string, username: string, photoUrl: string}>}
 */
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
      photoUrl: tgUser.photo_url || ''
    };

    setCachedUser(userProfile);
    return userProfile;
  }

  // 2. Якщо Telegram WebView завантажився без initData (повторний вхід) - беремо з кешу
  const cachedUser = getCachedUser();
  if (cachedUser && cachedUser.id) {
    return cachedUser;
  }

  // 3. Резервний локальний ідентифікатор для розробки поза Telegram
  const fallbackId = getOrCreateFallbackDeviceId();
  const defaultUser = {
    id: fallbackId,
    firstName: 'Локальний',
    lastName: 'Користувач',
    username: '@local_mode',
    photoUrl: ''
  };

  setCachedUser(defaultUser);
  return defaultUser;
}

/**
 * Застосування темного або світлого стилю Telegram
 */
export function applyTelegramTheme() {
  const tg = window.Telegram?.WebApp;
  if (!tg || !tg.colorScheme) return;

  if (tg.colorScheme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}
