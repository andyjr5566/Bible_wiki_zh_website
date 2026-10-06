import type { Reel } from '../data/types';
import type { Camp } from '../three/camp';
import { animOff, fill, h, svg, wait } from './dom';
import { factLine, quietBadge, refChips, voiceBlock } from './evidence';
import { ICONS } from './icons';

/**
 * 3D 故事：一步一步在營地裡演出來。
 * 桌機：左邊 3D、右邊字幕欄，字幕不壓畫面；窄螢幕：字幕在 3D 下面。
 * 演完一步直接接下一步，不另外停頓。不支援 WebGL 的裝置改成一格一格的分鏡卡。
 */
export function mountReel(reel: Reel): { el: HTMLElement } {
  const canvasHost = h('div', { class: 'th-canvas' });
  const tags = h('div', { class: 'labels3d' });
  const loading = h('div', { class: 'th-loading' }, '3D 營地載入中…');
  const stageEl = h('div', { class: 'th-stage' }, canvasHost, tags, loading);
  const cap = h('div', { class: 'th-cap', 'aria-live': 'polite' });
  const icon = (n: string) => svg(ICONS[n]);
  const btnPrev = h('button', { class: 'btn', type: 'button', 'aria-label': '上一步', onclick: () => stepBy(-1) }, icon('prev'));
  const btnPlay = h('button', { class: 'btn primary', type: 'button', onclick: () => toggle() });
  const btnNext = h('button', { class: 'btn', type: 'button', 'aria-label': '下一步', onclick: () => stepBy(1) }, icon('next'));
  const btnReset = h('button', { class: 'btn', type: 'button', 'aria-label': '從頭開始', onclick: () => { stop(); go(-1); } }, icon('reset'));
  const dots = h('div', { class: 'th-dots', role: 'group', 'aria-label': '跳到第幾步' });
  const bar = h('div', { class: 'th-bar' }, btnPrev, btnPlay, btnNext, btnReset);
  const panel = h('div', { class: 'th-panel' },
    h('div', { class: 'th-title' }, h('span', { class: 'story-tag' }, svg(ICONS.family), '示意情境'), h('b', null, reel.title)),
    cap, bar, dots);
  const el = h('section', { class: 'theater', style: `--c:${reel.color}`, 'aria-label': `${reel.title}：3D 故事` }, stageEl, panel);

  let camp: Camp | null = null;
  let i = -1;
  let playing = false;
  let token = 0;
  const beats = reel.beats;

  function renderPlay() {
    btnPlay.replaceChildren(icon(playing ? 'pause' : 'play'), playing ? '暫停' : i < 0 ? '開始看' : i >= beats.length - 1 ? '重看' : '繼續');
    btnPrev.disabled = i < 0;
    btnNext.disabled = i >= beats.length - 1;
  }

  function renderCaption() {
    dots.replaceChildren(...beats.map((b, k) => h('button', {
      type: 'button', class: `th-dot${k <= i ? ' done' : ''}`,
      title: `${k + 1}. ${b.story}`, 'aria-label': `第 ${k + 1} 步：${b.story}`, 'aria-current': k === i ? 'step' : null,
      onclick: () => { stop(); go(k); },
    }, String(k + 1))));
    const b = beats[i];
    if (!b) {
      fill(cap,
        h('div', { class: 'th-text' }, '我們用營中的一家人為例子。按「開始看」，看這一天發生了什麼；每一步下面附上經文。'),
        h('p', { class: 'th-note' }, '這家人是虛構的，他們遇到的事都照經文的規矩處理。'));
      return;
    }
    fill(cap,
      h('div', { class: 'th-who' }, h('span', { class: 'th-time' }, svg(ICONS.clock), b.time), h('span', { class: 'th-n' }, `${i + 1} / ${beats.length}`)),
      h('div', { class: 'th-text' }, b.story),
      h('div', { class: 'th-rule' },
        h('small', null, '經文怎麼說'),
        h('div', null, b.rule.q ? h('span', { class: 'q' }, b.rule.q) : b.rule.text, ' ', ...refChips(b.rule.refs, b.rule.q), ' ', quietBadge(b.rule.status)),
        b.rule.q ? h('div', { class: 'th-plain' }, factLine({ ...b.rule, refs: [] })) : null),
      b.voice ? h('details', { class: 'th-voice' }, h('summary', null, '註釋家補一句'), voiceBlock(b.voice)) : null,
      i === beats.length - 1 && reel.next ? h('p', { class: 'th-next' }, h('span', { class: 'th-next-arrow' }, svg(ICONS.chev)), reel.next) : null);
  }

  async function go(n: number, animate = true) {
    const my = playing ? token : ++token;
    i = n;
    renderCaption();
    renderPlay();
    if (!camp) return;
    await camp.stop();
    if (my !== token) return;
    camp.reset();
    for (let j = 0; j < n; j++) await camp.play(beats[j], false);
    if (my !== token) return;
    if (n < 0) { camp.view('campE', !animate); return; }
    await camp.play(beats[n], animate && !animOff());
    // 最後一步演完：讓下面的內容接上來（不捲動頁面）
    if (n === beats.length - 1 && my === token && animate) el.dispatchEvent(new CustomEvent('reel-end'));
  }

  function stepBy(d: number) {
    stop();
    go(Math.max(-1, Math.min(beats.length - 1, i + d)));
  }

  function stop() {
    playing = false;
    token++;
    renderPlay();
  }

  async function toggle() {
    if (playing) return stop();
    playing = true;
    const my = ++token;
    if (i >= beats.length - 1) i = -1;
    renderPlay();
    while (playing && my === token && i < beats.length - 1) {
      // 讀字幕的時間和動畫同時起算：動畫夠長就直接接下一步，太短才補足。
      // 故事一秒讀約九個字；經文摘句通常短，一秒約十四個字
      const b = beats[i + 1];
      const read = 1400 + b.story.length * 110 + (b.rule.q?.length ?? 0) * 70;
      await Promise.all([go(i + 1), wait(read)]);
      if (my !== token) return;
    }
    if (my === token) stop();
  }

  renderCaption();
  renderPlay();

  const canWebGL = (() => {
    try {
      const c = document.createElement('canvas');
      return !!(c.getContext('webgl2') || c.getContext('webgl'));
    } catch {
      return false;
    }
  })();
  const fallback = (why: string) => {
    el.classList.add('flat');
    el.replaceChildren(h('div', { class: 'wrap' },
      h('p', { class: 'th-fallback' }, why),
      h('ol', { class: 'storyboard' }, ...beats.map((b) => h('li', { class: 'card' },
        h('span', { class: 'th-time' }, b.time),
        h('p', { class: 'th-text' }, b.story),
        h('p', null, factLine(b.rule, { quote: true })))))));
  };
  const idle = (window as unknown as { requestIdleCallback?: (f: () => void) => void }).requestIdleCallback ?? ((f: () => void) => setTimeout(f, 200));
  if (!canWebGL) fallback('這台裝置不支援 3D，改用分鏡卡一格一格看。');
  else idle(async () => {
    try {
      const { createCamp } = await import('../three/camp');
      const lowPower = (navigator.hardwareConcurrency ?? 8) <= 4 || matchMedia('(max-width: 560px)').matches;
      camp = await createCamp(canvasHost, tags, { reducedMotion: animOff(), lowPower });
      loading.remove();
      go(i, false);
    } catch (err) {
      console.error(err);
      fallback('3D 載入失敗，改用分鏡卡一格一格看。');
    }
  });

  el.addEventListener('keydown', (e) => {
    if ((e.target as HTMLElement).closest('input,textarea')) return;
    if (e.key === 'ArrowRight') { stepBy(1); e.preventDefault(); }
    if (e.key === 'ArrowLeft') { stepBy(-1); e.preventDefault(); }
  });

  return { el };
}
