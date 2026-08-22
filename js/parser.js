import { safeParseDate } from './analytics.js';

export function parseWeightAndBonus(str) {
  if (!str) return { baseGramm: 0, bonusGramm: 0 };
  const clean = str.toString().toLowerCase().replace(',', '.').trim();
  
  let bonusGramm = 0;
  const bonusMatch = clean.match(/!(\d*\.?\d+)\s*(?:бонус|б)/);
  if (bonusMatch) {
    bonusGramm = parseFloat(bonusMatch[1]) || 0;
  }

  const pureWeightStr = clean.replace(/!(\d*\.?\d+)\s*(?:бонус|б)/g, '').trim();
  const numbers = pureWeightStr.match(/\d*\.?\d+/g);
  const baseGramm = numbers ? numbers.reduce((acc, curr) => acc + (parseFloat(curr) || 0), 0) : 0;

  return { baseGramm, bonusGramm };
}

export function parseMoneyAndPaymentType(str) {
  if (!str) return { eurPaid: 0, isCard: false, debtNew: 0, debtRepaid: 0, rawDebtText: '' };

  const clean = str.toString().toLowerCase().replace(',', '.').trim();
  const isCard = clean.includes('карта');
  let eurPaid = 0;
  let debtNew = 0;
  let debtRepaid = 0;
  let rawDebtText = '';

  if (clean.includes('долг')) {
    rawDebtText = clean;
    const newDebtMatch = clean.match(/(-\d*\.?\d+)\s*долг/);
    const repaidDebtMatch = clean.match(/(?:\+?(\d*\.?\d+))\s*долг/);

    if (newDebtMatch) {
      debtNew = Math.abs(parseFloat(newDebtMatch[1])) || 0;
    } else if (repaidDebtMatch && !clean.includes('-')) {
      debtRepaid = parseFloat(repaidDebtMatch[1]) || 0;
    }

    const moneyStr = clean.replace(/[-+]?\d*\.?\d+\s*долг/g, '').replace('карта', '').trim();
    const moneyMatch = moneyStr.match(/\d*\.?\d+/);
    if (moneyMatch) eurPaid = parseFloat(moneyMatch[0]) || 0;
  } else {
    const cleanMoney = clean.replace('карта', '').trim();
    const matches = cleanMoney.match(/\d*\.?\d+/);
    if (matches) eurPaid = parseFloat(matches[0]) || 0;
  }

  return { eurPaid, isCard, debtNew, debtRepaid, rawDebtText };
}

// Професійний патерн дедуплікації (DJB2 Hash Algorithm)
function generateDedupeHash(cat, client, gramm, money, time) {
  const str = `${cat}_${client}_${gramm}_${money}_${time}`.toLowerCase().replace(/\s+/g, '');
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
  }
  return `rec_${Math.abs(hash)}`;
}

/**
  Розумний Парсер: розбиває текст на елементарні блоки 
  і не ламається, якщо між ними є сміття чи пусті рядки.
 */
export function parseLogs(rawText) {
  if (!rawText || typeof rawText !== 'string') return [];

  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  let currentCategory = 'UNCATEGORIZED';
  const records = [];

  for (let i = 0; i < lines.length; i++) {
    // Перевірка на заголовок категорії
    if (i + 3 < lines.length && 
        lines[i+1].toLowerCase() === 'name' && 
        lines[i+2].toLowerCase() === 'gramm' && 
        lines[i+3] === '€') {
      currentCategory = lines[i].toUpperCase();
      i += 3; // Пропускаємо шапку таблиці
      continue;
    }

    // Шукаємо паттерн часу як якоря (Anchor Pattern)
    const possibleTime = lines[i];
    const isTimeFormat = /^(\d{1,2}:\d{2})(\s+\d{1,2}\.\d{1,2}(\.\d{2,4})?)?$/.test(possibleTime) || possibleTime.includes(':');

    if (isTimeFormat && i >= 3) {
      const timeStr = possibleTime;
      const rawMoney = lines[i - 1];
      const rawGramm = lines[i - 2];
      const clientName = lines[i - 3];

      // Валідація: ім'я не має бути системним словом
      if (['name', 'gramm', '€'].includes(clientName.toLowerCase())) continue;

      const weightData = parseWeightAndBonus(rawGramm);
      const moneyData = parseMoneyAndPaymentType(rawMoney);
      const parsedDateObj = parseRecordDateTime(timeStr);

      const exactGramm = (weightData.baseGramm * 1.1) + weightData.bonusGramm;
      const dedupeId = generateDedupeHash(currentCategory, clientName, rawGramm, rawMoney, timeStr);

      records.push({
        id: dedupeId,
        category: currentCategory,
        clientName,
        rawGramm,
        baseGramm: weightData.baseGramm,
        bonusGramm: weightData.bonusGramm,
        totalBaseGramm: weightData.baseGramm + weightData.bonusGramm,
        exactGramm,
        rawMoney,
        eurPaid: moneyData.eurPaid,
        isCard: moneyData.isCard,
        debtNew: moneyData.debtNew,
        debtRepaid: moneyData.debtRepaid,
        rawDebtText: moneyData.rawDebtText,
        timeStr,
        parsedDateObj: parsedDateObj.toISOString()
      });
    }
  }

  return records;
}

export function parseRecordDateTime(timeStr) {
  const now = new Date();
  if (!timeStr) return now;

  let year = now.getFullYear();
  let month = now.getMonth();
  let day = now.getDate();
  let hour = 12;
  let minute = 0;

  const parts = timeStr.trim().split(/\s+/);
  parts.forEach(p => {
    if (p.includes(':')) {
      const [h, m] = p.split(':');
      hour = parseInt(h, 10) || 0;
      minute = parseInt(m, 10) || 0;
    } else if (p.includes('.')) {
      const [d, m, y] = p.split('.');
      if (d) day = parseInt(d, 10);
      if (m) month = parseInt(m, 10) - 1;
      if (y) {
        const parsedYear = parseInt(y, 10);
        year = parsedYear < 100 ? 2000 + parsedYear : parsedYear;
      }
    }
  });

  const res = new Date(year, month, day, hour, minute);
  return isNaN(res.getTime()) ? now : res;
}
