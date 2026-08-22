export function getTelegramUser() {
  if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe?.user) {
    const tgUser = window.Telegram.WebApp.initDataUnsafe.user;
    return {
      id: tgUser.id.toString(),
      firstName: tgUser.first_name || 'User',
      lastName: tgUser.last_name || '',
      username: tgUser.username ? `@${tgUser.username}` : '',
      photoUrl: tgUser.photo_url || ''
    };
  }

  return {
    id: 'local_dev_user',
    firstName: 'Dev',
    lastName: 'Admin',
    username: '@local_dev',
    photoUrl: ''
  };
}
