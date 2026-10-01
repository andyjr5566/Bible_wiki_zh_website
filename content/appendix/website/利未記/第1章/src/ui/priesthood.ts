import {
  AARON_ORDER, BODY_MARKS, BODY_VOICES, GARMENTS, GARMENT_FACTS, GARMENT_VOICES, SONS_ORDER, type TimelineItem,
} from '../data/priesthood';
import { fill, h, svg } from './dom';
import { factLine, interpHeading, refChips, voiceBlock } from './evidence';

/* ------------------------------------------------------------ 人物 SVG */

const STONES = ['#b3202c', '#c43a2a', '#d0462f', '#2f8a4f', '#2e5aa8', '#e8eef2', '#6a3d8f', '#f1ede6', '#8a5bb0', '#3a9a9a', '#9c3f2c', '#3d7d3d'];

function figureSvg(): string {
  const stones = STONES.map((c, i) => {
    const r = Math.floor(i / 3);
    const col = i % 3;
    return `<circle cx="${88 + col * 12}" cy="${120 + r * 11}" r="4.2" fill="${c}" stroke="#7a5a10" stroke-width=".8"/>`;
  }).join('');
  const hem = Array.from({ length: 9 }, (_, i) => {
    const x = 60 + i * 10;
    return i % 2
      ? `<circle cx="${x}" cy="296" r="3.4" fill="#e0b44a" stroke="#8f6a14" stroke-width=".8"/>`
      : `<ellipse cx="${x}" cy="297" rx="3.6" ry="4.2" fill="#a3263a"/>`;
  }).join('');
  return `
<svg viewBox="0 0 200 360" class="figure" role="img" aria-label="祭司穿著示意圖">
  <defs>
    <pattern id="check" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="#f6f1e6"/><path d="M0 0h3v3H0zM3 3h3v3H3z" fill="#e6dcc8"/></pattern>
    <linearGradient id="ephod" x1="0" x2="1"><stop offset="0" stop-color="#d9ab3f"/><stop offset=".25" stop-color="#d9ab3f"/><stop offset=".25" stop-color="#3553a0"/><stop offset=".5" stop-color="#3553a0"/><stop offset=".5" stop-color="#6d3f8f"/><stop offset=".75" stop-color="#6d3f8f"/><stop offset=".75" stop-color="#b3263a"/><stop offset="1" stop-color="#b3263a"/></linearGradient>
  </defs>
  <ellipse cx="100" cy="350" rx="60" ry="6" fill="rgb(0 0 0 / 10%)"/>
  <g id="body">
    <path d="M78 80h44l6 60-6 180H78l-6-180z" fill="#d9c8ad"/>
    <path d="M78 84l-26 96 10 4 22-80zM122 84l26 96-10 4-22-80z" fill="#c9a887"/>
    <circle cx="100" cy="52" r="22" fill="#c9a07a"/>
    <path d="M86 335h12v10H84zM102 335h12l2 10h-14z" fill="#b98c66"/>
  </g>
  <g class="fig-layer off" data-g="tunic">
    <path d="M76 82h48l24 98-8 4-14-58 10 206H64l10-206-14 58-8-4z" fill="url(#check)" stroke="#cbbd9f"/>
  </g>
  <g class="fig-layer off" data-g="robe">
    <path d="M74 86h52l14 214H60z" fill="#2f55a3" stroke="#1d3a78"/>${hem}
  </g>
  <g class="fig-layer off" data-g="ephod">
    <path d="M80 104h40l4 112H76z" fill="url(#ephod)" opacity=".95" stroke="#8f6a14"/>
    <path d="M80 104l-2-22h10l2 22M120 104l2-22h-10l-2 22" fill="#d9ab3f"/>
    <circle cx="82" cy="84" r="5" fill="#9c3f2c" stroke="#e0b44a" stroke-width="1.5"/><circle cx="118" cy="84" r="5" fill="#9c3f2c" stroke="#e0b44a" stroke-width="1.5"/>
  </g>
  <g class="fig-layer off" data-g="sash">
    <path d="M74 158h52v10H74z" fill="url(#ephod)"/><path d="M92 168l-4 50h6l4-50zM102 168l2 44h6l-4-44z" fill="#6d3f8f" opacity=".85"/>
  </g>
  <g class="fig-layer off" data-g="breastpiece">
    <rect x="80" y="112" width="40" height="46" rx="2" fill="#e0b44a" stroke="#8f6a14"/>${stones}
  </g>
  <g class="fig-layer off" data-g="turban">
    <path d="M76 44c0-18 48-18 48 0v6c0 4-48 4-48 0z" fill="#f6f1e6" stroke="#cbbd9f"/><path d="M78 36c10-6 34-6 44 0M77 44c12-4 34-4 46 0" stroke="#d8ccb2" fill="none"/>
  </g>
  <g class="fig-layer off" data-g="cap">
    <path d="M79 44c0-14 42-14 42 0v4c0 3-42 3-42 0z" fill="#f6f1e6" stroke="#cbbd9f"/>
  </g>
  <g class="fig-layer off" data-g="plate">
    <rect x="90" y="40" width="20" height="8" rx="1.5" fill="#f2c94c" stroke="#8f6a14"/><path d="M93 44h14" stroke="#8f6a14" stroke-width=".8"/>
  </g>
  <g id="marks">
    <circle class="mark-dot off" data-m="ear" cx="77" cy="56" r="3.6"/>
    <circle class="mark-dot off" data-m="thumb" cx="55" cy="184" r="3.6"/>
    <circle class="mark-dot off" data-m="toe" cx="88" cy="343" r="3.6"/>
  </g>
</svg>`;
}

