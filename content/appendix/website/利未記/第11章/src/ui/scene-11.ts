import {
  BIRDS, BIRD_RULE, CONTACT, CREEPERS, CREEP_EIGHT, CREEP_RULE, HEBREW_11, INSECTS, INSECT_EXCEPT, INSECT_RULE, KITCHEN, LAND, LAND_EXTRA,
  LAND_RULE, LINK_10_10, NAME_NOTES, NT_11, SEPARATE, VERDICT_LABEL, VOICES_11, WATER_NAMES, WATER_NO, WATER_RULE, WHY,
  type KitchenThing, type NamedCreature,
} from '../data/ch11';
import { REEL_11 } from '../data/reels';
import { animOff, fill, h, motionOff, s, svg } from './dom';
import type { JarPlayer } from '../three/jar';
import { factLine, quoteLine, refChip, refChips, voiceBlock } from './evidence';
import { ICONS } from './icons';
import { answerBridge, layer, readingMore, study } from './common';
import { mountReel } from './reel';
import { kicker, sceneHref, sceneNav } from './shell';
import { sil } from './sil';

/*
 * 第 11 章的呈現（2026-10 重新編排，內容全部沿用 data/ch11.ts、data/reels.ts）：
 *   1. 開場：一條線把本章點名的活物分在兩邊（利11:46-47「可吃的與不可吃的」）
 *   2. 圖鑑：五類活物各有不同的畫線方法，捲動時右邊的圖跟著換
 *   3. 碰到死的：3D 故事當實例，再看摸／拿／吃的兩階，和器物依結果分欄
 *   4. 為什麼：利10:10、利11:47 同一個動詞，利11:44-45 是全章的理由
 */

const yes = (on: boolean, label: string) => h('span', { class: `crit ${on ? 'ok' : 'no'}` }, svg(ICONS[on ? 'check' : 'x']), label);
const reduce = () => motionOff() || animOff();
/** 讀者自己按下去的動畫（分欄、打破瓦器、跳到某一段）只看本站的開關，和 3D 故事的播放一樣 */
const pressedOff = () => animOff();

/* ------------------------------------------------------------ 1. 開場：一條線 */

interface Specimen { sil: string; name: string; refs: string[]; q?: string; ghost?: boolean }

/** 線的兩邊放哪些活物：只放本章（或申14:4）點名、而且網站有剪影的 */
const EDIBLE: Specimen[] = [
  ...LAND.filter((a) => a.verdict === 'clean').map((a) => ({ sil: a.sil!, name: a.name, refs: a.fact.refs!, q: a.fact.q })),
  { sil: 'fish', name: '有翅有鱗的', refs: WATER_RULE.refs!, q: WATER_RULE.q },
  { sil: 'locust', name: INSECTS[0].zh, refs: [INSECTS[0].ref], q: INSECTS[0].zh },
];
const NOT_EDIBLE: Specimen[] = [
  ...LAND.filter((a) => a.verdict !== 'clean').map((a) => ({ sil: a.sil!, name: a.name, refs: a.fact.refs!, q: a.fact.q })),
  { sil: 'fish', name: '無翅無鱗的', refs: WATER_NO.refs!, q: WATER_NO.q, ghost: true },
  ...['烏鴉', '蝙蝠'].map((zh) => BIRDS.find((b) => b.zh === zh)!).map((b) => ({ sil: b.zh === '烏鴉' ? 'raven' : 'bat', name: b.zh, refs: [b.ref], q: b.zh })),
  { sil: 'lizard', name: CREEPERS[2].zh, refs: [CREEPERS[2].ref], q: CREEPERS[2].zh },
];

function specimen(sp: Specimen, i: number): HTMLElement {
  return h('li', { class: `spec${sp.ghost ? ' ghost' : ''}`, style: `--i:${i}` },
    sil(sp.sil), h('b', null, sp.name), refChip(sp.refs[0], sp.q));
}

