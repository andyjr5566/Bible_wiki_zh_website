import type { StoryState } from '../story/state';
import { h } from './dom';

interface CoachStepSpec {
  stageIdx: number;
  stageTitle: string;
  stepNum: number;
  prompt: string;
  explain: string;
  targetSelector?: string | ((state: StoryState) => string);
  checkDone(state: StoryState): boolean;
  action?: 'open-more' | 'enable-only-i';
  isSummary?: boolean;
}

const STEPS: CoachStepSpec[] = [
  // 第一段：故事（3 步 + 小結）
  {
    stageIdx: 1,
    stageTitle: '第 1 段・順讀 3D 故事',
    stepNum: 1,
    prompt: '請往下捲動畫面，從序幕讀到第一幕。',
    explain: '畫面跟著捲動走，也可以按頂列的『自動播放』慢慢看。',
    checkDone: (s) => s.segment !== 'prologue' || window.scrollY > window.innerHeight * 0.65,
  },
  {
    stageIdx: 1,
    stageTitle: '第 1 段・順讀 3D 故事',
    stepNum: 2,
    prompt: '點一下頂列的『目錄』，選『第五幕・寫下，立起』。',
    explain: '目錄列出序、六幕和終幕。下面的小字，是註釋把本章對照古代條約分成的幾段。',
    targetSelector: '[data-coach="toc-btn"]',
    checkDone: (s) => s.segment === 'act-5' || s.raiseStone.done,
  },
  {
    stageIdx: 1,
    stageTitle: '第 1 段・順讀 3D 故事',
    stepNum: 3,
    prompt: '往下捲到第26節，按住『按住，把石頭立起來』，直到石頭立好。',
    explain: '從第26節起，畫面就停在這塊大石頭旁邊。',
    targetSelector: '[data-coach="raise-btn"]',
    checkDone: (s) => s.raiseStone.done,
  },
  {
    stageIdx: 1,
    stageTitle: '第 1 段・小結',
    stepNum: 4,
    prompt: '小結：故事走完，整章 33 節就讀完了。',
    explain: '第1到33節的和合本經文，每一節都在故事裡出現。',
    checkDone: () => true,
    isSummary: true,
  },

  // 第二段：「更多」小卡（2 步 + 小結）
  {
    stageIdx: 2,
    stageTitle: '第 2 段・更多小卡',
    stepNum: 1,
    prompt: '點一下畫面右下角的『更多』。',
    explain: '各家怎麼說、希伯來原文、地名人名和條目連結，都收在這張小卡裡。按右上角的 × 或 Esc 就能關掉。',
    targetSelector: '.jos-panel-on [data-coach="more-btn"]',
    checkDone: (s) => s.moreOpen,
    action: 'open-more',
  },
  {
    stageIdx: 2,
    stageTitle: '第 2 段・更多小卡',
    stepNum: 2,
    prompt: '用目錄跳到第二幕（第2–13節），點更多，在小卡裡打開只留下神說『我』的地方。',
    explain: '第3到13節，神用我做主詞的動詞共有 20 個。打開以後，經文裡其餘的字變淡，地圖上會亮起 20 盞燈。',
    targetSelector: (s) =>
      s.moreOpen && s.segment === 'act-2'
        ? '.jos-more-card [data-coach="only-i-btn"]'
        : s.segment === 'act-2'
          ? '.jos-panel-on [data-coach="more-btn"]'
          : '[data-coach="toc-btn"]',
    checkDone: (s) => s.moreOpen && s.segment === 'act-2' && s.onlyI,
    action: 'enable-only-i',
  },
  {
    stageIdx: 2,
    stageTitle: '第 2 段・小結',
    stepNum: 3,
    prompt: '小結：經文會一句一句浮現；想看註釋、原文或地名，點『更多』。',
    explain: '想讀多少，就打開多少。',
    checkDone: () => true,
    isSummary: true,
  },

  // 第三段：整理區與返回書籤（3 步 + 小結）
  {
    stageIdx: 3,
    stageTitle: '第 3 段・整理區與來回查看',
    stepNum: 1,
    prompt: '點左側『事奉線』上任何一個結，或到整理區 01 點一個事奉的記號。',
    explain: '全章 16 次事奉、1 次為奴、1 次僕人，在希伯來文是同一個字根。',
    targetSelector: '[data-coach="thread-rail"]',
    checkDone: () => coachCustomFlags.clickedServeKnot,
  },
  {
    stageIdx: 3,
    stageTitle: '第 3 段・整理區與來回查看',
    stepNum: 2,
    prompt: '打開頂列的目錄，點最下面的前往整理區，再在整理區按任何一個『在故事裡看』。',
    explain: '從整理區跳回故事以後，畫面右下角會出現一個返回按鈕。',
    targetSelector: '[data-coach="jump-story-btn"]',
    checkDone: (s) => Boolean(s.returnSpot) || coachCustomFlags.usedJumpToStory,
  },
  {
    stageIdx: 3,
    stageTitle: '第 3 段・整理區與來回查看',
    stepNum: 3,
    prompt: '點右下角的『回到剛才讀的地方』。',
    explain: '點地名小卡上的『到地圖看』，也會出現這個返回按鈕。',
    targetSelector: '.jos-return-btn',
    checkDone: (s) => coachCustomFlags.usedReturnBookmark && !s.returnSpot,
  },
  {
    stageIdx: 3,
    stageTitle: '第 3 段・小結',
    stepNum: 4,
    prompt: '小結：故事和整理區可以隨時來回查看。',
    explain: '隨時可再點頂列的『新手教學』重看。',
    checkDone: () => true,
    isSummary: true,
  },
];

