/**
 * 把 SITE.chapters 的每一拍排成一個 <section>：說明框 sticky 停在畫面內。
 * 每個說明框依序是：白話 → 經文（前面一行小字出處）→（互動提示）→「四家怎麼說」「原文」兩顆小按鈕。
 * 按鈕就地展開面板；手機改成從底部升起、覆蓋在說明框上方的面板。
 */
import type { Beat, StoryChapter } from '../data/types';
import { SITE } from '../data/site';
import { story } from '../story/state';
import { h } from './dom';
import type { BakeUI } from './bake';
import type { BarsUI } from './bars';
import type { BlowUI } from './blow';
import type { CountUI } from './count';
import { beatDomId, type EchoUI } from './echo';
import type { HyssopUI } from './hyssop';
import { offeringList } from './offerings';
import type { WaveUI } from './wave';
import { notesPanelBody, wordsPanelBody } from './panels';
import { fullRef, richText, verseNodes } from './text';

export interface BeatRef {
  chapter: StoryChapter;
  beat: Beat;
  /** 整份故事裡的第幾拍（0 起算） */
  index: number;
  el: HTMLElement;
  box: HTMLElement;
  /** 這一拍的室內分格（場景用 scissor 畫在裡面）；只有 meal 那一拍有 */
  panel?: HTMLElement;
  /** 關掉這一拍展開的面板 */
  closePanel(): void;
  hasPanelOpen(): boolean;
}

/** 說明框左右的固定指定（依 cue）；沒列到的照奇偶交替 */
const FIXED_SIDE: Record<string, 'left' | 'right'> = {
  title: 'right',
  meal: 'right', // 左邊是室內分格
  children: 'left', // 人物在畫面中間偏右，放右邊會蓋住父親的頭
  // 春季：左
  'new-moon': 'left',
  'seven-days': 'left',
  remember: 'left',
  wave: 'left',
  'not-yet': 'left',
  unclean: 'left',
  'second-month': 'left',
  count: 'left',
  'weeks-offerings': 'left',
  corners: 'left',
  // 春季：右
  bake: 'right',
  'no-leaven': 'right',
  'barley-ripe': 'right',
  'lamb-offering': 'right',
  sinai: 'right',
  wait: 'right',
  'two-loaves': 'right',
  rejoice: 'right',
};

/** 各種互動的介面（說明框裡的提示、按鈕、狀態；塗血與搖禾捆另有觸控層） */
export interface InteractionUIs {
  hyssop: HyssopUI;
  bake: BakeUI;
  wave: WaveUI;
  count: CountUI;
  blow: BlowUI;
  /** 長條圖（Beat.bars） */
  bars: BarsUI;
  /** 回聲拍的「呼應」與被呼應的拍的「後來」連結 */
  echo: EchoUI;
}

type Kind = 'notes' | 'words';
const KIND_LABEL: Record<Kind, string> = { notes: '四家怎麼說', words: '原文' };

/** 目前展開中的面板（全頁同時只開一個） */
let openRef: { close(returnFocus: boolean, keepTop?: boolean): void } | null = null;

export function closeOpenPanel(returnFocus = false): void {
  openRef?.close(returnFocus);
}
export const anyPanelOpen = (): boolean => openRef !== null;

/**
 * 收起說明框：讀者按任何一框的「收起」，所有說明框一起收成一個小標籤，捲到下一拍也維持收起，
 * 好看動畫的全貌；再按「展開說明」就全部回來。不存進 localStorage：重新整理就回到有字的狀態。
 * 有互動的拍（吹、烤餅、搖禾捆……）收起時仍留著互動按鈕。
 */
const foldBtns: HTMLButtonElement[] = [];
let folded = false;
function setFolded(on: boolean, from?: HTMLButtonElement): void {
  folded = on;
  if (on) closeOpenPanel(false);
  document.documentElement.toggleAttribute('data-fold', on);
  for (const b of foldBtns) {
    b.setAttribute('aria-expanded', on ? 'false' : 'true');
    b.textContent = on ? '展開說明' : '收起';
  }
  // 焦點留在剛按的那顆（按鈕文字換了，位置不變）
  from?.focus({ preventScroll: true });
}

