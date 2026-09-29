import './styles.css';
import './story.css';
import { SCENES } from './data/scenes';
import { createSound } from './audio/sound';
import { createEngine } from './three/engine';
import { h, svg } from './ui/dom';
import { ICONS } from './ui/icons';
import { smoothScrollTo } from './ui/motion';
import { mountAbout, mountDebates, mountExplore, mountOutside, mountTimeline } from './ui/sections';
import { mountStory } from './ui/story';
import { mountSpots } from './ui/inside';

/* ------------------------------------------------------------ 使用者設定（只存在這台裝置） */
const root = document.documentElement;
const store = {
  get(k: string) { try { return localStorage.getItem(`gen6:${k}`); } catch { return null; } },
  set(k: string, v: string) { try { localStorage.setItem(`gen6:${k}`, v); } catch { /* 私密模式等情況，不保存也能用 */ } },
};
for (const k of ['theme', 'big', 'motion', 'interp']) {
  const v = store.get(k);
  if (v) root.dataset[k] = v;
}
const sound = createSound();

function toolButton(icon: string, label: string, pressed: () => boolean, toggle: () => void | Promise<void>) {
  const b = h('button', { class: 'iconbtn', type: 'button', title: label, 'aria-label': label, 'aria-pressed': String(pressed()) }, svg(ICONS[icon]));
  b.addEventListener('click', async () => { await toggle(); b.setAttribute('aria-pressed', String(pressed())); });
  return b;
}
const isDark = () => root.dataset.theme === 'dark' || (!root.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
const soundTool = toolButton('sound', '聲音', () => sound.on, async () => { await sound.toggle(); document.dispatchEvent(new CustomEvent('sound-change')); });
document.addEventListener('sound-change', () => soundTool.setAttribute('aria-pressed', String(sound.on)));
// 右上角的播放／暫停：自動往下捲，隨時停
const playTool = h('button', { class: 'iconbtn playtool', type: 'button', title: '播放（空白鍵）', 'aria-label': '播放', 'aria-pressed': 'false' }, svg(ICONS.play));
playTool.addEventListener('click', () => storyUi.startAuto());
document.addEventListener('auto-change', (e) => {
  const on = (e as CustomEvent<boolean>).detail;
  playTool.setAttribute('aria-pressed', String(on));
  playTool.setAttribute('aria-label', on ? '暫停' : '播放');
  playTool.title = on ? '暫停（空白鍵）' : '播放（空白鍵）';
  playTool.replaceChildren(svg(on ? ICONS.pause : ICONS.play));
});
const tools = h('div', { class: 'tools' },
  playTool,
  soundTool,
  toolButton('text', '大字模式', () => root.dataset.big === '1', () => { root.dataset.big = root.dataset.big === '1' ? '0' : '1'; store.set('big', root.dataset.big); }),
  toolButton('motion', '減少動態', () => root.dataset.motion === 'off', () => { root.dataset.motion = root.dataset.motion === 'off' ? 'on' : 'off'; store.set('motion', root.dataset.motion); }),
  toolButton('eye', '顯示註釋家的解讀', () => root.dataset.interp !== 'off', () => { root.dataset.interp = root.dataset.interp === 'off' ? 'on' : 'off'; store.set('interp', root.dataset.interp); }),
  toolButton('moon', '下方內容用深色', isDark, () => { root.dataset.theme = isDark() ? 'light' : 'dark'; store.set('theme', root.dataset.theme); }),
);
const nav = h('nav', { class: 'nav', 'aria-label': '章節' },
  h('a', { href: '#top' }, '故事'), h('a', { href: '#explore' }, '走進方舟'), h('a', { href: '#days' }, '洪水的日子'),
  h('a', { href: '#unsaid' }, '經文沒說的'), h('a', { href: '#about' }, '關於'));
const topbar = h('header', { class: 'topbar' }, h('div', { class: 'wrap' },
  h('a', { class: 'brand', href: '#top' }, svg(ICONS.ark), h('span', null, '方舟')), nav, tools));

/* ------------------------------------------------------------ 3D 舞台（固定在背後） */
const stage = h('div', { class: 'stage', 'aria-hidden': 'true' });
const labels = h('div', { class: 'labels3d' });
const veil = h('div', { class: 'stage-veil' });
stage.append(labels, veil);

const story = h('main', { class: 'story', id: 'story' });
const explore = h('section', { class: 'explore', id: 'explore', 'aria-labelledby': 'explore-h' });
const section = (id: string, num: string, title: string, lede: string) => {
  const body = h('div');
  const el = h('section', { class: 'block', id, 'aria-labelledby': `${id}-h` }, h('div', { class: 'wrap' },
    h('div', { class: 'sec-head' }, h('div', { class: 'sec-num' }, num), h('h2', { id: `${id}-h` }, title), h('p', null, lede)), body));
  return { el, body };
};
const days = section('days', '01', '洪水的日子', '經文記下了好幾個日期。從二月十七日洪水開始，到隔年二月二十七日地都乾了。');
const unsaid = section('unsaid', '02', '經文沒說的事', '方舟和洪水留下很多空白。下面列出經文寫了什麼、沒寫什麼，和各家註釋的讀法，網站不下結論。');
const outside = section('outside', '03', '現代人怎麼重建方舟', '網站的船形、比例參考了幾位現代研究者和重建團隊的做法。');
const about = section('about', '04', '這個網站怎麼做的', '每一句話都標了根據：經文寫的、整理出來的，還是註釋家的讀法。');
const content = h('div', { class: 'content' }, days.el, unsaid.el, outside.el, about.el,
  h('footer', null, h('div', { class: 'wrap' }, '非商業的研經教材。經文引自和合本。', h('br'), '方舟・創世記 6–9 章互動導覽')));
document.body.prepend(topbar, stage, story, explore, content);

const engine = createEngine(stage, SCENES.map((s) => s.id), {
  onProgress: (v) => storyUi.loadProgress(v, engine.ready),
  onReady: () => {
    stage.classList.add('ready');
    storyUi.loadProgress(0.1, true);
  },
  onFrame: (f) => sound.update(f, 1 / 60),
  onThunder: (d) => sound.thunder(d),
});
const storyUi = mountStory(story, engine, sound, labels);
const spots = mountSpots(labels, engine);
mountExplore(explore, engine, spots);
mountTimeline(days.body);
mountDebates(unsaid.body);
mountOutside(outside.body);
mountAbout(about.body);

// 內容區蓋滿畫面時停掉 3D，省電
addEventListener('scroll', () => {
  const top = content.getBoundingClientRect().top;
  engine.setActive(top > 0);
  document.body.classList.toggle('in-content', top < 90);
  document.body.classList.toggle('content-near', top < innerHeight * 0.7);
}, { passive: true });

// 導覽列用自己的平滑捲動
document.addEventListener('click', (e) => {
  const a = (e.target as HTMLElement).closest('a[href^="#"]') as HTMLAnchorElement | null;
  if (!a) return;
  const el = document.getElementById(a.hash.slice(1));
  if (!el) return;
  e.preventDefault();
  storyUi.stopAuto();
  smoothScrollTo(a.hash === '#top' ? 0 : el.getBoundingClientRect().top + scrollY - (a.hash === '#explore' ? 0 : 60));
  history.replaceState(null, '', a.hash);
});

// 除錯：在 console 用 __gen6.go('decks', 0.5) 直接跳到某一幕（截圖檢查用）
(window as unknown as { __gen6: unknown }).__gen6 = {
  engine, sound,
  go(id: string, u = 0.5) {
    const i = id === 'hero' ? 0 : SCENES.findIndex((s) => s.id === id) + 1;
    document.body.classList.add('shot');
    engine.setProgress(i === 0 ? u : i + 0.3 + 0.7 * u);
  },
};
