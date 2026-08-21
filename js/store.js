/**
 * Safe LocalStorage Storage Layer
 */

const KEYS = {
  PURCHASES: 'app_purchases_v2',
  RAW_LOGS: 'app_raw_logs_v2',
  MY_EXPENSES: 'app_my_expenses_v2'
};

export function savePurchases(data) {
  try {
    localStorage.setItem(KEYS.PURCHASES, JSON.stringify(data));
  } catch (e) {
    console.error('Storage error:', e);
  }
}

export function loadPurchases() {
  try {
    const raw = localStorage.getItem(KEYS.PURCHASES);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

export function saveRawLogs(text) {
  try {
    localStorage.setItem(KEYS.RAW_LOGS, text);
  } catch (e) {
    console.error('Storage error:', e);
  }
}

export function loadRawLogs() {
  try {
    return localStorage.getItem(KEYS.RAW_LOGS) || '';
  } catch (e) {
    return '';
  }
}

export function saveMyExpenses(data) {
  try {
    localStorage.setItem(KEYS.MY_EXPENSES, JSON.stringify(data));
  } catch (e) {
    console.error('Storage error:', e);
  }
}

export function loadMyExpenses() {
  try {
    const raw = localStorage.getItem(KEYS.MY_EXPENSES);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}