// iPhone 模擬（手機版檢查共用）：
//   mobile ＋ 觸控 ＋ iOS Safari UA ＋ 瀏海／底部橫條安全區 ＋ 明確的亮暗與動態偏好 ＋ 略過導覽 dialog。
// 用法：
//   import { launchIphone, PROFILES } from './iphone.mjs';
//   const b = await launchIphone({ profile: 'iphone15', port: 9701, dark: false, reduced: false, url });
// 命令列共用旗標（parseArgs）：--profile=iphone15|iphone14|promax|mini|se|short  --dark  --reduced  --nobar（底部橫條 0＝Safari 工具列顯示時）
//
// 安全區：優先用 Emulation.setSafeAreaInsetsOverride（讓 env(safe-area-inset-*) 真的有值）；
// 不支援就在頁面注入 :root{--jf-safe-t:..;--jf-safe-b:..} 覆蓋。launchIphone 會量一次 env() 確認生效，回傳 b.safeMode。
//
// 與真機的落差（headless 模擬量不出）：網址列伸縮造成的 100svh／innerHeight 差、同一手勢內捲動不串接、橡皮筋、
// iOS 的 100vh 以大視窗計。profile 'short'（393×759）模擬網址列展開時的小視窗。
import { launch, sleep } from './cdp.mjs';

export { sleep };

export const IOS_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3 Mobile/15E148 Safari/604.1';

export const PROFILES = {
  iphone15: { width: 393, height: 852, top: 59, bottom: 34 },
  iphone14: { width: 390, height: 844, top: 47, bottom: 34 },
  promax: { width: 430, height: 932, top: 59, bottom: 34 },
  mini: { width: 375, height: 812, top: 50, bottom: 34 },
  se: { width: 375, height: 667, top: 20, bottom: 0 },
  // Safari 網址列展開：可用高度少約 93px（393×852 的 svh）
  short: { width: 393, height: 759, top: 59, bottom: 0 },
};

export function parseArgs(argv = process.argv.slice(2)) {
  const get = (k, d) => argv.find((x) => x.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
  return {
    positional: argv.filter((x) => !x.startsWith('--')),
    profile: get('profile', 'iphone15'),
    dark: argv.includes('--dark'),
    reduced: argv.includes('--reduced'),
    nobar: argv.includes('--nobar'),
    only: get('only', null)?.split(',') ?? null,
    flags: new Set(argv.filter((x) => x.startsWith('--'))),
  };
}

/**
 * @param {{profile?: keyof typeof PROFILES, port: number, url?: string, dark?: boolean, reduced?: boolean, nobar?: boolean,
 *          dpr?: number, safe?: boolean, wait?: number, extraScript?: string, gpu?: boolean}} o
 */
export async function launchIphone(o) {
  const p = PROFILES[o.profile ?? 'iphone15'];
  if (!p) throw new Error(`未知 profile ${o.profile}`);
  const top = o.safe === false ? 0 : p.top;
  const bottom = o.safe === false ? 0 : o.nobar ? 0 : p.bottom;
  const b = await launch({ width: p.width, height: p.height, mobile: true, dpr: o.dpr ?? 1, port: o.port, gpu: o.gpu ?? true, ua: IOS_UA });
  await b.send('Emulation.setEmulatedMedia', {
    features: [
      { name: 'prefers-color-scheme', value: o.dark ? 'dark' : 'light' },
      { name: 'prefers-reduced-motion', value: o.reduced ? 'reduce' : 'no-preference' },
    ],
  });
  b.safeMode = 'none';
  if (top || bottom) {
    try {
      await b.send('Emulation.setSafeAreaInsetsOverride', { insets: { top, bottom, left: 0, right: 0 } });
      b.safeMode = 'cdp';
    } catch {}
  }
  const seed = `try { localStorage.setItem('jf-coach-seen', '1'); localStorage.setItem('jf-motion', '${o.reduced ? 'off' : 'on'}') } catch {}`;
  await b.send('Page.addScriptToEvaluateOnNewDocument', { source: seed + (o.extraScript ?? '') });
  b.profile = { ...p, top, bottom };
  if (o.url) {
    await b.send('Page.navigate', { url: o.url });
    await sleep(o.wait ?? 4500);
    // 確認 env() 真的有值；沒有就注入覆蓋
    const probe = async () => b.evaluate(`(() => { const d = document.createElement('div'); d.style.cssText = 'position:fixed;visibility:hidden;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)'; document.body.append(d); const cs = getComputedStyle(d); const r = [parseFloat(cs.paddingTop), parseFloat(cs.paddingBottom)]; d.remove(); return r; })()`);
    let [t, bt] = await probe();
    if ((top && t !== top) || (bottom && bt !== bottom)) {
      await b.evaluate(`(() => { const s = document.createElement('style'); s.id = 'iphone-safe'; s.textContent = ':root{--jf-safe-t:${top}px !important;--jf-safe-b:${bottom}px !important}'; document.head.append(s); })()`);
      b.safeMode = 'inject';
      const v = await b.evaluate(`getComputedStyle(document.documentElement).getPropertyValue('--jf-safe-t').trim()`);
      if (v !== `${top}px`) throw new Error(`安全區覆蓋沒有生效：--jf-safe-t=${v}`);
    } else if (top || bottom) b.safeMode = 'cdp';
    b.safeMeasured = [t, bt];
  }
  return b;
}

/** 啟動後的共用量測：[innerWidth, scrollWidth] 與安全區 */
export const widthProbe = (b) => b.evaluate('JSON.stringify([innerWidth, document.documentElement.scrollWidth])');

/** 把頁面捲到某一拍的中段（比例 f，預設 0.5）；回傳 scrollY */
export const scrollToBeat = (b, id, f = 0.5) =>
  b.evaluate(`(() => { const el = document.querySelector('[data-beat="${id}"]'); const y = Math.round(el.getBoundingClientRect().top + scrollY + Math.max(0, el.offsetHeight - innerHeight) * ${f}); window.scrollTo(0, y); return y; })()`);

/**
 * 真的送 touchStart／touchMove／touchEnd 給瀏覽器的輸入管線（Input.synthesizeScrollGesture 在 headless 不會動，所以不用它）。
 * dy < 0：手指往上滑，頁面往下走。放開前停 160ms，速度歸零，不會有慣性滑動。回傳實際送出的位移。
 */
let touchId = 0;
export async function touchSwipe(b, x, y, dy, { stepPx = 16, stepMs = 14 } = {}) {
  const id = ++touchId; // 同一個 id 連用，Chrome 會把隔一次的手勢吃掉
  const pt = (yy) => [{ x, y: yy, id }];
  await b.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(y) });
  await sleep(80);
  const n = Math.max(1, Math.round(Math.abs(dy) / stepPx));
  for (let i = 1; i <= n; i++) {
    await b.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(y + (dy * i) / n) });
    await sleep(stepMs);
  }
  await sleep(160);
  await b.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(y + dy) });
  await b.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(60);
}
/** 往上滑（頁面往下走）distance px */
export const touchSwipeUp = (b, x, y, distance = 240) => touchSwipe(b, x, y, -distance);
/** 往下滑（頁面往上走） */
export const touchSwipeDown = (b, x, y, distance = 240) => touchSwipe(b, x, y, distance);

/** 所有拍的 id 與位置 */
export const listBeats = (b) =>
  b.evaluate(`[...document.querySelectorAll('.jf-beat')].map(el => ({ id: el.dataset.beat, cue: el.dataset.cue, top: Math.round(el.getBoundingClientRect().top + scrollY), h: el.offsetHeight }))`);
