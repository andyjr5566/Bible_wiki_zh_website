import VERSES from '../data/verses.json';
import { BALAAM_FACTS, LEVI_OUT_FACT, OVERVIEW_FACTS, TABERNACLE_FACTS, TOTAL_FACT } from '../data/center';
import { ARK_WORDS, MARCH_END, MARCH_NUM10, TRIGGER } from '../data/march';
import { signal, signalFact } from '../data/trumpets';
import { CAMPS, TOTAL_2, fmt, tribesOf } from '../data/tribes';
import type { CampId, Fact, Ref } from '../data/types';
import { h } from '../ui/dom';
import { badge, expandRef, factLine, refChip } from '../ui/evidence';
import { CAMP_STYLE, SIDE_NAME } from '../ui/meta';

/**
 * 捲動故事的每一幕。畫面上的文字全部取自資料檔（經文取自 verses.json，也就是 raw_scripture），
 * 這裡只決定順序、鏡頭和光線；鏡頭、時刻、地形都是示意。
 */
export type V3 = readonly [number, number, number];
export type RiseState = { court: number; levi: number } & Record<CampId, number>;

export interface Beat {
  id: string;
  /** 右側進度軌上的短名；沒有就不列 */
  nav?: string;
  pos: V3;
  target: V3;
  /** 0 深夜、0.5 黎明、1 白天 */
  tod: number;
  rise: RiseState;
  /** 民10 行軍的階段（store.phase） */
  phase: number;
  /** 顯示哪些名牌；[] 都不顯示 */
  labels: string[];
  /** 直式螢幕（卡片在下半部）另用的鏡頭；沒寫就和橫式相同 */
  m?: { pos?: V3; target?: V3 };
  /** 這一幕卡片的捲動長度（vh） */
  len?: number;
  /** 卡片的樣式 */
  kind?: 'title' | 'camp' | 'total' | 'step' | 'end';
  card(): HTMLElement;
}

const verses = VERSES as Record<string, string>;

