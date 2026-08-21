/**
 * Професійний Парсер тексту покупок (Smart Lexer)
 */

const DICTIONARY = {
  'молоко': 'Молочні продукти', 'сир': 'Молочні продукти', 'сметана': 'Молочні продукти', 'масло': 'Молочні продукти',
  'хліб': 'Випічка', 'батон': 'Випічка', 'булочка': 'Випічка',
  'яблуко': 'Фрукти та овочі', 'яблука': 'Фрукти та овочі', 'банан': 'Фрукти та овочі', 'банани': 'Фрукти та овочі', 'картопля': 'Фрукти та овочі',
  'курка': 'М\'ясо', 'м\'ясо': 'М\'ясо', 'фарш': 'М\'ясо', 'ковбаса': 'М\'ясо',
  'воду': 'Напої', 'вода': 'Напої', 'сік': 'Напої', 'кава': 'Напої', 'чай': 'Напої'
};

export function parseInputText(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    return { title: 'Невідомий товар', amount: '1 шт', category: 'Загальне', priority: 'normal' };
  }

  let text = rawText.trim();
  let priority = 'normal';

  // 1. Детекція пріоритету
  if (text.includes('!') || /терміново|срочно/i.test(text)) {
    priority = 'high';
    text = text.replace(/!|терміново|срочно/gi, '').trim();
  }

  // 2. Детекція кількості та одиниць
  let amount = '1 шт';
  const amountRegex = /(\d+(?:[\.,]\d+)?)\s*(кг|г|л|мл|шт|уп|пак|банок|пляшок)?/i;
  const match = text.match(amountRegex);

  if (match) {
    const num = match[1].replace(',', '.');
    const unit = match[2] ? match[2].toLowerCase() : 'шт';
    amount = `${num} ${unit}`;
    text = text.replace(match[0], '').trim();
  }

  // 3. Очищення назви
  const cleanTitle = text.replace(/\s+/g, ' ').trim() || rawText;

  // 4. Визначення категорії
  let category = 'Загальне';
  const words = cleanTitle.toLowerCase().split(' ');
  for (const word of words) {
    if (DICTIONARY[word]) {
      category = DICTIONARY[word];
      break;
    }
  }

  return {
    title: cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1),
    amount,
    category,
    priority
  };
}
