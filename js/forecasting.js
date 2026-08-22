import { safeParseDate } from './analytics.js';

function calculateLinearRegression(points) {
  const n = points.length;
  if (n === 0) return { slope: 0, intercept: 0 };
  if (n === 1) return { slope: 0, intercept: points[0].y };

  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumX += points[i].x;
    sumY += points[i].y;
    sumXY += points[i].x * points[i].y;
    sumXX += points[i].x * points[i].x;
  }

  const denominator = (n * sumXX - sumX * sumX);
  if (denominator === 0) return { slope: 0, intercept: sumY / n };

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  return { slope, intercept };
}

export function generateForecasts(records) {
  if (!records || records.length === 0) {
    const empty = { revenue: 0, weight: 0, deals: 0 };
    return { tomorrow: empty, week: empty, month: empty, year: empty };
  }

  const dailyMap = {};
  records.forEach(r => {
    const d = safeParseDate(r.parsedDateObj);
    const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    
    if (!dailyMap[dateKey]) {
      dailyMap[dateKey] = { 
        revenue: 0, 
        weight: 0, 
        deals: 0, 
        timestamp: new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() 
      };
    }
    dailyMap[dateKey].revenue += (r.eurPaid || 0);
    dailyMap[dateKey].weight += (r.exactGramm || 0);
    dailyMap[dateKey].deals += 1;
  });

  const sortedDays = Object.values(dailyMap).sort((a, b) => a.timestamp - b.timestamp);
  if (sortedDays.length === 0) {
    const empty = { revenue: 0, weight: 0, deals: 0 };
    return { tomorrow: empty, week: empty, month: empty, year: empty };
  }

  const firstTimestamp = sortedDays[0].timestamp;
  const MS_PER_DAY = 86400000;

  const revPoints = sortedDays.map(d => ({ x: Math.round((d.timestamp - firstTimestamp) / MS_PER_DAY), y: d.revenue }));
  const weightPoints = sortedDays.map(d => ({ x: Math.round((d.timestamp - firstTimestamp) / MS_PER_DAY), y: d.weight }));
  const dealsPoints = sortedDays.map(d => ({ x: Math.round((d.timestamp - firstTimestamp) / MS_PER_DAY), y: d.deals }));

  const revReg = calculateLinearRegression(revPoints);
  const weightReg = calculateLinearRegression(weightPoints);
  const dealsReg = calculateLinearRegression(dealsPoints);

  const lastDayIndex = Math.round((sortedDays[sortedDays.length - 1].timestamp - firstTimestamp) / MS_PER_DAY);

  const predictSumForDays = (startDayIndex, daysCount) => {
    let sumRev = 0, sumWeight = 0, sumDeals = 0;
    for (let i = 1; i <= daysCount; i++) {
      const targetDay = startDayIndex + i;
      sumRev += Math.max(0, revReg.slope * targetDay + revReg.intercept);
      sumWeight += Math.max(0, weightReg.slope * targetDay + weightReg.intercept);
      sumDeals += Math.max(0, dealsReg.slope * targetDay + dealsReg.intercept);
    }
    return {
      revenue: Math.round(sumRev),
      weight: Math.round(sumWeight * 10) / 10,
      deals: Math.round(sumDeals)
    };
  };

  return {
    tomorrow: predictSumForDays(lastDayIndex, 1),
    week: predictSumForDays(lastDayIndex, 7),
    month: predictSumForDays(lastDayIndex, 30),
    year: predictSumForDays(lastDayIndex, 365)
  };
}
