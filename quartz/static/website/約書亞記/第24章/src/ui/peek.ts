import { chapterUrl, entryUrl } from '../data/links';
import type { CuvSpanRef, SiteData } from '../data/types';
import type { StoryState } from '../story/state';
import { h } from './dom';
import { cueForVerse, reviewJumpToCue, reviewNavigate } from './review-navigation';
import { highlightedText } from './review-text';

export interface VersePeekOptions {
  highlights?: CuvSpanRef[];
  onStory?: () => void;
}

export interface PeekController {
  element: HTMLElement;
  openEntry(entryKey: string): void;
  openVerse(ref: string, options?: VersePeekOptions): void;
  openPlace(placeId: string): void;
  close(): void;
}

export function createPeekDrawer(
  data: SiteData,
  state: StoryState,
  onStateChange: () => void,
): PeekController {
  const kickerEl = h('div', { className: 'jos-peek-kicker' });
  const titleEl = h('h3', { className: 'jos-peek-title' });
  const bodyEl = h('div', { className: 'jos-peek-body' });
  const linksEl = h('div', { className: 'jos-peek-links' });

  const closeBtn = h('button', { type: 'button', className: 'jos-peek-close' }, '關閉');
  const panel = h(
    'div',
    { className: 'jos-peek-panel', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'jos-peek-title', tabindex: '-1' },
    h('div', { className: 'jos-peek-head' }, h('div', null, kickerEl, titleEl), closeBtn),
    bodyEl,
    linksEl,
  );

  const backdrop = h('div', { className: 'jos-peek-backdrop jos-peek-hidden' }, panel);
  titleEl.id = 'jos-peek-title';
  let opener: HTMLElement | null = null;
  let visible = false;
  const inertBefore = new Map<HTMLElement, boolean>();

  function close(restoreFocus = true): void {
    backdrop.classList.add('jos-peek-hidden');
    visible = false;
    for (const [element, inert] of inertBefore) element.inert = inert;
    inertBefore.clear();
    if (restoreFocus && opener?.isConnected) opener.focus({ preventScroll: true });
  }

  closeBtn.addEventListener('click', () => close());
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && visible) {
      close();
    }
    if (e.key === 'Tab' && visible) {
      const controls = [...panel.querySelectorAll<HTMLElement>('button, a[href], [tabindex="0"]')].filter(el => !el.hidden);
      const first = controls[0], last = controls[controls.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === panel)) {
        e.preventDefault(); last?.focus({ preventScroll: true });
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first?.focus({ preventScroll: true });
      }
    }
  });

  function show(): void {
    if (!visible) {
      opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const app = backdrop.parentElement;
      if (app) for (const sibling of app.children) {
        if (sibling !== backdrop && sibling instanceof HTMLElement) {
          inertBefore.set(sibling, sibling.inert);
          sibling.inert = true;
        }
      }
    }
    visible = true;
    backdrop.classList.remove('jos-peek-hidden');
    bodyEl.scrollTop = 0;
    closeBtn.focus({ preventScroll: true });
  }

  function openEntry(entryKey: string): void {
    const meta = data.entries[entryKey];
    if (!meta) return;
    kickerEl.textContent = `知識庫條目・${meta.type}`;
    titleEl.textContent = meta.title;
    bodyEl.replaceChildren(h('p', null, meta.summary));
    linksEl.replaceChildren(
      h(
        'a',
        {
          className: 'jos-ext-link',
          href: entryUrl(meta.type, meta.title),
          target: '_blank',
          rel: 'noopener noreferrer',
        },
        '查看完整條目（另開網頁） ↗',
      ),
    );
    show();
  }

  function openVerse(ref: string, options: VersePeekOptions = {}): void {
    const blk = data.verseBlocks[ref];
    if (!blk) return;
    kickerEl.textContent = '和合本經文';
    titleEl.textContent = blk.ref;
    const box = h('div', { className: 'jos-verse-box' });
    for (const ln of blk.lines) {
      box.appendChild(
        h(
          'p',
          { className: 'jos-verse-line' },
          h('span', { className: 'jos-verse-num' }, String(ln.v)),
          highlightedText(ln.text, options.highlights),
        ),
      );
    }
    bodyEl.replaceChildren(box);
    linksEl.replaceChildren();
    const verseMatch = /^書24:(\d+)/.exec(ref);
    const cue = verseMatch ? cueForVerse(data, +verseMatch[1]) : undefined;
    const storyAction = options.onStory ?? (cue ? () => reviewJumpToCue(cue, state, onStateChange) : undefined);
    if (storyAction) {
      const storyButton = h('button', { type: 'button', className: 'jos-primary-btn', 'data-coach': 'jump-story-btn' }, '在故事裡看 ↑');
      storyButton.addEventListener('click', () => { close(false); storyAction(); });
      linksEl.append(storyButton);
    }
    if (blk.kb) {
      linksEl.appendChild(
        h(
          'a',
          {
            className: 'jos-ext-link',
            href: chapterUrl(blk.book, blk.chapter),
            target: '_blank',
            rel: 'noopener noreferrer',
          },
          `前往〈${blk.book.replace(/^\d+\s*/, '')} 第${blk.chapter}章〉研讀 ↗`,
        ),
      );
    }
    show();
  }

  function openPlace(placeId: string): void {
    const p = data.places[placeId];
    if (!p) return;
    kickerEl.textContent = p.unlocated
      ? '聖經地點・◌ 位置不詳（只是可能在這一帶）'
      : p.uncertain
        ? '聖經地點・◌ 只是可能在這一帶'
        : '聖經地點';
    titleEl.textContent = p.nameZh;

    const frag = document.createDocumentFragment();
    frag.appendChild(h('p', null, p.summary));
    frag.appendChild(
      h(
        'p',
        { className: 'jos-widget-stat' },
        `地理位置：${p.modernLabel}`,
      ),
    );
    if (p.controversy) {
      frag.appendChild(
        h(
          'p',
          { className: 'jos-widget-stat' },
          `位置的其他說法：${p.controversy}`,
        ),
      );
    }
    if (p.verses.length > 0) {
      frag.appendChild(h('p', { className: 'jos-widget-stat' }, `相關經節：${p.verses.join('、')}`));
    }
    bodyEl.replaceChildren(frag);

    linksEl.replaceChildren();
    const mapJumpBtn = h(
      'button',
      { type: 'button', className: 'jos-chip' },
      '到地圖看',
    );
    mapJumpBtn.addEventListener('click', () => {
      close(false);
      const marker = document.querySelector(`[data-review-place="${CSS.escape(p.id)}"]`);
      const target =
        marker?.closest<HTMLElement>('figure') ?? document.getElementById(`jos-place-card-${p.id}`) ?? document.getElementById('jos-review-places');
      if (target instanceof HTMLDetailsElement) target.open = true;
      const parent = target?.closest('details');
      if (parent) parent.open = true;
      reviewNavigate(target, state, onStateChange, true);
    });
    linksEl.appendChild(mapJumpBtn);
    const stoneCue = data.sevenStones.find(stone => stone.placeId === placeId)?.storyCue;
    const relatedBeat = data.segments.flatMap(segment => segment.beats).find(beat => beat.placeLinks?.includes(placeId));
    const cue = stoneCue ?? relatedBeat?.cue;
    if (cue) {
      const storyButton = h('button', { type: 'button', className: 'jos-primary-btn' }, '在故事裡看 ↑');
      storyButton.addEventListener('click', () => { close(false); reviewJumpToCue(cue, state, onStateChange); });
      linksEl.append(storyButton);
    }

    if (p.entryKey && data.entries[p.entryKey]) {
      const em = data.entries[p.entryKey];
      linksEl.appendChild(
        h(
          'a',
          {
            className: 'jos-ext-link',
            href: entryUrl(em.type, em.title),
            target: '_blank',
            rel: 'noopener noreferrer',
          },
          `〈${em.title}〉條目 ↗`,
        ),
      );
    }
    show();
  }

  return {
    element: backdrop,
    openEntry,
    openVerse,
    openPlace,
    close,
  };
}
