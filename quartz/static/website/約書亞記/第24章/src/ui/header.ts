import type { SiteData } from '../data/types';
import { scrollToElement } from '../story/scroll';
import { saveDarkMode, saveMotionOff, saveSoundOn, type StoryState } from '../story/state';
import { coachCustomFlags } from './coach';
import { h } from './dom';
import { reviewNavigate } from './review-navigation';
import { PLAYBACK_SPEEDS, parsePlaybackRate, savePlaybackRate } from '../story/playback-speed';

const SHORT_LABELS: Record<string, string> = {
  prologue: '序',
  'act-1': '一',
  'act-2': '二',
  'act-3': '三',
  'act-4': '四',
  'act-5': '五',
  'act-6': '六',
  epilogue: '終',
};

export interface HeaderController {
  headerEl: HTMLElement;
  returnBarEl: HTMLElement;
  sync(): void;
}

export function createHeader(
  data: SiteData,
  state: StoryState,
  onThemeOrMotionChange: () => void,
  onToggleCoach?: () => void,
  onSoundToggle?: () => void,
): HeaderController {
  const brandBtn = h('button', { type: 'button', className: 'jos-brand-btn' }, data.meta.title);
  brandBtn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: state.motionOff ? 'auto' : 'smooth' });
  });

  // 目錄下拉選單（七段路線＋條約四段與跋文小字註記＋整理區入口）
  let tocOpen = false;
  const tocBtn = h(
    'button',
    { type: 'button', className: 'jos-tool-btn', 'data-coach': 'toc-btn', 'aria-expanded': 'false' },
    '目錄 ▾',
  );
  const tocList = h('div', { className: 'jos-toc-list' });
  const tocItems = new Map<string, HTMLButtonElement>();

  const closeToc = () => {
    tocOpen = false;
    tocPopover.classList.add('jos-toc-hidden');
    tocBtn.setAttribute('aria-expanded', 'false');
  };

  for (const seg of data.segments) {
    const itemBtn = h(
      'button',
      { type: 'button', className: 'jos-toc-item' },
      h('span', { className: 'jos-toc-kicker' }, `${seg.label}・${seg.rangeLabel}`),
      h('span', { className: 'jos-toc-name' }, seg.title),
    );
    itemBtn.addEventListener('click', () => {
      closeToc();
      const target = document.getElementById(`jos-seg-${seg.id}`);
      scrollToElement(target, state, undefined, sync);
    });
    tocItems.set(seg.id, itemBtn);
    tocList.appendChild(itemBtn);
  }

  const treatySubNote = h(
    'div',
    { className: 'jos-toc-treaty' },
    'GT《雷氏研讀本》把本章對照古代條約分段：前言（1–2）｜歷史序言（2–13）｜主要條款（14–24）｜契約的抄寫和存放（25–28）。CT：29–33 節是跋文。',
  );

  const reviewJumpInToc = h(
    'button',
    { type: 'button', className: 'jos-secondary-btn' },
    '前往整理區（01–07 與思想問題） ↓',
  );
  reviewJumpInToc.addEventListener('click', () => {
    closeToc();
    const target = document.getElementById('jos-review-root');
    reviewNavigate(target, state, sync, true);
  });

  const tocPopover = h(
    'div',
    { className: 'jos-toc-popover jos-toc-hidden', role: 'dialog', 'aria-label': '章節目錄' },
    tocList,
    treatySubNote,
    reviewJumpInToc,
  );

  tocBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    tocOpen = !tocOpen;
    tocPopover.classList.toggle('jos-toc-hidden', !tocOpen);
    tocBtn.setAttribute('aria-expanded', tocOpen ? 'true' : 'false');
  });

  window.addEventListener('click', (e) => {
    if (!tocOpen) return;
    const t = e.target as Node | null;
    if (t && !tocWrap.contains(t)) {
      closeToc();
    }
  });

  const tocWrap = h('div', { className: 'jos-toc-wrap' }, tocBtn, tocPopover);

  // 桌機快速段落鈕
  const segNav = h('nav', { className: 'jos-seg-nav', 'aria-label': '章節段落快速導覽' });
  const segButtons = new Map<string, HTMLButtonElement>();

  for (const seg of data.segments) {
    const label = SHORT_LABELS[seg.id] ?? seg.label;
    const btn = h(
      'button',
      {
        type: 'button',
        className: 'jos-seg-btn',
        title: `${seg.label}・${seg.title}`,
      },
      label,
    );
    btn.addEventListener('click', () => {
      const target = document.getElementById(`jos-seg-${seg.id}`);
      scrollToElement(target, state, undefined, sync);
    });
    segButtons.set(seg.id, btn);
    segNav.appendChild(btn);
  }

  const coachBtn = h(
    'button',
    { type: 'button', className: 'jos-coach-trigger' },
    '新手教學',
  );
  coachBtn.addEventListener('click', () => {
    onToggleCoach?.();
  });

  const reviewJumpBtn = h('button', { type: 'button', className: 'jos-tool-btn' }, '整理區');
  reviewJumpBtn.addEventListener('click', () => {
    const target = document.getElementById('jos-review-root');
    reviewNavigate(target, state, sync, true);
  });

  const motionBtn = h('button', { type: 'button', className: 'jos-tool-btn' }, '動態：開');
  motionBtn.addEventListener('click', () => {
    state.motionOff = !state.motionOff;
    saveMotionOff(state.motionOff);
    onThemeOrMotionChange();
    sync();
  });

  const soundBtn = h('button', { type: 'button', className: 'jos-tool-btn' }, '聲音：關');
  const autoplayBtn = h('button', { type: 'button', className: 'jos-tool-btn jos-autoplay', 'aria-pressed': 'false' }, '自動播放');
  const speedSelect = h('select', { className: 'jos-speed-select', 'aria-label': '播放速度' },
    ...PLAYBACK_SPEEDS.map(option => h('option', { value: String(option.value) }, `速度：${option.label}`)),
  );
  speedSelect.value = String(state.playbackRate);
  speedSelect.addEventListener('change', () => {
    state.playbackRate = parsePlaybackRate(speedSelect.value);
    savePlaybackRate(state.playbackRate);
  });
  const playbackControls = h('div', { className: 'jos-playback-controls' }, autoplayBtn, speedSelect);
  soundBtn.addEventListener('click', () => {
    state.soundOn = !state.soundOn;
    saveSoundOn(state.soundOn);
    onSoundToggle?.();
    sync();
  });

  const themeBtn = h('button', { type: 'button', className: 'jos-tool-btn' }, '深色');
  themeBtn.addEventListener('click', () => {
    state.dark = !state.dark;
    saveDarkMode(state.dark);
    onThemeOrMotionChange();
    sync();
  });

  const headerEl = h(
    'header',
    { className: 'jos-header' },
    h(
      'div',
      { className: 'jos-header-inner' },
      h('div', { className: 'jos-header-left' }, brandBtn, tocWrap, segNav),
      h(
        'div',
        { className: 'jos-header-tools' },
        coachBtn,
        playbackControls,
        reviewJumpBtn,
        motionBtn,
        soundBtn,
        themeBtn,
      ),
    ),
  );

  const returnLabelBtn = h('button', { type: 'button', className: 'jos-return-btn' }, '← 回到剛才讀的地方');
  returnLabelBtn.addEventListener('click', () => {
    coachCustomFlags.usedReturnBookmark = true;
    if (!state.returnSpot) return;
    const top = state.returnSpot.scrollY;
    state.returnSpot = null;
    window.scrollTo({ top, behavior: 'instant' });
    sync();
  });
  const returnCloseBtn = h(
    'button',
    { type: 'button', className: 'jos-return-close', 'aria-label': '關閉返回提示' },
    '×',
  );
  returnCloseBtn.addEventListener('click', () => {
    state.returnSpot = null;
    sync();
  });

  const returnBarEl = h(
    'div',
    { className: 'jos-return-bar jos-return-bar-hidden' },
    returnLabelBtn,
    returnCloseBtn,
  );

  function sync(): void {
    for (const [id, btn] of segButtons.entries()) {
      btn.classList.toggle('jos-seg-btn-active', state.segment === id);
    }
    for (const [id, item] of tocItems.entries()) {
      item.classList.toggle('jos-toc-item-active', state.segment === id);
    }

    soundBtn.textContent = !state.soundOn ? '聲音：關' : state.audioReady ? '聲音：開' : '聲音：點一下';
    soundBtn.classList.toggle('jos-tool-btn-on', state.soundOn);

    motionBtn.textContent = state.motionOff ? '動態：關' : '動態：開';
    motionBtn.classList.toggle('jos-tool-btn-on', !state.motionOff);

    themeBtn.textContent = state.dark ? '淺色' : '深色';
    themeBtn.classList.toggle('jos-tool-btn-on', state.dark);

    if (state.returnSpot) {
      returnLabelBtn.textContent = '← 回到剛才讀的地方';
      returnBarEl.classList.remove('jos-return-bar-hidden');
    } else {
      returnBarEl.classList.add('jos-return-bar-hidden');
    }
  }

  sync();
  // The header wraps on portrait phones. Measure the real height without changing its min-height.
  const headerObserver = new ResizeObserver(() => {
    const height = Math.ceil(headerEl.getBoundingClientRect().height);
    document.documentElement.style.setProperty('--jos-header-measured-h', `${height}px`);
  });
  headerObserver.observe(headerEl);

  return {
    headerEl,
    returnBarEl,
    sync,
  };
}