function divide(): HTMLElement {
  const line = h('span', { class: 'divide-line', 'aria-hidden': 'true' });
  return h('figure', { class: `divide${reduce() ? ' still' : ''}`, 'aria-label': '本章點名的活物，分在可吃的與不可吃的兩邊' },
    h('div', { class: 'divide-side yes' },
      h('h3', null, VERDICT_LABEL.clean),
      h('ul', null, ...EDIBLE.map(specimen))),
    line,
    h('div', { class: 'divide-side no' },
      h('h3', null, '不可吃'),
      h('ul', null, ...NOT_EDIBLE.map((sp, i) => specimen(sp, i + EDIBLE.length)))));
}

/* ------------------------------------------------------------ 2. 圖鑑：五種畫線的方法 */

/** 走獸：兩個條件排成四格，點名的四種各只合一個條件 */
function landFigure(): HTMLElement {
  const cell = (hoof: boolean, cud: boolean) => h('div', { class: `bm-cell${hoof && cud ? ' pass' : ''}` },
    ...LAND.filter((a) => a.hoof === hoof && a.cud === cud).map((a) => h('span', { class: `bm-beast v-${a.verdict}` }, sil(a.sil!), h('b', null, a.name))),
    !LAND.some((a) => a.hoof === hoof && a.cud === cud) ? h('span', { class: 'bm-empty' }, '—') : null);
  return h('div', { class: 'fig-land' },
    h('div', { class: 'beast-matrix' },
      h('div', { class: 'bm-corner' }),
      h('div', { class: 'bm-axis' }, yes(true, '蹄分兩瓣')), h('div', { class: 'bm-axis' }, yes(false, '蹄分兩瓣')),
      h('div', { class: 'bm-axis bm-row' }, yes(true, '倒嚼')), cell(true, true), cell(false, true),
      h('div', { class: 'bm-axis bm-row' }, yes(false, '倒嚼')), cell(true, false), cell(false, false)));
}

/** 水族：只看兩樣，一種也沒點名 */
function waterFigure(): HTMLElement {
  return h('div', { class: 'fig-water' },
    h('div', { class: 'gate-row pass' }, sil('fish', 'fish'), h('span', { class: 'gate-crit' }, yes(true, '有翅'), yes(true, '有鱗')), h('b', null, VERDICT_LABEL.clean)),
    h('div', { class: 'gate-row fail' }, h('span', { class: 'fish-ghost' }, sil('fish', 'fish')), h('span', { class: 'gate-crit' }, yes(false, '無翅'), yes(false, '無鱗')), h('b', null, '可憎')),
    h('p', { class: 'fig-note' }, factLine(WATER_NAMES)));
}

/** 飛鳥：沒有條件，只有二十種的名單 */
function birdFigure(): HTMLElement {
  return h('div', { class: 'fig-birds' },
    h('div', { class: 'fig-art' }, sil('raven'), sil('bat')),
    h('ol', { class: 'roster' }, ...BIRDS.map((b, i) => h('li', { class: i === BIRDS.length - 1 ? 'last' : null }, h('small', null, String(i + 1)), b.zh))));
}

/** 有翅膀的爬物：一律可憎，裡面劃出蹦跳的一小塊 */
function insectFigure(): HTMLElement {
  return h('div', { class: 'fig-set' },
    h('div', { class: 'set-outer' },
      h('span', { class: 'set-label' }, '有翅膀用四足爬行的', h('b', null, '可憎')),
      h('div', { class: 'set-inner' },
        h('span', { class: 'set-label' }, '有足有腿、在地上蹦跳的', h('b', null, VERDICT_LABEL.clean)),
        sil('locust'),
        h('ul', { class: 'set-names' }, ...INSECTS.map((c) => h('li', null, c.zh))))));
}

/** 地上的爬物：一律不可吃，其中八種死了碰到會使人不潔淨 */
function creepFigure(): HTMLElement {
  return h('div', { class: 'fig-set creep' },
    h('div', { class: 'set-outer' },
      h('span', { class: 'set-label' }, '一切爬在地上的', h('b', null, '不可吃')),
      h('div', { class: 'gaits' }, h('span', null, sil('snake'), '用肚子行走的'), h('span', null, sil('lizard'), '用四足行走的'), h('span', null, svg(ICONS.q), '有許多足的')),
      h('div', { class: 'set-inner touch' },
        h('span', { class: 'set-label' }, '其中八種', h('b', null, '死了碰到就不潔淨')),
        h('ul', { class: 'set-names' }, ...CREEPERS.map((c) => h('li', null, c.zh))))));
}

