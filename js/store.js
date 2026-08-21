// Модуль роботи зі сховищем даних (CloudStorage / LocalStorage)

let currentUserId = 'default_user';

export function setCurrentUserId(userId) {
  if (userId) {
    currentUserId = String(userId);
  }
}

function getStorageKey(key) {
  return `hms2_${currentUserId}_${key}`;
}

/**
 * Завантаження даних
 */
export async function loadData(key, defaultValue = null) {
  const storageKey = getStorageKey(key);
  const tg = window.Telegram?.WebApp;

  // 1. Спроба зчитати з Telegram CloudStorage
  if (tg?.CloudStorage) {
    try {
      const data = await new Promise((resolve) => {
        tg.CloudStorage.getItem(storageKey, (err, value) => {
          if (err || !value) resolve(null);
          else resolve(value);
        });
      });

      if (data) {
        const parsed = JSON.parse(data);
        localStorage.setItem(storageKey, JSON.stringify(parsed)); // Синхронізуємо локально
        return parsed;
      }
    } catch (e) {
      console.warn('Помилка читання з CloudStorage:', e);
    }
  }

  // 2. Резервне читання з LocalStorage
  try {
    const localData = localStorage.getItem(storageKey);
    return localData ? JSON.parse(localData) : defaultValue;
  } catch (e) {
    console.error('Помилка читання LocalStorage:', e);
    return defaultValue;
  }
}

/**
 * Збереження даних
 */
export async function saveData(key, value) {
  const storageKey = getStorageKey(key);
  const stringValue = JSON.stringify(value);
  const tg = window.Telegram?.WebApp;

  // Записи у LocalStorage робимо завжди
  try {
    localStorage.setItem(storageKey, stringValue);
  } catch (e) {
    console.error('Помилка збереження в LocalStorage:', e);
  }

  // Записи в Telegram CloudStorage для міжпристроєвої синхронізації
  if (tg?.CloudStorage) {
    try {
      await new Promise((resolve) => {
        tg.CloudStorage.setItem(storageKey, stringValue, (err, success) => {
          resolve(success);
        });
      });
    } catch (e) {
      console.warn('Помилка збереження в CloudStorage:', e);
    }
  }
}
