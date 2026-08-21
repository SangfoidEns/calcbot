/**
 * Telegram WebApp Integration Module
 */

export function getTelegramUser() {
  const tg = window.Telegram?.WebApp;

  if (tg) {
    tg.ready();
    tg.expand(); // Розгортаємо WebApp на весь екран
  }

  const user = tg?.initDataUnsafe?.user;

  if (user) {
    return {
      id: user.id.toString(),
      username: user.username ? `@${user.username}` : '',
      firstName: user.first_name || 'Користувач',
      lastName: user.last_name || '',
      photoUrl: user.photo_url || null,
      isTelegram: true
    };
  }

  // Fallback для розробки у звичайному браузері
  return {
    id: 'dev_guest_1001',
    username: '@dev_user',
    firstName: 'Dev Local',
    lastName: 'Account',
    photoUrl: null,
    isTelegram: false
  };
}
