/**
 * 手機：說明框內文（.jf-box-body）捲到頭以後，把「同方向的下一次手勢」確實交給頁面。
 *
 * 為什麼要自己接：內文是框內第二層捲動區，內文區的高度常常不是整數像素（50svh 在多數 iPhone 上是 x.5px，
 * 行高 1.75×17px＝29.75px），捲動區的「最大捲動量」帶小數，瀏覽器的捲動位置卻是整數像素——
 * 於是它永遠覺得自己還能再捲 0.x px，下一次手勢被內文捲動區吃掉（什麼都沒動），要滑第二次、有時第三次
 * 才會輪到頁面。讀者的感覺就是「手一直往下滑，內容不動」。（Chrome 觸控模擬可重現：內文捲到底後，
 * 隔一次手勢才會讓頁面走；整數化高度與行高後就不會。iOS 的巢狀捲動區另有橡皮筋，更容易遇到。）
 *
 * 做法：手勢一開始（手指移動超過 4px）就判斷，內文已在頂端而手指往下、或已在底端而手指往上（容許 1.5px 誤差）
 * → 這個手勢整個交給頁面：preventDefault 擋掉內文自己的捲動，用 window.scrollBy 跟著手指走。
 * 其餘情形照原生行為，不介入。放開後沒有慣性（只有這種「交棒」的手勢）；再滑一次就是原生的頁面捲動。
 */

const MOBILE = '(max-width: 720px)';
const SLOP = 4;
const EDGE = 1.5;

export function bindHandoff(body: HTMLElement): void {
  const mobile = window.matchMedia(MOBILE);
  let id = -1;
  let lastY = 0;
  let startY = 0;
  let mode: 'undecided' | 'native' | 'page' = 'native';

  body.addEventListener(
    'touchstart',
    (e) => {
      if (!mobile.matches || e.touches.length !== 1 || (e.target as Element).closest('.jf-more')) {
        mode = 'native';
        id = -1;
        return;
      }
      const t = e.touches[0];
      id = t.identifier;
      lastY = startY = t.clientY;
      mode = 'undecided';
    },
    { passive: true },
  );

  body.addEventListener(
    'touchmove',
    (e) => {
      if (id < 0 || mode === 'native') return;
      let t: Touch | null = null;
      for (const c of Array.from(e.touches)) if (c.identifier === id) t = c;
      if (!t) return;
      const dy = t.clientY - lastY;
      lastY = t.clientY;
      if (mode === 'undecided') {
        const moved = t.clientY - startY;
        if (Math.abs(moved) < SLOP) return;
        const max = body.scrollHeight - body.clientHeight;
        const atTop = body.scrollTop <= EDGE;
        const atEnd = body.scrollTop >= max - EDGE;
        // 手指往上滑（moved < 0）＝內容往下走：內文到底就交給頁面；手指往下滑反之
        mode = max > 2 && ((moved < 0 && atEnd) || (moved > 0 && atTop)) ? 'page' : 'native';
        if (mode === 'native') return;
        // 補上判斷前這一小段位移，手感才連得起來
        window.scrollBy(0, -(moved - dy));
      }
      if (e.cancelable) e.preventDefault();
      window.scrollBy(0, -dy);
    },
    { passive: false },
  );

  const end = () => {
    id = -1;
    mode = 'native';
  };
  body.addEventListener('touchend', end, { passive: true });
  body.addEventListener('touchcancel', end, { passive: true });
}
