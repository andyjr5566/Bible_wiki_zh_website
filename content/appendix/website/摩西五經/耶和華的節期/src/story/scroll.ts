/**
 * 捲動綁定：用 ScrollTrigger 把每個 <section>（一拍）的捲動進度寫進共享的 story 物件。
 * - 捲動直接帶動畫面（進度與捲動位置一對一，沒有時間差），讀者停下來畫面也停。
 * - 不用 Lenis／smooth scroll，不用 scrollIntoView，不自動捲頁。
 * - 「目前這一拍」＝畫面 60% 高度的那條線正落在哪個 section 裡，所以下一個說明框滑入時畫面就開始轉場。
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { story } from './state';
import { clamp } from '../ui/dom';

gsap.registerPlugin(ScrollTrigger);
// 手機網址列收合造成的高度變化不要整頁重算，避免捲動位置跳動
ScrollTrigger.config({ ignoreMobileResize: true });

export interface BeatInfo {
  chapterId: string;
  chapterKind: 'opening' | 'feast' | 'passage';
  beatId: string;
  cue: string;
  /** 這一拍月亮對應的日子（1–30）；dayTo 有值時在拍內從 day 走到 dayTo */
  day?: number;
  dayTo?: number;
  /** 這一拍所屬章的月份（開場章是 1）；沒有就是 undefined，story.month 維持前一個值 */
  month?: number;
  /** passage（無字過場）：月份導覽隨這一拍的捲動從 month 依序走到 monthTo */
  monthTo?: number;
  /** 回聲拍（後來的歷史）：寫進 story.later */
  later?: boolean;
  interaction?: 'hyssop' | 'bake' | 'wave' | 'count' | 'blow';
  el: HTMLElement;
  box: HTMLElement;
}

export interface ScrollController {
  /** 目前所在的拍（0 起算） */
  index(): number;
  refresh(): void;
}

/** 畫面上的這條線（視窗高度的比例）決定「目前這一拍」 */
export const LINE = 0.6;

/** 系統偏好：暗色。即時寫進 story。動態開關另見 src/ui/motion.ts（預設有動態，不跟系統的減少動態）。 */
export function bindPreferences(): void {
  const dark = window.matchMedia('(prefers-color-scheme: dark)');
  story.dark = dark.matches;
  const fn = (m: boolean) => {
    story.dark = m;
  };
  if (dark.addEventListener) dark.addEventListener('change', (e) => fn(e.matches));
  else (dark as MediaQueryList).addListener((e) => fn(e.matches));
}