/* ------------------------------------------------------------ 穿聖衣 */

export function mountDress(host: HTMLElement) {
  let who: 'aaron' | 'sons' = 'aaron';
  let worn: string[] = [];
  const fig = svg(figureSvg());
  fig.removeAttribute('aria-hidden');
  const toast = h('div', { class: 'toast', 'aria-live': 'polite' });
  const list = h('div', { class: 'garments' });
  const whoBtns = h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap' });
  const order = () => (who === 'aaron' ? AARON_ORDER : SONS_ORDER);
  // 按鈕順序打散，才有「照經文次序」可玩
  const SHUFFLED: Record<string, string[]> = {
    aaron: ['breastpiece', 'sash', 'plate', 'robe', 'turban', 'tunic', 'ephod'],
    sons: ['cap', 'sash', 'tunic'],
  };
  const shuffled = () => SHUFFLED[who];

  function paint() {
    fig.querySelectorAll<SVGGElement>('.fig-layer').forEach((g) => g.classList.toggle('off', !worn.includes(g.dataset.g!)));
  }

  function render() {
    whoBtns.replaceChildren(...(['aaron', 'sons'] as const).map((w) => h('button', {
      class: 'opt', type: 'button', 'aria-pressed': String(who === w), onclick: () => { who = w; worn = []; paint(); render(); toast.textContent = ''; },
    }, w === 'aaron' ? '亞倫（大祭司）・7 件' : '亞倫的兒子・3 件')));
    const ids = shuffled();
    list.replaceChildren(...ids.map((id) => {
      const g = GARMENTS.find((x) => x.id === id)!;
      const n = worn.indexOf(id);
      return h('button', {
        class: 'garment', type: 'button', 'aria-pressed': String(n >= 0),
        onclick: () => wear(id),
      }, h('span', { class: 'n' }, n >= 0 ? n + 1 : ''), g.name);
    }));
  }

  function wear(id: string) {
    if (worn.includes(id)) return;
    const next = order()[worn.length];
    const g = GARMENTS.find((x) => x.id === id)!;
    if (id !== next) {
      const want = GARMENTS.find((x) => x.id === next)!;
      toast.replaceChildren(`還不是「${g.name}」。照利未記 8 章的次序，現在該穿「${want.name}」。`, ' ', ...refChips(want.put.refs, want.put.q));
      return;
    }
    worn.push(id);
    paint();
    render();
    const done = worn.length === order().length;
    fill(toast,
      h('div', null, h('b', null, `${worn.length}. ${g.name}　`), factLine(g.put)),
      ...g.made.map((m) => h('div', { style: 'font-size:.9em;color:var(--ink-2)' }, '做法：', factLine(m))),
      done ? h('div', { style: 'margin-top:6px;font-weight:700;color:var(--ev-explicit)' }, '穿好了！', factLine(GARMENT_FACTS[1])) : null,
    );
  }

  const answer = h('button', { class: 'chipbtn', type: 'button', onclick: () => { worn = []; for (const id of order()) wear(id); } }, '直接看答案');
  render();
  host.append(h('div', { class: 'card dress' }, fig, h('div', { style: 'display:grid;gap:10px;width:100%' },
    h('div', null, h('b', null, '照經文的次序穿上聖衣'), h('p', { style: 'font-size:.88em;color:var(--ink-2);margin:2px 0 0' }, '下面的按鈕故意打亂了。猜猜看，摩西先給亞倫穿哪一件？')),
    whoBtns, list, toast, h('div', { style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap' }, answer,
      h('span', { style: 'font-size:.75em;color:var(--ink-3)' }, '人物與寶石顏色是示意，材料與次序照出28、利8。')),
    interpHeading(), ...GARMENT_VOICES.map(voiceBlock),
  )));
}

/* ------------------------------------------------------------ 抹血三處 */

export function mountMarks(host: HTMLElement) {
  const fig = svg(figureSvg());
  fig.removeAttribute('aria-hidden');
  fig.querySelectorAll<SVGGElement>('[data-g="tunic"],[data-g="sash"]').forEach((g) => g.classList.remove('off'));
  const info = h('div', { class: 'toast', 'aria-live': 'polite' }, '點下面三個部位，看摩西把血抹在哪裡。');
  const btns = h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap' }, ...BODY_MARKS.map((m) => h('button', {
    class: 'opt', type: 'button', 'aria-pressed': 'false', onclick: (e: Event) => {
      (e.currentTarget as HTMLElement).setAttribute('aria-pressed', 'true');
      const dot = fig.querySelector<SVGCircleElement>(`[data-m="${m.id}"]`)!;
      dot.classList.remove('off');
      dot.classList.add('on');
      info.replaceChildren(h('b', null, m.name, '　'), factLine(m.fact));
    },
  }, m.name)));
  host.append(h('div', { class: 'card dress' }, fig, h('div', { style: 'display:grid;gap:10px;width:100%' },
    h('div', null, h('b', null, '承接聖職的羊：血抹在三個地方'),
      h('p', { style: 'font-size:.88em;color:var(--ink-2);margin:2px 0 0' }, '都在身體的右邊。亞倫和他的兒子都一樣（利8:23-24）。')),
    btns, info, interpHeading(), ...BODY_VOICES.map(voiceBlock))));
}

/* ------------------------------------------------------------ 第八天與那把火 */

export function timeline(items: TimelineItem[]) {
  return h('div', { class: 'timeline' }, ...items.map((t) => h('div', { class: 'tl', 'data-who': t.who ?? '', 'data-id': t.id },
    h('div', { class: 'day' }, t.day), h('h4', null, t.title), h('p', null, factLine(t.fact)))));
}
