// Модуль сховища з захистом від Race Conditions (Mutex Lock)

let currentUserId = 'default_user';
let saveQueue = Promise.resolve(); // Черга для послідовних записів

export function setCurrentUserId(userId) {
  if (userId) {
    currentUserId = String(userId);
  }
}

function getStorageKey(key) {
  return `hms2_${currentUserId}_${key}`;
}

/**
 * Безпечне асинхронне читання
 */
export async function loadData(key, defaultValue = null) {
  const storageKey = getStorageKey(key);
  const tg = window.Telegram?.WebApp;

  // 1. Спроба читання з Telegram CloudStorage
  if (tg?.CloudStorage) {
    try {
      const cloudValue = await new Promise((resolve) => {
        tg.CloudStorage.getItem(storageKey, (err, value) => {
          if (err || !value) resolve(null);
          else resolve(value);
        });
      });

      if (cloudValue !== null) {
        const parsed = JSON.parse(cloudValue);
        localStorage.setItem(storageKey, JSON.stringify(parsed)); // Синхронізація
        return parsed;
      }
    } catch (e) {
      console.warn('[Store] Помилка читання з CloudStorage, перехід на LocalStorage:', e);
    }
  }

  // 2. Резервне читання з LocalStorage
  try {
    const localData = localStorage.getItem(storageKey);
    return localData ? JSON.parse(localData) : defaultValue;
  } catch (e) {
    console.error('[Store] Критична помилка читання з LocalStorage:', e);
    return defaultValue;
  }
}

/**
 * Послідовне збереження даних через чергу (Sequential Queue)
 */
export async function saveData(key, value) {
  // Додаємо операцію в чергу, щоб уникнути конфліктів асинхронності
  saveQueue = saveQueue.then(async () => {
    const storageKey = getStorageKey(key);
    const stringValue = JSON.stringify(value);
    const tg = window.Telegram?.WebApp;

    // Локальний запис
    try {
      localStorage.setItem(storageKey, stringValue);
    } catch (e) {
      console.error('[Store] Помилка збереження LocalStorage:', e);
    }

    // Хмарний запис Telegram
    if (tg?.CloudStorage) {
      try {
        await new Promise((resolve) => {
          tg.CloudStorage.setItem(storageKey, stringValue, (err, success) => {
            if (err) console.warn('[Store] CloudStorage setItem error:', err);
            resolve(success);
          });
        });
      } catch (e) {
        console.warn('[Store] Не вдалося зберегти в CloudStorage:', e);
      }
    }
  });

  return saveQueue;
}
