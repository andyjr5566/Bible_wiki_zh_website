import { DB, lawById, laws, lawsOfTopic, lawWhy, refText, relationClusters, relationsOf } from '../data/db';
import { go, href, parse, type Route } from '../router';
import { store } from '../store';
import { h } from './dom';

/**
 * 新手教學：在真正的網站上，一步一步請讀者自己點。
 * - 先做事，再解釋：第一步就是動手，不先念一段介紹。
 * - 分三段，每段三步；每段做完有小結，可以停，也可以繼續。
 * - 每一步：標出要點的東西 → 等讀者真的做了 → 才說明「這是什麼、對讀經有什麼用」。
 * - 面板固定在畫面下方（要點的東西在下半部時移到上方），不蓋住頁面，不替讀者捲動。
 *   要點的東西在畫面外時，畫面邊緣會出現一顆按鈕，讀者按了才捲過去。
 * - 離開正在做的那一頁，面板會提示並可以一鍵帶回去。
 */
interface Step {
  /** 第幾段（0 起算） */
  chapter: number;
  title: string;
  /** 這一步要在哪一頁做；不在那一頁就提示「帶我過去」 */
  at: (r: Route) => boolean;
  /** 「帶我過去」去哪裡 */
  goHash: string;
  /** 要點的東西（CSS 選擇器；同一個選擇器有好幾個時取看得見的第一個） */
  target: string;
  /** 請讀者做的事 */
  ask: string;
  /** 讀者做了沒有 */
  done: (r: Route) => boolean;
  /** 做完之後說明：這是什麼、有什麼用 */
  say: string[];
  /** 說明時標出來的東西 */
  sayTarget?: string;
}

interface Chapter {
  name: string;
  /** 選單上的一句說明 */
  desc: string;
  /** 做完這一段之後的小結 */
  sum: string[];
}

/** 示範用的律法：第一張問題卡的第一條（出21:2-6），它有別卷記載 */
export const DEMO_LAW = DB.questions[0]?.laws[0] ?? 'ex21-02';
/** 示範「經文給的理由」用的律法 */
export const DEMO_WHY_LAW = 'lev25-39';
/** 示範主題頁 */
export const DEMO_TOPIC = 'slavery';
/** 示範書卷頁 */
export const DEMO_BOOK = '利';
/** 開場引用的經文（出21:2，和合本原句） */
export const DEMO_QUOTE = '第七年他可以自由，白白地出去';

const onLaw = (id?: string) => (r: Route) => r.name === 'law' && (!id || r.params[0] === id);
const anyPage = () => true;
const layerOpen = (key: string) => () => !!document.querySelector<HTMLDetailsElement>(`details[data-layer="${key}"]`)?.open;

const CHAPTERS: Chapter[] = [
  { name: '看懂一條律法', desc: '從一個問題走到經文原文', sum: ['先看那一句話，再對照原文。不用先讀懂整段，就知道這一條在講什麼。', '最下面「出處」那一層，放知識庫的條目、人物地方，和別卷關聯的證據，需要查來源時再打開。'] },
  { name: '別卷與理由', desc: '別卷怎麼記，以及經文自己說的理由', sum: ['同一件事在別卷怎麼說，一眼對照得出來。', '很多律法旁邊，經文自己就說了理由。'] },
  { name: '自己找', desc: '主題頁、搜尋、書卷頁', sum: ['想看一個主題，進主題頁；有想找的字，用搜尋。', '讀到某一章看不懂，搜章節，或進書卷頁展開那一章。'] },
  { name: '首頁其他區塊', desc: '經文給的理由、別卷重述、五經分布', sum: ['首頁每一區都是一個入口：問題卡、經文給的理由、別卷重述的律法組、五經的分布圖。', `最下面「全部主題」按 ${DB.groups.length} 大類列出所有主題，「照順序一段一段讀」有 ${DB.tours.length} 條照經文順序讀的路線。`] },
];

