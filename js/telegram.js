export function getTelegramUser() {
  const tg = window.Telegram?.WebApp;

  if (tg) {
    tg.ready();
    tg.expand();
  }

  const user = tg?.initDataUnsafe?.user;

  if (user) {
    return {
      id: user.id,
      firstName: user.first_name || 'User',
      lastName: user.last_name || '',
      username: user.username ? `@${user.username}` : '',
      photoUrl: user.photo_url || null
    };
  }

  return {
    id: 'local_dev_id',
    firstName: 'Демо',
    lastName: 'Користувач',
    username: '@demo_user',
    photoUrl: null
  };
}
