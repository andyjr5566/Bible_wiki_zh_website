import { buildParallelDiff } from '../data/diff';
import type { FamilyLine, SiteData, StoryBeat, StorySegment, VerseLine } from '../data/types';
import type { BubblePlacement } from '../scene';
import { sampleStation, stationsForBeat } from '../scene/stations';
import { beatReadPx, FLIGHT_PX, splitSentences, stationLayouts, stationReadPx, verseLayouts, voiceWeights } from '../data/storytelling';
import { GROUP_SIZE, primaryRefOf, sentencePlan, stationRhythm, storyLines, verseWeight } from '../data/story-content.mjs';
import { scrollToElement } from '../story/scroll';
import { beatPlaybackSeconds } from '../story/autoplay';
import { paceRate, sentenceRevealSeconds } from '../story/playback-speed';
import { reviewNavigate } from './review-navigation';
import type { StoryState } from '../story/state';
import { h } from './dom';
import { viewportHeight } from './viewport';
import { beatHasMore, buildMoreBody, createMoreCard, SPEAKER_NAMES } from './more-card';
import type { PeekController } from './peek';

/*
 * 一拍只講一種東西（Claude.md §六）：
 * - 經文拍：只有和合本經文（小框，桌機右下、手機橫擺左下）。
 * - 有短註的拍：捲過前六成看經文，後段換成一句具名短註。
 * - 對話拍：泡泡浮在說話者旁邊，一次一句。
 * - 其餘（各家怎麼說、原文、地名人名、條目、第二幕的兩個開關）收進「更多」小卡。
 * 捲動軌道（section）只負責提供捲動長度與錨點；畫面上的內容全在固定的疊層裡，依目前這一拍切換。
 */

const SPEAKER_ACTORS: Record<FamilyLine['speaker'], string[]> = {
  grandfather: ['grandfather'],
  father: ['father'],
  daughter: ['daughter', 'daughter_grown'],
};

/** 經文框與短註只在此處切換，避免兩段文字同時可見 */
/** 第19節：先只有一行大字，再換成整段經文 */
const HEADLINE_FADE_FROM = 0.22;
const HEADLINE_FADE_TO = 0.3;
/** 一節的時間依 sentencePlan 的份量分給各句，到 86% 為止（之後整節淡出）。 */
const SENTENCE_SPREAD = 0.835;
const KICKER_FADE_FROM = 0.4;
const KICKER_FADE_TO = 0.5;

interface SpanMark {
  start: number;
  end: number;
  cls: string;
}

function findNthInterval(text: string, sub: string, occ = 1): [number, number] | null {
  let from = 0;
  let idx = -1;
  for (let i = 0; i < occ; i++) {
    idx = text.indexOf(sub, from);
    if (idx === -1) return null;
    from = idx + sub.length;
  }
  return [idx, idx + sub.length];
}

function smoothstep(a: number, b: number, x: number): number {
  if (x <= a) return 0;
  if (x >= b) return 1;
  const t = (x - a) / (b - a);
  return t * t * (3 - 2 * t);
}

function renderVerseLineWithSpans(
  bookAbbr: string,
  chapter: number,
  line: VerseLine,
  focusSubstrings: string[] | undefined,
  state: StoryState,
  data: SiteData,
  inAct2: boolean,
): HTMLElement {
  const text = line.text;
  const marks: SpanMark[] = [];

  if (bookAbbr === '書' && chapter === 24) {
    if (state.onlyI && inAct2) {
      for (const v of data.step.oneCsVerbs) {
        if (v.verse !== line.v) continue;
        for (const sp of v.cuvSpans) {
          const hit = findNthInterval(text, sp.text, sp.occurrence ?? 1);
          if (hit) marks.push({ start: hit[0], end: hit[1], cls: 'jos-span-1cs' });
        }
      }
    }

    if (state.sameGive) {
      for (const g of data.step.gives) {
        if (g.verse !== line.v) continue;
        for (const sp of g.cuvSpans) {
          const hit = findNthInterval(text, sp.text, sp.occurrence ?? 1);
          if (hit) marks.push({ start: hit[0], end: hit[1], cls: 'jos-span-give' });
        }
      }
    }
  }

  if (marks.length === 0 && focusSubstrings) {
    for (const fs of focusSubstrings) {
      const idx = text.indexOf(fs);
      if (idx >= 0) {
        marks.push({ start: idx, end: idx + fs.length, cls: 'jos-span-focus' });
      }
    }
  }

  marks.sort((a, b) => a.start - b.start || b.end - a.end);
  const cleanMarks: SpanMark[] = [];
  let cursor = 0;
  for (const mk of marks) {
    if (mk.start >= cursor) {
      cleanMarks.push(mk);
      cursor = mk.end;
    }
  }

  const p = h('p', { className: 'jos-verse-line' }, h('span', { className: 'jos-verse-num' }, String(line.v)));
  const dimRest = state.onlyI && inAct2;

  let pos = 0;
  for (const mk of cleanMarks) {
    if (mk.start > pos) {
      const chunk = text.slice(pos, mk.start);
      p.appendChild(
        dimRest ? h('span', { className: 'jos-verse-dim' }, chunk) : document.createTextNode(chunk),
      );
    }
    p.appendChild(h('span', { className: mk.cls }, text.slice(mk.start, mk.end)));
    pos = mk.end;
  }
  if (pos < text.length) {
    const rest = text.slice(pos);
    p.appendChild(
      dimRest ? h('span', { className: 'jos-verse-dim' }, rest) : document.createTextNode(rest),
    );
  }

  const nodes = Array.from(p.childNodes).slice(1);
  const sentences = splitSentences(text);
  let nodeIndex = 0, nodeOffset = 0;
  for (const sentence of sentences) {
    const span = h('span', { className: 'jos-story-sentence' });
    let remaining = sentence.length;
    while (remaining > 0 && nodeIndex < nodes.length) {
      const node = nodes[nodeIndex];
      const content = node.textContent ?? '';
      const take = Math.min(remaining, content.length - nodeOffset);
      const part = content.slice(nodeOffset, nodeOffset + take);
      const glyphs = [...part].map(char => h('span', { className: 'jos-story-char', 'data-glyph': char }, char));
      if (node instanceof HTMLElement) span.appendChild(h('span', { className: node.className }, ...glyphs));
      else span.append(...glyphs);
      nodeOffset += take; remaining -= take;
      if (nodeOffset === content.length) { nodeIndex++; nodeOffset = 0; }
    }
    p.appendChild(span);
  }
  for (const node of nodes) node.remove();
  return p;
}