export function initScroll(beats: BeatInfo[], onBeat: (index: number, prev: number) => void): ScrollController {
  const n = beats.length;
  const triggers: ScrollTrigger[] = [];
  const starts = new Array<number>(n).fill(0);
  const ends = new Array<number>(n).fill(1);
  let current = -1;

  // 月亮的日子：同一章裡，每個有 day 的拍在 0.3–0.7 停在自己的日子，相鄰兩拍之間連續內插；
  // 有 dayTo 的拍在 0.2–0.8 從 day 走到 dayTo。沒有 day 的章維持前一章最後的日子；
  // 章首、章尾的日子之外不內插到別章（章與章之間用轉場接，不讓月亮漂過去）。
  const dayPts = new Map<string, { s: number; d: number }[]>();
  beats.forEach((b, i) => {
    if (b.day === undefined) return;
    const list = dayPts.get(b.chapterId) ?? [];
    if (b.dayTo !== undefined) list.push({ s: i + 0.2, d: b.day }, { s: i + 0.8, d: b.dayTo });
    else list.push({ s: i + 0.3, d: b.day }, { s: i + 0.7, d: b.day });
    dayPts.set(b.chapterId, list);
  });
  // 沒有 day 的章：沿用前面最近一章的最後一個日子（一開始是 1）
  const dayHold = new Map<string, number>();
  {
    let carry = 1;
    const seen = new Set<string>();
    for (const b of beats) {
      if (seen.has(b.chapterId)) continue;
      seen.add(b.chapterId);
      const list = dayPts.get(b.chapterId);
      if (list) carry = list[list.length - 1].d;
      else dayHold.set(b.chapterId, carry);
    }
  }
  function dayAt(i: number, p: number): number {
    const id = beats[i].chapterId;
    const pts = dayPts.get(id);
    if (!pts) return dayHold.get(id) ?? story.day;
    const s = i + p;
    if (s <= pts[0].s) return pts[0].d;
    const last = pts[pts.length - 1];
    if (s >= last.s) return last.d;
    let k = 0;
    while (k < pts.length - 2 && s > pts[k + 1].s) k++;
    const a = pts[k];
    const b = pts[k + 1];
    return a.d + ((b.d - a.d) * (s - a.s)) / (b.s - a.s);
  }

  // 月份：章有 month 就用，開場是 1，沒有就沿用前一個
  const monthOf: number[] = [];
  {
    let carry = 1;
    beats.forEach((b, i) => {
      if (b.month) carry = b.month;
      else if (b.chapterKind === 'opening') carry = 1;
      monthOf[i] = carry;
    });
  }

  // 七七節數算：count 那一拍內從 0 走到 50；之前是 0，之後是 50
  const countIdx = beats.findIndex((b) => b.interaction === 'count');
  const COUNT_FROM = 0.1;
  const COUNT_TO = 0.72;

  // 每章的起訖拍
  const chapterSpan = new Map<string, { first: number; last: number }>();
  beats.forEach((b, i) => {
    const c = chapterSpan.get(b.chapterId);
    if (c) c.last = i;
    else chapterSpan.set(b.chapterId, { first: i, last: i });
  });

  function recompute() {
    for (let i = 0; i < n; i++) {
      const st = triggers[i];
      if (!st) continue;
      starts[i] = i === 0 ? 0 : st.start;
      ends[i] = st.end;
    }
  }

  function sync(y: number) {
    let i = 0;
    while (i < n - 1 && y >= starts[i + 1]) i++;
    const span = Math.max(1, ends[i] - starts[i]);
    const p = clamp((y - starts[i]) / span);
    const b = beats[i];
    if (i !== current) {
      const prev = current;
      current = i;
      story.chapter = b.chapterId;
      story.beat = b.beatId;
      story.cue = b.cue;
      story.prevCue = i > 0 ? beats[i - 1].cue : b.cue;
      onBeat(i, prev);
    }
    story.beatProgress = p;
    const cs = chapterSpan.get(b.chapterId)!;
    const c0 = starts[cs.first];
    const c1 = ends[cs.last];
    story.chapterProgress = clamp((y - c0) / Math.max(1, c1 - c0));
    story.pageProgress = clamp(y / Math.max(1, ScrollTrigger.maxScroll(window)));
    story.day = dayAt(i, p);
    story.later = !!b.later;
    story.month = monthOf[i];
    if (b.chapterKind === 'passage' && b.month !== undefined && b.monthTo !== undefined) {
      // 無字過場：依拍內進度把 month..monthTo 逐月點亮（三、四、五、六月各佔四分之一）
      const months = b.monthTo - b.month + 1;
      story.month = b.month + Math.min(months - 1, Math.floor(p * months));
    }
    if (countIdx >= 0) story.count = i < countIdx ? 0 : i > countIdx ? 50 : 50 * clamp((p - COUNT_FROM) / (COUNT_TO - COUNT_FROM));
  }

  beats.forEach((b, i) => {
    const st = ScrollTrigger.create({
      trigger: b.el,
      start: () => (i === 0 ? 0 : `top ${LINE * 100}%`),
      end: () => `bottom ${LINE * 100}%`,
      onRefresh: () => {
        recompute();
        sync(window.scrollY);
      },
      onUpdate: (self) => sync(self.scroll()),
      onLeave: (self) => {
        // 最後一拍之後（章末、頁尾）：進度停在 1
        if (i === n - 1) sync(self.scroll());
      },
    });
    triggers.push(st);

    // 說明框進場：捲進來時淡入並從下方滑上來（減少動態時只淡入，見 CSS）
    ScrollTrigger.create({
      trigger: b.el,
      start: 'top 80%',
      end: 'bottom 15%',
      toggleClass: { targets: b.box, className: 'jf-in' },
    });
  });

  // 整頁進度：最後一拍之後（章末、頁尾）也要繼續走到 1
  ScrollTrigger.create({
    start: 0,
    end: 'max',
    onUpdate: (self) => {
      story.pageProgress = self.progress;
    },
  });

  recompute();
  sync(window.scrollY);
  // 平時不另外起迴圈；ScrollTrigger 在捲動時會呼叫 onUpdate

  return {
    index: () => Math.max(0, current),
    refresh: () => ScrollTrigger.refresh(),
  };
}
