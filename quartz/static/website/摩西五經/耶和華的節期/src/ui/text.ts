import { h } from './dom';
import type { VerseBlock } from '../data/types';

/** `==關鍵詞==` 轉成血紅色的 <mark class="jf-key">；其餘照原文放進文字節點 */
export function richText(text: string): Node[] {
  const out: Node[] = [];
  const re = /==(.+?)==/g;
  let last = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) out.push(document.createTextNode(text.slice(last, m.index)));
    out.push(h('mark', { class: 'jf-key' }, m[1]));
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(document.createTextNode(text.slice(last)));
  return out;
}

/**
 * 經文：單節只放文字；多節在每節前面放小節號。
 * 文字一字不改，只取自 SITE.verses。
 */
export function verseNodes(block: VerseBlock, numbered = block.lines.length > 1): Node[] {
  const out: Node[] = [];
  block.lines.forEach((ln, i) => {
    if (numbered) out.push(h('sup', { class: 'jf-vn', 'aria-label': `第${ln.v}節` }, String(ln.v)));
    out.push(document.createTextNode(ln.text));
    if (i < block.lines.length - 1) out.push(document.createTextNode(' '));
  });
  return out;
}

/** 全書名的出處：「約書亞記 5:10-12」「詩篇 81:3-4」（單節不加範圍） */
export const fullRef = (b: VerseBlock): string =>
  `${b.book} ${b.chapter}:${b.from === b.to ? b.from : `${b.from}-${b.to}`}`;

/** 「約書亞記 5 章」 */
export const chapterLabel = (b: VerseBlock): string => `${b.book} ${b.chapter} 章`;

/** 日數牌上的日子：1 → 初一 … 14 → 十四 … 21 → 二十一 … 30 → 三十 */
const DAY_NAMES = [
  '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
  '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
  '二十一', '二十二', '二十三', '二十四', '二十五', '二十六', '二十七', '二十八', '二十九', '三十',
];
export const dayName = (d: number): string => DAY_NAMES[Math.min(DAY_NAMES.length, Math.max(1, Math.round(d))) - 1];