export const coachCustomFlags = {
  clickedServeKnot: false,
  usedJumpToStory: false,
  usedReturnBookmark: false,
};

export interface CoachController {
  element: HTMLElement;
  open(): void;
  close(): void;
  toggle(): void;
  isOpen(): boolean;
  notifyAction(): void;
}

export function createCoachPanel(state: StoryState): CoachController {
  let visible = false;
  let idx = 0;
  let completedCurrent = false;
  let performedAction = false;
  let pulsedEl: HTMLElement | null = null;

  const stageSpan = h('span', { className: 'jos-coach-stage' });
  const closeBtn = h('button', { type: 'button', className: 'jos-peek-close' }, '關閉教學');
  const promptP = h('p', { className: 'jos-coach-prompt' });
  const noteP = h('p', { className: 'jos-coach-note' });
  const statusSpan = h('span', { className: 'jos-widget-stat' });
  const nextBtn = h('button', { type: 'button', className: 'jos-primary-btn' }, '下一步 →');

  const bar = h(
    'aside',
    { className: 'jos-coach-bar jos-coach-hidden', 'aria-label': '新手教學引導面板' },
    h('div', { className: 'jos-coach-top' }, stageSpan, closeBtn),
    promptP,
    noteP,
    h('div', { className: 'jos-coach-actions' }, statusSpan, nextBtn),
  );

  function clearPulse(): void {
    if (pulsedEl) {
      pulsedEl.classList.remove('jos-coach-pulse');
      pulsedEl = null;
    }
  }

  function applyPulse(spec?: string | ((s: StoryState) => string)): void {
    clearPulse();
    if (!visible || !spec) return;
    const sel = typeof spec === 'function' ? spec(state) : spec;
    const found = document.querySelector<HTMLElement>(sel);
    if (found) {
      pulsedEl = found;
      pulsedEl.classList.add('jos-coach-pulse');
    }
  }

  function render(): void {
    bar.classList.toggle('jos-coach-hidden', !visible);
    if (!visible) {
      clearPulse();
      return;
    }

    const step = STEPS[idx];
    const doneNow = completedCurrent || ((!step.action || performedAction) && step.checkDone(state));
    completedCurrent = doneNow;

    const stageTotal = STEPS.filter((x) => x.stageIdx === step.stageIdx && !x.isSummary).length;
    stageSpan.textContent = step.isSummary
      ? step.stageTitle
      : `${step.stageTitle}（步驟 ${step.stepNum}/${stageTotal}）`;
    promptP.textContent = step.prompt;

    if (doneNow) {
      noteP.style.display = 'block';
      noteP.textContent = step.explain;
      statusSpan.textContent = step.isSummary ? '這一段完成了' : '做到了';
      nextBtn.style.display = 'inline-block';
      nextBtn.textContent = idx >= STEPS.length - 1 ? '完成教學' : '下一步 →';
      clearPulse();
    } else {
      noteP.style.display = 'none';
      statusSpan.textContent = '先照上面做一次，就會看到說明';
      nextBtn.style.display = 'none';
      applyPulse(step.targetSelector);
    }
  }

  nextBtn.addEventListener('click', () => {
    if (idx >= STEPS.length - 1) {
      visible = false;
      render();
      return;
    }
    idx += 1;
    completedCurrent = false;
    performedAction = false;
    render();
  });

  closeBtn.addEventListener('click', () => {
    visible = false;
    render();
  });

  // 既有開關狀態不算完成：必須在這一步親自按更多，或將小卡裡的開關打開。
  window.addEventListener('click', (event) => {
    if (!visible || !(event.target instanceof Element)) return;
    const action = STEPS[idx].action;
    if (action === 'open-more' && event.target.closest('.jos-panel-on [data-coach="more-btn"]') && state.moreOpen) {
      performedAction = true;
    } else if (action === 'enable-only-i' && event.target.closest('.jos-more-card [data-coach="only-i-btn"]') && state.onlyI) {
      performedAction = true;
    }
    render();
  });

  // 監聽 details 展開與一般點擊，偵測讀者操作（不替讀者捲動）
  window.addEventListener(
    'toggle',
    () => {
      if (visible) render();
    },
    true,
  );
  window.addEventListener(
    'scroll',
    () => {
      if (visible && !completedCurrent) render();
    },
    { passive: true },
  );

  return {
    element: bar,
    open() {
      visible = true;
      idx = 0;
      completedCurrent = false;
      performedAction = false;
      render();
    },
    close() {
      visible = false;
      render();
    },
    toggle() {
      if (visible) {
        visible = false;
        render();
      } else {
        visible = true;
        completedCurrent = false;
        performedAction = false;
        render();
      }
    },
    isOpen: () => visible,
    notifyAction() {
      if (visible) render();
    },
  };
}