function buildSteps(): Step[] {
  const demo = lawById.get(DEMO_LAW)!;
  const whyLaw = lawById.get(DEMO_WHY_LAW)!;
  const firstQ = DB.questions[0];
  const topicN = lawsOfTopic(DEMO_TOPIC).length;
  const otherRefs = relationsOf(DEMO_LAW).map((r) => refText(r.other)).join('、');
  const home = (r: Route) => r.name === '';
  const nWhy = laws.filter((l) => lawWhy(l).length).length;
  const nGroups = relationClusters().length;
  return [
    {
      chapter: 0, title: '先問一個問題', at: home, goHash: '#/',
      target: '.lm-qgrid .lm-q:first-child .lm-q-btn',
      ask: `讀到「${DEMO_QUOTE}」，常會想：這在講什麼？先點這張問題卡「${firstQ?.q ?? ''}」，看經文怎麼回答。`,
      done: () => document.querySelector('.lm-qgrid .lm-q:first-child .lm-q-btn')?.getAttribute('aria-expanded') === 'true',
      say: [
        `翻開的是一句話，把${refText(demo)}整理成一句，只說經文說了什麼，沒有加解釋。`,
        `網站有 ${laws.length} 條律法，每一條都這樣整理。以後讀到一長串規定，先看這一句，就知道在講什麼。`,
      ],
      sayTarget: '.lm-qgrid .lm-q:first-child',
    },
    {
      chapter: 0, title: '進到這條律法', at: home, goHash: '#/',
      target: '.lm-qgrid .lm-q:first-child .lm-q-go',
      ask: '點答案下面的連結，進到這條律法自己的頁面。',
      done: onLaw(),
      say: [
        '最上面的「一句話」，就是剛才那一句。再往下有三層：經文、別卷、出處。越下面越細，不想看就不用打開。',
        '頁面頂端的細帶是整個五經，一格一章，亮起來的格子是這條律法所在的章。',
      ],
      sayTarget: '.lm-top-rib',
    },
    {
      chapter: 0, title: '對照原文', at: onLaw(), goHash: href('law', DEMO_LAW),
      target: 'details[data-layer="text"] > summary',
      ask: '打開「經文」這一層（點那一列）。',
      done: layerOpen('text'),
      say: [
        '這是和合本原文，一個字沒有改。上面那句話有沒有說錯，可以自己核對。',
        '有底線的字是人物、地方、觀念。點一下有簡介，還能連到知識庫的完整條目。',
      ],
      sayTarget: 'details[data-layer="text"]',
    },
    {
      chapter: 1, title: '看別卷怎麼說', at: onLaw(), goHash: href('law', DEMO_LAW),
      target: 'details[data-layer="others"] > summary',
      ask: '打開「別卷」這一層。',
      done: layerOpen('others'),
      say: [
        `同一件事，出埃及記、利未記、申命記常各記一次，說法略有不同。這裡直接列出${otherRefs}，每一條都附知識庫裡的出處。`,
        '讀一卷的時候，不用自己翻去另一卷。',
      ],
      sayTarget: 'details[data-layer="others"]',
    },
    {
      chapter: 1, title: '三段並排比一比', at: onLaw(), goHash: href('law', DEMO_LAW),
      target: 'details[data-layer="others"] .lm-btn',
      ask: '按「這幾段並排，逐字比較」。',
      done: (r) => r.name === 'compare',
      say: [
        '三段經文並排。逐字比較裡，刪除線是只在前一段有的字，底色是只在後一段有的字。',
        '例如出埃及記21章講用錐子穿耳朵，申命記15章又寫到要多給羊群、禾場、酒醡出產。單讀一卷，很容易漏掉。',
      ],
      sayTarget: '.lm-compare-cols',
    },
    {
      chapter: 1, title: '經文自己說的理由', at: (r) => r.name === 'compare', goHash: href('compare', [DEMO_LAW, DEMO_WHY_LAW, 'deut15-12'].join(',')),
      target: `.lm-compare-cols a[href="${href('law', DEMO_WHY_LAW)}"]`,
      ask: `點最右邊那一欄的標題「${whyLaw.title}」。`,
      done: onLaw(DEMO_WHY_LAW),
      say: [
        '「一句話」下面多了一塊「經文給的理由」，是經文自己寫的原句，網站只是把那一節標出來。',
        '律法在希伯來文叫妥拉，字義是指引、教導。很多律法旁邊，經文自己就說了為什麼這樣吩咐。讀規定的時候順便讀理由，比較看得出神是對誰說的。',
      ],
      sayTarget: '.lm-why',
    },
    {
      chapter: 2, title: '同一個主題放在一起', at: onLaw(DEMO_WHY_LAW), goHash: href('law', DEMO_WHY_LAW),
      target: '.lm-law-meta .lm-topic',
      ask: '點這條律法的第一個主題標籤。',
      done: (r) => r.name === 'topic',
      say: [
        `五經裡同一個主題的 ${topicN} 條律法排在一起，分成出埃及記、利未記、申命記三欄，虛線連起來的是別卷又記了一次。`,
        `想知道聖經對一件事怎麼規定，在這一頁從頭讀到尾。全站共有 ${DB.groups.length} 大類、${DB.topics.length} 個主題。`,
      ],
      sayTarget: '.lm-lanes-box',
    },
    {
      chapter: 2, title: '用搜尋找', at: anyPage, goHash: '#/',
      target: '.lm-search-input',
      ask: '在搜尋框打「安息日」。',
      done: () => [...document.querySelectorAll<HTMLInputElement>('.lm-search-input')].some((i) => i.offsetParent !== null && i.value.trim().length >= 2),
      say: [
        '條文、主題、人物地方、經文出處都找得到。標題有這個詞的條文排在前面。',
        '讀到某一章看不懂，直接打章節，例如「利25」或「申15:12」，就列出那一節所在的律法。',
      ],
      sayTarget: '.lm-search-results:not([hidden])',
    },
    {
      chapter: 2, title: '照書卷、照章來看', at: anyPage, goHash: '#/',
      target: `a.lm-rib-name[href="${href('book', DEMO_BOOK)}"]`,
      ask: '點律法帶左邊的「利」，進到整卷利未記。',
      done: (r) => r.name === 'book',
      say: [
        '整卷利未記照全書目錄的段落和章排好，每一章可以點開，看收了哪幾條律法。',
        '讀到哪一章，就展開哪一章，五卷書都是這樣。',
      ],
      sayTarget: '.lm-book-tools',
    },
    {
      chapter: 3, title: '經文自己交代的理由', at: home, goHash: '#/',
      target: '.lm-reasons .lm-more-q',
      ask: `首頁這一區，集中放了經文自己說了理由的律法。點「看全部 ${nWhy} 條，依書卷分開」。`,
      done: () => document.querySelector('.lm-reasons .lm-more-q')?.getAttribute('aria-expanded') === 'true',
      say: [
        `${nWhy} 條律法的經文自己說了理由，依書卷分成五組。點開一卷，每張卡都是經文的原句，標題可以點進那條律法。`,
        '想快速讀神為什麼這樣吩咐，從這一區一條一條讀就行。',
      ],
      sayTarget: '.lm-reasons',
    },
    {
      chapter: 3, title: '別卷重述的律法組', at: home, goHash: '#/',
      target: '.lm-restated .lm-more-q',
      ask: `這一區列出別卷重述同一件事的律法。點「再看 ${nGroups - 6} 組」，把全部展開。`,
      done: () => !document.querySelector('.lm-restated .lm-more-q'),
      say: [
        `共 ${nGroups} 組。每一組標出在哪幾卷、哪幾節，點一組就並排比較。`,
        '想知道一件事在三卷書裡怎麼寫，從這一區找最快。',
      ],
      sayTarget: '.lm-restated',
    },
    {
      chapter: 3, title: '律法在五經的哪裡', at: home, goHash: '#/',
      target: '.lm-where a.lm-rib-cell[data-k="利1"]',
      ask: '這張圖是整個五經：一格一章，柱子越高，那一章收的律法越多，顏色是類別。點利未記第1章那一格。',
      done: (r) => r.name === 'ref',
      say: [
        '這一頁列出那一章收錄的所有律法，照段落排。',
        '圖上空白的格子，是那一章沒有收律法（多半是敘事或歌）。讀到哪一章，就從圖上點那一格。',
      ],
      sayTarget: '.lm-book-page h1',
    },
  ];
}

