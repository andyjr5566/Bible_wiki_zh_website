// 在整合後的網站上，用真的滑鼠／觸控拖曳完成塗血：蘸血→門楣→左門框→右門框。
// 用法：node tools/check-drag.mjs <url> [--mobile] [outDir]
import { join } from 'node:path';
import { launch, sleep } from './cdp.mjs';
const [url] = process.argv.slice(2);
const mobile = process.argv.includes('--mobile');
const outDir = process.argv.slice(2).find((a) => a !== url && !a.startsWith('--'));
const W = mobile ? 390 : 1440, H = mobile ? 844 : 900;
const b = await launch({ width: W, height: H, mobile, port: mobile ? 9382 : 9381, gpu: true });
await b.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }, { name: 'prefers-reduced-motion', value: 'no-preference' }] });
await b.send('Page.addScriptToEvaluateOnNewDocument', { source: `try { localStorage.setItem('jf-coach-seen', '1') } catch {}` });
await b.send('Page.navigate', { url });
await sleep(4500);
await b.evaluate(`(() => { const el = document.querySelector('[data-cue="hyssop"]'); window.scrollTo(0, el.getBoundingClientRect().top + scrollY + Math.max(0, el.offsetHeight - innerHeight) * 0.5); })()`);
await sleep(2500);
// 場景的可互動矩形：把手、盆、門框區（經由 lab 以外的途徑取得：直接讀觸控層）
const rects = JSON.parse(await b.evaluate(`JSON.stringify([...document.querySelectorAll('.jf-touch-layer .jf-touch')].map((e, i) => { const r = e.getBoundingClientRect(); return [['handle','basin','door'][i], r.x, r.y, r.width, r.height]; }))`));
console.log('觸控層', JSON.stringify(rects));
const get = (name) => rects.find((r) => r[0] === name);
const state = () => b.evaluate(`JSON.stringify((() => { const t = [...document.querySelectorAll('.jf-hyssop-status')].find(e => e.offsetParent); return t ? t.textContent : null; })())`);
const ptr = async (type, x, y) => mobile
  ? b.send('Input.dispatchTouchEvent', { type: { down: 'touchStart', move: 'touchMove', up: 'touchEnd' }[type], touchPoints: type === 'up' ? [] : [{ x, y }] })
  : b.send('Input.dispatchMouseEvent', { type: { down: 'mousePressed', move: 'mouseMoved', up: 'mouseReleased' }[type], x, y, button: 'left', clickCount: 1 });
const path = async (pts) => { for (let i = 1; i < pts.length; i++) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; for (let k = 1; k <= 12; k++) { await ptr('move', x0 + (x1 - x0) * k / 12, y0 + (y1 - y0) * k / 12); await sleep(16); } } };
const c = (r, fx = 0.5, fy = 0.5) => [r[1] + r[3] * fx, r[2] + r[4] * fy];
const handle = get('handle') ?? rects[0], basin = get('basin') ?? rects[1], door = get('door') ?? rects[2];
if (!handle || !basin || !door) { console.log('找不到觸控層，無法測拖曳'); await b.close(); process.exit(1); }
const h0 = c(handle, 0.5, 0.3), bs = c(basin, 0.5, 0.45);
const lintel = c(door, 0.5, 0.08), left = c(door, 0.1, 0.45), right = c(door, 0.9, 0.45);
await ptr('down', ...h0); await sleep(60);
const log = [];
for (const [name, target] of [['basin', bs], ['lintel', lintel], ['basin', bs], ['left', left], ['basin', bs], ['right', right]]) {
  const cur = log.length ? log.at(-1).at : h0;
  await path([cur, target]); await sleep(450);
  log.push({ name, at: target, status: await state() });
}
await ptr('up', ...log.at(-1).at); await sleep(1200);
for (const l of log) console.log(l.name.padEnd(7), l.status);
console.log('最後狀態', await state());
if (outDir) await b.shot(join(outDir, `drag-${mobile ? 'm' : 'd'}.png`));
const errs = b.consoleLog.filter((l) => /^\[(exception|error)\]/.test(l));
console.log(errs.length ? errs.join('\n') : 'console 無錯誤');
await b.close();
process.exit(0);
