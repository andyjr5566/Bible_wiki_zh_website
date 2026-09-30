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
