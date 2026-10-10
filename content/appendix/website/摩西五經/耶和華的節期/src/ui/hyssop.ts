/**
 * 塗血互動的介面層：
 * - 透明觸控層：只在 scene.interactiveRects() 的區域攔截，把 pointer 事件轉發給 canvas；
 *   第一個矩形（牛膝草把手）touch-action: none，其餘（盆、門框區）只收「點一下」、保留縱向捲動；
 *   這些區域以外照常捲動。
 * - 圓形互動徽章「按住拖曳」，貼在把手矩形旁。
 * - 說明框裡的提示文字、鍵盤可用的按鈕、一行狀態。
 */
import type { SceneEvent, SceneHandle } from '../scene/api';
import { story, type HyssopPart } from '../story/state';
import { h } from './dom';
import { makeFold } from './fold';
import { placeBadge } from './place';

const PART_NAME: Record<HyssopPart, string> = { lintel: '門楣', left: '左門框', right: '右門框' };
const PART_ORDER: HyssopPart[] = ['lintel', 'left', 'right'];

export interface HyssopUI {
  /** 說明框裡的互動區塊（提示、按鈕、狀態） */
  controls(prompt: string): HTMLElement;
  setScene(scene: SceneHandle | null): void;
  onEvent(e: SceneEvent): void;
  /**
   * 每幀：擺放觸控層與徽章（徽章避開 avoid 裡的矩形：說明框、標題列、月份導覽、聲音鈕等固定介面）。
   * 回傳目前可互動的區域（沒有時 null），給說明框選邊用。
   */
  update(active: boolean, avoid?: readonly DOMRect[]): DOMRect[] | null;
}