function namesGrid(list: NamedCreature[]): HTMLElement {
  return h('ol', { class: 'names numbered' }, ...list.map((c) => h('li', { class: 'name-tile' },
    h('b', null, c.zh), refChip(c.ref, c.zh),
    h('span', { class: 'he-row' }, h('span', { class: 'he', lang: 'he', dir: 'rtl' }, c.he), h('small', null, c.tr)),
    h('span', { class: 'gloss-row' }, h('small', null, 'STEP 本節譯義'), h('span', { lang: 'en' }, c.gloss), c.lex !== c.gloss ? h('small', { class: 'lex' }, `辭典：${c.lex}`) : null))));
}

interface Realm { id: string; name: string; how: string; fig: () => HTMLElement; text: () => (HTMLElement | null)[] }

const REALMS: Realm[] = [
  {
    id: 'land', name: '走獸', how: '看兩個條件', fig: landFigure,
    text: () => [
      h('p', { class: 'realm-rule' }, quoteLine(LAND_RULE)),
      h('ul', { class: 'key-lines' }, ...LAND.filter((a) => a.verdict !== 'clean').map((a) => h('li', null, factLine(a.fact)))),
      h('ul', { class: 'key-lines' }, ...LAND_EXTRA.map((f) => h('li', null, factLine(f)))),
      voiceBlock(VOICES_11.pair),
      study('為什麼沙番和兔子算「倒嚼」', voiceBlock(VOICES_11.sight), voiceBlock(VOICES_11.hyrax), h('p', { class: 'study-p' }, factLine(HEBREW_11[3]))),
    ],
  },
  {
    id: 'water', name: '水族', how: '看兩樣', fig: waterFigure,
    text: () => [h('p', { class: 'realm-rule' }, quoteLine(WATER_RULE)), h('ul', { class: 'key-lines' }, h('li', null, factLine(WATER_NO, { quote: true })))],
  },
  {
    id: 'bird', name: '飛鳥', how: '只有名單', fig: birdFigure,
    text: () => [
      h('p', { class: 'realm-rule' }, factLine(BIRD_RULE)),
      voiceBlock(VOICES_11.birds),
      study('二十種的原文和譯名', namesGrid(BIRDS), ...NAME_NOTES.map((f) => h('p', { class: 'study-p' }, factLine(f)))),
    ],
  },
  {
    id: 'insect', name: '有翅膀的爬物', how: '一律可憎，蹦跳的例外', fig: insectFigure,
    text: () => [
      h('p', { class: 'realm-rule' }, quoteLine(INSECT_RULE)),
      h('ul', { class: 'key-lines' }, h('li', null, factLine(INSECT_EXCEPT, { quote: true }))),
      voiceBlock(VOICES_11.locust),
      study('四種可吃的原文', namesGrid(INSECTS)),
    ],
  },
  {
    id: 'creep', name: '地上的爬物', how: '一律不可吃', fig: creepFigure,
    text: () => [
      h('p', { class: 'realm-rule' }, quoteLine(CREEP_RULE)),
      h('ul', { class: 'key-lines' }, h('li', null, factLine(CREEP_EIGHT, { quote: true }))),
      study('八種的原文', namesGrid(CREEPERS), h('p', { class: 'study-p' }, factLine(HEBREW_11[1]))),
    ],
  },
];

