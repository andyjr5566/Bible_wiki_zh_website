import type { Actor, OfferingId, PlaceId, Status } from '../data/types';

export const OFFERING_STYLE: Record<OfferingId | 'priesthood', { color: string; shape: string; short: string }> = {
  burnt: { color: 'var(--burnt)', shape: 'tri', short: '燔' },
  grain: { color: 'var(--grain)', shape: 'circle', short: '素' },
  peace: { color: 'var(--peace)', shape: 'square', short: '平' },
  sin: { color: 'var(--sin)', shape: 'diamond', short: '罪' },
  guilt: { color: 'var(--guilt)', shape: 'hex', short: '愆' },
  priesthood: { color: 'var(--priest)', shape: 'star', short: '職' },
};

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

export const ACTOR: Record<Actor, { label: string; color: string; glyph: string }> = {
  offerer: { label: '獻祭的人', color: '#8a6a45', glyph: '人' },
  priest: { label: '祭司', color: '#5a7fa8', glyph: '祭' },
  anointed: { label: '受膏的祭司', color: '#6b4ea2', glyph: '膏' },
  elders: { label: '會中的長老', color: '#7b6b3a', glyph: '老' },
  moses: { label: '摩西', color: '#8a3f2e', glyph: '摩' },
  aaron: { label: '亞倫和他兒子', color: '#6b4ea2', glyph: '亞' },
  sons: { label: '亞倫的兒子', color: '#5a7fa8', glyph: '子' },
  unstated: { label: '經文沒說是誰', color: '#9d8f7b', glyph: '？' },
};

export const PLACE_LABEL: Record<PlaceId, string> = {
  gate: '院子的門',
  front: '會幕門口（壇前）',
  north: '壇的北邊',
  altar: '壇上的火',
  around: '壇的周圍',
  horns: '燔祭壇的四角',
  base: '壇腳',
  side: '壇的旁邊',
  east: '壇東邊倒灰處',
  laver: '洗濯盆',
  door: '會幕門',
  veil: '幔子前',
  incense: '香壇',
  court: '會幕的院子（聖處）',
  camp: '營中',
  outside: '營外潔淨之地',
};

export const ITEM_LABEL: Record<string, string> = {
  bull: '牛', ram: '公羊', goat: '山羊', lamb: '綿羊', bird: '鳥', flour: '細麵', cake: '餅', grain: '禾穗', blood: '血',
  fat: '脂油', meat: '祭肉', skin: '皮', breast: '胸', thigh: '右腿', bread: '餅', ash: '灰', silver: '銀子', fire: '火',
  smoke: '馨香', hand: '按手', oil: '油',
};
