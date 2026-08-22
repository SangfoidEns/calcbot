let currentUserId = 'default_user';

export function setCurrentUserId(userId) {
  if (userId) currentUserId = userId.toString();
}

function getKey(key) {
  return `hms2_${currentUserId}_${key}`;
}

export function savePurchases(data) {
  localStorage.setItem(getKey('purchases'), JSON.stringify(data));
}

export function loadPurchases() {
  const data = localStorage.getItem(getKey('purchases'));
  return data ? JSON.parse(data) : {};
}

export function saveRawLogs(text) {
  localStorage.setItem(getKey('raw_logs'), text);
}

export function loadRawLogs() {
  return localStorage.getItem(getKey('raw_logs')) || '';
}

export function saveMyExpenses(expensesArr) {
  localStorage.setItem(getKey('my_expenses'), JSON.stringify(expensesArr));
}

export function loadMyExpenses() {
  const data = localStorage.getItem(getKey('my_expenses'));
  return data ? JSON.parse(data) : [];
}

export function saveGlobalArchive(newRecordsBatch) {
  const existing = loadGlobalArchive();
  const map = new Map();

  existing.forEach(item => map.set(item.id, item));
  newRecordsBatch.forEach(item => map.set(item.id, item));

  const updatedArr = Array.from(map.values());
  localStorage.setItem(getKey('global_archive'), JSON.stringify(updatedArr));
  return updatedArr;
}

export function loadGlobalArchive() {
  const data = localStorage.getItem(getKey('global_archive'));
  return data ? JSON.parse(data) : [];
}

export function clearGlobalArchive() {
  localStorage.removeItem(getKey('global_archive'));
}
