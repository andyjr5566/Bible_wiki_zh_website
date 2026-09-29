import { CREDITS, LICENSES, OWN_MODELS } from '../data/credits';
import { DEBATES, OUTSIDE } from '../data/debates';
import { DAYS, DAYS_NOTE } from '../data/timeline';
import type { Engine } from '../three/engine';
import { badge, factLine, voiceBlock } from './evidence';
import { h, s, svg } from './dom';
import { ICONS } from './icons';
import { STATUS_HELP } from './meta';
import { reveal } from './motion';

/* ============================================================ 走進方舟 */
export function mountExplore(sec: HTMLElement, engine: Engine, spots: { on: boolean; set(v: boolean): void; onChange(f: (v: boolean) => void): void }) {
  const touch = matchMedia('(pointer: coarse)').matches;
  const btn = (icon: string, label: string, on: () => void, pressed?: boolean) => {
    const b = h('button', { class: 'xbtn', type: 'button', ...(pressed !== undefined ? { 'aria-pressed': String(pressed) } : {}) }, svg(ICONS[icon]), h('span', null, label));
    b.addEventListener('click', on);
    return b;
  };
  let cut = false, lamps = false, walking = false, rotate = !touch;
  const hint = h('p', { class: 'xhint' });
  const setHint = () => {
    hint.textContent = walking
      ? touch ? '用方向鍵走動，拖曳畫面轉頭。' : 'W A S D 或方向鍵走動，按住滑鼠拖曳轉頭，Shift 走快一點。'
      : touch ? '按「轉動視角」之後，用一根手指拖曳旋轉。' : '拖曳旋轉，右鍵拖曳平移。H 收起面板，L 開關標示。';
  };
  const cutBtn = btn('cut', '剖開船身', () => {
    cut = !cut;
    cutBtn.setAttribute('aria-pressed', String(cut));
    engine.setExplore({ cut: cut ? 1 : 0, lamps: cut || lamps ? 1 : 0 });
  }, false);
  const lampBtn = btn('lamp', '點燈', () => {
    lamps = !lamps;
    lampBtn.setAttribute('aria-pressed', String(lamps));
    engine.setExplore({ lamps: lamps || cut ? 1 : 0 });
  }, false);
  const tagBtn = btn('tag', '標示', () => spots.set(!spots.on), spots.on);
  tagBtn.title = '顯示／隱藏標示（L）';
  spots.onChange((v) => tagBtn.setAttribute('aria-pressed', String(v)));
  const deckBtns = ['下層', '中層', '上層'].map((n, i) => btn('walk', n, () => enterWalk(i), false));
  const outBtn = btn('x', '走出來', () => leaveWalk());
  const rotBtn = btn('hand', '轉動視角', () => {
    rotate = !rotate;
    rotBtn.setAttribute('aria-pressed', String(rotate));
    engine.setExplore({ rotate });
  }, rotate);
  const pad = h('div', { class: 'dpad', 'aria-label': '走動' },
    ...(['f', 'l', 'r', 'b'] as const).map((d) => {
      const b = h('button', { class: `dp dp-${d}`, type: 'button', 'aria-label': { f: '往前', b: '往後', l: '往左', r: '往右' }[d] }, svg(ICONS[{ f: 'chev', b: 'chev', l: 'prev', r: 'next' }[d]]));
      const on = (e: Event) => (e.preventDefault(), engine.walkPad(d, true));
      const off = (e: Event) => (e.preventDefault(), engine.walkPad(d, false));
      b.addEventListener('pointerdown', on);
      b.addEventListener('pointerup', off);
      b.addEventListener('pointerleave', off);
      b.addEventListener('pointercancel', off);
      return b;
    }));
  function enterWalk(i: number) {
    walking = true;
    engine.setExplore({ deck: i, walk: true });
    deckBtns.forEach((b, k) => b.setAttribute('aria-pressed', String(k === i)));
    sec.classList.add('walking');
    setHint();
  }
  function leaveWalk() {
    walking = false;
    engine.setExplore({ walk: false });
    deckBtns.forEach((b) => b.setAttribute('aria-pressed', 'false'));
    sec.classList.remove('walking');
    setHint();
  }
  setHint();
  const views = h('div', { class: 'xgroup' }, h('span', { class: 'xlabel' }, '看外面'),
    btn('side', '側面', () => engine.setExplore({ view: 'side' })),
    btn('door', '門邊', () => engine.setExplore({ view: 'door' })),
    btn('top', '俯視', () => engine.setExplore({ view: 'top' })),
    btn('ark', '船尾', () => engine.setExplore({ view: 'end' })),
    btn('plus', '拉近', () => engine.zoom(0.75)),
    btn('minus', '拉遠', () => engine.zoom(1.33)),
    touch ? rotBtn : null);
  const inside = h('div', { class: 'xgroup' }, h('span', { class: 'xlabel' }, '走進去'), ...deckBtns, outBtn);
  const more = h('div', { class: 'xgroup' }, h('span', { class: 'xlabel' }, '其他'), tagBtn, cutBtn, lampBtn);
  // 收起控制面板，整個畫面留給方舟；左下角留一顆鈕叫回來
  const hideBtn = h('button', { class: 'xhide', type: 'button', 'aria-label': '收起控制面板', title: '收起（H）' }, svg(ICONS.chev));
  const showBtn = h('button', { class: 'xshow', type: 'button', 'aria-label': '顯示控制面板', title: '顯示控制（H）' }, svg(ICONS.sliders), h('span', null, '控制'));
  const setHidden = (v: boolean) => {
    sec.classList.toggle('panel-off', v);
    document.body.classList.toggle('xfull', v && document.body.classList.contains('exploring'));
    (v ? showBtn : hideBtn).focus({ preventScroll: true });
  };
  hideBtn.addEventListener('click', () => setHidden(true));
  showBtn.addEventListener('click', () => setHidden(false));
  addEventListener('keydown', (e) => {
    if ((e.key === 'h' || e.key === 'H') && document.body.classList.contains('exploring') && !(e.target as HTMLElement).closest('input, textarea')) setHidden(!sec.classList.contains('panel-off'));
  });
  sec.append(showBtn);
  sec.append(h('div', { class: 'xpanel' },
    h('div', { class: 'xhead' }, h('h2', { id: 'explore-h' }, '走進方舟'), hideBtn),
    h('p', { class: 'xlede' }, '長寬高照經文，艙內擺設是示意。點畫面上的標籤看說明。'),
    views, inside, more, hint), pad);
  engine.setExplore({ rotate });
  // 捲到這一區才交給使用者操作
  new IntersectionObserver(([e]) => {
    const on = e.intersectionRatio > 0.55;
    engine.setMode(on ? 'explore' : 'story');
    document.body.classList.toggle('exploring', on);
    document.body.classList.toggle('xfull', on && sec.classList.contains('panel-off'));
    if (!on && walking) leaveWalk();
  }, { threshold: [0, 0.55, 1] }).observe(sec);
}

