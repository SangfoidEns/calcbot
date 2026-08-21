// Модуль роботи з хмарним сховищем Telegram CloudStorage з фолбеком на localStorage

const isCloudAvailable = () => {
  return window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.CloudStorage;
};

// Універсальне асинхронне читання з CloudStorage / localStorage
async function getItem(key) {
  if (isCloudAvailable()) {
    return new Promise((resolve) => {
      window.Telegram.WebApp.CloudStorage.getItem(key, (err, value) => {
        if (err || !value) {
          // Якщо в хмарі немає, пробуємо зчитати з локального фолбеку
          const localVal = localStorage.getItem(key);
          resolve(localVal ? JSON.parse(localLocalVal(localVal)) : null);
        } else {
          try {
            resolve(JSON.parse(value));
          } catch (e) {
            resolve(null);
          }
        }
      });
    });
  } else {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : null;
  }
}

function localLocalVal(val) {
  try { return JSON.parse(val); } catch (e) { return null; }
}

// Універсальний асинхронний запис у CloudStorage + localStorage (дублювання для надійності)
async function setItem(key, value) {
  const jsonString = JSON.stringify(value);
  
  // Завжди дублюємо в localStorage для миттєвого відгуку UI
  localStorage.setItem(key, jsonString);

  if (isCloudAvailable()) {
    return new Promise((resolve) => {
      window.Telegram.WebApp.CloudStorage.setItem(key, jsonString, (err, success) => {
        if (err) console.error(`Error saving ${key} to CloudStorage:`, err);
        resolve(success);
      });
    });
  }
}

let currentUserId = 'guest';

export function setCurrentUserId(userId) {
  if (userId) currentUserId = userId;
}

// Keys generator with user prefix
const getKey = (name) => `hms2_${currentUserId}_${name}`;

// 1. Закупівлі (Purchases)
export async function loadPurchases() {
  const data = await getItem(getKey('purchases'));
  return data || { "СОРТ_1": 600, "СОРТ_2": 550 };
}

export async function savePurchases(purchases) {
  await setItem(getKey('purchases'), purchases);
}

// 2. Сирі логи (Raw Input Text)
export async function loadRawLogs() {
  const data = await getItem(getKey('raw_logs'));
  return data || '';
}

export async function saveRawLogs(text) {
  await setItem(getKey('raw_logs'), text);
}

// 3. Особисті витрати (My Expenses)
export async function loadMyExpenses() {
  const data = await getItem(getKey('my_expenses'));
  return data || [];
}

export async function saveMyExpenses(expenses) {
  await setItem(getKey('my_expenses'), expenses);
}

// 4. Глобальний архів угод (Global Archive)
export async function loadGlobalArchive() {
  const data = await getItem(getKey('global_archive'));
  return data || [];
}

export async function saveGlobalArchive(newRecordsBatch) {
  if (!newRecordsBatch || newRecordsBatch.length === 0) {
    return await loadGlobalArchive();
  }

  const existing = await loadGlobalArchive();
  
  // Дедуплікація за timestamp та клієнтом
  const combined = [...existing];
  newRecordsBatch.forEach(newRec => {
    const isDuplicate = existing.some(ex => 
      ex.parsedDateObj === newRec.parsedDateObj && 
      ex.clientName === newRec.clientName &&
      ex.eurPaid === newRec.eurPaid
    );
    if (!isDuplicate) {
      combined.push(newRec);
    }
  });

  await setItem(getKey('global_archive'), combined);
  return combined;
}

export async function clearGlobalArchive() {
  await setItem(getKey('global_archive'), []);
  if (isCloudAvailable()) {
    window.Telegram.WebApp.CloudStorage.removeItem(getKey('global_archive'));
  }
}
