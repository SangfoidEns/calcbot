// Safe Date Parser
export function safeParseDate(dateStr) {
  if (!dateStr) return new Date();
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? new Date() : d;
}

// Filter Records by Selected Period
export function filterRecordsByPeriod(records, period) {
  const now = new Date();
  return records.filter(r => {
    const d = safeParseDate(r.parsedDateObj);
    const diffDays = (now - d) / (1000 * 60 * 60 * 24);

    if (period === 'day') return diffDays <= 1;
    if (period === 'week') return diffDays <= 7;
    if (period === 'month') return diffDays <= 30;
    return true; // 'all'
  });
}

// Group Records Chronologically
export function groupRecordsByTimeSlot(records, period) {
  const grouped = {};

  records.forEach(r => {
    const d = safeParseDate(r.parsedDateObj);
    let key = '';

    if (period === 'day') {
      key = `${String(d.getHours()).padStart(2, '0')}:00`;
    } else if (period === 'week') {
      const days = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
      key = `${days[d.getDay()]} (${d.getDate()}.${d.getMonth() + 1})`;
    } else if (period === 'month') {
      key = `${d.getDate()}.${d.getMonth() + 1}`;
    } else {
      key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }

    if (!grouped[key]) {
      grouped[key] = { revenue: 0, weight: 0, timestamp: d.getTime() };
    }

    grouped[key].revenue += (r.eurPaid || 0);
    grouped[key].weight += (r.exactGramm || 0);
  });

  const sortedKeys = Object.keys(grouped).sort((a, b) => grouped[a].timestamp - grouped[b].timestamp);

  const result = {};
  sortedKeys.forEach(k => {
    result[k] = grouped[k];
  });

  return result;
}

// Top Clients Aggregator
export function getTopClients(records, limit = 3) {
  const map = {};
  records.forEach(r => {
    if (!map[r.clientName]) {
      map[r.clientName] = { clientName: r.clientName, totalSpent: 0, totalWeight: 0, dealsCount: 0 };
    }
    map[r.clientName].totalSpent += r.eurPaid || 0;
    map[r.clientName].totalWeight += r.exactGramm || 0;
    map[r.clientName].dealsCount += 1;
  });

  return Object.values(map)
    .sort((a, b) => b.totalSpent - a.totalSpent)
    .slice(0, limit);
}

// 7x24 Heatmap Matrix Calculation
export function calculateWeeklyHeatmap(records, selectedMonth = 'all') {
  const matrix = Array.from({ length: 7 }, () => Array(24).fill(0));
  let maxVal = 0;

  records.forEach(r => {
    const d = safeParseDate(r.parsedDateObj);

    if (selectedMonth !== 'all' && d.getMonth().toString() !== selectedMonth.toString()) {
      return;
    }

    const dayIndex = d.getDay();
    const hour = d.getHours();

    matrix[dayIndex][hour] += (r.eurPaid || 0);
    if (matrix[dayIndex][hour] > maxVal) {
      maxVal = matrix[dayIndex][hour];
    }
  });

  return { matrix, maxVal };
}