// ---- 狀態 ----
let steps: Step[] = [];
let idx = 0;
/** 正在看哪一段的小結（null＝在做步驟） */
let summaryOf: number | null = null;
/** 顯示「想從哪一段開始」的選單 */
let menu = false;
let started = false;
let panel: HTMLElement | null = null;
let pin: HTMLElement | null = null;
let doneSet = new Set<number>();
let marked: Element | null = null;
let timer = 0;
let lastSig = '';
/** 這一步已經自動捲過了（每一步只自動捲一次，之後讀者想往哪捲就往哪捲） */
let scrolledKey = '';

const visible = (el: Element) => (el as HTMLElement).getClientRects().length > 0 && !(el as HTMLElement).closest('[hidden]');
function find(sel?: string): HTMLElement | null {
  if (!sel) return null;
  for (const el of document.querySelectorAll<HTMLElement>(sel)) if (visible(el)) return el;
  return null;
}
function mark(el: HTMLElement | null) {
  if (marked === el) return;
  marked?.classList.remove('lm-coach-hl');
  marked = el;
  el?.classList.add('lm-coach-hl');
}

export const coachActive = () => !!panel;

export function startCoach() {
  if (panel) {
    // 已經開著：再按頂列的按鈕，就打開選單，可以改選別段
    menu = true;
    lastSig = '';
    update();
    return;
  }
  steps = buildSteps();
  idx = 0;
  summaryOf = null;
  doneSet = new Set();
  lastSig = '';
  menu = true;
  started = false;
  scrolledKey = '';
  panel = h('aside', { class: 'lm-coach', role: 'region', 'aria-label': '新手教學' });
  pin = h('button', { type: 'button', class: 'lm-coach-pin', hidden: true });
  document.body.append(panel, pin);
  for (const ev of ['click', 'input', 'toggle'] as const) document.addEventListener(ev, schedule, true);
  window.addEventListener('resize', schedule);
  window.addEventListener('scroll', schedule, { passive: true });
  update();
}

