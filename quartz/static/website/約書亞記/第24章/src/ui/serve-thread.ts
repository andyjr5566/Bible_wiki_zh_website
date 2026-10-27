import type { ServeKnotItem, SiteData } from '../data/types';
import { scrollToElement } from '../story/scroll';
import type { StoryState } from '../story/state';
import { coachCustomFlags } from './coach';
import { h } from './dom';

const KIND_LABELS: Record<ServeKnotItem['kind'], string> = {
  yhwh: '事奉耶和華',
  'other-gods': '事奉別神',
  bondage: '埃及為奴',
  servant: '神的僕人',
};

function findBeatIdForVerse(data: SiteData, verseNum: number): string | null {
  for (const seg of data.segments) {
    for (const b of seg.beats) {
      if (!b.verse) continue;
      const m = /^書24:(\d+)(?:-(\d+))?$/.exec(b.verse);
      if (!m) continue;
      const lo = Number(m[1]);
      const hi = m[2] ? Number(m[2]) : lo;
      if (verseNum >= lo && verseNum <= hi) return b.id;
    }
  }
  return null;
}

export interface ServeThreadController {
  element: HTMLElement;
  setHidden(hidden: boolean): void;
  sync(): void;
}

export function createServeThread(
  data: SiteData,
  state: StoryState,
  onStateChange: () => void,
): ServeThreadController {
  let drawerOpen = false;

  const toggleBtn = h(
    'button',
    {
      type: 'button',
      className: 'jos-thread-toggle',
      title: '展開或收合：本章 18 處事奉、為奴、僕人',
      'aria-expanded': 'false',
    },
    '事奉線',
  );

  const cord = h('div', { className: 'jos-thread-cord' }, toggleBtn);
  const knotsWrap = h('div', { className: 'jos-thread-knots' });

  const pipItems: { beatId: string | null; pip: HTMLButtonElement; btn: HTMLButtonElement }[] = [];

  for (const knot of data.step.serveKnots) {
    const beatId = findBeatIdForVerse(data, knot.verse);
    const affBadge = knot.affirmationOrder ? `（第${knot.affirmationOrder}次答應）` : '';

    const pip = h(
      'button',
      {
        type: 'button',
        className: `jos-knot-pip jos-knot-pip-${knot.kind}`,
        title: `書24:${knot.verse} ${knot.cuvWord}｜${KIND_LABELS[knot.kind]}${affBadge}`,
      },
      knot.affirmationOrder ? String(knot.affirmationOrder) : '',
    );

    const btn = h(
      'button',
      {
        type: 'button',
        className: `jos-knot-btn jos-knot-${knot.kind}`,
        title: `書24:${knot.verse}｜${KIND_LABELS[knot.kind]}`,
      },
      h('span', { className: 'jos-knot-dot' }),
      h('span', null, `24:${knot.verse} ${knot.cuvWord}${affBadge}`),
    );

    const jump = () => {
      coachCustomFlags.clickedServeKnot = true;
      drawerOpen = false;
      drawer.classList.add('jos-thread-drawer-hidden');
      toggleBtn.setAttribute('aria-expanded', 'false');
      if (!beatId) return;
      const el = document.getElementById(`jos-beat-${beatId}`);
      scrollToElement(el, state, undefined, onStateChange);
    };

    pip.addEventListener('click', jump);
    btn.addEventListener('click', jump);

    cord.appendChild(pip);
    knotsWrap.appendChild(btn);
    pipItems.push({ beatId, pip, btn });
  }

  const drawer = h(
    'div',
    { className: 'jos-thread-drawer jos-thread-drawer-hidden' },
    h('h2', { className: 'jos-thread-title' }, '一條字根的線'),
    h(
      'p',
      { className: 'jos-thread-sub' },
      '全章 16 次『事奉』，以及第17節的為奴、第29節耶和華的僕人，在希伯來原文是同一個字根。點任何一個結，就跳到那一節。',
    ),
    knotsWrap,
  );

  toggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    drawerOpen = !drawerOpen;
    drawer.classList.toggle('jos-thread-drawer-hidden', !drawerOpen);
    toggleBtn.setAttribute('aria-expanded', drawerOpen ? 'true' : 'false');
  });

  window.addEventListener('click', (e) => {
    if (!drawerOpen) return;
    const t = e.target as Node | null;
    if (t && !rail.contains(t)) {
      drawerOpen = false;
      drawer.classList.add('jos-thread-drawer-hidden');
      toggleBtn.setAttribute('aria-expanded', 'false');
    }
  });

  const rail = h(
    'aside',
    {
      className: 'jos-thread-rail',
      'data-coach': 'thread-rail',
      'aria-label': '事奉與僕人字根貫穿線',
    },
    cord,
    drawer,
  );

  function sync(): void {
    for (const item of pipItems) {
      const active = item.beatId === state.beat;
      item.pip.classList.toggle('jos-knot-pip-active', active);
      item.btn.classList.toggle('jos-knot-active', active);
    }
  }

  function setHidden(hidden: boolean): void {
    rail.classList.toggle('jos-thread-rail-hidden', hidden);
  }

  sync();

  return {
    element: rail,
    setHidden,
    sync,
  };
}
