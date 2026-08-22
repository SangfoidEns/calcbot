export function getTelegramUser() {
  let user = null;

  // 1. Спроба отримати з Telegram WebApp SDK
  if (window.Telegram && window.Telegram.WebApp) {
    try {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
    } catch (e) {
      console.warn('Telegram WebApp error:', e);
    }

    const tgUser = window.Telegram.WebApp.initDataUnsafe?.user;
    if (tgUser && tgUser.id) {
      user = {
        id: tgUser.id.toString(),
        firstName: tgUser.first_name || 'User',
        lastName: tgUser.last_name || '',
        username: tgUser.username ? `@${tgUser.username}` : '',
        photoUrl: tgUser.photo_url || ''
      };
      // Кешуємо користувача для подальших заходів з браузера
      localStorage.setItem('hms2_cached_user', JSON.stringify(user));
      return user;
    }
  }

  // 2. Спроба отримати з кешу LocalStorage
  const cached = localStorage.getItem('hms2_cached_user');
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (e) {
      console.error('Failed to parse cached user', e);
    }
  }

  // 3. Fallback: створення постійного UUID для автономного браузера
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

  localStorage.setItem('hms2_cached_user', JSON.stringify(user));
  return user;
}
