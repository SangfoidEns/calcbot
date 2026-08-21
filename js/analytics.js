/**
 * Safe Analytics Processing
 */

export function filterRecordsByPeriod(records, period) {
  if (!Array.isArray(records)) return [];
  const now = new Date();
  return records.filter(r => {
    const d = new Date(r.parsedDateObj);
    const diffTime = Math.abs(now - d);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (period === 'day') return diffDays <= 1;
    if (period === 'week') return diffDays <= 7;
    if (period === 'month') return diffDays <= 30;
    return true;
  });
}

export function groupRecordsByTimeSlot(records, period) {
  const grouped = {};
  if (!Array.isArray(records)) return grouped;

  records.forEach(r => {
    const d = new Date(r.parsedDateObj);
    let key = '';

    if (period === 'day') {
      key = `${String(d.getHours()).padStart(2, '0')}:00`;
    } else if (period === 'week' || period === 'month') {
      key = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;
    } else {
      key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }

    if (!grouped[key]) {
      grouped[key] = { revenue: 0, weight: 0 };
    }

    grouped[key].revenue += (r.eurPaid || 0);
    grouped[key].weight += (r.exactGramm || 0);
  });

  return grouped;
}