/** 一類一段：左邊文字往上捲，右邊的圖黏在畫面上，捲到下一類才換 */
function realms(): HTMLElement {
  const index = h('ol', { class: 'realm-index', 'aria-label': '五類活物' }, ...REALMS.map((r) => h('li', null,
    h('a', { href: `#/c11`, 'data-to': r.id, onclick: (e: MouseEvent) => {
      e.preventDefault();
      document.getElementById(`realm-${r.id}`)?.scrollIntoView({ behavior: pressedOff() ? 'auto' : 'smooth', block: 'start' });
    } }, h('b', null, r.name), h('small', null, r.how)))));
  const steps = REALMS.map((r) => h('section', { class: 'realm', id: `realm-${r.id}`, 'data-id': r.id },
    h('div', { class: 'realm-text' },
      h('h3', null, r.name, h('small', null, r.how)),
      ...r.text()),
    h('figure', { class: `realm-fig fig-${r.id}`, 'aria-label': `${r.name}：${r.how}` }, r.fig())));
  // 目前讀到哪一類，索引跟著亮
  const io = new IntersectionObserver((es) => {
    for (const e of es) {
      if (!e.isIntersecting) continue;
      const id = (e.target as HTMLElement).dataset.id;
      index.querySelectorAll('a').forEach((a) => a.toggleAttribute('aria-current', a.dataset.to === id));
    }
  }, { rootMargin: '-45% 0px -50% 0px' });
  steps.forEach((st) => io.observe(st));
  return h('div', { class: 'realms' }, index, ...steps);
}

/* ------------------------------------------------------------ 3. 碰到死的 */

const RESULT_TEXT: Record<KitchenThing['result'], string> = {
  break: '要打破', water: '放在水中，到晚上', clean: '仍是潔淨', unclean: '不潔淨', evening: '不潔淨到晚上',
};
const RESULT_ORDER: KitchenThing['result'][] = ['break', 'water', 'unclean', 'clean', 'evening'];

/** 摸、拿、吃：兩階 */
function ladder(): HTMLElement {
  const step = (lvl: number, verbs: string, out: HTMLElement[], rows: typeof CONTACT) => h('div', { class: `stair s${lvl}` },
    h('div', { class: 'stair-verbs' }, verbs),
    h('div', { class: 'stair-out' }, ...out),
    h('ul', { class: 'stair-refs' }, ...rows.map((c) => h('li', null, `${c.verb}${c.what}`, ' ', ...refChips(c.fact.refs, c.fact.q)))));
  const evening = h('span', { class: 'out evening' }, '不潔淨到晚上');
  return h('div', { class: 'ladder2' },
    step(1, '摸', [evening], CONTACT.filter((c) => !c.wash)),
    step(2, '拿、吃', [evening.cloneNode(true) as HTMLElement, h('span', { class: 'out wash' }, '還要洗衣服')], CONTACT.filter((c) => c.wash)),
    h('div', { class: 'ladder-voices' }, voiceBlock(VOICES_11.carry), voiceBlock(VOICES_11.evening)));
}

