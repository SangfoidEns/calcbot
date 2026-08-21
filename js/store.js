/**
 * Модуль сховища із захистом від Race Conditions (Sequential Queue)
 */

let currentUserId = 'default_user';
let saveQueue = Promise.resolve();

export function setCurrentUserId(userId) {
  if (userId) {
    currentUserId = String(userId);
  }
}

function getStorageKey(key) {
  return `hms2_${currentUserId}_${key}`;
}

export async function loadData(key, defaultValue = null) {
  const storageKey = getStorageKey(key);
  const tg = window.Telegram?.WebApp;

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
        localStorage.setItem(storageKey, JSON.stringify(parsed));
        return parsed;
      }
    } catch (e) {
      console.warn('[Store] Помилка CloudStorage, читаємо LocalStorage:', e);
    }
  }

  try {
    const localData = localStorage.getItem(storageKey);
    return localData ? JSON.parse(localData) : defaultValue;
  } catch (e) {
    console.error('[Store] Критична помилка LocalStorage:', e);
    return defaultValue;
  }
}

export async function saveData(key, value) {
  saveQueue = saveQueue.then(async () => {
    const storageKey = getStorageKey(key);
    const stringValue = JSON.stringify(value);
    const tg = window.Telegram?.WebApp;

    try {
      localStorage.setItem(storageKey, stringValue);
    } catch (e) {
      console.error('[Store] Помилка збереження в LocalStorage:', e);
    }

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
