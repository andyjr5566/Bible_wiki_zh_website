const digitValues: Readonly<Record<string, number>> = {
  零: 0,
  〇: 0,
  一: 1,
  二: 2,
  兩: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
};

function formatUnder10000(input: number): string {
  if (input === 0) return '零';

  let value = input;
  let text = '';
  let zeroPending = false;
  let started = false;
  for (const [unit, unitText] of [
    [1000, '千'],
    [100, '百'],
    [10, '十'],
    [1, ''],
  ] as const) {
    const digit = Math.floor(value / unit);
    value %= unit;
    if (digit > 0) {
      if (zeroPending && started) text += '零';
      if (!(unit === 10 && digit === 1 && !started)) {
        text += '零一二三四五六七八九'[digit];
      }
      text += unitText;
      started = true;
      zeroPending = false;
    } else if (started && value > 0) {
      zeroPending = true;
    }
  }
  return text;
}

function formatChineseNumber(value: number): string {
  if (value < 10000) return formatUnder10000(value);
  const high = Math.floor(value / 10000);
  const low = value % 10000;
  let text = formatUnder10000(high) + '萬';
  if (low > 0) {
    if (low < 1000) text += '零';
    let lowText = formatUnder10000(low);
    if (low >= 10 && low < 20) lowText = '一' + lowText;
    text += lowText;
  }
  return text;
}

function parseUnder10000(text: string): number | null {
  if (text.length === 0) return null;

  let total = 0;
  let digit: number | null = null;
  let lastUnit = 10000;
  let seenUnit = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (Object.prototype.hasOwnProperty.call(digitValues, char)) {
      const value = digitValues[char];
      if (value === 0) {
        if (!seenUnit || digit !== null || index === text.length - 1) return null;
        if ('十百千'.includes(text[index + 1])) return null;
        digit = 0;
      } else {
        if (digit !== null && digit !== 0) return null;
        digit = value;
      }
      continue;
    }

    const unit = char === '十' ? 10 : char === '百' ? 100 : char === '千' ? 1000 : null;
    if (unit === null || unit >= lastUnit || digit === 0) return null;
    if (digit === null) {
      if (unit !== 10 || seenUnit) return null;
      total += 10;
    } else {
      total += digit * unit;
    }
    digit = null;
    lastUnit = unit;
    seenUnit = true;
  }

  if (digit === 0) return null;
  if (digit !== null) total += digit;
  return seenUnit || digit !== null ? total : null;
}

export function chineseNumber(text: string): number | null {
  if (text.length === 0) return null;
  const normalized = text.replaceAll('兩', '二').replaceAll('〇', '零');
  if ([...normalized].some((char) => !'零一二三四五六七八九十百千萬'.includes(char))) {
    return null;
  }
  if (normalized === '零') return 0;
  if ((normalized.match(/萬/g) ?? []).length > 1) return null;

  let value: number;
  if (normalized.includes('萬')) {
    const [highText, initialLowText] = normalized.split('萬');
    const high = parseUnder10000(highText);
    if (high === null || high === 0) return null;

    let lowText = initialLowText;
    if (lowText.startsWith('零')) {
      lowText = lowText.slice(1);
      if (lowText.length === 0) return null;
    }
    const low = lowText.length > 0 ? parseUnder10000(lowText) : 0;
    if (low === null) return null;
    value = high * 10000 + low;
  } else {
    const parsed = parseUnder10000(normalized);
    if (parsed === null) return null;
    value = parsed;
  }

  // 「共一十八人」（拉 8:18）：十幾的數也有寫成「一十幾」的，和 roster.py 一樣接受
  const canonical = formatChineseNumber(value);
  return canonical === normalized || (normalized.startsWith('一十') && canonical === normalized.slice(1)) ? value : null;
}
