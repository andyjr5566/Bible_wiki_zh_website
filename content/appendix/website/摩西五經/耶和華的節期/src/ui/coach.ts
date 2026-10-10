/**
 * 新手導覽：<dialog> 三步。第一次造訪自動開，標題列的「怎麼讀」可以再開。
 * 看過的記號存在 localStorage（讀寫都包 try/catch）。Esc 可關。
 */
import { h, lsGet, lsSet, s } from './dom';

const SEEN_KEY = 'jf-coach-seen';

interface Step {
  title: string;
  body: string;
  figure: () => SVGElement | HTMLElement;
}

// 三段文字照規格一字不改
const STEPS: Step[] = [
  {
    title: '往下捲',
    body: '畫面跟著捲動前進。停下來，畫面也停。',
    figure: () =>
      s('svg', { viewBox: '0 0 160 84', width: 160, height: 84, 'aria-hidden': 'true', class: 'jf-coach-svg' },
        s('rect', { x: 62, y: 6, width: 36, height: 56, rx: 18, fill: 'none', stroke: 'currentColor', 'stroke-width': 3 }),
        s('rect', { x: 77, y: 16, width: 6, height: 12, rx: 3, fill: 'var(--jf-blood)' }),
        s('path', { d: 'M80 70 v10 M74 75 l6 6 l6 -6', fill: 'none', stroke: 'currentColor', 'stroke-width': 3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
        s('path', { d: 'M18 20 h28 M18 32 h20 M114 20 h28 M122 32 h20', fill: 'none', stroke: 'currentColor', 'stroke-width': 3, 'stroke-linecap': 'round', opacity: 0.55 })),
  },
  {
    title: '圓形徽章',
    body: '看到圓形徽章的地方可以動手，例如拿牛膝草打在門框上。不想做也可以直接往下捲。',
    figure: () => h('div', { class: 'jf-badge jf-badge-demo is-on', 'aria-hidden': 'true' }, h('span', null, '按住'), h('span', null, '拖曳')),
  },
  {
    title: '點開來看',
    body: '說明框下方的「四家怎麼說」和「原文」可以點開，看註釋的原句和希伯來文。',
    figure: () => h('div', { class: 'jf-coach-chips', 'aria-hidden': 'true' }, h('span', { class: 'jf-chip jf-chip-demo' }, '四家怎麼說'), h('span', { class: 'jf-chip jf-chip-demo' }, '原文')),
  },
];

export interface Coach {
  open(): void;
  /** 第一次造訪（沒有看過的記號）才自動打開 */
  openIfFirstVisit(): void;
}

export function createCoach(host: HTMLElement): Coach {
  const dialog = h('dialog', { class: 'jf-coach', 'aria-labelledby': 'jf-coach-title' });
  host.append(dialog);
  let step = 0;

  function close() {
    if (dialog.open) dialog.close();
  }

  function render() {
    const st = STEPS[step];
    const last = step === STEPS.length - 1;
    const primary = h('button', { type: 'button', class: 'jf-btn jf-btn-primary', onclick: () => (last ? close() : go(step + 1)) }, last ? '開始' : '下一步');
    dialog.replaceChildren(
      h('div', { class: 'jf-coach-card' },
        h('p', { class: 'jf-coach-step' }, `第 ${step + 1} 步`),
        h('div', { class: 'jf-coach-fig' }, st.figure()),
        h('h2', { class: 'jf-coach-title', id: 'jf-coach-title' }, st.title),
        h('p', { class: 'jf-coach-body' }, st.body),
        h('ol', { class: 'jf-coach-dots', 'aria-hidden': 'true' }, STEPS.map((_, i) => h('li', { class: i === step ? 'is-on' : '' }))),
        h('div', { class: 'jf-coach-actions' },
          last ? h('span') : h('button', { type: 'button', class: 'jf-btn', onclick: close }, '略過'),
          primary)),
    );
    return primary;
  }

  function go(n: number) {
    step = n;
    render().focus({ preventScroll: true });
  }

  dialog.addEventListener('close', () => {
    lsSet(SEEN_KEY, '1');
    document.documentElement.classList.remove('jf-lock');
  });
  // 點到對話框外面（背景）也關
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) close();
  });

  function open() {
    if (dialog.open) return;
    step = 0;
    const primary = render();
    document.documentElement.classList.add('jf-lock');
    try {
      dialog.showModal();
    } catch {
      dialog.setAttribute('open', '');
    }
    primary.focus({ preventScroll: true });
  }

  return {
    open,
    openIfFirstVisit() {
      if (lsGet(SEEN_KEY) === null) open();
    },
  };
}
