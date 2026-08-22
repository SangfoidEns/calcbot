/**
 * HMS2.0 - Storage Engine
 */

let currentUserId = 'default';

export function setCurrentUserId(userId) {
  currentUserId = userId || 'default';
}

function getScopedKey(key) {
  return `hms2_${currentUserId}_${key}`;
}

export function savePurchases(data) {
  try {
    localStorage.setItem(getScopedKey('purchases_v2'), JSON.stringify(data));
  } catch (e) {
    console.error('[Storage Error: savePurchases]', e);
  }
}

export function loadPurchases() {
  try {
    const raw = localStorage.getItem(getScopedKey('purchases_v2'));
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

export function saveRawLogs(text) {
  try {
    localStorage.setItem(getScopedKey('raw_logs_v2'), text);
  } catch (e) {
    console.error('[Storage Error: saveRawLogs]', e);
  }
}

export function loadRawLogs() {
  try {
    return localStorage.getItem(getScopedKey('raw_logs_v2')) || '';
  } catch (e) {
    return '';
  }
}

export function saveMyExpenses(data) {
  try {
    localStorage.setItem(getScopedKey('my_expenses_v2'), JSON.stringify(data));
  } catch (e) {
    console.error('[Storage Error: saveMyExpenses]', e);
  }
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
  try {
    const existingArchive = loadGlobalArchive();
    const map = new Map();

    existingArchive.forEach(item => map.set(item.id, item));
    newRecords.forEach(item => map.set(item.id, item));

    const updatedArchive = Array.from(map.values());
    localStorage.setItem(getScopedKey('global_archive_v2'), JSON.stringify(updatedArchive));
    return updatedArchive;
  } catch (e) {
    console.error('[Storage Error: saveGlobalArchive]', e);
    return [];
  }
}

export function loadGlobalArchive() {
  try {
    const raw = localStorage.getItem(getScopedKey('global_archive_v2'));
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function clearGlobalArchive() {
  try {
    localStorage.removeItem(getScopedKey('global_archive_v2'));
  } catch (e) {
    console.error('[Storage Error: clearGlobalArchive]', e);
  }
}
