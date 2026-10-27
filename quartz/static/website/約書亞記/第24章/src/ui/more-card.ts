import { genealogyUrl, wildernessUrl } from '../data/links';
import type { CommentaryItem, SiteData, StoryBeat, StorySegment } from '../data/types';
import type { StoryState } from '../story/state';
import { h, renderCommentaryCard, renderRichText } from './dom';
import type { PeekController } from './peek';

export const SPEAKER_NAMES = {
  grandfather: '爺爺',
  father: '父親',
  daughter: '女兒',
} as const;

export interface MoreContext {
  data: SiteData;
  state: StoryState;
  peek: PeekController;
  onStateChange: () => void;
  rerenderHighlights: () => void;
  /** 開關按鈕的亮暗狀態同步函式（rerenderHighlights 時一併呼叫） */
  toggleSyncs: (() => void)[];
}

/** 這一拍有沒有可放進「更多」的內容 */
export function beatHasMore(beat: StoryBeat, seg: StorySegment, primaryRef: string | undefined): boolean {
  if (seg.id === 'act-2') return true;
  if (beat.daughterQA) return true;
  if (extraRefsOf(beat, primaryRef).length > 0) return true;
  if ((beat.commentaries?.length ?? 0) > 0) return true;
  if ((beat.words?.length ?? 0) > 0) return true;
  return hasLinks(beat);
}

function hasLinks(beat: StoryBeat): boolean {
  return Boolean(
    beat.placeLinks?.length || beat.personLinks?.length || beat.externalLinks?.length || beat.entryLinks?.length,
  );
}

function extraRefsOf(beat: StoryBeat, primaryRef: string | undefined): string[] {
  return [...(beat.bgVerses ?? []), ...(beat.moreVerses ?? [])].filter((r) => r !== primaryRef);
}

function section(title: string, hint?: string): { root: HTMLElement; body: HTMLElement } {
  const body = h('div', { className: 'jos-more-sec-body' });
  const root = h(
    'section',
    { className: 'jos-more-sec' },
    h('h4', { className: 'jos-more-h' }, title),
    hint ? h('p', { className: 'jos-more-hint' }, hint) : null,
    body,
  );
  return { root, body };
}

function commentaryList(items: CommentaryItem[]): HTMLElement {
  const wrap = h('div', { className: 'jos-more-list' });
  for (const c of items) wrap.appendChild(renderCommentaryCard(c));
  return wrap;
}