/** 整節經文，摘句加亮；跨節的 ref（民9:15-16）逐節接起來 */
export function verseBlock(ref: Ref, q?: string, opts: { size?: 'xl' | 'lg' | 'md' } = {}): HTMLElement {
  const keys = expandRef(ref);
  const p = h('blockquote', { class: `sv sv-${opts.size ?? 'lg'}`, cite: ref });
  for (const k of keys) {
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

const facts = (fs: Fact[]) => h('ul', { class: 'sfacts' }, ...fs.map((f) => h('li', null, factLine(f))));

const ALL = { court: 1, levi: 1, judah: 1, reuben: 1, ephraim: 1, dan: 1 } as const;
const NONE = { court: 1, levi: 0, judah: 0, reuben: 0, ephraim: 0, dan: 0 } as const;
const campLabels = (c: CampId) => [...tribesOf(c).map((t) => `t-${t.id}`), `b-${c}`];

function campCard(id: CampId): HTMLElement {
  const c = CAMPS.find((x) => x.id === id)!;
  const ts = tribesOf(id);
  return h('div', { class: 'scard-camp', style: `--c:${CAMP_STYLE[id].color}` },
    h('p', { class: 'sk' }, h('span', { class: 'omark', 'data-shape': CAMP_STYLE[id].shape, style: `--c:${CAMP_STYLE[id].color}` }), SIDE_NAME[c.side]),
    h('h2', { class: 'sh' }, c.bannerName),
    verseBlock(c.sideRef, c.sideQ),
    h('ol', { class: 'stribes' }, ...ts.map((t) => h('li', null,
      h('b', null, t.name), h('span', { class: 'stribe-n' }, fmt(t.c2.n)),
      h('small', null, t.rank === 1 ? '領頭' : t.rank === 2 ? '挨著他' : '又有')))),
    h('p', { class: 'stotal' },
      h('span', { class: 'count', 'data-n': c.total.n }, fmt(c.total.n)),
      h('span', null, '名・', c.orderName), ' ', badge('explicit'), ' ', refChip(c.total.ref, c.total.zh)));
}

function stepCard(i: number, extraRef?: { ref: Ref; q: string }): HTMLElement {
  const s = MARCH_NUM10[i];
  const sg = s.signal ? signal(s.signal) : null;
  return h('div', { class: 'scard-step', style: s.camps ? `--c:${CAMP_STYLE[s.camps[0]].color}` : '--c:var(--levi)' },
    h('p', { class: 'sk' }, h('span', { class: 'snum' }, String(i + 1)), '第 ', String(i + 1), ' 批'),
    h('h2', { class: 'sh sh-sm' }, s.label),
    sg ? verseBlock(sg.ref, sg.q, { size: 'md' }) : null,
    verseBlock(extraRef?.ref ?? s.ref, extraRef?.q ?? s.q, { size: 'md' }),
    s.carries ? h('p', { class: 'scarry' }, h('b', null, '帶著：'), s.carries) : null,
    sg ? facts([signalFact(sg)]) : null,
    s.note ? h('p', { class: 'snote' }, s.note) : null);
}

export function buildBeats(skipLink: HTMLElement): Beat[] {
  const steps = MARCH_NUM10;
  const p = (i: number) => i + 2; // 第 i 批出發時的 store.phase
  return [
    {
      id: 'open', nav: '開始', kind: 'title', len: 110,
      pos: [-560, 26, 250], target: [-60, 64, -130], m: { pos: [-600, 30, 260], target: [0, 70, 0] }, tod: 0, rise: NONE, phase: 0, labels: [],
      card: () => h('div', { class: 'scard-title' },
        h('h1', null, '環繞會幕'),
        verseBlock('民2:2', '各歸自己的纛下，在本族的旗號那裡，對著會幕的四圍安營', { size: 'xl' }),
        h('p', { class: 'slede' }, '民數記 2 章寫下了以色列全營的位置：誰在東邊、誰在南邊、誰在西邊、誰在北邊，誰先走、誰跟在後面，會幕在哪裡。民數記 10 章的兩枝銀號和第一次拔營，把這張地圖動起來。'),
        skipLink),
    },
    {
      id: 'cloud', nav: '雲彩',
      pos: [-250, 40, 170], target: [-30, 66, -60], m: { pos: [-290, 44, 190], target: [0, 66, 0] }, tod: 0.04, rise: NONE, phase: 0, labels: ['court'],
      card: () => h('div', null,
        verseBlock('民9:15-16', '夜間形狀如火'),
        facts([TABERNACLE_FACTS[2], TRIGGER[3]])),
    },
    {
      id: 'levi', nav: '利未營',
      pos: [-150, 190, 320], target: [0, 0, 10], tod: 0.12, rise: { ...NONE, levi: 1 }, phase: 0,
      labels: ['c-gershon', 'c-kohath', 'c-merari', 'c-priests'],
      card: () => h('div', null,
        verseBlock('民2:17', '有利未營在諸營中間'),
        facts([TABERNACLE_FACTS[1], LEVI_OUT_FACT])),
    },
    {
      id: 'judah', nav: '東', kind: 'camp',
      pos: [40, 64, 150], target: [440, 30, -30], m: { pos: [20, 110, 160], target: [400, -40, -20] }, tod: 0.5, rise: { ...NONE, levi: 1, judah: 1 }, phase: 0, labels: campLabels('judah'),
      card: () => campCard('judah'),
    },
    {
      id: 'reuben', nav: '南', kind: 'camp',
      pos: [-250, 150, 600], target: [0, 0, 230], tod: 0.66, rise: { ...NONE, levi: 1, judah: 1, reuben: 1 }, phase: 0, labels: campLabels('reuben'),
      card: () => campCard('reuben'),
    },
    {
      id: 'ephraim', nav: '西', kind: 'camp',
      pos: [-680, 150, -170], target: [-330, 0, 20], tod: 0.8, rise: { ...NONE, levi: 1, judah: 1, reuben: 1, ephraim: 1 }, phase: 0, labels: campLabels('ephraim'),
      card: () => campCard('ephraim'),
    },
    {
      id: 'dan', nav: '北', kind: 'camp',
      pos: [250, 160, -640], target: [0, 0, -230], tod: 0.92, rise: { ...ALL }, phase: 0, labels: campLabels('dan'),
      card: () => campCard('dan'),
    },
    {
      id: 'all', nav: '全營', kind: 'total',
      pos: [0, 900, 430], target: [0, 0, 30], tod: 1, rise: ALL, phase: 0,
      labels: ['court', ...CAMPS.map((c) => `b-${c.id}`)],
      card: () => h('div', null,
        h('p', { class: 'stotal stotal-xl' }, h('span', { class: 'count', 'data-n': TOTAL_2.n }, fmt(TOTAL_2.n)), h('span', null, '名')),
        verseBlock('民2:32', '六十萬零三千五百五十名', { size: 'md' }),
        facts([TOTAL_FACT, OVERVIEW_FACTS[0]])),
    },
    {
      id: 'balaam', nav: '高處',
      pos: [640, 178, -360], target: [0, 0, 0], tod: 1, rise: ALL, phase: 0, labels: [],
      card: () => h('div', null,
        verseBlock('民24:5', BALAAM_FACTS[2].q),
        facts(BALAAM_FACTS.slice(0, 2)),
        h('p', { class: 'snote' }, '站在營外的高處往下看。山的位置與高度是示意。')),
    },
    {
      id: 'lift', nav: '起行',
      pos: [-320, 90, 300], target: [0, 110, 0], tod: 1, rise: ALL, phase: 1, labels: ['court'],
      card: () => h('div', null,
        verseBlock('民10:11', '第二年二月二十日，雲彩從法櫃的帳幕收上去'),
        h('p', { class: 'slede' }, '起行的信號不是人決定的。雲彩一收上去，以色列人就起行。'),
        facts([TRIGGER[0], TRIGGER[4]])),
    },
    {
      id: 'go-1', nav: '拔營', kind: 'step', len: 90,
      pos: [430, 64, 200], target: [640, 6, -10], tod: 1, rise: ALL, phase: p(0), labels: [],
      card: () => stepCard(0),
    },
    {
      id: 'go-2', kind: 'step', len: 80,
      pos: [250, 86, 250], target: [520, 0, -20], tod: 1, rise: ALL, phase: p(1), labels: [],
      card: () => stepCard(1),
    },
    {
      id: 'go-3', kind: 'step', len: 80,
      pos: [300, 80, 340], target: [560, 0, 70], tod: 1, rise: ALL, phase: p(2), labels: [],
      card: () => stepCard(2),
    },
    {
      id: 'go-4', kind: 'step', len: 70,
      pos: [190, 72, 270], target: [430, 0, 50], tod: 1, rise: ALL, phase: p(3), labels: [],
      card: () => stepCard(3),
    },
    {
      id: 'go-5', kind: 'step', len: 70,
      pos: [60, 120, 330], target: [380, 0, 30], tod: 1, rise: ALL, phase: p(4), labels: [],
      card: () => stepCard(4),
    },
    {
      id: 'go-6', kind: 'step', len: 70,
      pos: [240, 120, -340], target: [450, 0, -60], tod: 1, rise: ALL, phase: p(5), labels: [],
      card: () => stepCard(5),
    },
    {
      id: 'ark', nav: '約櫃',
      pos: [1060, 58, 170], target: [700, 24, -10], tod: 1, rise: ALL, phase: steps.length + 2, labels: [],
      card: () => h('div', null,
        verseBlock('民10:35', ARK_WORDS[0].q),
        verseBlock('民10:36', ARK_WORDS[1].q, { size: 'md' })),
    },
    {
      id: 'end', nav: '結語', kind: 'end', len: 100,
      pos: [260, 300, 460], target: [1050, 0, -40], tod: 1, rise: ALL, phase: steps.length + 2, labels: [],
      card: () => h('div', null,
        verseBlock('民2:34', MARCH_END[0].q),
        facts([MARCH_END[1]])),
    },
  ];
}
