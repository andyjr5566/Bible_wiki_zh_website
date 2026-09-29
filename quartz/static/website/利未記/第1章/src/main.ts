import './styles.css';
import { emit, h, svg } from './ui/dom';
import { badge } from './ui/evidence';
import { ICONS } from './ui/icons';
import { mountCompare } from './ui/compare';
import { mountDebates } from './ui/debates';
import { mountHero } from './ui/hero';
import { STATUS_HELP } from './ui/meta';
import { mountObjects } from './ui/objects';
import { mountPriesthood } from './ui/priesthood';
import { mountSimulator } from './ui/simulator';

/* ------------------------------------------------------------ 使用者設定（只存在這台裝置） */
const root = document.documentElement;
const store = {
  get(k: string) {
    try { return localStorage.getItem(`lev-offerings:${k}`); } catch { return null; }
  },
  set(k: string, v: string) {
    try { localStorage.setItem(`lev-offerings:${k}`, v); } catch { /* 私密模式等情況，不保存也能用 */ }
  },
};
for (const k of ['theme', 'big', 'motion', 'interp']) {
  const v = store.get(k);
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
  toolButton('moon', '深色模式', isDark, () => { root.dataset.theme = isDark() ? 'light' : 'dark'; store.set('theme', root.dataset.theme); }),
  toolButton('text', '大字模式', () => root.dataset.big === '1', () => { root.dataset.big = root.dataset.big === '1' ? '0' : '1'; store.set('big', root.dataset.big); }),
  toolButton('motion', '減少動態', () => root.dataset.motion === 'off', () => {
    root.dataset.motion = root.dataset.motion === 'off' ? 'on' : 'off';
    store.set('motion', root.dataset.motion);
    emit('motion', root.dataset.motion === 'off');
  }),
  toolButton('eye', '顯示註釋家的解讀', () => root.dataset.interp !== 'off', () => {
    root.dataset.interp = root.dataset.interp === 'off' ? 'on' : 'off';
    store.set('interp', root.dataset.interp);
  }),
);

const SECTIONS = [
  { id: 'simulator', num: '01', title: '走一次獻祭', short: '走一次',
    lede: '選一種祭、誰來獻、帶什麼來，再一步一步往下看。每一步都標了是誰做的、在院子的哪裡做。只改一個選項，下面的結果表會標出哪幾項變了。' },
  { id: 'compare', num: '02', title: '五祭一次看懂', short: '對照',
    lede: '五種祭並排比較。要分辨它們，先看血和肉最後去了哪裡。' },
  { id: 'objects', num: '03', title: '器具與地點', short: '器具',
    lede: '點開卡片看經文的描述。標著 3D 的，可以在最上面的院子裡找到。' },
  { id: 'priests', num: '04', title: '祭司是怎麼來的', short: '祭司',
    lede: '利未記 8–9 章。前七章的條例在這裡第一次照著做：摩西為亞倫和他兒子穿聖衣、獻祭、抹血；七天以後，亞倫第一次自己獻祭。' },
  { id: 'unsaid', num: '05', title: '經文沒說的事', short: '沒說的',
    lede: '下面這些地方，經文沒有給理由。列出的是各家註釋的讀法，網站不下結論。' },
];

const nav = h('nav', { class: 'nav', 'aria-label': '章節' }, ...SECTIONS.map((s) => h('a', { href: `#${s.id}` }, s.short)), h('a', { href: '#about' }, '關於'));
const brand = h('a', { class: 'brand', href: '#top' }, svg(ICONS.altar), h('span', null, '會幕前的一天'));
const topbar = h('header', { class: 'topbar' }, h('div', { class: 'wrap' }, brand, nav, tools));

const hero = h('section', { class: 'hero', id: 'top', 'aria-label': '開始' });
const main = h('main');
const blocks: Record<string, HTMLElement> = {};
for (const s of SECTIONS) {
  const body = h('div');
  blocks[s.id] = body;
  main.append(h('section', { class: 'block', id: s.id, 'aria-labelledby': `${s.id}-h` }, h('div', { class: 'wrap' },
    h('div', { class: 'sec-head' }, h('div', { class: 'sec-num' }, s.num), h('h2', { id: `${s.id}-h` }, s.title), h('p', null, s.lede)),
    body)));
}