/** 器物：先混在一起，按一下依結果分欄；點一樣東西看經文 */
function sorter(): HTMLElement {
  const jarBox = h('div', { class: 'k-jar', 'aria-hidden': 'true' });
  let jar: Promise<JarPlayer | null> | null = null;
  const canWebGL = () => {
    try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
  };
  const out = h('div', { class: 'k-out', 'aria-live': 'polite' }, h('p', { class: 'k-empty' }, '點一樣東西，看經文怎麼說。'));
  const tiles = KITCHEN.map((k) => h('button', { class: `k-tile r-${k.result}`, type: 'button', 'data-id': k.id, onclick: () => choose(k) },
    h('span', { class: 'k-ico' }, svg(ICONS[k.icon] ?? ICONS.q)), h('b', null, k.name)));
  function choose(k: KitchenThing) {
    tiles.forEach((t) => t.classList.toggle('on', t.dataset.id === k.id));
    const v = k.id === 'clay' ? VOICES_11.clay : k.id === 'spring' ? VOICES_11.spring : null;
    let shards: HTMLElement | null = null;
    if (k.id === 'clay' && canWebGL()) {
      jar ??= import('../three/jar').then((m) => m.mountJar(jarBox, pressedOff())).catch((e) => { console.error(e); return null; });
      requestAnimationFrame(() => jar!.then((p) => p?.play()));
      shards = jarBox;
    }
    fill(out,
      shards,
      h('div', { class: `k-verdict r-${k.result}` }, h('small', null, `掉在${k.name}上`), h('b', null, RESULT_TEXT[k.result])),
      h('p', { class: 'k-q' }, quoteLine(k.fact)),
      h('p', { class: 'k-plain' }, k.fact.text),
      v ? voiceBlock(v) : null,
      k.id === 'spring' ? voiceBlock(VOICES_11.springGrace) : null);
  }
  const pile = h('div', { class: 'k-pile' }, ...tiles);
  const cols = RESULT_ORDER.map((r) => h('div', { class: `k-col r-${r}`, 'data-r': r }, h('h4', null, RESULT_TEXT[r])));
  const table = h('div', { class: 'k-table', hidden: true }, ...cols);
  let sorted = false;
  const btn = h('button', { class: 'chipbtn', type: 'button', 'aria-pressed': 'false' }, '依結果分欄');
  btn.addEventListener('click', () => {
    sorted = !sorted;
    const before = new Map(tiles.map((t) => [t, t.getBoundingClientRect()]));
    if (sorted) KITCHEN.forEach((k, i) => cols[RESULT_ORDER.indexOf(k.result)].append(tiles[i]));
    else pile.append(...tiles);
    table.hidden = !sorted;
    pile.hidden = sorted;
    btn.setAttribute('aria-pressed', String(sorted));
    btn.textContent = sorted ? '混在一起' : '依結果分欄';
    if (pressedOff()) return;
    for (const t of tiles) {
      const a = before.get(t)!;
      const b = t.getBoundingClientRect();
      if (a.left === b.left && a.top === b.top) continue;
      t.animate([{ transform: `translate(${a.left - b.left}px, ${a.top - b.top}px)` }, { transform: 'none' }], { duration: 520, easing: 'cubic-bezier(.2,.75,.2,1)' });
    }
  });
  return h('div', { class: 'sorter' },
    h('div', { class: 'k-left' }, h('div', { class: 'k-tools' }, h('span', { class: 'k-token' }, sil('lizard'), h('small', null, '死蜥蜴')), btn), pile, table),
    out);
}

/* ------------------------------------------------------------ 4. 為什麼 */

/** 利10:10 → 利11:47 同一個動詞；利11:44-45 是全章的理由 */
function whyDiagram(): HTMLElement {
  const W = 760;
  const H = 230;
  const node = (x: number, y: number, ref: string, label: string, cls = '') => s('g', { class: `wd-node ${cls}`, transform: `translate(${x} ${y})` },
    s('rect', { x: -110, y: -34, width: 220, height: 68, rx: 10 }),
    s('text', { y: -6, 'text-anchor': 'middle', class: 'wd-ref' }, ref),
    s('text', { y: 18, 'text-anchor': 'middle', class: 'wd-label' }, label));
  const svgEl = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'why-svg', role: 'img', 'aria-label': '利10:10 吩咐祭司分別潔淨與不潔淨，利11:47 用同一個動詞說這份條例的用處；利11:44-45 說全章的理由是神是聖潔的。' },
    s('defs', {}, s('marker', { id: 'wd-ar', viewBox: '0 0 10 10', refX: '9', refY: '5', markerWidth: '7', markerHeight: '7', orient: 'auto-start-reverse' }, s('path', { d: 'M0 0L10 5L0 10z', fill: 'currentColor' }))),
    s('path', { d: 'M232 62 C 320 34, 440 34, 528 62', class: 'wd-arc', 'marker-end': 'url(#wd-ar)' }),
    s('text', { x: 366, y: 22, 'text-anchor': 'end', class: 'wd-arc-label' }, '同一個動詞「分別」'),
    s('text', { x: 376, y: 24, 'text-anchor': 'start', class: 'wd-he' }, 'בָּדַל'),
    node(120, 92, '利10:10', '祭司要分別潔淨的、不潔淨的'),
    node(640, 92, '利11:47', '這份條例的用處：分別出來'),
    s('path', { d: 'M512 196 H612 Q640 196 640 168 V132', class: 'wd-line', 'marker-end': 'url(#wd-ar)' }),
    s('text', { x: 652, y: 176, class: 'wd-arc-label' }, '理由'),
    node(400, 196, '利11:44-45', '因為我是聖潔的', 'key'));
  return h('figure', { class: 'why-fig' }, svgEl,
    h('figcaption', null, factLine(HEBREW_11[0])));
}

