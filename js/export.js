import { filterRecordsByPeriod, safeParseDate } from './analytics.js';

export function exportArchiveToTxt(globalArchiveRecords, currentPeriod) {
  const filtered = filterRecordsByPeriod(globalArchiveRecords, currentPeriod);

  if (filtered.length === 0) {
    alert('Немає даних у цьому періоді для експорту.');
    return;
  }

  const groupedByCat = {};
  filtered.forEach(r => {
    if (!groupedByCat[r.category]) {
      groupedByCat[r.category] = [];
    }
    groupedByCat[r.category].push(r);
  });

  let txtLines = [];

  Object.keys(groupedByCat).forEach(cat => {
    txtLines.push(`| name | gramm | € | time |`);

    groupedByCat[cat].sort((a, b) => safeParseDate(a.parsedDateObj) - safeParseDate(b.parsedDateObj));

    groupedByCat[cat].forEach(r => {
      txtLines.push(`| ${r.clientName} | ${r.rawGramm} | ${r.rawMoney} | ${r.timeStr} |`);
    });
  });

  const txtContent = txtLines.join('\n');
  const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `HMS2_Report_${currentPeriod}_${new Date().toISOString().slice(0, 10)}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