export function createHyssopUI(canvas: HTMLCanvasElement, host: HTMLElement): HyssopUI {
  let scene: SceneHandle | null = null;
  let flash = '';
  let flashTimer = 0;
  let used = false;
  let dragging = 0;

  const layer = h('div', { class: 'jf-touch-layer', 'aria-hidden': 'true' });
  const badge = h('div', { class: 'jf-badge', 'aria-hidden': 'true' }, h('span', null, '按住'), h('span', null, '拖曳'));
  host.append(layer, badge);

  const divs: HTMLElement[] = [];
  const last: number[][] = [];

  const statuses: HTMLElement[] = [];
  const buttons: { part: HyssopPart | 'dip'; el: HTMLButtonElement }[] = [];
  let lastSig = '';

  function forward(e: PointerEvent) {
    // 轉發成同樣內容的新事件，場景只需要在 canvas 上聽 pointer 事件
    canvas.dispatchEvent(new PointerEvent(e.type, e));
  }

  function ensureDivs(n: number) {
    while (divs.length < n) {
      // 第一個矩形是牛膝草把手：拖曳時整個手勢都給場景（touch-action: none）。
      // 其他矩形（盆、門框區）只需要「點一下」，保留縱向捲動，免得手機上整個畫面中央都捲不動。
      const isDrag = divs.length === 0;
      const d = h('div', { class: isDrag ? 'jf-touch jf-touch-drag' : 'jf-touch jf-touch-tap' });
      if (isDrag) {
        d.addEventListener('pointerdown', (e) => {
          if (e.button > 0) return;
          e.preventDefault();
          try {
            d.setPointerCapture(e.pointerId);
          } catch {
            /* 沒有 capture 也照常轉發 */
          }
          dragging++;
          d.classList.add('is-down');
          forward(e);
        });
        d.addEventListener('pointermove', (e) => {
          if (d.hasPointerCapture?.(e.pointerId)) forward(e);
        });
        const end = (e: PointerEvent) => {
          if (d.classList.contains('is-down')) {
            d.classList.remove('is-down');
            dragging = Math.max(0, dragging - 1);
            forward(e);
          }
        };
        d.addEventListener('pointerup', end);
        d.addEventListener('pointercancel', end);
      } else {
        // 點一下才算：放開時才把「按下＋放開」一起轉給場景。手指一動（開始捲頁）就作廢，
        // 免得在手機上捲頁經過門框就誤觸發蘸血或落空。
        let down: PointerEvent | null = null;
        let sx = 0;
        let sy = 0;
        d.addEventListener('pointerdown', (e) => {
          if (e.button > 0) return;
          down = new PointerEvent('pointerdown', e);
          sx = e.clientX;
          sy = e.clientY;
        });
        d.addEventListener('pointermove', (e) => {
          if (down && Math.hypot(e.clientX - sx, e.clientY - sy) > 10) down = null;
        });
        d.addEventListener('pointerup', (e) => {
          if (!down) return;
          const dn = down;
          down = null;
          canvas.dispatchEvent(dn);
          canvas.dispatchEvent(new PointerEvent('pointerup', e));
        });
        d.addEventListener('pointercancel', () => {
          down = null;
        });
      }
      layer.append(d);
      divs.push(d);
      last.push([NaN, NaN, NaN, NaN]);
    }
  }

  function statusText(): string {
    if (flash) return flash;
    const hs = story.hyssop;
    if (hs.done) return hs.auto ? '已替你補上三處的血' : '三處都打上了';
    const marked = PART_ORDER.filter((p) => hs.marks[p]).map((p) => PART_NAME[p]);
    if (marked.length) return `已打：${marked.join('、')}`;
    return hs.dipped ? '已蘸血，還沒打上' : '還沒蘸血';
  }

  function refreshStatus() {
    const hs = story.hyssop;
    const sig = `${flash}|${hs.dipped}|${hs.done}|${hs.auto}|${hs.marks.lintel}${hs.marks.left}${hs.marks.right}`;
    if (sig === lastSig) return;
    lastSig = sig;
    const text = statusText();
    for (const s of statuses) s.textContent = text;
    for (const b of buttons) {
      const done = b.part === 'dip' ? hs.dipped : hs.marks[b.part];
      b.el.classList.toggle('is-done', done);
      b.el.setAttribute('data-done', done ? 'true' : 'false');
    }
  }

  function setFlash(text: string, ms = 2600) {
    flash = text;
    window.clearTimeout(flashTimer);
    flashTimer = window.setTimeout(() => {
      flash = '';
      refreshStatus();
    }, ms);
    refreshStatus();
  }

  function controls(prompt: string): HTMLElement {
    const mk = (part: HyssopPart | 'dip', label: string) => {
      const el = h('button', { type: 'button', class: 'jf-key-btn', 'data-action': part, onclick: () => scene?.hyssopAction(part) }, label);
      buttons.push({ part, el });
      return el;
    };
    const status = h('p', { class: 'jf-hyssop-status', role: 'status', 'aria-live': 'polite' });
    statuses.push(status);
    // 手機上說明框貼底，會蓋住要拖的東西：互動那一拍預設收成小條，讀者要看說明與經文再展開
    const fold = makeFold();
    const root = h('div', { class: 'jf-hyssop' },
      h('p', { class: 'jf-prompt' }, prompt),
      h('div', { class: 'jf-keys', role: 'group', 'aria-label': '不用拖曳，也可以用按鈕操作' },
        mk('dip', '蘸血'), mk('lintel', '打門楣'), mk('left', '打左門框'), mk('right', '打右門框')),
      h('div', { class: 'jf-status-row' }, status, fold));
    refreshStatus();
    return root;
  }

  function onEvent(e: SceneEvent) {
    if (e.type === 'hyssop-dip') used = true;
    if (e.type === 'hyssop-miss') setFlash('牛膝草還沒蘸血，先拖到盆裡');
    else refreshStatus();
  }

  function update(active: boolean, avoid: readonly DOMRect[] = []): DOMRect[] | null {
    const on = active && !!scene;
    layer.classList.toggle('is-on', on);
    if (on) refreshStatus();
    if (!on) {
      badge.classList.remove('is-on');
      return null;
    }
    const rects = scene!.interactiveRects();
    ensureDivs(rects.length);
    for (let i = 0; i < divs.length; i++) {
      const d = divs[i];
      const r = rects[i];
      if (!r || r.width <= 0 || r.height <= 0) {
        d.style.display = 'none';
        last[i][0] = NaN;
        continue;
      }
      // 觸控目標至少 48px：矩形太小就向外撐開
      const padX = Math.max(0, (48 - r.width) / 2);
      const padY = Math.max(0, (48 - r.height) / 2);
      const x = r.left - padX;
      const y = r.top - padY;
      const w = r.width + padX * 2;
      const hgt = r.height + padY * 2;
      const L = last[i];
      if (L[0] !== x || L[1] !== y || L[2] !== w || L[3] !== hgt) {
        d.style.display = 'block';
        d.style.width = `${w}px`;
        d.style.height = `${hgt}px`;
        d.style.transform = `translate(${x}px, ${y}px)`;
        L[0] = x;
        L[1] = y;
        L[2] = w;
        L[3] = hgt;
      }
    }
    // 徽章貼在第一個矩形（牛膝草把手）旁；蘸過血或讀者按下去之後就收起來
    const r0 = rects[0];
    const showBadge = !!r0 && r0.width > 0 && !used && dragging === 0 && !story.hyssop.done;
    badge.classList.toggle('is-on', showBadge);
    if (showBadge && r0) placeBadge(badge, r0, avoid);
    return rects;
  }

  return {
    controls,
    setScene(s) {
      scene = s;
    },
    onEvent,
    update,
  };
}