/* ------------------------------------------------------------ 這一幕 */

export function buildC11(): HTMLElement {
  // 3D 故事放在「碰到死的」當實例：最後女兒問「掉在別的東西上呢？」，母親的回答接到下面的器物
  const reel = mountReel(REEL_11);
  const things = layer('死了掉進來怎麼辦', '利11:32-38：同一隻死蜥蜴，掉在不同的東西上，結果不一樣', sorter());
  const bridge = answerBridge({ id: 'mother', label: '母親回答女兒' },
    '「掉在木器、衣服、皮子、口袋上，就像今天的木碗，泡在水裡，到晚上就好了。掉進瓦器裡，就像那個瓦罐，要打破；爐子、鍋臺也要打碎。泉源和聚水的池子還是潔淨的，只是碰到那死的就不潔淨。要種的種子還是潔淨的，可是種子已經澆了水，就不潔淨了。」', reel.el, things);

  return h('article', { class: 'scene scene-11', style: '--c:var(--c11)' },
    h('div', { class: 'wrap' },
      h('header', { class: 'scene-head' },
        h('div', { class: 'kicker' }, kicker('c11')),
        h('h1', null, '吃什麼、碰到死的'),
        h('p', { class: 'lede' }, '這一章先講哪些動物可以吃，再講碰到動物的屍體要怎麼處理。')),
      divide(),
      h('p', { class: 'divide-cap' }, quoteLine(SEPARATE))),

    h('div', { class: 'wrap' },
      layer('圖鑑：什麼可以吃', '五類活物，畫線的方法各不相同', realms())),

    h('div', { class: 'wrap' },
      layer('碰到死的', '傍晚的一隻死蜥蜴', h('p', { class: 'lede-s' }, factLine(REEL_11.beats[1].rule), ' ', factLine(REEL_11.beats[4].rule)))),
    reel.el,
    h('div', { class: 'wrap' },
      bridge,
      things,
      layer('摸、拿、吃', '拿和吃，比摸多一道洗衣服的手續', ladder()),

      layer('為什麼', '全章的理由寫在最後',
        h('p', { class: 'why-big' }, `「${WHY.q}」`, ' ', ...refChips(WHY.refs, WHY.q)),
        whyDiagram(),
        h('ul', { class: 'key-lines' }, h('li', null, factLine(LINK_10_10, { quote: true })), h('li', null, factLine(SEPARATE))),
        voiceBlock(VOICES_11.holy),
        study('原文裡看得見的事', ...HEBREW_11.slice(1, 3).map((f) => h('p', { class: 'study-p' }, factLine(f))))),

      layer('今天怎麼讀', '新約裡的一句話',
        h('div', { class: 'nt card' }, h('span', { class: 'nt-tag' }, '新約'), h('p', null, factLine(NT_11, { quote: true })))),
      h('div', { class: 'mores' }, readingMore([
        { ch: 11, from: 1, to: 23, title: '利未記 11:1-23：可吃與不可吃' },
        { ch: 11, from: 24, to: 40, title: '利未記 11:24-40：碰到死的' },
        { ch: 11, from: 41, to: 47, title: '利未記 11:41-47：爬物，和全章的理由' },
      ])),
      h('a', { class: 'voices-link card', href: `${sceneHref('voices')}/animals` },
        svg(ICONS.scale), h('span', null, h('b', null, '為什麼偏偏是這些動物？'), h('small', null, '衛生、和異教切割、分類上的「正常」、神的「飲食」、遠離死亡：本章的來源給了五種答案'),
          h('small', null, '全部集中在最後一幕「各家怎麼讀」')),
        svg(ICONS.next)),
      sceneNav('c11')));
}
