import type { CampId, Side, Status } from '../data/types';

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

/** 四營的顏色與形狀：色盲也分得出來 */
export const CAMP_STYLE: Record<CampId, { color: string; shape: 'circle' | 'tri' | 'square' | 'diamond'; glyph: string }> = {
  judah: { color: 'var(--c-east)', shape: 'circle', glyph: '東' },
  reuben: { color: 'var(--c-south)', shape: 'tri', glyph: '南' },
  ephraim: { color: 'var(--c-west)', shape: 'square', glyph: '西' },
  dan: { color: 'var(--c-north)', shape: 'diamond', glyph: '北' },
};

export const CAMP_HEX: Record<CampId, number> = { judah: 0xc2410c, reuben: 0x9f1d3a, ephraim: 0x3553a0, dan: 0x2f7a48 };

export const SIDE_NAME: Record<Side, string> = { east: '東邊', south: '南邊', west: '西邊', north: '北邊' };

/** 傳統的纛圖案（GT 串珠、精讀本），經文沒記載 */
export const BANNER_TRADITION: Record<CampId, { animal: string; glyph: string; note: string }> = {
  judah: { animal: '獅子', glyph: '獅', note: '精讀本：畫著獅子的綠旗，依創49:9「猶大是個小獅子」' },
  reuben: { animal: '人', glyph: '人', note: '精讀本：畫著人的紅旗，流便作為長子是家族的頭' },
  ephraim: { animal: '牛', glyph: '牛', note: '精讀本：畫著牛犢的黃旗' },
  dan: { animal: '鷹', glyph: '鷹', note: '精讀本：畫著鷹的紅白旗，但不喜歡被描述成蛇（創49:17），選了蛇的天敵鷹' },
};