export function stopCoach() {
  if (!panel) return;
  for (const ev of ['click', 'input', 'toggle'] as const) document.removeEventListener(ev, schedule, true);
  window.removeEventListener('resize', schedule);
  window.removeEventListener('scroll', schedule);
  mark(null);
  panel.remove();
  pin?.remove();
  panel = null;
  pin = null;
  store.setGuided(true);
}

/** 第一次來到首頁時自動出現 */
export function offerCoach(isHome: boolean) {
  if (isHome && !store.guided) startCoach();
}

/** 換頁後，重新判斷這一步的狀態 */
export function coachSync() {
  if (panel) update();
}

function schedule() {
  if (!panel || timer) return;
  timer = window.setTimeout(() => {
    timer = 0;
    update();
  }, 60);
}

// ---- 前進後退 ----
const lastOfChapter = (i: number) => i === steps.length - 1 || steps[i + 1].chapter !== steps[i].chapter;
/** 跳到某一段的第一步；不在那一頁就直接帶過去 */
function jump(c: number) {
  const i = steps.findIndex((x) => x.chapter === c);
  if (i < 0) return;
  idx = i;
  summaryOf = null;
  menu = false;
  started = true;
  doneSet = new Set();
  lastSig = '';
  scrolledKey = '';
  // 「經文」「別卷」兩層一開始收著，才看得到打開的那一下
  store.setLayer('text', false);
  store.setLayer('others', false);
  if (!steps[i].at(parse())) go(steps[i].goHash);
  update();
}

function next() {
  if (summaryOf !== null) {
    if (summaryOf >= CHAPTERS.length - 1) return;
    summaryOf = null;
    idx += 1;
    if (!steps[idx].at(parse())) go(steps[idx].goHash);
  } else if (lastOfChapter(idx)) {
    summaryOf = steps[idx].chapter;
  } else {
    idx += 1;
  }
  update();
}
function prev() {
  if (summaryOf !== null) summaryOf = null;
  else idx = Math.max(0, idx - 1);
  update();
}

// ---- 畫面 ----
function progress(cur: number, finished: boolean): HTMLElement {
  return h('ol', { class: 'lm-coach-prog', 'aria-label': '進度' }, ...CHAPTERS.map((c, i) =>
    h('li', { class: i < cur || (finished && i === cur) ? 'lm-done' : i === cur ? 'lm-cur' : '', 'aria-current': i === cur ? 'step' : null },
      h('button', { type: 'button', class: 'lm-coach-seg', 'aria-label': `跳到第 ${i + 1} 段：${c.name}`, title: `跳到第 ${i + 1} 段：${c.name}`, onclick: () => jump(i) }, h('i'), h('span', null, c.name)))));
}

