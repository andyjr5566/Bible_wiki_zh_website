// 用 file:// 打開建置後的 dist/index.html：拍數、場景、插圖與音檔能不能載入。
import { pathToFileURL } from 'node:url';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, sleep } from './cdp.mjs';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const url = pathToFileURL(join(root, 'dist', 'index.html')).href;
const b = await launch({ width: 1440, height: 900, gpu: true, port: 9371 });
await b.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
await b.send('Page.navigate', { url });
await sleep(5000);
const r = await b.evaluate(`(async () => {
  const img = (src) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(true); i.onerror = () => ok(false); i.src = src; });
  const aud = (src) => new Promise((ok) => { const a = new Audio(); a.preload = 'auto'; a.oncanplaythrough = () => ok(true); a.onerror = () => ok(false); a.src = src; a.load(); setTimeout(() => ok('timeout'), 4000); });
  return JSON.stringify({
    protocol: location.protocol,
    beats: document.querySelectorAll('.jf-beat').length,
    ready: document.documentElement.classList.contains('jf-ready'),
    canvas: !!document.querySelector('#jf-canvas') && !document.getElementById('jf-fallback').hidden === false,
    fallbackImg: await img('./fallback/hyssop.webp'),
    audio: await aud('./audio/dip.mp3'),
  });
})()`);
console.log(r);
if (process.argv[2]) await b.shot(process.argv[2]);
const errs = b.consoleLog.filter((l) => /^\[(exception|error)\]/.test(l));
console.log(errs.length ? errs.join('\n') : 'console 無錯誤');
await b.close();
process.exit(0);
