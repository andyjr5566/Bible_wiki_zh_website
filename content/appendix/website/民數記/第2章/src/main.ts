import './styles.css';
import { CAMPS, MATRIARCH, TOTAL_2, camp, fmt, tribesOf } from './data/tribes';
import { parseHash } from './deeplink';
import { CX as MAP_CX, PEOPLE_PER_TENT } from './layout';
import * as store from './store';
import { centerMapOn, createCampMap } from './ui/campmap';
import { mountCompare } from './ui/compare';
import { emit, fill, h, svg } from './ui/dom';
import { badge, refChip } from './ui/evidence';
import { ICONS } from './ui/icons';
import { mountMarch } from './ui/march';
import { CAMP_STYLE, SIDE_NAME, STATUS_HELP } from './ui/meta';
import { reveal, smoothScrollTo } from './ui/motion';
import { createCampList, createPanel, revealPanel } from './ui/panel';
import { mountQuiz } from './ui/quiz';
import { mountUnsaid, mountVoices } from './ui/sections';

/* ------------------------------------------------------------ 使用者設定（只存在這台裝置） */
const root = document.documentElement;
const settings = {
  get(k: string) {
    try { return localStorage.getItem(`num-camp:${k}`); } catch { return null; }
  },
  set(k: string, v: string) {
    try { localStorage.setItem(`num-camp:${k}`, v); } catch { /* 私密模式等情況，不保存也能用 */ }
  },
};
for (const k of ['theme', 'big', 'motion', 'interp']) {
  const v = settings.get(k);
  if (v) root.dataset[k] = v;
}

function toolButton(icon: string, label: string, pressed: () => boolean, toggle: () => void) {
  const b = h('button', { class: 'iconbtn', type: 'button', title: label, 'aria-label': label, 'aria-pressed': String(pressed()) }, svg(ICONS[icon]));
  b.addEventListener('click', () => {
    toggle();
    b.setAttribute('aria-pressed', String(pressed()));
  });
  return b;
}