function update() {
  if (!panel || !pin) return;
  const r = parse();

  // ---- 選單：想從哪一段開始 ----
  if (menu) {
    mark(null);
    pin.hidden = true;
    const sig = `menu|${started}`;
    if (sig === lastSig) return;
    lastSig = sig;
    panel.className = 'lm-coach';
    panel.replaceChildren(
      h('div', { class: 'lm-coach-head' }, h('span', { class: 'lm-coach-count' }, '新手教學'),
        h('button', { type: 'button', class: 'lm-coach-x', 'aria-label': '結束教學', onclick: () => stopCoach() }, '×')),
      h('h2', { class: 'lm-coach-title' }, '想從哪一段開始？'),
      h('div', { class: 'lm-coach-body' },
        h('p', { class: 'lm-coach-hint' }, '每一段三步，都是你自己動手點。第一次來，建議從第 1 段開始。'),
        h('div', { class: 'lm-coach-opts' }, ...CHAPTERS.map((c, i) =>
          h('button', { type: 'button', class: `lm-coach-opt${i === 0 ? ' lm-coach-opt-first' : ''}`, onclick: () => jump(i) },
            h('b', null, `第 ${i + 1} 段　${c.name}`, i === 0 ? h('em', null, '建議先做') : null),
            h('small', null, c.desc))))),
      ...(started
        ? [h('div', { class: 'lm-coach-foot' },
          h('button', { type: 'button', class: 'lm-btn', onclick: () => { menu = false; lastSig = ''; update(); } }, '回到剛才那一步'), h('span'))]
        : []));
    return;
  }

  // ---- 小結 ----
  if (summaryOf !== null) {
    mark(null);
    pin.hidden = true;
    const c = summaryOf;
    const finale = c >= CHAPTERS.length - 1;
    const sig = `sum|${c}`;
    if (sig === lastSig) return;
    lastSig = sig;
    panel.className = 'lm-coach';
    panel.replaceChildren(
      head(c, true),
      h('h2', { class: 'lm-coach-title' }, finale ? '三段都做完了' : `第 ${c + 1} 段做完了`),
      h('div', { class: 'lm-coach-body', 'aria-live': 'polite' },
        h('p', { class: 'lm-coach-ok' }, '你已經會了：'),
        ...CHAPTERS[c].sum.map((t) => h('p', null, t)),
        finale ? h('p', null, '換你試：打開你最近讀到的那一章，看網站收了哪幾條律法，先看一句話，需要再往下打開。') : null),
      h('div', { class: 'lm-coach-foot' },
        h('button', { type: 'button', class: 'lm-btn', onclick: prev }, '上一步'),
        finale
          ? h('button', { type: 'button', class: 'lm-btn lm-btn-primary', onclick: () => { stopCoach(); go('#/'); } }, '回首頁自己逛')
          : h('span', { class: 'lm-coach-foot-r' },
            h('button', { type: 'button', class: 'lm-btn', onclick: () => stopCoach() }, '先到這裡'),
            h('button', { type: 'button', class: 'lm-btn lm-btn-primary', onclick: next }, `繼續第 ${c + 2} 段`))));
    return;
  }

  // ---- 步驟 ----
  const s = steps[idx];
  // 「做到了」看整個畫面的狀態（有的步驟做完就換頁，所以不限定在原來那一頁）
  if (!doneSet.has(idx) && s.done(r)) doneSet.add(idx);
  const done = doneSet.has(idx);
  const onPage = done || s.at(r);

  const sel = !onPage ? undefined : done ? s.sayTarget : s.target;
  const el = find(sel);
  mark(el);
  const rect = el?.getBoundingClientRect();
  const inView = !!rect && rect.bottom > 0 && rect.top < window.innerHeight;
  const dir = rect && !inView ? (rect.top >= window.innerHeight ? 'down' : 'up') : '';
  // 要點的東西在下半部，面板就放上面
  const top = inView && rect!.top > window.innerHeight * 0.42;

  // 換到新的一步（或做完、要說明了），目標不在畫面裡，就把它帶進畫面。每一步只做一次。
  const key = `${idx}|${done}`;
  if (el && !inView && scrolledKey !== key) {
    scrolledKey = key;
    scrollTo(el);
  }

  placePin(el, rect, inView, dir, done);

  const sig = [idx, onPage, done, top, dir, !!el, sel ?? ''].join('|');
  if (sig === lastSig) return;
  lastSig = sig;

  const inChapter = steps.filter((x) => x.chapter === s.chapter);
  const nth = inChapter.indexOf(s) + 1;
  const body: HTMLElement[] = [];
  if (!onPage) {
    body.push(h('p', { class: 'lm-coach-ask' }, '這一步要回到對應的頁面做。'));
  } else if (!done) {
    body.push(h('p', { class: 'lm-coach-ask' }, s.ask));
    if (sel && !el) body.push(h('p', { class: 'lm-coach-hint' }, '畫面上暫時找不到要點的地方，按「帶我過去」。'));
  } else {
    body.push(h('p', { class: 'lm-coach-ok' }, h('span', { class: 'lm-coach-check', 'aria-hidden': 'true' }, '✓'), '做到了'));
    body.push(...s.say.map((t) => h('p', null, t)));
  }
  const needGo = !onPage || (!done && !!sel && !el);

  panel.className = `lm-coach${top ? ' lm-coach-top' : ''}${done ? ' lm-coach-is-done' : ''}`;
  panel.replaceChildren(
    head(s.chapter, false, nth, inChapter.length),
    h('h2', { class: 'lm-coach-title' }, s.title),
    h('div', { class: 'lm-coach-body', 'aria-live': 'polite' }, ...body),
    h('div', { class: 'lm-coach-foot' },
      idx > 0 ? h('button', { type: 'button', class: 'lm-btn', onclick: prev }, '上一步') : h('span'),
      h('span', { class: 'lm-coach-foot-r' },
        needGo ? h('button', { type: 'button', class: 'lm-btn', onclick: () => go(s.goHash) }, '帶我過去') : null,
        h('button', { type: 'button', class: `lm-btn ${done ? 'lm-btn-primary' : ''}`, onclick: next }, done ? (lastOfChapter(idx) ? '看小結' : '下一步') : '跳過這一步'))));
}

