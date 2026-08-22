export function safeParseDate(dateInput) {
  if (!dateInput) return new Date();
  const d = new Date(dateInput);
  return isNaN(d.getTime()) ? new Date() : d;
}

export function filterRecordsByPeriod(records, period) {
  if (!records || !Array.isArray(records)) return [];
  if (period === 'all') return records;

  const now = new Date();
  const cutoff = new Date();

  if (period === 'week') {
    cutoff.setDate(now.getDate() - 7);
  } else if (period === 'month') {
    cutoff.setMonth(now.getMonth() - 1);
  } else {
    return records;
  }

  return records.filter(r => safeParseDate(r.parsedDateObj) >= cutoff);
}

export function groupRecordsByTimeSlot(records, period) {
  const groups = {};

  records.forEach(r => {
    const d = safeParseDate(r.parsedDateObj);
    let key = '';

    if (period === 'week') {
      const days = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
      key = days[d.getDay()];
    } else if (period === 'month') {
      key = `${d.getDate()}.${d.getMonth() + 1}`;
    } else {
      key = `${d.getMonth() + 1}.${d.getFullYear()}`;
    }

    if (!groups[key]) {
      groups[key] = { revenue: 0, weight: 0, count: 0 };
    }

    groups[key].revenue += r.eurPaid || 0;
    groups[key].weight += r.exactGramm || 0;
    groups[key].count += 1;
  });

  return groups;
}

export function getTopClients(records, topN = 3) {
  const map = {};

  records.forEach(r => {
    const name = r.clientName || 'Невідомий';
    if (!map[name]) {
      map[name] = { clientName: name, totalSpent: 0, totalWeight: 0, dealsCount: 0 };
    }
    map[name].totalSpent += r.eurPaid || 0;
    map[name].totalWeight += r.exactGramm || 0;
    map[name].dealsCount += 1;
  });

  return Object.values(map)
    .sort((a, b) => b.totalSpent - a.totalSpent)
    .slice(0, topN);
}

export function calculateWeeklyHeatmap(records, monthFilter = 'all') {
  const matrix = Array.from({ length: 7 }, () => Array(24).fill(0));
  let maxVal = 0;

  records.forEach(r => {
    const d = safeParseDate(r.parsedDateObj);

    if (monthFilter !== 'all' && d.getMonth() !== parseInt(monthFilter, 10)) {
      return;
    }

    const day = d.getDay();
    const hour = d.getHours();
    const rev = r.eurPaid || 0;

    matrix[day][hour] += rev;
    if (matrix[day][hour] > maxVal) {
      maxVal = matrix[day][hour];
    }
  });

  return { matrix, maxVal };
}
