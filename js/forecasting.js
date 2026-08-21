import { safeParseDate } from './analytics.js';

// 1. Прогноз на завтра (погодинно 0..23)
export function predictTomorrowHourly(records) {
  if (!records || records.length === 0) {
    return Array(24).fill({ hour: 0, revenue: 0, weight: 0 });
  }

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const targetDayOfWeek = tomorrow.getDay(); // 0-6

  // Фільтруємо записи тільки за цей же день тижня в минулому
  const sameDayRecords = records.filter(r => safeParseDate(r.parsedDateObj).getDay() === targetDayOfWeek);
  const sourceRecords = sameDayRecords.length >= 5 ? sameDayRecords : records;

  // Рахуємо кількість унікальних днів у вибірці
  const uniqueDates = new Set(sourceRecords.map(r => safeParseDate(r.parsedDateObj).toDateString())).size || 1;

  const hourlyMap = Array.from({ length: 24 }, (_, h) => ({ hour: h, revenue: 0, weight: 0 }));

  sourceRecords.forEach(r => {
    const h = safeParseDate(r.parsedDateObj).getHours();
    hourlyMap[h].revenue += (r.eurPaid || 0);
    hourlyMap[h].weight += (r.exactGramm || 0);
  });

  // Усереднення з легким трендом (+5% оптимістичний коефіцієнт)
  return hourlyMap.map(item => ({
    hour: item.hour,
    revenue: +(item.revenue / uniqueDates * 1.05).toFixed(1),
    weight: +(item.weight / uniqueDates * 1.05).toFixed(2)
  }));
}

// 2. Прогноз на тиждень (по днях: Пн..Нд)
export function predictNextWeekDaily(records) {
  const daysOfWeek = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  if (!records || records.length === 0) {
    return daysOfWeek.map(d => ({ day: d, revenue: 0, weight: 0 }));
  }

  const dayStats = Array.from({ length: 7 }, () => ({ totalRev: 0, totalWeight: 0, count: 0 }));

  records.forEach(r => {
    const d = safeParseDate(r.parsedDateObj);
    const dayIdx = d.getDay();
    dayStats[dayIdx].totalRev += (r.eurPaid || 0);
    dayStats[dayIdx].totalWeight += (r.exactGramm || 0);
    dayStats[dayIdx].count += 1;
  });

  // Починаємо розрахунок від завтрашнього дня на 7 днів уперед
  const result = [];
  const today = new Date();

  for (let i = 1; i <= 7; i++) {
    const nextDate = new Date();
    nextDate.setDate(today.getDate() + i);
    const dayIdx = nextDate.getDay();

    const stat = dayStats[dayIdx];
    const avgRev = stat.count > 0 ? (stat.totalRev / (stat.count / 4 || 1)) : 0; // розрахунок за останні ~4 тижні
    const avgWeight = stat.count > 0 ? (stat.totalWeight / (stat.count / 4 || 1)) : 0;

    result.push({
      dateStr: `${nextDate.getDate()}.${nextDate.getMonth() + 1}`,
      dayName: daysOfWeek[dayIdx],
      revenue: +(avgRev * 1.03).toFixed(1),
      weight: +(avgWeight * 1.03).toFixed(2)
    });
  }

  return result;
}

// 3. Прогноз на місяць (Агрегований підсумок)
export function predictNextMonthSummary(records) {
  const weeklyPrediction = predictNextWeekDaily(records);
  const weeklyRevSum = weeklyPrediction.reduce((acc, d) => acc + d.revenue, 0);
  const weeklyWeightSum = weeklyPrediction.reduce((acc, d) => acc + d.weight, 0);

  // 1 місяць ≈ 4.33 тижні
  return {
    monthlyRevenue: +(weeklyRevSum * 4.33).toFixed(1),
    monthlyWeight: +(weeklyWeightSum * 4.33).toFixed(1),
    expectedDeals: Math.round((records.length / 30) * 30 * 1.05) || 0
  };
}