/* ============================================================ 洪水的日子 */
export function mountTimeline(body: HTMLElement) {
  const W = 1000, H = 290, X0 = 50, X1 = W - 30, Y0 = 62, Y1 = H - 78;
  const x = (d: number) => X0 + (d / 372) * (X1 - X0);
  const y = (w: number) => Y1 - w * (Y1 - Y0);
  const pts = [[0, 0.02], [4, 0.2], [20, 0.55], [40, 0.9], [60, 0.98], [150, 1], ...DAYS.slice(3).map((d) => [d.day, d.water])];
  const path = pts.map(([d, w], i) => `${i ? 'L' : 'M'}${x(d).toFixed(1)},${y(w).toFixed(1)}`).join(' ');
  const area = `${path} L${x(370)},${Y1} L${x(0)},${Y1} Z`;
  const chart = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'tl-chart', role: 'img', 'aria-label': '洪水期間的水位示意與日期' },
    s('path', { d: area, class: 'tl-area' }),
    s('path', { d: path, class: 'tl-line' }),
    s('line', { x1: X0, y1: Y1, x2: X1, y2: Y1, class: 'tl-axis' }),
    ...[0, 60, 120, 180, 240, 300, 360].map((d) => s('g', {}, s('line', { x1: x(d), y1: Y1, x2: x(d), y2: Y1 + 5, class: 'tl-axis' }), s('text', { x: x(d), y: Y1 + 20, class: 'tl-tick' }, `第 ${d} 天`))),
    ...DAYS.map((d, i) => {
      // 標籤錯開：上下交替；日子太近的再多錯一排
      const near = i > 1 && d.day - DAYS[i - 2].day < 30;
      const top = i % 2 === 0;
      const ly = top ? Y0 - 22 - (near ? 20 : 0) : Y1 + 42 + (near ? 20 : 0);
      return s('g', { class: `tl-pt ${d.what.status}` },
        s('line', { x1: x(d.day), y1: y(d.water), x2: x(d.day), y2: top ? ly + 6 : ly - 14, class: 'tl-stem' }),
        s('circle', { cx: x(d.day), cy: y(d.water), r: 5.5 }),
        s('text', { x: x(d.day), y: ly, class: 'tl-date' }, d.date.replace(/^6\d\d 歲 /, '')),
      );
    }),
    s('text', { x: X0 - 14, y: Y1 - 4, class: 'tl-tick', 'text-anchor': 'start', transform: `rotate(-90 ${X0 - 14} ${Y1 - 4})` }, '水位（示意）'),
  );
  const list = h('ol', { class: 'tl-list' }, ...DAYS.map((d) => h('li', { class: d.what.status }, h('b', null, d.date), ' ', factLine(d.what))));
  body.append(h('div', { class: 'card tl-card rv' }, h('div', { class: 'tl-scroll' }, chart),
    h('p', { class: 'tl-legend' }, h('span', { class: 'lg solid' }), '經文寫明的日期　', h('span', { class: 'lg hollow' }), '照天數推算　', DAYS_NOTE)), list);
  reveal(body.querySelectorAll('.rv'));
}

