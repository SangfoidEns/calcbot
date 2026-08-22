export function exportArchiveToTxt(records, periodName = 'export') {
  if (!records || records.length === 0) {
    alert('Немає даних для експорту');
    return;
  }

  let textContent = `=== HMS 2.0 EXPORT (${periodName.toUpperCase()}) ===\n`;
  textContent += `Дата експорту: ${new Date().toLocaleString()}\n`;
  textContent += `Всього записів: ${records.length}\n`;
  textContent += `===========================================\n\n`;

  records.forEach((r, idx) => {
    textContent += `[${idx + 1}] ${r.category} | ${r.clientName} | ${r.timeStr}\n`;
    textContent += `    Вага: ${r.rawGramm} (Точна: ${r.exactGramm.toFixed(2)}g)\n`;
    textContent += `    Оплата: ${r.eurPaid} € (${r.isCard ? 'Карта' : 'Готівка'})\n`;
    if (r.rawDebtText) {
      textContent += `    Борг: ${r.rawDebtText}\n`;
    }
    textContent += `-------------------------------------------\n`;
  });

  const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `hms_archive_${periodName}_${Date.now()}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
