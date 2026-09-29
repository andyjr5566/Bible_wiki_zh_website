import type { Status } from '../data/types';

export const STATUS_LABEL: Record<Status, string> = {
  explicit: '經文明說',
  synthesis: '綜合整理',
  interpretation: '註釋解讀',
  not_stated: '經文沒說',
};

export const STATUS_HELP: Record<Status, string> = {
  explicit: '這句話經文直接寫了，點旁邊的經節可以看原文。',
  synthesis: '把幾處經文放在一起看得出來，但沒有一句話直接這樣講。',
  interpretation: '註釋家的讀法，不同註釋家可能不一樣。',
  not_stated: '經文在這裡沒有交代。網站不替它補上答案。',
};

export const METAL: Record<string, { label: string; color: string }> = {
  bronze: { label: '銅', color: '#b0703a' },
  silver: { label: '銀', color: '#9aa4ae' },
  gold: { label: '金', color: '#c9982c' },
  'pure-gold': { label: '精金', color: '#e0b43e' },
  fabric: { label: '布與皮', color: '#8c3b2e' },
};
