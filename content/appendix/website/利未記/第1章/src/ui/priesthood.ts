import VERSES from '../data/verses.json';
import {
  AARON_ORDER, BODY_MARKS, BODY_VOICES, EIGHTH_DAY, EIGHTH_DAY_ORDER_VOICES, GARMENTS, GARMENT_FACTS, GARMENT_VOICES,
  ORDINATION, SEVEN_DAYS, SONS_ORDER, type TimelineItem,
} from '../data/priesthood';
import { fill, h, motionOff, svg, wait } from './dom';
import { factLine, interpHeading, refChips, voiceBlock } from './evidence';
import { ICONS } from './icons';
import { Player } from './player';

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

function mountDress(host: HTMLElement) {
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

function mountMarks(host: HTMLElement) {
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

function timeline(items: TimelineItem[]) {
  return h('div', { class: 'timeline' }, ...items.map((t) => h('div', { class: 'tl', 'data-who': t.who ?? '', 'data-id': t.id },
    h('div', { class: 'day' }, t.day), h('h4', null, t.title), h('p', null, factLine(t.fact)))));
}

function finaleSvg(): string {
  const people = Array.from({ length: 11 }, (_, i) => {
    const x = 30 + i * 52;
    return `<g class="person" data-i="${i}" transform="translate(${x} 250)"><circle cx="0" cy="-34" r="8" fill="var(--ink-2)"/><path d="M-10 0l4-26h12l4 26z" fill="var(--ink-2)"/></g>`;
  }).join('');
  return `
<svg viewBox="0 0 600 300" preserveAspectRatio="xMidYMid slice" role="img" aria-label="第八天：火從耶和華面前出來，燒盡壇上的燔祭">
  <defs>
    <linearGradient id="sky8" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b2238"/><stop offset="1" stop-color="#8a5a3a"/></linearGradient>
    <radialGradient id="glory"><stop offset="0" stop-color="#fff4c2"/><stop offset=".5" stop-color="#ffd27a" stop-opacity=".6"/><stop offset="1" stop-color="#ffb14a" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="600" height="300" fill="url(#sky8)"/>
  <rect y="230" width="600" height="70" fill="#6b5236"/>
  <g id="tent"><rect x="70" y="110" width="170" height="120" fill="#4a3a2e"/><rect x="70" y="104" width="170" height="10" fill="#8c3b2e"/><rect x="226" y="120" width="14" height="110" fill="#3553a0"/></g>
  <circle id="glow8" cx="240" cy="160" r="10" fill="url(#glory)" opacity="0"/>
  <g id="altar8" transform="translate(380 176)">
    <rect x="-50" y="0" width="100" height="56" fill="#9a5a2a" stroke="#6e4526" stroke-width="3"/>
    <path d="M-50 0l-6-14 12 0zM50 0l6-14-12 0z" fill="#b0703a"/>
    <rect x="-34" y="-10" width="68" height="10" rx="3" fill="#c98a52"/>
  </g>
  <path id="bolt" d="M240 160 C 300 100, 340 110, 380 166" fill="none" stroke="#ffd27a" stroke-width="10" stroke-linecap="round" opacity="0"/>
  <g id="fire8" transform="translate(380 170)" opacity="0">
    <path d="M0-80c10 22 38 36 38 70A38 38 0 0 1-38-10c0-20 14-28 14-42 8 8 12 16 16 24 8-16 8-36 8-52z" fill="#ff8a2a"/>
    <path d="M0-50c6 14 22 22 22 42A22 22 0 0 1-22-8c0-12 8-16 8-24 5 5 7 10 9 14 5-9 5-20 5-32z" fill="#ffe08a"/>
  </g>
  ${people}
</svg>`;
}

function mountFinale(host: HTMLElement) {
  const fig = svg(finaleSvg());
  fig.removeAttribute('aria-hidden');
  const v = (VERSES as Record<string, string>)['利9:24'];
  const caption = h('div', { class: 'caption' }, h('span', { class: 'q' }, v), ' ', ...refChips(['利9:24']));
  const play = h('button', { class: 'btn primary play', type: 'button', onclick: () => go() }, svg(ICONS.fire), '看第八天的結局');
  const box = h('div', { class: 'card finale' }, fig, play, caption);
  host.append(box);

  async function go() {
    box.classList.add('go');
    const tl = host.closest('.pr-block')?.querySelectorAll<HTMLElement>('.tl') ?? [];
    for (const t of tl) { t.classList.add('lit'); await wait(180); }
    const glow = fig.querySelector<SVGCircleElement>('#glow8')!;
    const bolt = fig.querySelector<SVGPathElement>('#bolt')!;
    const fire = fig.querySelector<SVGGElement>('#fire8')!;
    if (motionOff()) {
      glow.setAttribute('opacity', '1'); glow.setAttribute('r', '120'); fire.setAttribute('opacity', '1');
      fig.querySelectorAll<SVGGElement>('.person').forEach((p) => p.setAttribute('transform', p.getAttribute('transform') + ' rotate(70 0 0)'));
      return;
    }
    glow.animate([{ opacity: 0, r: '10' }, { opacity: 1, r: '140' }], { duration: 1400, fill: 'forwards', easing: 'ease-out' });
    await wait(900);
    const len = bolt.getTotalLength();
    bolt.style.strokeDasharray = `${len}`;
    bolt.animate([{ strokeDashoffset: len, opacity: 1 }, { strokeDashoffset: 0, opacity: 1 }, { opacity: 0 }], { duration: 900, fill: 'forwards' });
    await wait(700);
    fire.animate([{ opacity: 0, transform: 'translate(380px,170px) scale(.2)' }, { opacity: 1, transform: 'translate(380px,170px) scale(1)' }, { opacity: 1, transform: 'translate(380px,170px) scale(.8)' }], { duration: 900, fill: 'forwards' });
    await wait(800);
    fig.querySelectorAll<SVGGElement>('.person').forEach((p, i) => {
      const base = p.getAttribute('transform')!;
      const x = +/translate\((\d+)/.exec(base)![1];
      p.animate([{ transform: `translate(${x}px,250px)` }, { transform: `translate(${x}px,250px) translateY(-6px)` }, { transform: `translate(${x}px,262px) rotate(75deg)` }],
        { duration: 1100, delay: i * 60, fill: 'forwards', easing: 'ease-in-out' });
    });
  }
}

/* ------------------------------------------------------------ mount */

export function mountPriesthood(host: HTMLElement) {
  // 1. 七天
  const seven = h('div', { class: 'card', style: 'padding:16px' }, h('h3', { style: 'font-size:1.1em;margin-bottom:8px' }, '承接聖職的七天（利8）'), timeline(SEVEN_DAYS));
  const dressHost = h('div');
  mountDress(dressHost);
  host.append(h('div', { class: 'pr-grid' }, seven, dressHost));

  // 2. 三隻祭牲：摩西擔任祭司
  const player = new Player({ compactList: true });
  const choose = h('div', { class: 'axis', role: 'group', 'aria-label': '選一隻祭牲' }, h('span', null, '三隻祭牲'));
  const load = (i: number) => {
    choose.querySelectorAll('button').forEach((b, j) => b.setAttribute('aria-pressed', String(i === j)));
    player.load(ORDINATION[i], 'var(--priest)');
  };
  ORDINATION.forEach((v, i) => choose.append(h('button', { class: 'opt', type: 'button', onclick: () => load(i) }, `${i + 1}. ${v.label}`)));
  host.append(h('h3', { style: 'margin:30px 0 6px' }, '三隻祭牲，由摩西來獻'),
    h('p', { style: 'color:var(--ink-2);font-size:.92em;max-width:760px' }, '亞倫和他兒子還沒有承接聖職，這一天由摩西做祭司的工作。先贖罪祭，再燔祭，最後是承接聖職的羊。'),
    h('div', { class: 'axes' }, choose), player.el);
  load(0);

  // 3. 抹血
  const marksHost = h('div', { style: 'margin-top:16px' });
  mountMarks(marksHost);

  // 4. 第八天
  const eighth = h('div', { class: 'card pr-block', style: 'padding:16px' },
    h('h3', { style: 'font-size:1.1em;margin-bottom:4px' }, '第八天：亞倫第一次獻祭（利9）'),
    h('p', { style: 'font-size:.85em;color:var(--ink-2)' }, h('span', { style: 'color:var(--sin);font-weight:700' }, '■ 先為自己'), '　', h('span', { style: 'color:var(--peace);font-weight:700' }, '■ 再為百姓')),
    timeline(EIGHTH_DAY), interpHeading(), ...EIGHTH_DAY_ORDER_VOICES.map(voiceBlock));
  const finaleHost = h('div', { style: 'display:grid;gap:12px;align-content:start' });
  mountFinale(finaleHost);
  finaleHost.append(h('p', { style: 'font-size:.85em;color:var(--ink-3)' }, '這把火從哪裡來？經文沒說。註釋家有四種讀法，見下一區「經文沒說的事」。'));
  eighth.append(finaleHost);
  host.append(marksHost, h('div', { style: 'margin-top:16px' }, eighth));
  // 讓 finale 能點亮第八天的時間軸
  finaleHost.classList.add('pr-block');
  const fin = finaleHost.querySelector('.finale')!;
  fin.addEventListener('click', () => eighth.querySelectorAll('.tl').forEach((t, i) => setTimeout(() => t.classList.add('lit'), motionOff() ? 0 : i * 180)), { once: true });
}
