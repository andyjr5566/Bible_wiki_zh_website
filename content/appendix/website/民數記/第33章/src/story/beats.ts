import VERSES from '../data/verses.json';
import { DATES, SPANS } from '../data/dates';
import { SEGMENTS, station, stationRef } from '../data/stations';
import type { Ref } from '../data/types';
import { ZONE_STATIONS, boundsOf } from '../geo';
import { h } from '../ui/dom';
import { badge, expandRef, refChip } from '../ui/evidence';

/**
 * 開場捲動故事的每一幕。文字全部取自資料檔：經文是 verses.json（raw_scripture）整節，
 * 日期取自 data/dates.ts，分段取自 data/stations.ts。這裡只決定順序、地圖框到哪裡、路線走到第幾站。
 */
export interface Frame { x: number; y: number; w: number; h: number }

export interface Beat {
  id: string;
  /** 右側進度軌上的短名；沒有就不列 */
  nav?: string;
  /** 路線走到第幾站（1–42 的小數） */
  p: number;
  /** 地圖框住的範圍（地圖單位） */
  frame: Frame;
  /** 開場的斜視圖（Blender）還看得到多少：1 全部、0 換成正上方的地圖 */
  hero: number;
  /** 顯示整條路線的淡線（結尾） */
  ghost?: boolean;
  /** 畫出申1:2「十一天的路程」那一段（西乃到加低斯） */
  eleven?: boolean;
  /** 卡片的捲動長度（vh） */
  len?: number;
  kind?: 'title' | 'end';
  card(): HTMLElement;
}

const verses = VERSES as Record<string, string>;

/** 整節經文（楷書），摘句加亮 */
export function verseBlock(ref: Ref, q?: string, size: 'xl' | 'lg' | 'md' = 'lg'): HTMLElement {
  const p = h('blockquote', { class: `sv sv-${size}`, cite: ref });
  for (const k of expandRef(ref)) {
    const text = verses[k];
    if (!text) continue;
    const span = h('span', { class: 'sv-v' });
    if (q && text.includes(q)) {
      const [a, ...rest] = text.split(q);
      span.append(a, h('mark', null, q), rest.join(q));
    } else span.append(text);
    p.append(span);
  }
  return h('figure', { class: 'sv-fig' }, p, h('figcaption', null, refChip(ref, q)));
}

const seg = (i: 0 | 1 | 2) => {
  const sg = SEGMENTS.ct[i];
  return h('p', { class: `sk seg-${i}` }, h('span', { class: 'sk-bar' }), `CT 第${'一二三'[i]}段：${sg.name}・第 ${sg.from}–${sg.to} 站・${sg.note}`);
};
const stationHead = (n: number) => h('h2', { class: 'sh' }, h('span', { class: 'sh-n' }, `第 ${n} 站`), station(n).name);
const dateNote = (i: number) => (DATES[i].note ? h('p', { class: 'snote' }, DATES[i].note) : null);
/** 整條路線（不是整張地圖：整張圖放進右邊六成的空間會縮得太小、露出暈渲圖的邊） */
const full: Frame = boundsOf(Array.from({ length: 42 }, (_, i) => i + 1), 30);
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

export function buildBeats(skip: HTMLElement): Beat[] {
  return [
    {
      id: 'open', nav: '開始', kind: 'title', p: 1, frame: full, hero: 1, len: 110,
      card: () => h('div', { class: 'scard-title' },
        h('h1', null, '曠野四十二站'),
        verseBlock('民33:2', '摩西遵著耶和華的吩咐記載他們所行的路程', 'xl'),
        h('p', { class: 'slede' }, '民數記 33 章把以色列人從蘭塞到摩押平原的路，一站一站記了下來：四十二個站口，大多數只有名字。這個網站把它們放上地圖，也把「經文沒說的事」標出來。'),
        skip),
    },
    {
      id: 'egypt', nav: '埃及', p: 1, frame: boundsOf(range(1, 6), 70), hero: 0,
      card: () => h('div', null, seg(0), stationHead(1), verseBlock(DATES[0].ref, DATES[0].q)),
    },
    {
      id: 'sea', nav: '過海', p: 5, frame: boundsOf(range(3, 8), 60), hero: 0,
      card: () => h('div', null, stationHead(5), verseBlock('民33:8', '經過海中')),
    },
    {
      id: 'sinai', nav: '西乃', p: 12, frame: boundsOf(range(7, 12), 60), hero: 0,
      card: () => h('div', null, stationHead(12), verseBlock(DATES[2].ref, DATES[2].q), dateNote(2)),
    },
    {
      id: 'eleven', nav: '十一天', p: 12, frame: boundsOf([12, 33], 90), hero: 0, eleven: true,
      card: () => h('div', null, verseBlock(SPANS[2].ref, SPANS[2].q), h('p', { class: 'slede' }, SPANS[2].label, '。')),
    },
    {
      id: 'wander', nav: '三十八年', p: 33, frame: boundsOf([12, 33, ...ZONE_STATIONS], 50), hero: 0, len: 150,
      card: () => h('div', null, seg(1),
        verseBlock(SPANS[0].ref, SPANS[0].q),
        h('p', { class: 'snote' }, '空心圓是經文沒有給日期、在兩個日期之間平均分配的站；粗一點的是經文給了日期的站。三十八年裡每一站停多久，經文沒有寫。')),
    },
    {
      id: 'kadesh', nav: '加低斯', p: 33, frame: boundsOf(range(30, 35), 60), hero: 0,
      card: () => h('div', null, stationHead(33), verseBlock(DATES[6].ref, DATES[6].q), h('p', { class: 'snote' }, badge(DATES[6].status), ' ', DATES[6].note ?? '')),
    },
    {
      id: 'hor', nav: '何珥山', p: 34, frame: boundsOf(range(32, 37), 60), hero: 0,
      card: () => h('div', null, seg(2), stationHead(34), verseBlock(DATES[7].ref, DATES[7].q)),
    },
    {
      id: 'moab', nav: '摩押', p: 42, frame: boundsOf(range(34, 42), 50), hero: 0,
      card: () => h('div', null, stationHead(42), verseBlock(stationRef(station(42)), station(42).q, 'md'), verseBlock(DATES[8].ref, DATES[8].q, 'md')),
    },
    {
      id: 'end', nav: '全程', kind: 'end', p: 42, frame: full, hero: 0, ghost: true, len: 100,
      card: () => h('div', null,
        h('ol', { class: 'segsum' }, ...SEGMENTS.ct.map((sg, i) => h('li', { class: `seg-${i}` },
          h('b', null, sg.name), h('span', null, `第 ${sg.from}–${sg.to} 站・${sg.note}`), ' ', refChip(sg.ref)))),
        verseBlock(SPANS[1].ref, SPANS[1].q, 'md')),
    },
  ];
}