function head(chapter: number, finished: boolean, nth = 0, total = 0): HTMLElement {
  return h('div', { class: 'lm-coach-head' },
    progress(chapter, finished),
    h('div', { class: 'lm-coach-headr' },
      nth ? h('span', { class: 'lm-coach-count' }, `第 ${chapter + 1} 段 · ${nth}/${total}`) : null,
      h('button', { type: 'button', class: 'lm-coach-x', 'aria-label': '結束教學', onclick: () => stopCoach() }, '×')));
}

/** 把目標帶進畫面：矮的放中間，高的（整個區塊）對齊上緣並留出空間 */
function scrollTo(el: HTMLElement) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const tall = el.getBoundingClientRect().height > window.innerHeight * 0.55;
  el.style.scrollMarginTop = '84px';
  el.scrollIntoView({ block: tall ? 'start' : 'center', behavior: reduce ? 'auto' : 'smooth' });
}

/** 標示按鈕：在畫面內就貼在目標旁邊寫「點這裡」；在畫面外就在邊緣放一顆按鈕，按了才捲過去 */
function placePin(el: HTMLElement | null, rect: DOMRect | undefined, inView: boolean, dir: string, done: boolean) {
  if (!pin) return;
  if (!el || !rect || done) {
    pin.hidden = true;
    return;
  }
  pin.hidden = false;
  pin.onclick = null;
  if (inView) {
    pin.className = 'lm-coach-pin lm-coach-pin-here';
    pin.textContent = '點這裡';
    pin.tabIndex = -1;
    const above = rect.top > 40;
    pin.style.left = `${Math.min(Math.max(rect.left, 8), window.innerWidth - 80)}px`;
    pin.style.top = `${above ? rect.top - 34 : rect.bottom + 6}px`;
    pin.style.bottom = 'auto';
  } else {
    pin.className = `lm-coach-pin lm-coach-pin-edge lm-coach-pin-${dir}`;
    pin.textContent = dir === 'down' ? '↓ 要點的在下面，按我捲過去' : '↑ 要點的在上面，按我捲過去';
    pin.tabIndex = 0;
    pin.style.left = '50%';
    pin.style.top = dir === 'up' ? '64px' : 'auto';
    pin.style.bottom = dir === 'down' ? `${(panel?.getBoundingClientRect().height ?? 200) + 24}px` : 'auto';
    pin.onclick = () => {
      scrollTo(el);
    };
  }
}

export type { Step };