const isDark = () => root.dataset.theme === 'dark' || (!root.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
const tools = h('div', { class: 'tools' },
  toolButton('moon', '深色模式', isDark, () => { root.dataset.theme = isDark() ? 'light' : 'dark'; settings.set('theme', root.dataset.theme); }),
  toolButton('text', '大字模式', () => root.dataset.big === '1', () => { root.dataset.big = root.dataset.big === '1' ? '0' : '1'; settings.set('big', root.dataset.big); }),
  toolButton('motion', '減少動態', () => root.dataset.motion === 'off', () => {
    root.dataset.motion = root.dataset.motion === 'off' ? 'on' : 'off';
    settings.set('motion', root.dataset.motion);
    emit('motion', root.dataset.motion === 'off');
  }),
  toolButton('eye', '顯示註釋家的解讀', () => root.dataset.interp !== 'off', () => {
    root.dataset.interp = root.dataset.interp === 'off' ? 'on' : 'off';
    settings.set('interp', root.dataset.interp);
  }),
);

const SECTIONS = [
  { id: 'map', num: '01', title: '營地地圖', short: '地圖',
    lede: '十二個支派分成四營，東南西北各一，中間是會幕和利未人。點任何一塊，右邊會列出人數、首領、方向和出發順序。' },
  { id: 'march', num: '02', title: '拔營', short: '拔營',
    lede: '雲彩收上去，銀號吹響，一批一批出發。可以切換民10 實際上路的行列，和民2 宣告的安營次序，看兩邊差在哪裡。' },
  { id: 'three', num: '03', title: '立體營地', short: '立體',
    lede: '同一份資料的立體版。一頂帳棚代表約一千名被數點的男丁；可以繞著營地看，或站到營外的高處往下看。' },
  { id: 'compare', num: '04', title: '同一個次序，和兩次數點', short: '對照',
    lede: '民2 安營、民7 獻壇禮、民10 起行，十二個首領的先後完全一樣。民1 與民2 的人數相同，民26 又數了一次。' },
  { id: 'voices', num: '05', title: '註釋家怎麼讀', short: '註釋',
    lede: '方位、旗號、十字、行軍次序、號聲，各家的讀法。' },
  { id: 'unsaid', num: '06', title: '經文沒說的事', short: '沒說的',
    lede: '下面這些地方，經文沒有交代或各家讀法不同。列出的是經文的原話和各家的讀法，網站不下結論。' },
  { id: 'quiz', num: '07', title: '小測驗', short: '測驗',
    lede: '試試看：誰在哪一邊？誰先走？' },
];

const nav = h('nav', { class: 'nav', 'aria-label': '章節' }, ...SECTIONS.map((s) => h('a', { href: `#${s.id}` }, s.short)), h('a', { href: '#about' }, '關於'));
const brand = h('a', { class: 'brand', href: '#top' }, svg(ICONS.map), h('span', null, '環繞會幕'));
const topbar = h('header', { class: 'topbar' }, h('div', { class: 'wrap' }, brand, nav, tools));

/* ------------------------------------------------------------ 開場 */
// 開場圖：四營與中間的會幕、利未營。每一面的支派名照地圖的排法（每一面的先後是示意）
const heroSide = (x: number, y: number, w: number, hh: number, color: string, dir: string, names: string[], vertical: boolean) => {
  const cx = x + w / 2;
  const nameEls = vertical
    ? names.map((n, i) => `<text x="${cx}" y="${y + 58 + i * 17}" font-size="11.5" font-weight="400" fill="#fff" fill-opacity=".92">${n}</text>`).join('')
    : `<text x="${cx}" y="${y + 56}" font-size="11" font-weight="400" fill="#fff" fill-opacity=".92">${names.join('・')}</text>`;
  return `<rect x="${x}" y="${y}" width="${w}" height="${hh}" rx="9" fill="${color}" opacity=".92"/>
    <text x="${cx}" y="${y + 32}" fill="#fff" font-size="21">${dir}</text>${nameEls}`;
};
const names = (c: 'judah' | 'reuben' | 'ephraim' | 'dan') => tribesOf(c).map((t) => t.name);
const heroArt = `<svg viewBox="0 0 300 300" role="img" aria-label="十二支派環繞會幕的示意圖：東邊猶大營、南邊流便營、西邊以法蓮營、北邊但營，中間是會幕和利未營">
  <g font-family="Noto Serif TC, serif" font-weight="700" text-anchor="middle">
    ${heroSide(92, 6, 116, 72, 'var(--c-north)', '北', names('dan'), false)}
    ${heroSide(92, 222, 116, 72, 'var(--c-south)', '南', [...names('reuben')].reverse(), false)}
    ${heroSide(6, 92, 80, 116, 'var(--c-west)', '西', [...names('ephraim')].reverse(), true)}
    ${heroSide(214, 92, 80, 116, 'var(--c-east)', '東', names('judah'), true)}
    <rect x="98" y="90" width="104" height="120" rx="14" fill="none" stroke="var(--levi)" stroke-width="2" stroke-dasharray="5 4"/>
    <rect x="114" y="128" width="72" height="44" rx="4" fill="var(--surface)" stroke="var(--gold)" stroke-width="3"/>
    <rect x="121" y="142" width="26" height="16" fill="var(--gold)" opacity=".75"/><rect x="164" y="144" width="12" height="12" fill="var(--fire)"/>
    <text x="150" y="119" fill="var(--ink-2)" font-size="14">會幕</text>
    <text x="150" y="198" fill="var(--levi)" font-size="11">利未營</text>
  </g></svg>`;

const hero = h('section', { class: 'hero', id: 'top', 'aria-label': '開始' }, h('div', { class: 'wrap' },
  h('div', null,
    h('h1', null, '環繞會幕'),
    h('p', { class: 'epi' }, '「', h('span', null, '以色列人要各歸自己的纛下，在本族的旗號那裡，對著會幕的四圍安營。'), '」 ', refChip('民2:2', '各歸自己的纛下，在本族的旗號那裡，對著會幕的四圍安營')),
    h('p', { class: 'lede' }, '民數記 2 章寫下了以色列全營的位置：誰在東邊、誰在南邊、誰在西邊、誰在北邊，誰先走、誰跟在後面，會幕在哪裡。民數記 10 章的兩枝銀號和第一次拔營，把這張地圖動起來。'),
    h('div', { class: 'hero-stats' },
      h('div', null, h('b', null, '4'), h('span', null, '營，東南西北')),
      h('div', null, h('b', null, '12'), h('span', null, '個支派')),
      h('div', null, h('b', null, fmt(TOTAL_2.n)), h('span', null, '名被數點的男丁（利未人另計）'))),
    h('div', { class: 'hero-cta' },
      h('a', { class: 'btn primary', href: '#map' }, svg(ICONS.map), '看營地地圖'),
      h('button', { class: 'btn', type: 'button', onclick: () => {
        store.set({ mode: 'num10', phase: 1, playing: true });
        const el = document.getElementById('march');
        if (el) smoothScrollTo(el.getBoundingClientRect().top + scrollY - 64, 700);
      } }, svg(ICONS.play), '開始拔營'))),
  h('div', { class: 'hero-art', html: heroArt })));

/* ------------------------------------------------------------ 各區骨架 */
const main = h('main');
const blocks: Record<string, HTMLElement> = {};
for (const s of SECTIONS) {
  const body = h('div');
  blocks[s.id] = body;
  main.append(h('section', { class: 'block', id: s.id, 'aria-labelledby': `${s.id}-h` }, h('div', { class: 'wrap' },
    h('div', { class: 'sec-head' }, h('div', { class: 'sec-num' }, s.num), h('h2', { id: `${s.id}-h` }, s.title), h('p', null, s.lede)),
    body)));
}

/* ------------------------------------------------------------ 01 營地地圖 */
function mountMap(host: HTMLElement) {
  const map = createCampMap({ onPick: revealPanel });
  const list = createCampList();
  const panel = createPanel();
  const scroller = h('div', { class: 'map-scroll' }, map.el);
  const mapView = h('div', null, scroller, h('p', { class: 'swipe-hint' }, '← 左右滑動看整張圖 →'));
  const view = { cur: matchMedia('(max-width: 720px)').matches ? 'list' : 'map' };
  const viewBtns = ([['map', '地圖'], ['list', '清單']] as const).map(([k, label]) => h('button', {
    class: 'seg-btn', type: 'button', 'aria-pressed': String(view.cur === k),
    onclick: () => { view.cur = k; paint(); },
  }, label));
  const body = h('div');
  const paint = () => {
    viewBtns.forEach((b, i) => b.setAttribute('aria-pressed', String(view.cur === (i === 0 ? 'map' : 'list'))));
    fill(body, view.cur === 'map' ? mapView : list);
    // 手機上地圖比畫面寬：一打開先把會幕放在正中間
    if (view.cur === 'map') requestAnimationFrame(() => centerMapOn(scroller, MAP_CX, false));
  };
  paint();

  const layerChip = (k: keyof store.Layers, label: string, icon: string) => {
    const b = h('button', { class: 'chipbtn', type: 'button', 'aria-pressed': String(store.get().layers[k]), onclick: () => store.setLayer(k, !store.get().layers[k]) }, svg(ICONS[icon]), label);
    store.subscribe((st) => b.setAttribute('aria-pressed', String(st.layers[k])));
    return b;
  };
  const bar = h('div', { class: 'stage-bar' },
    h('div', { class: 'seg', role: 'group', 'aria-label': '檢視方式' }, ...viewBtns),
    h('span', { class: 'spacer' }),
    layerChip('levites', '利未人', 'people'),
    layerChip('mother', '母系', 'flag'),
    layerChip('banner', '傳統纛圖案', 'flag'),
    layerChip('c26', '民26 人數', 'target'));

  const legend = h('div', { class: 'map-legend' },
    ...CAMPS.map((c) => h('span', null, h('span', { class: 'omark', 'data-shape': CAMP_STYLE[c.id].shape, style: `--c:${CAMP_STYLE[c.id].color}` }), `${SIDE_NAME[c.side]}・${camp(c.id).bannerName.replace('的纛', '')}`)),
    h('span', null, h('span', { class: 'omark', 'data-shape': 'star', style: '--c:var(--levi)' }), '利未人'),
    h('span', null, svg(ICONS.tent), h('small', null, `一頂帳棚約 ${fmt(PEOPLE_PER_TENT)} 名（示意）`)),
    h('span', { class: 'legend-mother' }, ...(Object.values(MATRIARCH)).map((m) => h('span', { style: `color:${m.color};font-weight:700;margin-right:8px` }, m.name))),
    h('span', { class: 'legend-banner' }, badge('interpretation'), '旗上的字是猶太傳統，經文沒記載'));

  const stage = h('div', { class: 'card stage' }, bar, body, legend,
    h('p', { class: 'shown' }, h('b', null, '畫面說明：'), '地圖是示意，未按比例。方位照民2；每一面三個支派的先後經文沒寫，這裡依順時鐘排（見「經文沒說的事」）。右上角的數字是支派在那一營的順序：1 領頭、2 挨著他、3 又有。'));
  host.append(h('div', { class: 'map-layout' }, stage, panel.el));
  // 圖例跟著圖層開關；清單檢視時地圖不在頁面上，所以由這裡管，不靠地圖本身
  const syncLegend = (st: Readonly<store.State>) => {
    stage.classList.toggle('lay-mother', st.layers.mother);
    stage.classList.toggle('lay-banner', st.layers.banner);
  };
  store.subscribe(syncLegend);
  syncLegend(store.get());
}
mountMap(blocks.map);

/* ------------------------------------------------------------ 02 拔營 */
mountMarch(blocks.march);

/* ------------------------------------------------------------ 03 立體營地（捲近了才載入 three.js） */
function mountThreeSection(host: HTMLElement) {
  const wrap = h('div', { class: 'three-wrap' },
    h('div', { class: 'three-msg' }, h('div', null, h('p', null, '立體營地會在捲到這裡時載入。'), h('button', { class: 'btn', type: 'button', onclick: () => load() }, svg(ICONS.cube), '現在載入'))));
  host.append(wrap,
    h('p', { class: 'three-note' }, '畫面說明：地形、帳棚樣式、營與會幕的距離、行進方向、營外的高處都是示意，經文沒有記載。一頂帳棚約一千名被數點的男丁。哥轄人抬的聖物照民4 上色，車與牛的數目照民7:7-9。'));
  let started = false;
  const load = () => {
    if (started) return;
    started = true;
    wrap.replaceChildren(h('div', { class: 'three-msg' }, '載入立體營地…'));
    import('./three/mount').then((m) => m.mountThree(wrap)).catch((e) => {
      console.error(e);
      wrap.replaceChildren(h('div', { class: 'three-msg' }, h('div', null, h('p', null, '這台裝置沒辦法顯示 3D，請用上面的地圖和清單。'))));
    });
  };
  new IntersectionObserver((entries, io) => {
    if (entries.some((e) => e.isIntersecting)) { io.disconnect(); load(); }
  }, { rootMargin: '400px 0px' }).observe(wrap);
}
mountThreeSection(blocks.three);

/* ------------------------------------------------------------ 04–07 */
mountCompare(blocks.compare);
mountVoices(blocks.voices);
mountUnsaid(blocks.unsaid);
mountQuiz(blocks.quiz);

/* ------------------------------------------------------------ 關於 */
const about = h('section', { class: 'block', id: 'about', 'aria-labelledby': 'about-h' }, h('div', { class: 'wrap' },
  h('div', { class: 'sec-head' }, h('div', { class: 'sec-num' }, '08'), h('h2', { id: 'about-h' }, '這個網站怎麼做的'),
    h('p', null, '每一句話都標了它的根據。看到標籤，就知道那句話是經文寫的，還是整理出來的，或是註釋家的讀法。')),
  h('div', { class: 'about-grid' },
    h('div', { class: 'card' }, h('h3', null, '四種標籤'), h('div', { class: 'evlist' },
      ...(['explicit', 'synthesis', 'interpretation', 'not_stated'] as const).map((st) => h('div', null, badge(st), ' ', STATUS_HELP[st])))),
    h('div', { class: 'card' }, h('h3', null, '資料從哪裡來'),
      h('p', null, '經文：和合本，取自本知識庫的 raw_scripture。點任何經節（例如 民2:3）都會顯示原文，引號裡的摘句會標出來。'),
      h('p', null, '註釋家的讀法：取自本知識庫《民數記》2、3、10 章主檔的「本章整理」，那些整理讀過四套註釋：CT、GT（ccbiblestudy 的兩套）、KC（KingComments）、BH（BibleHub Study）。引號裡的話都是註釋家原話，沒有引號的是轉述。')),
    h('div', { class: 'card' }, h('h3', null, '圖和模型'),
      h('p', null, '營地圖是示意圖，未按比例；方位、人數、首領、出發順序照民2、民10。每一面三個支派的先後、營與會幕的距離、纛上的圖案、帳棚的形狀，經文都沒有記載，畫面上一律當示意。'),
      h('p', null, '一頂帳棚代表約一千名被數點的男丁；603,550 是二十歲以外、能出去打仗的男丁，不是總人口。'),
      h('p', null, '3D 模型：篷子車、哥轄人抬的聖物是本站用 Blender 自製；會幕院子沿用同系列「會幕前的一天」的模型；公牛取自 poly.pizza，Quaternius 作，CC0（',
        h('a', { href: 'https://poly.pizza/m/a8PIIYwF7r', rel: 'noopener' }, 'Bull'), '）。')),
    h('div', { class: 'card' }, h('h3', null, '同一系列'),
      h('p', null, '同一套做法的其他互動網站。營地中間的那座會幕，前兩站講它怎麼造、在裡面怎麼獻祭：'),
      h('p', null, h('a', { href: '../../../出埃及記/第25章/dist/index.html' }, '照山上的樣式：出埃及記 25–27 章')),
      h('p', null, h('a', { href: '../../../利未記/第1章/dist/index.html' }, '會幕前的一天：利未記 1–9 章')),
      h('p', null, h('a', { href: '../../../創世記/第6章/dist/index.html' }, '方舟：創世記 6–9 章'))),
    h('div', { class: 'card' }, h('h3', null, '自動檢查'),
      h('p', null, '網站建置前會自動比對：每一段引號裡的經文都必須逐字出現在所引的經節；每一句註釋家原話都必須逐字出現在主檔的引號裡；每個營的人數相加要等於經文的總數。對不上，網站就不會建置。')),
  ),
));
main.append(about);
const footer = h('footer', null, h('div', { class: 'wrap' },
  '非商業的研經教材。經文引自和合本。',
  h('br'), '環繞會幕・民數記 2 章與 10 章互動地圖'));

document.body.prepend(topbar, hero, main, footer);

// 各區的卡片捲進畫面時浮上來
reveal(document.querySelectorAll('.map-layout, .march-grid, .cmp-grid, .deb-grid > *, .quiz-grid > *, .about-grid > *'));

// 目前讀到哪一區
const links = [...nav.querySelectorAll('a')];
const io = new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting) links.forEach((a) => a.setAttribute('aria-current', String(a.hash === `#${e.target.id}`)));
}, { rootMargin: '-45% 0px -50% 0px' });
document.querySelectorAll('section[id]').forEach((s) => io.observe(s));

// 可分享的網址：#judah、#camp-judah、#clan-kohath、#tabernacle、#march-10、#march-2
function applyHash() {
  const d = parseHash(location.hash);
  if (!d) return;
  if ('sel' in d) {
    store.set({ sel: d.sel });
    revealPanel();
  } else {
    store.set({ mode: d.march, phase: 0, playing: false });
    const el = document.getElementById('march');
    if (el) requestAnimationFrame(() => scrollTo(0, el.getBoundingClientRect().top + scrollY - 64));
  }
}
applyHash();
addEventListener('hashchange', applyHash);

// 除錯：__num2.go('march', 3) 直接跳到某個階段；__num2.select('judah') 選支派
Object.assign(window, {
  __num2: {
    store,
    tribes: (c: 'judah' | 'reuben' | 'ephraim' | 'dan') => tribesOf(c).map((t) => t.id),
    select: (id: string) => store.set({ sel: { kind: 'tribe', id: id as never } }),
    go: (mode: 'num10' | 'num2', phase: number) => store.set({ mode, phase, playing: false }),
  },
});
