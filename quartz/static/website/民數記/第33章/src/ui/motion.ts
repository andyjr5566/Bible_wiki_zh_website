import { animOff } from './dom';

/** 元素捲進畫面時加上 .in，讓 CSS 做進場動畫；只觸發一次 */
export function reveal(els: Iterable<Element>, rootMargin = '0px 0px -12% 0px') {
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add('in');
      io.unobserve(e.target);
    }
  }, { rootMargin });
  for (const el of els) {
    el.classList.add('rv');
    io.observe(el);
  }
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

let running = 0;
/**
 * 平滑捲動到指定高度。瀏覽器內建的 smooth 速度不能控制，也無法中途停下，所以自己做。
 * 回傳 false 代表中途被打斷（使用者自己捲動，或 cancel() 回傳 true）。
 */
export function smoothScrollTo(y: number, duration?: number, cancel?: () => boolean): Promise<boolean> {
  const from = scrollY;
  const to = Math.max(0, Math.min(y, document.documentElement.scrollHeight - innerHeight));
  const dist = Math.abs(to - from);
  // 捲動都是使用者要求才有的（到地圖看、回到剛才讀的地方、開始走、故事的幕按鈕、帶站號的網址），只看本站的「減少動態」開關
  const dur = animOff() ? 0 : duration ?? Math.min(1600, 500 + dist * 0.5);
  const my = ++running;
  if (!dur) {
    scrollTo(0, to);
    return Promise.resolve(true);
  }
  return new Promise((resolve) => {
    const t0 = performance.now();
    let userMoved = false;
    const stop = () => (userMoved = true);
    const opts = { passive: true } as const;
    addEventListener('wheel', stop, opts);
    addEventListener('touchstart', stop, opts);
    const done = (ok: boolean) => {
      removeEventListener('wheel', stop);
      removeEventListener('touchstart', stop);
      resolve(ok);
    };
    const step = (now: number) => {
      if (my !== running || userMoved || cancel?.()) return done(false);
      const t = Math.min(1, (now - t0) / dur);
      scrollTo(0, from + (to - from) * easeInOut(t));
      if (t < 1) requestAnimationFrame(step);
      else done(true);
    };
    requestAnimationFrame(step);
  });
}
