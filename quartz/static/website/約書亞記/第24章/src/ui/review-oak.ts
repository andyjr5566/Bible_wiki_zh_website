import type { SiteData } from '../data/types';
import type { StoryState } from '../story/state';
import { h, renderCommentaryCard, renderRichText } from './dom';
import type { PeekController } from './peek';

/** Three replaceable 2D states. A future rendered frame can replace the diagram alone. */
export function createOakSlider(data: SiteData, state: StoryState, peek: PeekController): HTMLElement {
  const slider = h('input', { className: 'jos-oak-range', type: 'range', min: '0', max: '2', step: '1', value: String(state.oakSlider), 'aria-label': '橡樹下的三個時候' });
  const tabs = h('div', { className: 'jos-oak-tabs', role: 'group', 'aria-label': '選擇橡樹下的時刻' });
  const art = h('div', { className: 'jos-oak-diagram' });
  // Deliberately a flat diagram; the tree stays in place for all three moments.
  art.innerHTML = `<svg viewBox="0 0 640 230" role="img" aria-label="橡樹下的三個時候示意"><path class="jos-oak-ground" d="M30 207H610"/><path class="jos-oak-trunk" d="M312 203L316 110M316 154L274 111M317 135L361 94M316 117L302 77"/><path class="jos-oak-crown" d="M210 117C179 102 195 61 232 61C219 28 275 14 298 37C316 6 370 20 375 49C420 35 452 75 426 101C450 131 395 157 367 134C335 162 300 141 278 139C245 162 203 148 210 117Z"/><g class="jos-oak-era" data-era="0"><path class="jos-oak-object" d="M394 194H444V207H394ZM400 182H438V194H400ZM406 174H432V182H406Z"/></g><g class="jos-oak-era" data-era="1"><path class="jos-oak-buried" d="M386 207Q415 234 444 207M398 214H428"/><path class="jos-oak-object" d="M394 188L410 175L427 188Z"/><circle class="jos-oak-ring" cx="436" cy="190" r="7"/></g><g class="jos-oak-era" data-era="2"><path class="jos-oak-object" d="M392 206L397 145L414 136L434 147L440 206Z"/></g></svg>`;
  const detail = h('div', { className: 'jos-oak-detail' });
  const panels: HTMLElement[] = [];
  const buttons: HTMLButtonElement[] = [];
  data.oakMoments.forEach((moment, index) => {
    const button = h('button', { type: 'button', className: 'jos-oak-tab', 'aria-pressed': 'false' },
      h('span', { className: 'jos-oak-era-ref' }, moment.ref), moment.title);
    button.addEventListener('click', () => select(index));
    buttons.push(button); tabs.append(button);
    const verse = h('button', { type: 'button', className: 'jos-text-action' }, `閱讀經文：${moment.ref} ↗`);
    verse.addEventListener('click', () => peek.openVerse(moment.ref));
    const panel = h('div', { className: 'jos-oak-moment' }, h('p', null, renderRichText(moment.summary)), verse);
    panels.push(panel); detail.append(panel);
  });
  function select(index: number): void {
    state.oakSlider = Math.max(0, Math.min(2, index));
    slider.value = String(state.oakSlider);
    slider.setAttribute('aria-valuetext', data.oakMoments[state.oakSlider].title);
    buttons.forEach((button, i) => button.setAttribute('aria-pressed', String(i === state.oakSlider)));
    panels.forEach((panel, i) => { panel.hidden = i !== state.oakSlider; });
    art.querySelectorAll<SVGElement>('[data-era]').forEach(node => { node.style.display = +node.dataset.era! === state.oakSlider ? '' : 'none'; });
  }
  slider.addEventListener('input', () => select(+slider.value));
  select(state.oakSlider);
  return h('div', { className: 'jos-oak-slider-box' },
    h('h3', { className: 'jos-oak-title' }, '同一棵橡樹，三個時候'),
    h('div', { className: 'jos-oak-layout' }, art, h('div', { className: 'jos-oak-controls' }, slider, tabs, detail)),
    renderCommentaryCard(data.oakSameTreeNote));
}
