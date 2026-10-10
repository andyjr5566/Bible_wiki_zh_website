// 整合後的驗收截圖：逐拍捲到該拍中段截圖，並量 [innerWidth, scrollWidth]。
// 用法：node tools/shoot-site.mjs <url> <outDir> [--mobile] [--dark] [--reduced]
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { launch, sleep } from './cdp.mjs';

const [url, outDir] = process.argv.slice(2);
const mobile = process.argv.includes('--mobile');
const dark = process.argv.includes('--dark');
const reduced = process.argv.includes('--reduced');
const W = mobile ? 390 : 1440, H = mobile ? 844 : 900;
const tag = `${mobile ? 'm' : 'd'}${dark ? '-dark' : ''}${reduced ? '-reduce' : ''}`;
mkdirSync(outDir, { recursive: true });

const b = await launch({ width: W, height: H, mobile, dpr: 1, port: 9361 + (mobile ? 1 : 0) + (dark ? 2 : 0) + (reduced ? 4 : 0), gpu: true });
const media = [];
media.push({ name: 'prefers-color-scheme', value: dark ? 'dark' : 'light' });
media.push({ name: 'prefers-reduced-motion', value: reduced ? 'reduce' : 'no-preference' });
await b.send('Emulation.setEmulatedMedia', { features: media });
await b.send('Page.addScriptToEvaluateOnNewDocument', { source: `try { localStorage.setItem('jf-coach-seen', '1') } catch {}` });
await b.send('Page.navigate', { url });
await sleep(5000);

const beats = await b.evaluate(`[...document.querySelectorAll('.jf-beat')].map(el => ({ id: el.dataset.beat, top: el.getBoundingClientRect().top + scrollY, h: el.offsetHeight }))`);
const widths = new Set();
let i = 0;
for (const bt of beats) {
  const y = Math.round(bt.top + Math.max(0, bt.h - H) * 0.5);
  await b.evaluate(`window.scrollTo(0, ${y})`);
  await sleep(1800);
  const w = await b.evaluate('JSON.stringify([innerWidth, document.documentElement.scrollWidth])');
  widths.add(w);
  await b.shot(join(outDir, `${tag}-${String(++i).padStart(2, '0')}-${bt.id}.png`));
}
for (const sel of ['.jf-end', '#jf-credits']) {
  await b.evaluate(`(() => { const el = document.querySelector('${sel}'); if (el) window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 40); })()`);
  await sleep(1200);
  widths.add(await b.evaluate('JSON.stringify([innerWidth, document.documentElement.scrollWidth])'));
  await b.shot(join(outDir, `${tag}-${String(++i).padStart(2, '0')}-${sel.replace(/[^a-z]/g, '')}.png`));
}
console.log(`${tag}: ${beats.length} 拍；寬度 ${[...widths].join(' ')}`);
const errs = b.consoleLog.filter((l) => /^\[(exception|error)\]/.test(l));
console.log(errs.length ? errs.join('\n') : 'console 無錯誤');
await b.close();
process.exit(0);