export interface BubbleSceneApi {
  placeBubble(actorIds: string[], w: number, h: number, topInset: number): BubblePlacement | null;
}

export interface StoryViewController {
  element: HTMLElement;
  rerenderHighlights(): void;
  syncRaiseUi(): void;
  /** 依目前這一拍與捲動進度更新疊層（捲動時與每個畫面影格都會呼叫） */
  tick(): void;
  attachScene(scene: BubbleSceneApi | null): void;
  setHidden(hidden: boolean): void;
}

interface BoxRef {
  el: HTMLElement;
  key: string;
}

interface BubbleRefs {
  el: HTMLElement;
  textEl: HTMLElement;
  whoEl: HTMLElement;
  tailEl: HTMLElement;
  lines: FamilyLine[];
  renderedKey: string;
  w: number;
  h: number;
  placedKey: string;
  x: number | null;
  y: number | null;
  lastProgress: number;
  lastViewport: string;
  target: BubblePlacement | null;
}

interface Panel {
  stackEl: HTMLElement | null;
  stackH: number;
  beat: StoryBeat;
  el: HTMLElement;
  sectionEl: HTMLElement;
  slot: HTMLElement | null;
  kicker: BoxRef | null;
  verse: BoxRef | null;
  note: BoxRef | null;
  headline: BoxRef | null;
  verseScrollEl: HTMLElement | null;
  bubble: BubbleRefs | null;
  moreBtn: HTMLButtonElement | null;
}

function setWeight(ref: BoxRef | null, w: number): void {
  if (!ref) return;
  const key = w >= 0.995 ? '1' : w <= 0.005 ? '0' : w.toFixed(2);
  if (ref.key === key) return;
  ref.key = key;
  const el = ref.el;
  if (key === '0') {
    el.style.opacity = '0';
    el.style.visibility = 'hidden';
    el.style.pointerEvents = 'none';
  } else {
    el.style.opacity = key;
    el.style.visibility = 'visible';
    el.style.pointerEvents = w > 0.5 ? 'auto' : 'none';
  }
}

