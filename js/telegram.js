/**
 * Telegram Auth & Session Manager
 * Підтримує Telegram Mini Apps (WebApp) та Telegram Login Widget.
 */

export function getTelegramUser() {
  let user = null;

  // 1. Перевіряємо, чи відкрито додаток всередині Telegram Mini App (TG WebApp SDK)
  if (window.Telegram && window.Telegram.WebApp) {
    try {
      // Сповіщаємо Telegram, що додаток готовий і розгортаємо його на весь екран
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
    } catch (e) {
      console.warn('[Telegram SDK] Не вдалося ініціалізувати WebApp:', e);
    }

    // Отримуємо дані користувача з Telegram SDK
    const initDataUnsafe = window.Telegram.WebApp.initDataUnsafe;
    const tgUser = initDataUnsafe?.user;

    if (tgUser && tgUser.id) {
      user = {
        id: tgUser.id.toString(),
        firstName: tgUser.first_name || 'Користувач',
        lastName: tgUser.last_name || '',
        username: tgUser.username ? `@${tgUser.username}` : '',
        photoUrl: tgUser.photo_url || ''
      };

      // КЕШУЄМО ДАНІ: Якщо користувач зайшов з Телеграму, зберігаємо його профіль
      localStorage.setItem('hms2_cached_user', JSON.stringify(user));
      return user;
    }
  }

  // 2. Якщо це відкрито НЕ в Mini App, перевіряємо чи є авторизований сеанс у LocalStorage
  const cached = localStorage.getItem('hms2_cached_user');
  if (cached) {
    try {
      const parsedUser = JSON.parse(cached);
      // Якщо це був справжній сеанс Telegram (а не старий dev-профіль), повертаємо його
      if (parsedUser && parsedUser.id && !parsedUser.id.startsWith('dev_')) {
        return parsedUser;
      }
    } catch (e) {
      console.error('[Storage Error] Помилка читання збереженого профілю:', e);
    }
  }

  // 3. ФОЛБЕК ДЛЯ РОЗРОБКИ / БРАУЗЕРА (Спрацьовує тільки якщо Telegram не доступний)
  let devId = localStorage.getItem('hms2_dev_id');
  if (!devId) {
    devId = 'dev_' + Math.random().toString(36).substring(2, 9);
    localStorage.setItem('hms2_dev_id', devId);
  }

  user = {
    id: devId,
    firstName: 'Dev',
    lastName: 'Admin',
    username: `@${devId}`,
    photoUrl: ''
  };

  return user;
}

/**
 * Ручна авторизація через Telegram Widget (для звичайних браузерів)
 * @param {Object} tgUserObj - об'єкт користувача, який повертає Telegram Login Widget
 */
export function saveTelegramWidgetUser(tgUserObj) {
  if (!tgUserObj || !tgUserObj.id) return null;

  const user = {
    id: tgUserObj.id.toString(),
    firstName: tgUserObj.first_name || 'Користувач',
    lastName: tgUserObj.last_name || '',
    username: tgUserObj.username ? `@${tgUserObj.username}` : '',
    photoUrl: tgUserObj.photo_url || ''
  };

  localStorage.setItem('hms2_cached_user', JSON.stringify(user));
  return user;
}