/** 組出一拍的「更多」內容：各家怎麼說、原文、地名人名、條目連結，第二幕另有兩個開關 */
export function buildMoreBody(
  beat: StoryBeat,
  seg: StorySegment,
  isFirstInSeg: boolean,
  primaryRef: string | undefined,
  ctx: MoreContext,
): HTMLElement {
  const { data, state, peek, onStateChange, rerenderHighlights, toggleSyncs } = ctx;
  const root = h('div', { className: 'jos-more-content' });

  // 第二幕：開關
  if (seg.id === 'act-2') {
    const onlyIBtn = h(
      'button',
      { type: 'button', className: 'jos-toggle-pill', 'data-coach': 'only-i-btn' },
      `只留下神說『我』的地方（${data.step.oneCsVerbCount} 次）`,
    );
    const sameGiveBtn = h(
      'button',
      { type: 'button', className: 'jos-toggle-pill' },
      `同一個『給』（全章 ${data.step.giveCount} 次）`,
    );
    onlyIBtn.addEventListener('click', () => {
      state.onlyI = !state.onlyI;
      rerenderHighlights();
      onStateChange();
    });
    sameGiveBtn.addEventListener('click', () => {
      state.sameGive = !state.sameGive;
      rerenderHighlights();
      onStateChange();
    });
    toggleSyncs.push(() => {
      onlyIBtn.classList.toggle('jos-toggle-pill-active', state.onlyI);
      onlyIBtn.setAttribute('aria-pressed', String(state.onlyI));
      sameGiveBtn.classList.toggle('jos-toggle-pill-active', state.sameGive);
      sameGiveBtn.setAttribute('aria-pressed', String(state.sameGive));
    });
    const sec = section('神說『我』');
    sec.body.appendChild(
      h(
        'div',
        { className: 'jos-widget-bar' },
        onlyIBtn,
        sameGiveBtn,
        h(
          'span',
          { className: 'jos-widget-stat' },
          `第3到13節，神用我做主詞的動詞，在希伯來原文共有 ${data.step.oneCsVerbCount} 個。打開以後，經文裡其餘的字變淡，地圖上亮起 ${data.step.oneCsVerbCount} 盞燈。`,
        ),
      ),
    );
    if (isFirstInSeg && data.onlyIBasis.length > 0) {
      sec.body.appendChild(h('p', { className: 'jos-more-hint' }, '為什麼數這些『我』？註釋怎麼說：'));
      sec.body.appendChild(commentaryList(data.onlyIBasis));
    }
    root.appendChild(sec.root);
  }

  // 家庭問答：誰回答女兒
  if (beat.daughterQA) {
    const qa = beat.daughterQA;
    const sec = section(`${SPEAKER_NAMES[qa.answerer]}回答女兒：${qa.question}`);
    const vChips = h('div', { className: 'jos-chip-row' });
    for (const vr of qa.verses) {
      const btn = h('button', { type: 'button', className: 'jos-chip' }, `經文：${vr}`);
      btn.addEventListener('click', () => peek.openVerse(vr));
      vChips.appendChild(btn);
    }
    sec.body.appendChild(vChips);
    sec.body.appendChild(commentaryList(qa.notes));
    if (qa.entryLinks && qa.entryLinks.length > 0) {
      const eRow = h('div', { className: 'jos-chip-row' });
      for (const ek of qa.entryLinks) {
        const em = data.entries[ek];
        if (!em) continue;
        const btn = h('button', { type: 'button', className: 'jos-chip' }, `條目：${em.title}`);
        btn.addEventListener('click', () => peek.openEntry(ek));
        eRow.appendChild(btn);
      }
      sec.body.appendChild(eRow);
    }
    root.appendChild(sec.root);
  }

  // 各家怎麼說
  if (beat.commentaries && beat.commentaries.length > 0) {
    const sec = section('各家怎麼說', beat.commentaryPreview);
    sec.body.appendChild(commentaryList(beat.commentaries));
    root.appendChild(sec.root);
  }

  // 原文
  if (beat.words && beat.words.length > 0) {
    const sec = section('原文', beat.wordPreview);
    if (beat.verse === '書24:33') {
      const giveToggle = h(
        'button',
        { type: 'button', className: 'jos-toggle-pill' },
        `標出全章 ${data.step.giveCount} 次同一個『給』`,
      );
      giveToggle.addEventListener('click', () => {
        state.sameGive = !state.sameGive;
        rerenderHighlights();
        onStateChange();
      });
      toggleSyncs.push(() => {
        giveToggle.classList.toggle('jos-toggle-pill-active', state.sameGive);
        giveToggle.setAttribute('aria-pressed', String(state.sameGive));
      });
      sec.body.appendChild(h('div', { className: 'jos-widget-bar' }, giveToggle));
    }
    for (const w of beat.words) {
      sec.body.appendChild(
        h(
          'div',
          { className: 'jos-word-card' },
          h(
            'div',
            { className: 'jos-word-top' },
            h('strong', null, w.label),
            h('span', { className: 'jos-hebrew', lang: 'he', dir: 'rtl' }, w.hebrew),
            h('span', { className: 'jos-translit' }, w.translit),
          ),
          h(
            'p',
            { className: 'jos-word-meta' },
            `本節英譯：${w.gloss}｜詞形：${w.morphText || w.morph}${
              w.headword ? `｜字典：${w.headword}（${w.lexiconGloss}）` : ''
            }`,
          ),
          h('p', { className: 'jos-word-note' }, renderRichText(w.note)),
        ),
      );
    }
    sec.body.appendChild(h('p', { className: 'jos-step-credit' }, `出處：${data.meta.stepSource.label}`));
    root.appendChild(sec.root);
  }

  // 對照經文
  const extraRefs = extraRefsOf(beat, primaryRef);
  if (extraRefs.length > 0) {
    const sec = section('對照經文');
    const row = h('div', { className: 'jos-chip-row' });
    for (const r of extraRefs) {
      const btn = h('button', { type: 'button', className: 'jos-chip' }, r);
      btn.addEventListener('click', () => peek.openVerse(r));
      row.appendChild(btn);
    }
    sec.body.appendChild(row);
    root.appendChild(sec.root);
  }

  // 地點、人物、外連、條目
  if (hasLinks(beat)) {
    const sec = section('地點、人物與條目');
    const chipRow = h('div', { className: 'jos-chip-row' });
    for (const pid of beat.placeLinks ?? []) {
      const p = data.places[pid];
      if (!p) continue;
      const btn = h('button', { type: 'button', className: 'jos-chip' }, `地點：${p.nameZh}`);
      btn.addEventListener('click', () => peek.openPlace(pid));
      chipRow.appendChild(btn);
    }
    for (const per of beat.personLinks ?? []) {
      chipRow.appendChild(
        h(
          'a',
          {
            className: 'jos-chip',
            href: genealogyUrl(per.targetId),
            target: '_blank',
            rel: 'noopener noreferrer',
          },
          `家譜：${per.label} ↗`,
        ),
      );
    }
    for (const ext of beat.externalLinks ?? []) {
      const href = ext.kind === 'wilderness' ? wildernessUrl() : genealogyUrl(ext.targetId ?? '亞伯拉罕');
      chipRow.appendChild(
        h('a', { className: 'jos-chip', href, target: '_blank', rel: 'noopener noreferrer' }, `${ext.label} ↗`),
      );
    }
    for (const ek of beat.entryLinks ?? []) {
      const em = data.entries[ek];
      if (!em) continue;
      const btn = h('button', { type: 'button', className: 'jos-chip' }, `〈${em.title}〉`);
      btn.addEventListener('click', () => peek.openEntry(ek));
      chipRow.appendChild(btn);
    }
    sec.body.appendChild(chipRow);
    root.appendChild(sec.root);
  }

  return root;
}

