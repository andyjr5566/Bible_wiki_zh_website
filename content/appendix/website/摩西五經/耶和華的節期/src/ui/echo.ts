/**
 * 回聲：舊約後來的歷史（Beat.echoes）與被它呼應的拍之間的連結。
 * - 回聲拍的說明框：左上「後來」小標籤（beats.ts）、經文出處寫全書名、文字下方「呼應」小標列出被呼應的拍。
 * - 被呼應的拍反向顯示一行「後來：約書亞記 5 章」（從 echoes 反推，不寫在 yaml）。
 * - 回看（Beat.recall）：說明框裡一行「回看」小標＋被回看的拍，點了用同一套跳轉；不是「後來」，
 *   不換舊紙配色、不顯示「後來」標籤，被回看的拍也不反向顯示連結。
 * - 點連結 → 沿用月份導覽的跳轉（刻線抹除＋window.scrollTo({behavior:'instant'})）；
 *   跳過去以後，畫面角落出現「回到：…」小按鈕，8 秒後或捲動超過一個螢幕高就消失。
 * - 沒有平滑捲動、沒有 scrollIntoView。
 */
import { SITE } from '../data/site';
import type { Beat, StoryChapter } from '../data/types';
import { h } from './dom';
import type { Nav } from './nav';
import { chapterLabel } from './text';

const RETURN_MS = 8000;

interface Entry {
  chapter: StoryChapter;
  beat: Beat;
}

export interface EchoUI {
  /** 回聲拍說明框裡的「呼應」小節；不是回聲拍回 null */
  echoesSection(beat: Beat): HTMLElement | null;
  /** 回看小節（Beat.recall）：「回看」小標＋被回看的拍；沒有 recall 回 null */
  recallSection(beat: Beat): HTMLElement | null;
  /** 被呼應的拍反向的「後來」連結；沒有人呼應它回 null */
  laterLinks(beat: Beat): HTMLElement | null;
  setNav(nav: Nav): void;
  /** 跳到某一拍（刻線抹除＋瞬間定位）；不顯示「回到」按鈕。章末「看故事裡的這一段」用 */
  jumpToBeat(beatId: string): void;
  /** 每幀呼叫（便宜）：「回到」按鈕捲動超過一個螢幕高就收起來 */
  update(): void;
}

export const beatDomId = (chapter: StoryChapter, beat: Beat): string => `jf-beat-${chapter.id}-${beat.id}`;

export function createEchoUI(host: HTMLElement): EchoUI {
  const byId = new Map<string, Entry>();
  for (const chapter of SITE.chapters) for (const beat of chapter.beats) byId.set(beat.id, { chapter, beat });
  /** 被呼應的拍 id → 呼應它的回聲拍 */
  const echoedBy = new Map<string, Entry[]>();
  for (const e of byId.values()) {
    for (const id of e.beat.echoes ?? []) echoedBy.set(id, [...(echoedBy.get(id) ?? []), e]);
  }

  let nav: Nav | null = null;
  let timer = 0;
  let fromY = 0;
  let target: Entry | null = null;

  const back = h('button', { type: 'button', class: 'jf-btn jf-return', hidden: true }) as HTMLButtonElement;
  back.addEventListener('click', () => {
    const t = target;
    hideBack();
    if (t) go(t, null);
  });
  host.append(back);

  function hideBack() {
    back.hidden = true;
    target = null;
    window.clearTimeout(timer);
  }

  /** 這一拍的經文出處（短）：「利23:14」；沒有經文回空字串 */
  const shortRef = (e: Entry): string => (e.beat.verse ? (SITE.verses[e.beat.verse]?.ref ?? '') : '');
  /** 被呼應的拍的名稱：「初熟的禾捆・利23:14」 */
  const targetLabel = (e: Entry): string => {
    const r = shortRef(e);
    return r ? `${e.chapter.title}・${r}` : e.chapter.title;
  };
  /** 回聲拍的名稱：「約書亞記 5 章」 */
  const echoLabel = (e: Entry): string => {
    const block = e.beat.verse ? SITE.verses[e.beat.verse] : undefined;
    return block ? chapterLabel(block) : e.chapter.title;
  };

  function go(to: Entry, origin: Entry | null) {
    const el = document.getElementById(beatDomId(to.chapter, to.beat));
    if (!el || !nav) return;
    nav.jumpTo(el, () => {
      if (!origin) return;
      // 畫面已被刻線蓋住、位置已換好：記下新位置，顯示「回到」
      fromY = window.scrollY;
      target = origin;
      back.textContent = `回到：${origin.beat.echoes?.length ? echoLabel(origin) : targetLabel(origin)}`;
      back.hidden = false;
      window.clearTimeout(timer);
      timer = window.setTimeout(hideBack, RETURN_MS);
    });
  }

  function link(label: string, to: Entry, origin: Entry, cls: string): HTMLElement {
    return h('button', {
      type: 'button',
      class: `jf-echo-link ${cls}`,
      'data-to': to.beat.id,
      onclick: () => go(to, origin),
    }, label);
  }

  return {
    echoesSection(beat) {
      if (!beat.echoes?.length) return null;
      const origin = byId.get(beat.id)!;
      const items = beat.echoes.map((id) => byId.get(id)).filter((e): e is Entry => !!e);
      if (!items.length) return null;
      return h('div', { class: 'jf-echoes' },
        h('p', { class: 'jf-echoes-h' }, '呼應'),
        h('ul', { class: 'jf-echoes-list' },
          items.map((e) => h('li', null, link(targetLabel(e), e, origin, 'jf-echo-to')))));
    },
    recallSection(beat) {
      if (!beat.recall?.length) return null;
      const origin = byId.get(beat.id)!;
      const items = beat.recall.map((id) => byId.get(id)).filter((e): e is Entry => !!e);
      if (!items.length) return null;
      return h('div', { class: 'jf-echoes jf-recall' },
        h('p', { class: 'jf-echoes-h' }, '回看'),
        h('ul', { class: 'jf-echoes-list' },
          items.map((e) => h('li', null, link(targetLabel(e), e, origin, 'jf-echo-to jf-recall-to')))));
    },
    laterLinks(beat) {
      const list = echoedBy.get(beat.id);
      if (!list?.length) return null;
      const origin = byId.get(beat.id)!;
      return h('div', { class: 'jf-laters' },
        list.map((e) => h('p', { class: 'jf-later-line' },
          h('span', { class: 'jf-later-k' }, '後來：'),
          link(echoLabel(e), e, origin, 'jf-echo-later'))));
    },
    setNav(n) {
      nav = n;
    },
    jumpToBeat(beatId) {
      const e = byId.get(beatId);
      if (e) go(e, null);
    },
    update() {
      if (back.hidden) return;
      if (Math.abs(window.scrollY - fromY) > window.innerHeight) hideBack();
    },
  };
}