/* ------------------------------------------------------------ 關於 */
const about = h('section', { class: 'block', id: 'about', 'aria-labelledby': 'about-h' }, h('div', { class: 'wrap' },
  h('div', { class: 'sec-head' }, h('div', { class: 'sec-num' }, '06'), h('h2', { id: 'about-h' }, '這個網站怎麼做的'),
    h('p', null, '每一句話都標了它的根據。看到標籤，就知道那句話是經文寫的，還是整理出來的，或是註釋家的讀法。')),
  h('div', { class: 'about-grid' },
    h('div', { class: 'card' }, h('h3', null, '四種標籤'), h('div', { class: 'evlist' },
      ...(['explicit', 'synthesis', 'interpretation', 'not_stated'] as const).map((st) => h('div', null, badge(st), ' ', STATUS_HELP[st]))),
    ),
    h('div', { class: 'card' }, h('h3', null, '資料從哪裡來'),
      h('p', null, '經文：和合本，取自本知識庫的 raw_scripture。點任何經節（例如 利1:5）都會顯示原文，引號裡的摘句會標出來。'),
      h('p', null, '註釋家的讀法：取自本知識庫《利未記》1–9 章主檔的「本章整理」，那些整理讀過四套註釋：CT、GT（ccbiblestudy 的兩套）、KC（KingComments）、BH（BibleHub Study）。引號裡的話都是註釋家原話，沒有引號的是轉述。'),
    ),
    h('div', { class: 'card' }, h('h3', null, '圖和模型'),
      h('p', null, '流程地圖是示意圖，未按比例；方位照出埃及記 27、40 章。祭物用符號和標籤表示，不畫寫實的宰殺畫面。'),
      h('p', null, '3D 院子用 Blender 依出埃及記 26–30 章的尺寸建模：院子 100×50 肘、燔祭壇 5×5×3 肘、香壇 1×1×2 肘。經文沒給尺寸的部分（會幕的外觀、洗濯盆的形狀）都是示意重建。'),
    ),
    h('div', { class: 'card' }, h('h3', null, '同一系列'),
      h('p', null, '這座會幕是怎麼造的，尺寸和材料在出埃及記 25–27 章：'),
      h('a', { href: '../../../出埃及記/第25章/dist/index.html' }, '照山上的樣式：出埃及記 25–27 章'),
    ),
    h('div', { class: 'card' }, h('h3', null, '自動檢查'),
      h('p', null, '網站建置前會自動比對：每一段引號裡的經文都必須逐字出現在所引的經節；每一句註釋家原話都必須逐字出現在主檔的引號裡。對不上，網站就不會建置。'),
    ),
  ),
));
main.append(about);
const footer = h('footer', null, h('div', { class: 'wrap' },
  '非商業的研經教材。經文引自和合本。',
  h('br'), '會幕前的一天・利未記 1–9 章互動導覽'));

document.body.prepend(topbar, hero, main, footer);

mountHero(hero);
mountSimulator(blocks.simulator);
mountCompare(blocks.compare);
mountObjects(blocks.objects);
mountPriesthood(blocks.priests);
mountDebates(blocks.unsaid);

// 各區的卡片捲進畫面時浮上來；同一列的依序出現
import('./ui/motion').then(({ reveal }) => {
  const groups = ['.portions', '.obj-grid', '.deb-grid', '.flips', '.about-grid', '.pr-grid'];
  for (const g of groups) document.querySelectorAll(g).forEach((grid) => {
    [...grid.children].forEach((c, i) => (c as HTMLElement).style.setProperty('--d', String(i % 6)));
    reveal(grid.children);
  });
  reveal(document.querySelectorAll('.matrix-wrap, #simulator .sim, .finale, .timeline'));
});

// 目前讀到哪一區
const links = [...nav.querySelectorAll('a')];
const io = new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting) links.forEach((a) => a.setAttribute('aria-current', String(a.hash === `#${e.target.id}`)));
}, { rootMargin: '-45% 0px -50% 0px' });
document.querySelectorAll('section[id]').forEach((s) => io.observe(s));