export interface MoreCardController {
  element: HTMLElement;
  open(beatId: string, title: string, content: HTMLElement, opener: HTMLElement): void;
  close(restoreFocus?: boolean): void;
  isOpen(): boolean;
  openBeatId(): string;
}

export function createMoreCard(state: StoryState, onStateChange: () => void): MoreCardController {
  const titleEl = h('h3', { className: 'jos-more-title' }, '更多');
  const closeBtn = h('button', { type: 'button', className: 'jos-more-close', 'aria-label': '關閉' }, '×');
  const bodyEl = h('div', { className: 'jos-more-body' });
  const card = h(
    'div',
    { className: 'jos-more-card jos-more-hidden', role: 'dialog', 'aria-label': '更多內容', tabindex: '-1' },
    h('div', { className: 'jos-more-head' }, titleEl, closeBtn),
    bodyEl,
  );
  let opener: HTMLElement | null = null;
  let openFor = '';
  let visible = false;

  function close(restoreFocus = true): void {
    if (!visible) return;
    visible = false;
    openFor = '';
    card.classList.add('jos-more-hidden');
    state.moreOpen = false;
    const back = opener;
    opener = null;
    onStateChange();
    if (restoreFocus && back?.isConnected) back.focus({ preventScroll: true });
  }

  function open(beatId: string, title: string, content: HTMLElement, openerEl: HTMLElement): void {
    opener = openerEl;
    openFor = beatId;
    titleEl.textContent = title;
    bodyEl.replaceChildren(content);
    visible = true;
    card.classList.remove('jos-more-hidden');
    bodyEl.scrollTop = 0;
    state.moreOpen = true;
    onStateChange();
    closeBtn.focus({ preventScroll: true });
  }

  closeBtn.addEventListener('click', () => close());
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !visible) return;
    // 地名人名小卡開著時，先關小卡
    if (document.querySelector('.jos-peek-backdrop:not(.jos-peek-hidden)')) return;
    close();
  });
  // 小卡內捲動不帶動頁面：內容放得下時整個攔下，放不下時由 overscroll-behavior 擋住連動
  card.addEventListener(
    'wheel',
    (e) => {
      if (bodyEl.scrollHeight <= bodyEl.clientHeight + 1) e.preventDefault();
    },
    { passive: false },
  );

  return {
    element: card,
    open,
    close,
    isOpen: () => visible,
    openBeatId: () => openFor,
  };
}
