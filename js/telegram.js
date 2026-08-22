/**
 * HMS2.0 - Telegram Authentication Module
 */

export function getTelegramUser() {
  let user = null;

  if (window.Telegram && window.Telegram.WebApp) {
    try {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
    } catch (e) {
      console.warn('[TG SDK Warning]', e);
    }

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

      localStorage.setItem('hms2_cached_user', JSON.stringify(user));
      return user;
    }
  }

  const cached = localStorage.getItem('hms2_cached_user');
  if (cached) {
    try {
      const parsedUser = JSON.parse(cached);
      if (parsedUser && parsedUser.id && !parsedUser.id.startsWith('dev_')) {
        return parsedUser;
      }
    } catch (e) {
      console.error('[TG Cache Error]', e);
    }
  }

  let devId = localStorage.getItem('hms2_dev_id');
  if (!devId) {
    devId = 'dev_' + Math.random().toString(36).substring(2, 9);
    localStorage.setItem('hms2_dev_id', devId);
  }

  return {
    id: devId,
    firstName: 'Dev',
    lastName: 'Admin',
    username: `@${devId}`,
    photoUrl: ''
  };
}

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
