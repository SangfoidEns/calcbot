/**
 * Модуль аналітики та розумного прогнозування на основі інтервалів покупок
 */

export function getPurchaseAnalytics(purchases = []) {
  const total = purchases.length;
  const completed = purchases.filter(p => p.completed).length;
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  return { total, completed, pending: total - completed, completionRate };
}

/**
 * Розумний прогнозик покупок (Smart Time-Based Forecasting)
 */
export function getForecastedItems(currentPurchases = [], historyPurchases = []) {
  if (!historyPurchases || historyPurchases.length === 0) {
    const defaults = ['Молоко 1л', 'Хліб', 'Яйця 10шт', 'Вода 6л'];
    const activeTitles = currentPurchases.map(p => p.title.toLowerCase().trim());
    return defaults.filter(d => !activeTitles.includes(d.toLowerCase()));
  }

  const now = Date.now();
  const DAY_IN_MS = 1000 * 60 * 60 * 24;

  const itemStats = {};

  historyPurchases.forEach(item => {
    if (!item.title) return;
    const cleanTitle = item.title.trim();
    const key = cleanTitle.toLowerCase();

    if (!itemStats[key]) {
      itemStats[key] = {
        originalTitle: cleanTitle,
        timestamps: []
      };
    }
    itemStats[key].timestamps.push(item.timestamp || now);
  });

  const scoredItems = [];
  const activeTitles = new Set(currentPurchases.map(p => p.title.toLowerCase().trim()));

  Object.keys(itemStats).forEach(key => {
    if (activeTitles.has(key)) return;

    const stats = itemStats[key];
    const times = stats.timestamps.sort((a, b) => a - b);
    const count = times.length;
    const lastBought = times[times.length - 1];
    
    const daysSinceLast = Math.max(0.5, (now - lastBought) / DAY_IN_MS);

    let score = 0;

    if (count === 1) {
      score = daysSinceLast * 0.5;
    } else {
      const totalInterval = (times[times.length - 1] - times[0]) / DAY_IN_MS;
      const avgInterval = Math.max(1, totalInterval / (count - 1));

      const readinessRatio = daysSinceLast / avgInterval;
      score = count * readinessRatio;
    }

    scoredItems.push({
      title: stats.originalTitle,
      score: score
    });
  });

  return scoredItems
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map(item => item.title);
}