export function buildBeats(main: HTMLElement, ui: InteractionUIs): BeatRef[] {
  const refs: BeatRef[] = [];
  // 說明框左右交替；有互動的那一拍固定落在左邊（牛膝草把手在畫面右側），其餘照奇偶往前後推
  const flat = SITE.chapters.flatMap((c) => c.beats);
  const interactive = flat.findIndex((b) => b.interaction);
  const offset = interactive >= 0 && interactive % 2 === 1 ? 1 : 0;
  let index = 0;
  for (const chapter of SITE.chapters) {
    chapter.beats.forEach((beat, bi) => {
      const side = FIXED_SIDE[beat.cue] ?? ((index + offset) % 2 === 0 ? 'left' : 'right');
      const ref = buildBeat(chapter, beat, bi, index, side, ui);
      main.append(ref.el);
      refs.push(ref);
      index++;
    });
  }
  return refs;
}

function buildBeat(chapter: StoryChapter, beat: Beat, bi: number, index: number, side: 'left' | 'right', ui: InteractionUIs): BeatRef {
  // 無字的時光過場：沒有標題卡、說明框、章末、日數牌，只有一段捲動的高度（CSS 100–120vh）
  if (chapter.kind === 'passage') {
    const el = h('section', {
      class: 'jf-beat jf-passage',
      id: beatDomId(chapter, beat),
      'data-chapter': chapter.id,
      'data-beat': beat.id,
      'data-cue': beat.cue,
      'aria-hidden': 'true',
    });
    // 其他程式（捲動綁定、避讓計算）都預期每一拍有個 box：給一個不顯示的空殼
    const box = h('div', { class: 'jf-box jf-box-none', hidden: true });
    el.append(box);
    return { chapter, beat, index, el, box, closePanel: () => undefined, hasPanelOpen: () => false };
  }
  const el = h('section', {
    class: 'jf-beat',
    id: beatDomId(chapter, beat),
    'data-chapter': chapter.id,
    'data-beat': beat.id,
    'data-cue': beat.cue,
    'data-side': side,
    'data-len': index === 0 || beat.interaction ? 'long' : 'normal',
  });

  // 開場第一拍：大標題；其他章的第一拍：章標題
  if (index === 0) {
    el.append(
      h('header', { class: 'jf-hero' },
        h('h1', { class: 'jf-plate jf-title' }, SITE.title),
        h('p', { class: 'jf-hero-ref' }, SITE.motto.ref)),
    );
  } else if (bi === 0 && chapter.kind === 'feast') {
    el.append(
      h('header', { class: 'jf-chaphead' },
        h('h2', { class: 'jf-plate jf-chaptitle' }, chapter.title),
        chapter.date ? h('p', { class: 'jf-chapdate' }, chapter.date) : null),
    );
  }

  const boxId = `jf-box-${chapter.id}-${beat.id}`;
  const later = !!beat.echoes?.length;
  const box = h('article', {
    class: 'jf-box',
    id: boxId,
    'data-compact': beat.interaction ? 'true' : null,
    'data-offers': beat.offerings?.length ?? null,
    'data-later': later ? 'true' : null,
    'data-bars': beat.bars?.length ? 'true' : null,
  });
  // 說明框的內容放進 .jf-box-body：桌機超過 max-height 時只有它捲動，框線與偏移墨塊（::before）不動
  const body = h('div', { class: 'jf-box-body', id: `${boxId}-body` });
  const hint = h('span', { class: 'jf-box-hint', 'aria-hidden': 'true', hidden: true }, '往下看');
  const fold = h('button', {
    type: 'button',
    class: 'jf-boxfold',
    'aria-expanded': folded ? 'false' : 'true',
    'aria-controls': `${boxId}-body`,
    onclick: () => setFolded(!folded, fold),
  }, folded ? '展開說明' : '收起') as HTMLButtonElement;
  foldBtns.push(fold);
  box.append(fold, body, hint);
  // 回聲拍（後來的歷史）：左上一個小標籤
  if (later) box.append(h('span', { class: 'jf-later-tag' }, '後來'));
  if (beat.reason) body.append(h('p', { class: 'jf-reason' }, '經文自己說的理由'));
  body.append(h('p', { class: 'jf-text' }, richText(beat.text)));

  const block = beat.verse ? SITE.verses[beat.verse] : undefined;
  if (block) {
    body.append(
      h('figure', { class: 'jf-verse' },
        // 回聲拍的經文出處寫全書名（約書亞記 5:10-12）；其餘照簡稱
        h('figcaption', { class: 'jf-verse-ref' }, later ? fullRef(block) : block.ref),
        h('blockquote', { class: 'jf-verse-text' }, verseNodes(block))),
    );
  }

  // 補充經文：主經文後面依序顯示，每段標出處（回聲拍用全書名）
  for (const ref of beat.moreVerses ?? []) {
    const more = SITE.verses[ref];
    if (!more) continue;
    body.append(
      h('figure', { class: 'jf-verse jf-verse-more' },
        h('figcaption', { class: 'jf-verse-ref' }, later ? fullRef(more) : more.ref),
        h('blockquote', { class: 'jf-verse-text' }, verseNodes(more))),
    );
  }

  const echoes = ui.echo.echoesSection(beat);
  if (echoes) body.append(echoes);
  const recall = ui.echo.recallSection(beat);
  if (recall) body.append(recall);
  const laters = ui.echo.laterLinks(beat);
  if (laters) body.append(laters);

  const offers = offeringList(beat.offerings, beat.offeringsLabel);
  if (offers) body.append(offers);

  // 長條圖：手機放在說明框裡（經文下方）；桌機放在說明框旁邊（fixed，另一側）
  const bars = ui.bars.build(beat, side === 'left' ? 'right' : 'left');
  if (bars) body.append(bars.inline);

  if (beat.prompt) {
    let ctl: HTMLElement | undefined;
    if (beat.interaction === 'hyssop') ctl = ui.hyssop.controls(beat.prompt);
    else if (beat.interaction === 'bake') ctl = ui.bake.controls(beat.prompt);
    else if (beat.interaction === 'wave') ctl = ui.wave.controls(beat.prompt);
    else if (beat.interaction === 'count') ctl = ui.count.controls(beat.prompt);
    else if (beat.interaction === 'blow') ctl = ui.blow.controls(beat.prompt, beat.id);
    if (ctl) {
      // 收起說明框時，互動按鈕留著
      ctl.classList.add('jf-ctl');
      box.dataset.ctl = 'true';
      body.append(ctl);
    }
  }

  // ---- 就地展開 ----
  const hasNotes = !!beat.notes?.length;
  const hasWords = !!beat.words?.length;
  const parts: Partial<Record<Kind, { chip: HTMLButtonElement; more: HTMLElement; closeBtn: HTMLButtonElement }>> = {};
  let current: Kind | null = null;
  const mobileQ = window.matchMedia('(max-width: 720px)');

  const handle = {
    close(returnFocus: boolean, keepTop = false) {
      const k = current;
      setOpen(null);
      // 用滑鼠或觸控收起時，框的捲動位置要停在頂端（focus 預設會把按鈕捲進來），鍵盤操作才讓焦點按鈕可見
      if (returnFocus && k) parts[k]?.chip.focus({ preventScroll: keepTop });
    },
  };

  function setOpen(kind: Kind | null) {
    current = kind;
    for (const k of ['notes', 'words'] as Kind[]) {
      const p = parts[k];
      if (!p) continue;
      const on = k === kind;
      p.more.hidden = !on;
      p.chip.setAttribute('aria-expanded', on ? 'true' : 'false');
    }
    box.dataset.open = kind ?? '';
    if (kind) openRef = handle;
    else if (openRef === handle) openRef = null;
    // 桌機：展開後把面板標題捲進框內（只捲框自己，不用 scrollIntoView，免得整頁跟著動）；收起就回到頂端
    if (!mobileQ.matches) {
      const target = kind ? parts[kind]?.more : null;
      const top = target ? Math.max(0, target.offsetTop - 10) : 0;
      body.scrollTo({ top, behavior: kind && !story.motionOff ? 'smooth' : 'auto' });
    }
    updateHint();
  }

  /** 框內還能往下捲時，框底掛一個「往下看」小標籤（掛在邊線上，不蓋住文字） */
  function updateHint() {
    const more = body.scrollHeight - body.clientHeight > 4 && body.scrollTop + body.clientHeight < body.scrollHeight - 4;
    hint.hidden = !more;
  }
  body.addEventListener('scroll', updateHint, { passive: true });

  function addPart(kind: Kind, content: HTMLElement) {
    const moreId = `${boxId}-${kind}`;
    const closeBtn = h('button', { type: 'button', class: 'jf-more-x', 'aria-label': `關閉「${KIND_LABEL[kind]}」`, onclick: (e: MouseEvent) => handle.close(true, e.detail > 0) }, '關閉');
    const more = h('div', { class: 'jf-more', id: moreId, role: 'region', 'aria-label': KIND_LABEL[kind], hidden: true },
      h('div', { class: 'jf-more-head' }, h('span', { class: 'jf-more-title' }, KIND_LABEL[kind]), closeBtn),
      h('div', { class: 'jf-more-body' }, content));
    const chip = h('button', {
      type: 'button',
      class: 'jf-chip',
      'aria-expanded': 'false',
      'aria-controls': moreId,
      onclick: () => {
        if (current === kind) {
          setOpen(null);
        } else {
          closeOpenPanel(false);
          setOpen(kind);
          // 手機的面板蓋在說明框上方：把焦點帶進去，讀報讀器的人才知道面板開了
          if (mobileQ.matches) closeBtn.focus({ preventScroll: true });
        }
      },
    }, KIND_LABEL[kind]);
    parts[kind] = { chip, more, closeBtn };
  }

  if (hasNotes) addPart('notes', notesPanelBody(beat.notes!));
  if (hasWords) addPart('words', wordsPanelBody(beat.words!));

  if (parts.notes || parts.words) {
    body.append(h('div', { class: 'jf-actions' }, parts.notes?.chip, parts.words?.chip));
    for (const k of ['notes', 'words'] as Kind[]) if (parts[k]) body.append(parts[k]!.more);
  }

  // 說明框的 sticky 範圍限在 .jf-pin 裡，所以開場大標題、章標題那一段不會被說明框蓋住
  // meal：室內分格。DOM 只給外框與位置（背景透明，canvas 透出來），場景找到它之後用 scissor 畫在框內。
  // 一開始是 hidden；進入這一拍才顯示（見 setPanelOn），離開就隱藏，場景量到 0×0 就不畫。
  const panel = beat.cue === 'meal'
    ? h('div', { class: 'jf-panel', 'data-jf-panel': 'meal', 'aria-hidden': 'true', hidden: true })
    : undefined;
  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(updateHint);
    ro.observe(body);
    for (const c of Array.from(body.children)) ro.observe(c);
  }
  // 桌機的長條圖掛在說明框旁邊、跟著框一起進出畫面（原本 fixed，前一拍的框還沒離開時會疊在一起）
  if (bars) box.append(bars.side);
  el.append(h('div', { class: 'jf-pin' }, panel, box));
  return {
    chapter,
    beat,
    index,
    el,
    box,
    panel,
    closePanel: () => handle.close(false),
    hasPanelOpen: () => current !== null,
  };
}

/** 顯示或隱藏室內分格：進入時從下方滑入＋淡入（約 0.5s，減少動態時只淡入，見 CSS）；離開就收起來 */
export function setPanelOn(panel: HTMLElement, on: boolean): void {
  if (on) {
    if (!panel.hidden && panel.classList.contains('is-on')) return;
    panel.hidden = false;
    void panel.offsetWidth; // 先讓瀏覽器量一次，transition 才會從起點開始
    panel.classList.add('is-on');
  } else {
    panel.classList.remove('is-on');
    panel.hidden = true;
  }
}
