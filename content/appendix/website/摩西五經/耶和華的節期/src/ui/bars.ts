/**
 * 長條圖（Beat.bars）：住棚節 bulls 拍的七根直條。
 * - 條的長度＝該日那一組獻祭裡名稱以「公牛」開頭的祭牲數目合計；數字一律從 SITE.offerings 算，這裡不寫死。
 * - 隨捲動（beatProgress）一根一根長出來：第 i 根在進度 > i/N 時出現，並在自己的那一段裡長到全高；
 *   目前那一天的條用 accent 色；條頂寫數字，條底寫標籤。
 * - 最下面一行由程式加總：「七日共 N 隻公牛」。
 * - 再下面是「目前那一天」的完整獻祭清單（沿用 offerings 元件）。
 * - 同一張圖做兩份：說明框裡（手機，經文下方）與說明框旁邊（桌機，fixed）；CSS 只顯示其中一份。
 * 沒有場景（WebGL 不可用）時一樣能用：只讀 story.beatProgress。
 */
import { SITE } from '../data/site';
import type { Beat } from '../data/types';
import { clamp, h } from './dom';
import { offeringList } from './offerings';

const CN = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
const cn = (n: number): string => CN[n] ?? String(n);

/** 該組獻祭裡名稱以「公牛」開頭的祭牲數目合計（公牛、公牛犢都算） */
export const bullCount = (ref: string): number =>
  (SITE.offerings[ref]?.items ?? []).filter((i) => i.animal.startsWith('公牛')).reduce((n, i) => n + i.count, 0);

interface Chart {
  beatId: string;
  bars: NonNullable<Beat['bars']>;
  root: HTMLElement;
  cols: HTMLElement[];
  fills: HTMLElement[];
  state: number[];
  day: HTMLElement;
  curDay: number;
  curFrac: number[];
}

export interface BarsUI {
  /** 回傳 {inline, side}：inline 放進說明框，side 放在說明框旁邊（桌機）；side 要自己 append */
  build(beat: Beat, sideAt: 'left' | 'right'): { inline: HTMLElement; side: HTMLElement } | null;
  /** 目前所在的拍改變時呼叫：只有那一拍的 side 圖顯示 */
  setBeat(beatId: string): void;
  /** 每幀呼叫（便宜）：依 progress 更新目前拍的圖 */
  update(beatId: string, progress: number): void;
}

export function createBarsUI(): BarsUI {
  const charts: Chart[] = [];

  function make(beat: Beat, where: 'inline' | 'side', sideAt: 'left' | 'right'): Chart | null {
    const bars = beat.bars ?? [];
    if (!bars.length) return null;
    const counts = bars.map((b) => bullCount(b.ref));
    const max = Math.max(1, ...counts);
    const total = counts.reduce((a, b) => a + b, 0);
    const cols = bars.map((bar, i) =>
      h('div', { class: 'jf-vb', style: `--r:${(counts[i] / max).toFixed(4)}` },
        h('span', { class: 'jf-vb-n' }, String(counts[i])),
        h('i', { class: 'jf-vb-fill' }),
        h('span', { class: 'jf-vb-l' }, bar.label)));
    const day = h('div', { class: 'jf-bars-day' });
    const root = h('figure', { class: 'jf-bars', 'data-where': where, 'data-at': where === 'side' ? sideAt : null },
      h('div', { class: 'jf-bars-plot', 'aria-hidden': 'true' }, cols),
      h('p', { class: 'jf-bars-total' }, `${cn(bars.length)}日共 ${total} 隻公牛`),
      day,
      // 給報讀器：圖是裝飾，數字用文字列一次
      h('p', { class: 'jf-sr' }, bars.map((b, i) => `${b.label} ${counts[i]} 隻公牛。`).join('')));
    return {
      beatId: beat.id,
      bars,
      root,
      cols,
      fills: cols.map((c) => c.querySelector('.jf-vb-fill') as HTMLElement),
      state: cols.map(() => NaN),
      day,
      curDay: -1,
      curFrac: cols.map(() => NaN),
    };
  }

  function build(beat: Beat, sideAt: 'left' | 'right') {
    const a = make(beat, 'inline', sideAt);
    const b = make(beat, 'side', sideAt);
    if (!a || !b) return null;
    b.root.hidden = true;
    charts.push(a, b);
    return { inline: a.root, side: b.root };
  }

  function setBeat(beatId: string) {
    for (const c of charts) {
      if (c.root.dataset.where !== 'side') continue;
      const on = c.beatId === beatId;
      if (on === !c.root.hidden) continue;
      if (on) {
        c.root.hidden = false;
        void c.root.offsetWidth; // 先讓瀏覽器量一次，transition 才會從起點開始
        c.root.classList.add('is-on');
      } else {
        c.root.classList.remove('is-on');
        c.root.hidden = true;
      }
    }
  }

  function update(beatId: string, progress: number) {
    for (const c of charts) {
      if (c.beatId !== beatId) continue;
      const n = c.bars.length;
      const p = clamp(progress);
      // 目前那一天：已經出現的最後一根（還沒有任何一根時看第一天）
      const day = clamp(Math.ceil(p * n) - 1, 0, n - 1);
      for (let i = 0; i < n; i++) {
        // 第 i 根在 p > i/n 時出現，在自己的那一段（長度 1/n）裡長到全高
        const f = Math.ceil(clamp(p * n - i) * 50) / 50; // 向上取整：只要出現（f > 0）就至少有 0.02 的高度，目前日的那根一定畫得出來
        if (f !== c.curFrac[i]) {
          c.curFrac[i] = f;
          c.cols[i].style.setProperty('--f', String(f));
          c.cols[i].classList.toggle('is-on', f > 0);
        }
        const cur = i === day;
        const sig = cur ? 1 : 0;
        if (sig !== c.state[i]) {
          c.state[i] = sig;
          c.cols[i].classList.toggle('is-current', cur);
        }
      }
      if (day !== c.curDay) {
        c.curDay = day;
        const list = offeringList([c.bars[day].ref]);
        c.day.replaceChildren(...(list ? [h('p', { class: 'jf-bars-day-h' }, c.bars[day].label), list] : []));
      }
    }
  }

  return { build, setBeat, update };
}
