import { SCENES, SCENE_BY_ID, neighbors, type Scene, type SceneId } from '../data/story';
import { emit, h, svg } from './dom';
import { ICONS } from './icons';

const root = document.documentElement;
export const store = {
  get(k: string) {
    try { return localStorage.getItem(`lev-purity:${k}`); } catch { return null; }
  },
  set(k: string, v: string) {
    try { localStorage.setItem(`lev-purity:${k}`, v); } catch { /* 私密模式等情況，不保存也能用 */ }
  },
};
for (const k of ['theme', 'big', 'motion', 'study']) {
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

export const TITLE = '潔淨與不潔淨';

export function sceneHref(id: SceneId | 'about') {
  return `#/${id}`;
}

export function currentScene(): SceneId | 'about' {
  const id = location.hash.replace(/^#\/?/, '').split('/')[0];
  if (id === 'about') return 'about';
  return (SCENE_BY_ID[id as SceneId] ? id : 'intro') as SceneId;
}

export function mountShell(build: (id: SceneId | 'about') => HTMLElement) {
  const tools = h('div', { class: 'tools' },
    toolButton('scroll', '研經模式：顯示原文和詞義', () => root.dataset.study === '1', () => {
      root.dataset.study = root.dataset.study === '1' ? '0' : '1';
      store.set('study', root.dataset.study);
    }),
    toolButton('moon', '深色模式', isDark, () => { root.dataset.theme = isDark() ? 'light' : 'dark'; store.set('theme', root.dataset.theme); }),
    toolButton('text', '大字模式', () => root.dataset.big === '1', () => { root.dataset.big = root.dataset.big === '1' ? '0' : '1'; store.set('big', root.dataset.big); }),
    toolButton('motion', '減少動態', () => root.dataset.motion === 'off', () => {
      root.dataset.motion = root.dataset.motion === 'off' ? 'on' : 'off';
      store.set('motion', root.dataset.motion);
      emit('motion', root.dataset.motion === 'off');
    }),
  );
  const brand = h('a', { class: 'brand', href: sceneHref('intro') }, svg(ICONS.tent), h('span', null, TITLE), h('small', null, '利未記 11–15 章'));

  const rail = h('nav', { class: 'rail', 'aria-label': '利未記 11–15 章的每一幕' }, h('div', { class: 'rail-items' }, ...SCENES.map((s) => h('a', {
    class: `rail-item${s.ready ? '' : ' soon'}`, href: sceneHref(s.id), 'data-id': s.id, style: `--c:${s.color}`,
    title: s.ready ? `${s.short}（${s.range}）` : `${s.short}：還在做`,
  }, h('b', null, s.short), h('small', null, s.range)))));
  const bar = h('i');
  const progress = h('div', { class: 'rail-progress', 'aria-hidden': 'true' }, bar);

  const topbar = h('header', { class: 'topbar' },
    h('div', { class: 'wrap topline' }, brand, tools),
    h('div', { class: 'wrap' }, rail),
    progress);

  const main = h('main', { id: 'main', tabindex: -1 });
  const footer = h('footer', null, h('div', { class: 'wrap' },
    '非商業的研經教材。經文引自和合本。故事裡的一家人是虛構的，規矩都附經節。',
    ' ', h('a', { href: sceneHref('about') }, '這個網站怎麼做的')));
  document.body.prepend(topbar, main, footer);

  const cache = new Map<string, HTMLElement>();
  let shown: string | null = null;

  function show() {
    const id = currentScene();
    if (id === shown) return;
    shown = id;
    let el = cache.get(id);
    if (!el) {
      el = build(id);
      cache.set(id, el);
    }
    main.replaceChildren(el);
    el.classList.remove('scene-in');
    void el.offsetWidth;
    el.classList.add('scene-in');
    scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });

    const idx = SCENES.findIndex((s) => s.id === id);
    rail.querySelectorAll<HTMLAnchorElement>('.rail-item').forEach((a, i) => {
      if (a.dataset.id === id) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
      a.classList.toggle('past', idx >= 0 && i < idx);
    });
    bar.style.width = idx >= 0 ? `${((idx + 1) / SCENES.length) * 100}%` : '0';
    const cur = rail.querySelector<HTMLElement>('.rail-item[aria-current]');
    if (cur) {
      const rr = rail.getBoundingClientRect();
      const cr = cur.getBoundingClientRect();
      if (cr.left < rr.left || cr.right > rr.right) rail.scrollTo({ left: rail.scrollLeft + cr.left - rr.left - rr.width / 2 + cr.width / 2 });
    }
    const s = idx >= 0 ? SCENES[idx] : null;
    document.title = s && s.id !== 'intro' ? `${s.short}・${TITLE}` : `${TITLE}：利未記 11–15 章`;
    emit('scene', id);
  }
  addEventListener('hashchange', show);
  show();
}

/** 每一幕底下的「上一幕／下一幕」 */
export function sceneNav(id: SceneId): HTMLElement {
  const { prev, next } = neighbors(id);
  const link = (s: Scene | undefined, dir: 'prev' | 'next') => s
    ? h('a', { class: `scene-link ${dir}`, href: sceneHref(s.id), style: `--c:${s.color}` },
      dir === 'prev' ? svg(ICONS.prev) : null,
      h('span', null, h('small', null, dir === 'prev' ? '上一幕' : '下一幕'), h('b', null, s.short), h('small', null, s.range)),
      dir === 'next' ? svg(ICONS.next) : null)
    : h('span');
  return h('nav', { class: 'scene-nav', 'aria-label': '上一幕／下一幕' }, link(prev, 'prev'), link(next, 'next'));
}

/** 「第 n 幕，共 m 幕」 */
export function kicker(id: SceneId): string {
  const s = SCENE_BY_ID[id];
  const pos = SCENES.findIndex((x) => x.id === id) + 1;
  return `${s.range}・第 ${pos} 幕，共 ${SCENES.length} 幕`;
}
