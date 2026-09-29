import './styles.css';
import './tour.css';
import { CREDITS, LICENSE } from './data/credits';
import { emit, h, svg } from './ui/dom';
import { badge } from './ui/evidence';
import { ICONS } from './ui/icons';
import { STATUS_HELP } from './ui/meta';
import { mountMaterials, mountUnsaid } from './ui/sections';
import { mountTour } from './ui/tour';
import { smoothScrollTo } from './ui/motion';

/* ------------------------------------------------------------ 使用者設定（只存在這台裝置） */
const root = document.documentElement;
const store = {
  get(k: string) { try { return localStorage.getItem(`ex25:${k}`); } catch { return null; } },
  set(k: string, v: string) { try { localStorage.setItem(`ex25:${k}`, v); } catch { /* 私密模式等情況，不保存也能用 */ } },
};
for (const k of ['theme', 'big', 'motion', 'interp']) {
  const v = store.get(k);
  if (v) root.dataset[k] = v;
}
function toolButton(icon: string, label: string, pressed: () => boolean, toggle: () => void) {
  const b = h('button', { class: 'iconbtn', type: 'button', title: label, 'aria-label': label, 'aria-pressed': String(pressed()) }, svg(ICONS[icon]));
  b.addEventListener('click', () => { toggle(); b.setAttribute('aria-pressed', String(pressed())); });
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

const nav = h('nav', { class: 'nav', 'aria-label': '章節' },
  h('a', { href: '#top' }, '走進去'), h('a', { href: '#materials' }, '材料'), h('a', { href: '#unsaid' }, '沒說的'), h('a', { href: '#about' }, '關於'));
const topbar = h('header', { class: 'topbar' }, h('div', { class: 'wrap' },
  h('a', { class: 'brand', href: '#top' }, svg(ICONS.door), h('span', null, '照山上的樣式')), nav, tools));

const tour = h('section', { class: 'tour', id: 'top', 'aria-label': '走進會幕' });
const section = (id: string, num: string, title: string, lede: string) => {
  const body = h('div');
  const el = h('section', { class: 'block', id, 'aria-labelledby': `${id}-h` }, h('div', { class: 'wrap' },
    h('div', { class: 'sec-head' }, h('div', { class: 'sec-num' }, num), h('h2', { id: `${id}-h` }, title), h('p', null, lede)), body));
  return { el, body };
};
const materials = section('materials', '02', '百姓送來的禮物',
  '神吩咐摩西向百姓收禮物，凡甘心樂意的都可以送來。金銀銅、線、皮、木頭、油、香料、寶石，最後各自成了會幕的哪一部分。');
const unsaid = section('unsaid', '03', '經文沒說的事',
  '出25–27 章給了很多尺寸，也留下很多空白。下面列出經文沒寫的地方，和各家註釋的讀法，網站不下結論。');

const about = h('section', { class: 'block', id: 'about', 'aria-labelledby': 'about-h' }, h('div', { class: 'wrap' },
  h('div', { class: 'sec-head' }, h('div', { class: 'sec-num' }, '04'), h('h2', { id: 'about-h' }, '這個網站怎麼做的'),
    h('p', null, '每一句話都標了根據：經文寫的、整理出來的，還是註釋家的讀法。')),
  h('div', { class: 'about-grid' },
    h('div', { class: 'card' }, h('h3', null, '四種標籤'), h('div', { class: 'evlist' },
      ...(['explicit', 'synthesis', 'interpretation', 'not_stated'] as const).map((st) => h('div', null, badge(st), ' ', STATUS_HELP[st]))),
    ),
    h('div', { class: 'card' }, h('h3', null, '資料從哪裡來'),
      h('p', null, '經文：和合本，取自本知識庫的 raw_scripture。點任何經節都會顯示原文。'),
      h('p', null, '註釋家的讀法：取自本知識庫《出埃及記》25–27 章主檔的「本章整理」，那些整理讀過 CT、GT（ccbiblestudy 的兩套）、KC（KingComments）、BH（BibleHub Study）。引號裡是原話，沒有引號的是轉述。'),
      h('p', null, '網站建置前會自動比對：引號裡的經文必須逐字出現在所引經節，註釋家的原話必須逐字出現在主檔的引號裡。'),
    ),
    h('div', { class: 'card' }, h('h3', null, '3D 模型'),
      h('p', null, '會幕與四件器具的模型都是 thedeserttabernacle 在 Sketchfab 發布的作品，授權 ', h('a', { href: LICENSE.url, rel: 'noopener' }, LICENSE.name), '，本站只作非商業研經用途。'),
      h('ul', { style: 'padding-left:1.1em;margin:0 0 8px;font-size:.9em' }, ...CREDITS.map((c) => h('li', null, h('a', { href: c.url, rel: 'noopener' }, c.title), c.note ? `：${c.note}` : ''))),
      h('p', { style: 'font-size:.9em' }, '模型是示意重建。本站另外做了三處調整：院門、門簾、內幔原本是漩渦貼圖，改成藍、紫、朱紅三色線加細麻的織紋；約櫃、桌子、燈臺改成金色（出25:11、24、31）；這個模型沒有山羊毛罩棚，四層頂蓋只掀得開三層。'),
    ),
    h('div', { class: 'card' }, h('h3', null, '同一系列'),
      h('p', null, '這座會幕後來怎麼用來獻祭：'),
      h('a', { href: '../../../利未記/第1章/dist/index.html' }, '會幕前的一天：利未記 1–9 章'),
    ),
  ),
));

const footer = h('footer', null, h('div', { class: 'wrap' }, '非商業的研經教材。經文引自和合本。', h('br'), '照山上的樣式・出埃及記 25–27 章互動導覽'));
document.body.prepend(topbar, tour, materials.el, unsaid.el, about, footer);

mountTour(tour);
// 導覽列用自己的平滑捲動（瀏覽器內建的 smooth 會和逐格捲動互相干擾）
document.addEventListener('click', (e) => {
  const a = (e.target as HTMLElement).closest('a[href^="#"]') as HTMLAnchorElement | null;
  if (!a) return;
  const el = document.getElementById(a.hash.slice(1));
  if (!el) return;
  e.preventDefault();
  smoothScrollTo(a.hash === '#top' ? 0 : el.getBoundingClientRect().top + scrollY - 60);
  history.replaceState(null, '', a.hash);
});
mountMaterials(materials.body);
mountUnsaid(unsaid.body);

const links = [...nav.querySelectorAll('a')];
const io = new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting) links.forEach((a) => a.setAttribute('aria-current', String(a.hash === `#${e.target.id}`)));
}, { rootMargin: '-45% 0px -50% 0px' });
document.querySelectorAll('body > section[id]').forEach((s) => io.observe(s));
