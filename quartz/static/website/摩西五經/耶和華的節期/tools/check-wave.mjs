// 在整合後的網站上，用真的滑鼠／觸控按住禾捆來回甩，看 wave-swing 有沒有算（讀說明框裡的狀態列）。
// 用法：node tools/check-wave.mjs <url> [--mobile] [--reduced] [--skip] [outDir]
//   --skip：不操作，直接捲過 wave 那一拍，驗證自動補完。
import { join } from 'node:path';
import { launch, sleep } from './cdp.mjs';
const [url] = process.argv.slice(2);
const mobile = process.argv.includes('--mobile');
const reduced = process.argv.includes('--reduced');
const skip = process.argv.includes('--skip');
const outDir = process.argv.slice(2).find((a) => a !== url && !a.startsWith('--'));
const W = mobile ? 390 : 1440, H = mobile ? 844 : 900;
const b = await launch({ width: W, height: H, mobile, port: (mobile ? 9392 : 9391) + (reduced ? 2 : 0) + (skip ? 4 : 0), gpu: true });
await b.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }, { name: 'prefers-reduced-motion', value: reduced ? 'reduce' : 'no-preference' }] });
await b.send('Page.addScriptToEvaluateOnNewDocument', { source: `try { localStorage.setItem('jf-coach-seen', '1') } catch {}` });
await b.send('Page.navigate', { url });
await sleep(4500);
const goto = (cue, f = 0.5) => b.evaluate(`(() => { const el = document.querySelector('[data-cue="${cue}"]'); window.scrollTo(0, el.getBoundingClientRect().top + scrollY + Math.max(0, el.offsetHeight - innerHeight) * ${f}); })()`);
const status = () => b.evaluate(`JSON.stringify([...document.querySelectorAll('.jf-wave-status')].map(e => e.textContent))`);
await goto('wave');
await sleep(2500);
const tag = `${mobile ? 'm' : 'd'}${reduced ? '-reduce' : ''}`;
if (skip) {
  await goto('lamb-offering');
  await sleep(1500);
  console.log(tag, '捲過去後狀態', await status());
  await goto('wave');
  await sleep(800);
  console.log(tag, '捲回來後狀態', await status());
  const errs = b.consoleLog.filter((l) => /^\[(exception|error)\]/.test(l));
  console.log(errs.length ? errs.join('\n') : 'console 無錯誤');
  await b.close();
  process.exit(0);
}
const r = JSON.parse(await b.evaluate(`JSON.stringify((() => { const e = document.querySelector('.jf-touch-drag'); const r = e.getBoundingClientRect(); return [r.x, r.y, r.width, r.height, getComputedStyle(e).display]; })())`));
console.log(tag, '把手', JSON.stringify(r));
const ptr = async (type, x, y) => mobile
  ? b.send('Input.dispatchTouchEvent', { type: { down: 'touchStart', move: 'touchMove', up: 'touchEnd' }[type], touchPoints: type === 'up' ? [] : [{ x, y }] })
  : b.send('Input.dispatchMouseEvent', { type: { down: 'mousePressed', move: 'mouseMoved', up: 'mouseReleased' }[type], x, y, button: 'left', clickCount: 1 });
const cx = r[0] + r[2] / 2, cy = r[1] + r[3] / 2;
const amp = Math.min(150, W * 0.2);
await ptr('down', cx, cy);
await sleep(60);
const log = [];
let x = cx;
for (let s = 0; s < 4; s++) {
  const to = cx + (s % 2 === 0 ? amp : -amp);
  for (let k = 1; k <= 10; k++) {
    await ptr('move', x + ((to - x) * k) / 10, cy);
    await sleep(14);
  }
  x = to;
  await sleep(120);
  log.push(await status());
  if (outDir && s === 1) await b.shot(join(outDir, `wave-${tag}.png`));
}
await ptr('up', x, cy);
await sleep(900);
for (const l of log) console.log(tag, l);
console.log(tag, '放開後', await status());
const errs = b.consoleLog.filter((l) => /^\[(exception|error)\]/.test(l));
console.log(errs.length ? errs.join('\n') : 'console 無錯誤');
await b.close();
process.exit(0);