/* ============================================================ 經文沒說的事 */
export function mountDebates(body: HTMLElement) {
  const grid = h('div', { class: 'deb-grid' }, ...DEBATES.map((d) => h('details', { class: 'deb card rv' },
    h('summary', null, h('h3', null, d.title), svg(ICONS.chev, 'chev')),
    h('div', { class: 'body' },
      h('div', { class: 'said-k' }, '經文寫的'), h('div', { class: 'said' }, factLine(d.said, { showQuote: false })),
      h('div', { class: 'said-k' }, '經文沒寫的'), h('div', { class: 'said unsaid' }, badge('not_stated'), ' ', d.gap),
      h('div', { class: 'said-k interp-layer' }, '各家怎麼讀'), ...d.voices.map(voiceBlock),
      d.outside?.length ? h('div', { class: 'ext-box' }, h('div', { class: 'said-k' }, '知識庫以外'), ...d.outside.map((o) => h('p', null, h('b', null, o.who), '：', o.says))) : null,
    ))));
  body.append(grid);
  reveal(body.querySelectorAll('.rv'));
}

export function mountOutside(body: HTMLElement) {
  body.append(h('div', { class: 'ext-list' }, ...OUTSIDE.map((o) => h('div', { class: 'card ext-item rv' }, h('h3', null, o.who), h('p', null, o.says)))),
    h('p', { class: 'ext-note' }, '這一區的內容不在本庫的四套註釋（CT、GT、KC、BH）裡，網站沒有逐字查核。它們解釋了方舟外形為什麼這樣畫，不代表經文的意思。'));
  reveal(body.querySelectorAll('.rv'));
}

export function mountAbout(body: HTMLElement) {
  const byLic = (lic: 'CC0' | 'CC-BY 3.0') => CREDITS.filter((c) => c.license === lic);
  body.append(h('div', { class: 'about-grid' },
    h('div', { class: 'card' }, h('h3', null, '四種標籤'), h('div', { class: 'evlist' },
      ...(['explicit', 'synthesis', 'interpretation', 'not_stated'] as const).map((st) => h('div', null, badge(st), ' ', STATUS_HELP[st])))),
    h('div', { class: 'card' }, h('h3', null, '資料從哪裡來'),
      h('p', null, '經文：和合本，取自本知識庫的 raw_scripture。點任何經節都會顯示原文。'),
      h('p', null, '註釋家的讀法：取自本知識庫《創世記》6–9 章主檔的「本章整理」，那些整理讀過 CT、GT（ccbiblestudy 的兩套）、KC（KingComments）、BH（BibleHub Study）。引號裡是原話，沒有引號的是轉述。'),
      h('p', null, '網站建置前會自動比對：引號裡的經文必須逐字出現在所引經節，註釋家的原話必須逐字出現在主檔的引號裡。')),
    h('div', { class: 'card' }, h('h3', null, '3D 模型'),
      h('p', null, OWN_MODELS),
      h('p', null, '動物模型：', h('a', { href: LICENSES.CC0, rel: 'noopener' }, 'CC0'), ' — Quaternius（', byLic('CC0').map((c) => c.title).join('、'), '）；',
        h('a', { href: LICENSES['CC-BY 3.0'], rel: 'noopener' }, 'CC-BY 3.0'), ' — Poly by Google（', byLic('CC-BY 3.0').map((c) => c.title).join('、'), '）。皆取自 poly.pizza，本站只保留走路、站立、吃草三段動畫。'),
      h('ul', { class: 'credit-list' }, ...CREDITS.map((c) => h('li', null, h('a', { href: c.url, rel: 'noopener' }, c.title), ` · ${c.author} · ${c.license}`)))),
    h('div', { class: 'card' }, h('h3', null, '畫面與聲音'),
      h('p', null, '天空、水、雨、閃電、地形都是瀏覽器當場算出來的，聲音也是即時合成，沒有音檔。山的高度、動物種類、船艙擺設都是想像，各幕卡片最下面會註明。'),
      h('p', null, '「減少動態」會關掉鏡頭晃動和船身搖擺。')),
    h('div', { class: 'card' }, h('h3', null, '同一系列'),
      h('p', null, h('a', { href: '../../../出埃及記/第25章/dist/index.html' }, '照山上的樣式：出埃及記 25–27 章')),
      h('p', null, h('a', { href: '../../../利未記/第1章/dist/index.html' }, '會幕前的一天：利未記 1–9 章')),
      h('p', { class: 'muted' }, 'KC 說，神給方舟精確的規格，就像後來吩咐摩西建造會幕一樣。')),
  ));
}
