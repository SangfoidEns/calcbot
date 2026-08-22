let currentUserId = 'default';

export function setCurrentUserId(userId) {
  currentUserId = userId || 'default';
}

function getScopedKey(key) {
  return `hms2_${currentUserId}_${key}`;
}

// Безпечний запис у LocalStorage з обробкою переповнення пам'яті
function safeSetItem(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (e) {
    if (e.name === 'QuotaExceededError' || e.code === 22) {
      console.error('[HMS2.0 Store] Переповнення LocalStorage! Дані занадто великі.');
      alert('⚠️ Увага: Пам\'ять LocalStorage заповнена! Експортуйте архів у TXT, щоб не втратити дані.');
    } else {
      console.error('[HMS2.0 Store] Помилка запису:', e);
    }
    return false;
  }
}

export function savePurchases(data) {
  safeSetItem(getScopedKey('purchases_v2'), JSON.stringify(data));
}

export function loadPurchases() {
  try {
    const raw = localStorage.getItem(getScopedKey('purchases_v2'));
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.error('[HMS2.0 Store] Помилка зчитування закупівель:', e);
    return {};
  }
}

export function saveRawLogs(text) {
  safeSetItem(getScopedKey('raw_logs_v2'), text);
}

export function loadRawLogs() {
  try {
    return localStorage.getItem(getScopedKey('raw_logs_v2')) || '';
  } catch (e) {
    return '';
  }
}

export function saveMyExpenses(data) {
  safeSetItem(getScopedKey('my_expenses_v2'), JSON.stringify(data));
}

export function loadMyExpenses() {
  try {
    const raw = localStorage.getItem(getScopedKey('my_expenses_v2'));
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function saveGlobalArchive(newRecords) {
  if (!Array.isArray(newRecords) || newRecords.length === 0) {
    return loadGlobalArchive();
  }

  try {
    const existingArchive = loadGlobalArchive();
    const map = new Map();

    // Заповнюємо Map для швидкої дедуплікації O(N)
    for (let i = 0; i < existingArchive.length; i++) {
      map.set(existingArchive[i].id, existingArchive[i]);
    }
    for (let i = 0; i < newRecords.length; i++) {
      map.set(newRecords[i].id, newRecords[i]);
    }

    const updatedArchive = Array.from(map.values());
    const isSaved = safeSetItem(getScopedKey('global_archive_v2'), JSON.stringify(updatedArchive));
    
    return isSaved ? updatedArchive : existingArchive;
  } catch (e) {
    console.error('[HMS2.0 Store] Помилка оновлення архіву:', e);
    return [];
  }
}

export function loadGlobalArchive() {
  try {
    const raw = localStorage.getItem(getScopedKey('global_archive_v2'));
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('[HMS2.0 Store] Помилка завантаження архіву:', e);
    return [];
  }
}

export function clearGlobalArchive() {
  try {
    localStorage.removeItem(getScopedKey('global_archive_v2'));
  } catch (e) {
    console.error('[HMS2.0 Store] Помилка очищення архіву:', e);
  }
}