export function createStoryView(
  data: SiteData,
  state: StoryState,
  peek: PeekController,
  onStateChange: () => void,
  hasWebglScene: () => boolean = () => false,
): StoryViewController {
  const main = h('main', { className: 'jos-story-main' });
  const overlay = h('div', { className: 'jos-onevoice', 'aria-label': '經文與說明' });
  const verseRenderUpdaters: (() => void)[] = [];
  const toggleSyncs: (() => void)[] = [];
  const raiseSyncFns: (() => void)[] = [];
  const panels = new Map<string, Panel>();
  const moreCache = new Map<string, HTMLElement>();
  let scene: BubbleSceneApi | null = null;
  let active: Panel | null = null;
  let topInset = 60;
  let observedHeader: HTMLElement | null = null;
  const headerObserver = new ResizeObserver(measureHeader);

  function rerenderHighlights(): void {
    for (const fn of verseRenderUpdaters) fn();
    for (const fn of toggleSyncs) fn();
  }

  function syncRaiseUi(): void {
    for (const fn of raiseSyncFns) fn();
  }

  const moreCard = createMoreCard(state, onStateChange);
  overlay.appendChild(moreCard.element);

  // 最後一拍：提醒讀者下面還有整理區，點一下就過去。
  const lastBeatId = data.segments.at(-1)!.beats.at(-1)!.id;
  const outroHint = h('button', { type: 'button', className: 'jos-outro-hint' }, '往下還有補充整理 ↓');
  outroHint.hidden = true;
  outroHint.addEventListener('click', () => reviewNavigate(document.getElementById('jos-review-root'), state, onStateChange, true));
  overlay.appendChild(outroHint);

  const moreCtx = { data, state, peek, onStateChange, rerenderHighlights, toggleSyncs };

  function openMore(panel: Panel, seg: StorySegment, isFirstInSeg: boolean, opener: HTMLElement): void {
    if (moreCard.isOpen() && moreCard.openBeatId() === panel.beat.id) {
      moreCard.close();
      return;
    }
    let content = moreCache.get(panel.beat.id);
    if (!content) {
      content = buildMoreBody(panel.beat, seg, isFirstInSeg, primaryRefOf(panel.beat), moreCtx);
      moreCache.set(panel.beat.id, content);
      for (const fn of toggleSyncs) fn();
    }
    moreCard.open(panel.beat.id, '更多', content, opener);
  }

  for (const seg of data.segments) {
    seg.beats.forEach((beat, idx) => {
      const panel = buildPanel(beat, seg, idx === 0);
      panels.set(beat.id, panel);
      main.appendChild(panel.sectionEl);
      overlay.insertBefore(panel.el, moreCard.element);
    });
  }
  main.append(h('div', { className: 'jos-story-outro-runway', 'aria-hidden': 'true' }), overlay);
  rerenderHighlights();

  function measureHeader(): void {
    const hdr = document.querySelector<HTMLElement>('.jos-header');
    if (hdr && hdr !== observedHeader) {
      if (observedHeader) headerObserver.unobserve(observedHeader);
      observedHeader = hdr;
      headerObserver.observe(hdr);
    }
    topInset = (hdr ? hdr.getBoundingClientRect().height : 52) + 8;
    document.documentElement.style.setProperty('--jos-station-top', `${topInset - 8}px`);
    for (const p of panels.values()) if (p.bubble) p.bubble.renderedKey = '';
  }
  window.addEventListener('resize', measureHeader, { passive: true });

  function buildPanel(beat: StoryBeat, seg: StorySegment, isFirstInSeg: boolean): Panel {
    const inAct2 = seg.id === 'act-2';
    const isInteractive = Boolean(beat.interaction);
    const isWide = beat.interaction === 'epilogue-diff';
    const isRaise = beat.interaction === 'raise-stone';
    const primaryRef = primaryRefOf(beat);

    // ---- 捲動軌道 ----
    const sectionEl = h('section', {
      id: `jos-beat-${beat.id}`,
      className: `jos-beat${isInteractive ? ' jos-beat-tall' : ''}`,
      'data-beat-id': beat.id,
      'data-cue': beat.cue,
      'data-seg-id': seg.id,
      'data-wide': isWide ? '1' : '0',
    });
    if (isFirstInSeg) {
      sectionEl.appendChild(h('div', { id: `jos-seg-${seg.id}`, className: 'jos-seg-anchor' }));
    }
    const beatStations = stationsForBeat(beat.id);
    const length = beatStations.length
      ? beatStations.reduce((sum, s) => sum + FLIGHT_PX + stationReadPx(s), 0)
      : beatReadPx(beat, data);
    sectionEl.style.minHeight = `${length}px`;
    sectionEl.dataset.readLength = String(length);

    // ---- 疊層面板 ----
    const el = h('div', { className: 'jos-panel', 'data-panel-beat': beat.id });
    el.dataset.verseLayout = verseLayouts[beat.cue].position;
    const panel: Panel = {
      stackEl: null,
      stackH: -1,
      beat,
      el,
      sectionEl,
      slot: null,
      kicker: null,
      verse: null,
      note: null,
      headline: null,
      verseScrollEl: null,
      bubble: null,
      moreBtn: null,
    };

    // 互動小工具（右上）：序幕標題、石頭列、巴勒三句、四張禮物卡、立石、終幕對照
    const slotNodes: HTMLElement[] = [];

    if (seg.id === 'prologue' && isFirstInSeg) {
      slotNodes.push(
        h(
          'div',
          { className: 'jos-wcard jos-hero-plate' },
          h('p', { className: 'jos-eyebrow' }, data.meta.subtitle),
          h('h1', { className: 'jos-hero-title' }, data.meta.title),
          h('p', { className: 'jos-hero-hint' }, '往下捲動，進入示劍山谷；停下來就可以細看畫面。'),
        ),
      );
    } else if (isFirstInSeg && !inAct2) {
      const kickerEl = h(
        'div',
        { className: 'jos-wcard jos-seg-kicker' },
        h('div', { className: 'jos-seg-kicker-meta' }, `${seg.label}・${seg.rangeLabel}`),
        h('h2', { className: 'jos-seg-kicker-title' }, seg.title),
        seg.treatyNote ? h('p', { className: 'jos-seg-kicker-treaty' }, seg.treatyNote) : null,
      );
      panel.kicker = { el: kickerEl, key: '' };
      slotNodes.push(kickerEl);
    }

    if (seg.id === 'prologue') {
      const stonesRow = h('div', { className: 'jos-wcard jos-prologue-stones' });
      for (const st of data.sevenStones.slice(0, 6)) {
        const sBtn = h(
          'button',
          { type: 'button', className: 'jos-prologue-stone-btn' },
          h('span', { className: 'jos-prologue-stone-place' }, `${st.order}. ${st.placeName}`),
          h('span', { className: 'jos-prologue-stone-ref' }, `${st.ref}｜${st.what}`),
        );
        sBtn.addEventListener('click', () => peek.openVerse(st.ref));
        stonesRow.appendChild(sBtn);
      }
      slotNodes.push(stonesRow);
    }

    if (isRaise) slotNodes.push(buildRaiseWidget());

    if (beat.interaction === 'balak-scroll' && beat.balakStages) {
      const grid = h('div', { className: 'jos-wcard jos-balak-grid' });
      for (const stg of beat.balakStages) {
        const refBtn = h('button', { type: 'button', className: 'jos-chip' }, stg.ref);
        refBtn.addEventListener('click', () => peek.openVerse(stg.ref));
        grid.appendChild(
          h(
            'div',
            { className: 'jos-balak-card' },
            h('div', { className: 'jos-balak-step' }, `第 ${stg.step} 句・${stg.speaker}`),
            h('p', { className: 'jos-balak-quote' }, `「${stg.quote}」`),
            h('div', { className: 'jos-chip-row' }, refBtn),
          ),
        );
      }
      slotNodes.push(grid);
    }

    if (beat.interaction === 'gift-cards' && beat.giftCards) {
      const grid = h('div', { className: 'jos-wcard jos-gifts-grid' });
      for (const gc of beat.giftCards) {
        const btn = h('button', { type: 'button', className: 'jos-gift-card' });
        const renderGift = () => {
          const flipped = state.flippedGifts[gc.id];
          btn.classList.toggle('jos-gift-card-flipped', flipped);
          btn.replaceChildren(
            h(
              'div',
              { className: 'jos-gift-head' },
              h('span', null, gc.frontTitle),
              h('span', null, flipped ? `${gc.deut6Ref}（點一下翻回來）` : '書24:13（點一下，看摩西先前說的話）'),
            ),
            h('p', { className: 'jos-gift-quote' }, flipped ? `「${gc.deut6Quote}」` : `「${gc.jos24Quote}」`),
          );
        };
        btn.addEventListener('click', () => {
          state.flippedGifts[gc.id] = !state.flippedGifts[gc.id];
          renderGift();
          onStateChange();
        });
        renderGift();
        grid.appendChild(btn);
      }
      slotNodes.push(grid);
    }

    if (beat.interaction === 'epilogue-diff') {
      slotNodes.push(buildDiffWidget(), buildJumpRow());
    }

    if (slotNodes.length > 0) {
      const slot = h(
        'div',
        {
          className: `jos-wslot${isWide ? ' jos-wslot-wide' : ''}${primaryRef || beat.familyLines ? '' : ' jos-wslot-full'}`,
        },
        ...slotNodes,
      );
      panel.slot = slot;
      el.appendChild(slot);
    }

    // ---- 經文／短註／第19節大字（小框，桌機右下、手機橫擺左下） ----
    const hasFamily = Boolean(beat.familyLines && beat.familyLines.length > 0);
    const stack = h('div', { className: 'jos-voice-stack' });

    if (beat.interaction === 'cannot-pause') {
      const headEl = h(
        'div',
        { className: 'jos-vbox jos-vbox-headline' },
        h('p', { className: 'jos-cannot-headline', 'data-glyph': '「你們不能事奉耶和華」' }, '「你們不能事奉耶和華」'),
      );
      panel.headline = { el: headEl, key: '' };
      stack.appendChild(headEl);
    }

    if (primaryRef && data.verseBlocks[primaryRef]) {
      const blk = data.verseBlocks[primaryRef];
      const boxCls =
        beat.interaction === 'cannot-pause'
          ? ' jos-vbox-solemn'
          : beat.interaction === 'put-away-past'
            ? ' jos-vbox-past'
            : '';
      const verseEl = h('div', { className: `jos-vbox jos-vbox-verse${boxCls}`, tabindex: '0', 'aria-label': primaryRef });
      const renderLines = () => {
        delete verseEl.dataset.stationVerse;
        verseEl.replaceChildren();
        for (const ln of storyLines(beat, data)) {
          verseEl.appendChild(
            renderVerseLineWithSpans(blk.abbr, blk.chapter, ln, beat.focusSubstrings, state, data, inAct2),
          );
        }
      };
      renderLines();
      verseRenderUpdaters.push(renderLines);
      panel.verse = { el: verseEl, key: '' };
      panel.verseScrollEl = verseEl;
      stack.appendChild(verseEl);
    }

    if (beat.note) {
      const idx = beat.note.indexOf('：');
      const noteEl = h('div', { className: 'jos-vbox jos-vbox-note' });
      if (idx > 0) {
        noteEl.appendChild(h('span', { className: 'jos-note-src' }, beat.note.slice(0, idx + 1)));
        noteEl.appendChild(document.createTextNode(beat.note.slice(idx + 1)));
      } else {
        noteEl.appendChild(document.createTextNode(beat.note));
      }
      panel.note = { el: noteEl, key: '' };
      stack.appendChild(noteEl);
    }

    const hasMore = beatHasMore(beat, seg, primaryRef);
    let moreBtn: HTMLButtonElement | null = null;
    if (hasMore) {
      moreBtn = h('button', { type: 'button', className: 'jos-more-btn', 'data-coach': 'more-btn' }, '更多');
      moreBtn.addEventListener('click', () => openMore(panel, seg, isFirstInSeg, moreBtn!));
      panel.moreBtn = moreBtn;
    }

    if (stack.childElementCount > 0 || (moreBtn && !hasFamily)) {
      const voice = h('div', { className: 'jos-voice' });
      if (stack.childElementCount > 0) {
        voice.appendChild(stack);
        panel.stackEl = stack;
      }
      el.appendChild(voice);
    }

    // ---- 對話泡泡 ----
    if (hasFamily) {
      panel.bubble = buildBubble(beat.familyLines!, null);
      el.appendChild(panel.bubble.el);
    }
    if (moreBtn) el.appendChild(moreBtn);

    return panel;
  }

  function buildBubble(lines: FamilyLine[], moreBtn: HTMLButtonElement | null): BubbleRefs {
    const textEl = h('div', { className: 'jos-bubble-text' });
    const whoEl = h('span', { className: 'jos-bubble-who' });
    const tailEl = h('span', { className: 'jos-bubble-tail', 'aria-hidden': 'true' });
    // 「更多」掛在泡泡右上角、說話者名字掛在左上角（像貼在邊上的小標籤），泡泡本身只有字
    const el = h('div', { className: 'jos-bubble' }, whoEl, moreBtn, textEl, tailEl);
    return { el, textEl, whoEl, tailEl, lines, renderedKey: '', w: 0, h: 0, placedKey: '', x: null, y: null, lastProgress: -1, lastViewport: '', target: null };
  }

  function lineWithRef(fl: FamilyLine): HTMLElement {
    const p = h(
      'p',
      { className: 'jos-bubble-line' },
      fl.kind === 'cuv-quote' ? `「${fl.text}」` : fl.text,
    );
    if (fl.ref) {
      const ref = fl.ref;
      const refBtn = h('button', { type: 'button', className: 'jos-bubble-ref' }, ref);
      refBtn.addEventListener('click', () => peek.openVerse(ref));
      p.appendChild(refBtn);
    }
    return p;
  }

  function renderBubble(b: BubbleRefs, idx: number): void {
    const key = String(idx);
    if (b.renderedKey === key) return;
    b.renderedKey = key;
    b.textEl.replaceChildren();
    const fl = b.lines[idx];
    b.textEl.appendChild(lineWithRef(fl));
    b.whoEl.textContent = SPEAKER_NAMES[fl.speaker];
    b.whoEl.hidden = false;
    b.el.dataset.speaker = fl.speaker;
    b.w = 0;
    b.h = 0;
    b.placedKey = '';
    b.x = null;
    b.y = null;
    b.lastProgress = -1;
  }

  function tickBubble(panel: Panel, p: number): void {
    const b = panel.bubble;
    if (!b) return;
    const noScene = !scene || !hasWebglScene();
    const n = b.lines.length;
    const idx = Math.max(0, Math.min(n - 1, Math.floor(p * n)));
    renderBubble(b, idx);
    // Idle breathing and pointing change card bounds; they must not reflow speech.
    // Reproject only while scrolling/resizing, then retain the settled placement.
    const viewport = `${innerWidth}:${viewportHeight()}:${topInset}`;
    const changed = b.lastProgress !== p || b.lastViewport !== viewport || !b.placedKey;
    b.lastProgress = p;
    b.lastViewport = viewport;

    if (noScene) {
      b.el.classList.add('jos-bubble-docked');
      b.el.style.transform = '';
      return;
    }
    if (b.w === 0) {
      b.w = b.el.offsetWidth;
      b.h = b.el.offsetHeight;
    }
    const sp = b.lines[idx].speaker;
    if (changed) {
      const candidate = scene!.placeBubble(SPEAKER_ACTORS[sp], b.w, b.h, topInset + 4);
      b.target = candidate ? { ...candidate } : null;
    }
    const placement = b.target;
    if (!placement) {
      // 說話的人不在畫面裡（例如地圖上的一拍）：泡泡留在經文框的位置，不帶尾巴
      b.el.classList.add('jos-bubble-docked');
      b.el.style.transform = '';
      return;
    }
    b.el.classList.remove('jos-bubble-docked');
    b.el.dataset.headY = String(placement.headY);
    b.el.dataset.tailGap = String(placement.headY - (placement.y + b.h));
    b.x = b.x === null ? placement.x : Math.abs(placement.x - b.x) < .75 ? b.x : b.x + (placement.x - b.x) * .16;
    b.y = b.y === null ? placement.y : Math.abs(placement.y - b.y) < .75 ? b.y : b.y + (placement.y - b.y) * .16;
    const key = `${Math.round(b.x)},${Math.round(b.y)},${Math.round(placement.tailX)},${Math.round(placement.tailLen)}`;
    if (key === b.placedKey) return;
    b.placedKey = key;
    b.el.style.transform = `translate(${Math.round(b.x)}px, ${Math.round(b.y)}px)`;
    b.tailEl.style.left = `${Math.round(placement.tailX - 9)}px`;
    b.tailEl.style.borderTopWidth = `${Math.round(placement.tailLen)}px`;
  }

  function activate(next: Panel | null): void {
    if (active) active.el.classList.remove('jos-panel-on');
    active = next;
    if (next) {
      next.el.classList.add('jos-panel-on');
      if (next.verseScrollEl) next.verseScrollEl.scrollTop = 0;
      if (next.bubble) {
        next.bubble.renderedKey = '';
        next.bubble.placedKey = '';
      }
    }
    if (moreCard.isOpen() && moreCard.openBeatId() !== (next?.beat.id ?? '')) moreCard.close(false);
  }

  function tick(): void {
    // 建立 story view 時頂列尚未掛上 DOM；掛載後才量實際高度，並追蹤換行。
    if (!observedHeader) measureHeader();
    const panel = panels.get(state.beat) ?? null;
    if (panel !== active) activate(panel);
    outroHint.hidden = !(panel && panel.beat.id === lastBeatId && state.beatProgress > .3);
    if (!panel) return;
    const p = state.beatProgress;
    const station = sampleStation(panel.beat.id, p);
    const original = data.verseBlocks[primaryRefOf(panel.beat)!];
    const readingStart = panel.headline ? HEADLINE_FADE_TO : 0;
    const readingEnd = panel.note ? .70 : .86;
    const reading = Math.max(0, Math.min(.999999, (p - readingStart) / (readingEnd - readingStart)));
    const sourceProgress = station ? Math.min(.999999, station.p / (panel.note ? .70 : 1)) : reading;
    const currentLines = storyLines(panel.beat, data, station?.station);
    const verseCount = Math.max(1, currentLines.length);
    // 每一節分到的捲動長度依字數，長的節不會被短的節擠掉停留時間
    const verseWeights = currentLines.map(line => verseWeight(line.text));
    const weightTotal = verseWeights.reduce((sum, w) => sum + w, 0) || 1;
    let verseIndex = 0, verseStart = 0;
    while (verseIndex < verseCount - 1 && sourceProgress * weightTotal >= verseStart + verseWeights[verseIndex]) {
      verseStart += verseWeights[verseIndex++];
    }
    const verseShare = (verseWeights[verseIndex] ?? weightTotal) / weightTotal;
    const verseLocal = Math.max(0, Math.min(.999999, (sourceProgress * weightTotal - verseStart) / (verseWeights[verseIndex] ?? weightTotal)));
    const selectedVerse = currentLines[verseIndex]?.v;
    const placement = station ? stationLayouts[station.station.id] : verseLayouts[panel.beat.cue];
    panel.el.dataset.verseLayout = placement.position;
    panel.el.dataset.verseTone = placement.tone;
    panel.el.style.setProperty('--jos-story-width', `${placement.width}vw`);
    panel.el.style.setProperty('--jos-story-mobile-width', `${placement.mobileWidth}vw`);
    if (panel.verse && original) {
      const verseEl = panel.verse.el;
      const verseKey = `${station?.station.id ?? panel.beat.id}:${selectedVerse}:${state.onlyI}:${state.sameGive}`;
      if (verseEl.dataset.stationVerse !== verseKey) {
        const lines = currentLines.filter(line => line.v === selectedVerse);
        const ref = `${original.abbr}${original.chapter}:${selectedVerse}`;
        verseEl.replaceChildren(h('small', { className: 'jos-story-ref', 'data-glyph': ref }, ref), ...lines.map(line => renderVerseLineWithSpans(original.abbr, original.chapter,
          line, panel.beat.focusSubstrings, state, data, Boolean(station))));
        verseEl.dataset.stationVerse = verseKey;
        verseEl.dataset.verse = String(selectedVerse);
        verseEl.setAttribute('aria-label', ref);
        verseEl.scrollTop = 0;
      }
      if (station && panel.slot && panel.beat.balakStages) {
        // 飛行途中不顯示；牌只在翻到接近正面時才浮現，不會停在邊緣翻到一半的樣子。
        panel.slot.style.visibility = station.station.id === 'moab' && !station.flight ? 'visible' : 'hidden';
        const stage = Math.min(2, Math.floor(station.p * 3));
        panel.slot.querySelectorAll<HTMLElement>('.jos-balak-card').forEach((card, i) => {
          card.hidden = i !== stage;
          const turn = (station.p * 3) % 1;
          card.style.transform = state.motionOff ? '' : `perspective(500px) rotateX(${(1 - smoothstep(0, .15, turn)) * -75}deg)`;
          card.style.opacity = state.motionOff ? '' : String(smoothstep(.02, .1, turn));
        });
      }
    }
    const weights = voiceWeights(station ? station.p : p, Boolean(panel.note));
    const noteW = !original && panel.note
      ? smoothstep(.06, .18, p) * (1 - smoothstep(.90, 1, p)) : weights.note;
    const headW = panel.headline ? 1 - smoothstep(HEADLINE_FADE_FROM, HEADLINE_FADE_TO, p) : 0;
    const verseFade = 1 - smoothstep(.86, 1, verseLocal);
    const verseW = (1 - headW) * weights.verse * verseFade * (station?.flight ? 0 : 1);
    setWeight(panel.headline, headW * (1 - noteW));
    setWeight(panel.verse, verseW);
    setWeight(panel.note, noteW);
    if (panel.beat.interaction === 'epilogue-diff' && panel.slot) {
      // 終幕兩欄：捲一段亮一組，只留前一組淡淡在上面，不在面板裡另外捲動。
      const rows = panel.slot.querySelectorAll<HTMLElement>('[data-diff-row]');
      const current = Math.min(rows.length - 1, Math.floor(Math.min(.999, p / .94) * rows.length));
      rows.forEach((row, index) => {
        row.dataset.diffState = index === current ? 'current' : index === current - 1 ? 'previous' : index < current ? 'past' : 'future';
      });
    }
    const sentences = panel.verse?.el.querySelectorAll<HTMLElement>('.jos-story-sentence');
    const secondsPerVerse = (station
      ? stationRhythm(station.station, data).seconds * (panel.note ? .70 : 1)
      : beatPlaybackSeconds(panel.beat, data) * (readingEnd - readingStart)) * verseShare;
    // 句子出現的時間點依字數分配，每組最後一句另有停留（sentencePlan），不會出現一下就換掉。
    const sentenceWeights = sentencePlan(currentLines[verseIndex]?.text ?? '').weights;
    const sentenceTotal = sentenceWeights.reduce((sum, w) => sum + w, 0) || 1;
    const sentenceStarts: number[] = [];
    let sentenceCum = 0;
    for (const w of sentenceWeights) { sentenceStarts.push(.025 + sentenceCum / sentenceTotal * SENTENCE_SPREAD); sentenceCum += w; }
    let latest = 0;
    sentenceStarts.forEach((start, i) => { if (verseLocal >= start) latest = i; });
    sentences?.forEach((sentence, index) => {
      const start = sentenceStarts[index];
      const rate = state.autoplaying ? paceRate(state.playbackRate) : 1;
      const duration = sentenceRevealSeconds(rate) * rate / secondsPerVerse;
      const reveal = (verseLocal - start) / duration;
      // Three phrases per inscription keep the open part of the painting clear.
      sentence.hidden = Math.floor(index / GROUP_SIZE) !== Math.floor(latest / GROUP_SIZE);
      sentence.style.visibility = reveal <= 0 ? 'hidden' : 'visible';
      sentence.style.opacity = '1';
      const chars = sentence.querySelectorAll<HTMLElement>('.jos-story-char');
      chars.forEach((char, i) => {
        const alpha = state.motionOff ? (reveal > 0 ? 1 : 0) : smoothstep(i / chars.length * .8, i / chars.length * .8 + .2, reveal);
        char.style.opacity = String(alpha);
      });
    });
    if (panel.kicker) setWeight(panel.kicker, 1 - smoothstep(KICKER_FADE_FROM, KICKER_FADE_TO, p));
    if (panel.stackEl) {
      // 疊在一起的小框，高度取目前各框高度的加權平均，更多鈕貼著看得見的那個框
      let hh = 0;
      if (panel.headline) hh += panel.headline.el.offsetHeight * headW * (1 - noteW);
      if (panel.verse) hh += panel.verse.el.offsetHeight * verseW;
      if (panel.note) hh += panel.note.el.offsetHeight * noteW;
      const rounded = Math.round(hh);
      if (rounded !== panel.stackH) {
        panel.stackH = rounded;
        panel.stackEl.style.height = `${rounded}px`;
      }
    }
    tickBubble(panel, p);
  }

  function buildRaiseWidget(): HTMLElement {
    // 第26節「按住，把石頭立起來」
    const holdBtn = h(
      'button',
      { type: 'button', className: 'jos-raise-btn', 'data-coach': 'raise-btn' },
      '按住，把石頭立起來',
    );
    const fillBar = h('div', { className: 'jos-raise-fill' });
    const statusSpan = h('span', { className: 'jos-widget-stat' }, '按住按鈕不放，大石頭就會在橡樹下立起來。');

    let fallbackRaf = 0;
    let lastTs = 0;

    const syncLocalRaise = () => {
      const pct = Math.round(state.raiseStone.progress * 100);
      fillBar.style.width = `${pct}%`;
      if (state.raiseStone.done) {
        holdBtn.textContent = '大石頭已立在橡樹下';
        holdBtn.classList.add('jos-raise-btn-done');
        statusSpan.textContent = '石頭立好了。';
      } else {
        holdBtn.textContent = state.raiseStone.holding ? `正在立起石頭…… ${pct}%` : '按住，把石頭立起來';
        holdBtn.classList.remove('jos-raise-btn-done');
      }
    };
    raiseSyncFns.push(syncLocalRaise);

    const tickFallback = (ts: number) => {
      if (!state.raiseStone.holding || state.raiseStone.done) return;
      const dt = lastTs ? Math.min(0.1, (ts - lastTs) / 1000) : 0.016;
      lastTs = ts;
      state.raiseStone.progress = Math.min(1, state.raiseStone.progress + dt * 0.65);
      if (state.raiseStone.progress >= 1) {
        state.raiseStone.done = true;
        state.raiseStone.holding = false;
      }
      syncLocalRaise();
      onStateChange();
      if (state.raiseStone.holding && !state.raiseStone.done) {
        fallbackRaf = window.requestAnimationFrame(tickFallback);
      }
    };

    const startHold = () => {
      if (state.raiseStone.done) return;
      if (state.motionOff) {
        state.raiseStone.progress = 1;
        state.raiseStone.done = true;
        syncLocalRaise();
        onStateChange();
        return;
      }
      state.raiseStone.holding = true;
      syncLocalRaise();
      onStateChange();
      if (!hasWebglScene()) {
        lastTs = 0;
        window.cancelAnimationFrame(fallbackRaf);
        fallbackRaf = window.requestAnimationFrame(tickFallback);
      }
    };

    const stopHold = () => {
      if (!state.raiseStone.holding) return;
      state.raiseStone.holding = false;
      window.cancelAnimationFrame(fallbackRaf);
      syncLocalRaise();
      onStateChange();
    };

    holdBtn.addEventListener('pointerdown', startHold);
    holdBtn.addEventListener('pointerup', stopHold);
    holdBtn.addEventListener('pointerleave', stopHold);
    holdBtn.addEventListener('pointercancel', stopHold);
    holdBtn.addEventListener('keydown', (e) => {
      if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
        e.preventDefault();
        state.raiseStone.progress = 1;
        state.raiseStone.done = true;
        state.raiseStone.holding = false;
        syncLocalRaise();
        onStateChange();
      }
    });

    syncLocalRaise();
    return h(
      'div',
      { className: 'jos-wcard jos-raise-floating' },
      h('div', { className: 'jos-raise-row' }, holdBtn, statusSpan),
      h('div', { className: 'jos-raise-track' }, fillBar),
    );
  }

  function buildDiffWidget(): HTMLElement {
    // 終幕雙欄平行經文自動比對（書24:28-31 vs 士2:6-10）：這是經文，照舊留在畫面上
    const diff = buildParallelDiff(data.verses);
    const wrap = h('div', { className: 'jos-wcard jos-diff-wrap' });

    for (const pair of diff.pairs) {
      const leftP = h('p', { className: 'jos-diff-text' });
      const rightP = h('p', { className: 'jos-diff-text' });

      for (const s of pair.segments) {
        if (s.kind === 'same') {
          leftP.appendChild(document.createTextNode(s.leftText));
          rightP.appendChild(document.createTextNode(s.rightText));
        } else {
          if (s.leftText) leftP.appendChild(h('span', { className: 'jos-diff-hl' }, s.leftText));
          if (s.rightText) rightP.appendChild(h('span', { className: 'jos-diff-hl' }, s.rightText));
        }
      }

      wrap.appendChild(
        h(
          'div',
          { className: 'jos-diff-pair', 'data-diff-row': String(wrap.childElementCount) },
          h(
            'div',
            { className: 'jos-diff-col' },
            h(
              'div',
              { className: 'jos-diff-ref' },
              h('span', null, pair.leftRef),
              pair.reordered ? h('span', { className: 'jos-diff-reorder-tag' }, '次序對調') : null,
            ),
            leftP,
          ),
          h(
            'div',
            { className: 'jos-diff-col' },
            h(
              'div',
              { className: 'jos-diff-ref' },
              h('span', null, pair.rightRef),
              pair.reordered ? h('span', { className: 'jos-diff-reorder-tag' }, '次序對調') : null,
            ),
            rightP,
          ),
        ),
      );
    }

    for (const un of diff.unmatchedRight) {
      const echoNote =
        un.negatedEchoes.length > 0
          ? `（對照左欄 ${un.negatedEchoes.map((e) => `${e.leftRef}『${e.word}』→ 此處『${e.negatedWord}』`).join('；')}）`
          : '';

      const p = h('p', { className: 'jos-diff-text' });
      let rest = un.text;
      for (const ec of un.negatedEchoes) {
        const parts = rest.split(ec.negatedWord);
        if (parts.length > 1) {
          p.replaceChildren();
          parts.forEach((part, idx) => {
            if (part) p.appendChild(document.createTextNode(part));
            if (idx < parts.length - 1) {
              p.appendChild(h('span', { className: 'jos-diff-hl' }, ec.negatedWord));
            }
          });
          rest = '';
          break;
        }
      }
      if (rest) p.textContent = rest;

      wrap.appendChild(
        h(
          'div',
          { className: 'jos-diff-unmatched', 'data-diff-row': String(wrap.childElementCount) },
          h('div', { className: 'jos-diff-ref' }, `${un.ref}（右欄多出的一節）${echoNote}`),
          p,
        ),
      );
    }
    return wrap;
  }

  function buildJumpRow(): HTMLElement {
    const jumpSecBtn = h(
      'button',
      { type: 'button', className: 'jos-secondary-btn' },
      `繼續往下讀：05 ${data.section05Title} ↓`,
    );
    jumpSecBtn.addEventListener('click', () => {
      scrollToElement(document.getElementById('jos-sec-05'), state, { label: '終幕平行經文' }, onStateChange);
    });
    return h('div', { className: 'jos-wcard jos-jump-row' }, jumpSecBtn);
  }

  measureHeader();

  return {
    element: main,
    rerenderHighlights,
    syncRaiseUi,
    tick,
    attachScene(s) {
      scene = s;
    },
    setHidden(hidden) {
      overlay.classList.toggle('jos-onevoice-hidden', hidden);
      if (hidden && moreCard.isOpen()) moreCard.close(false);
    },
  };
}
