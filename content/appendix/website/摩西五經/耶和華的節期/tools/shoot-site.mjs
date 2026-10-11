// 整合後的驗收截圖：逐拍捲到該拍中段截圖，並量 [innerWidth, scrollWidth]。
// 用法：node tools/shoot-site.mjs <url> <outDir> [--mobile | --iphone[=iphone15|iphone14|promax|short]] [--dark] [--reduced] [--nobar] [--before] [--only=a,b]
//   --mobile  舊的手機模擬（390×844、沒有安全區）
//   --iphone  iPhone 模擬（393×852、瀏海 59／底部橫條 34 的安全區、iOS Safari UA；見 tools/iphone.mjs）
//   --before  只在 --iphone 下有效：把這次修正的規則還原成修正前的樣子，拿來做「修之前」的對照截圖
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { launch, sleep } from './cdp.mjs';
import { launchIphone } from './iphone.mjs';

const [url, outDir] = process.argv.slice(2).filter((x) => !x.startsWith('--'));
const flag = (k) => process.argv.includes(k);
const iph = process.argv.find((x) => x === '--iphone' || x.startsWith('--iphone='));
const mobile = flag('--mobile') || !!iph;
const dark = flag('--dark');
const reduced = flag('--reduced');
const only = process.argv.find((x) => x.startsWith('--only='))?.slice(7).split(',');
const profile = iph?.includes('=') ? iph.split('=')[1] : 'iphone15';
const tag = `${iph ? profile : mobile ? 'm' : 'd'}${dark ? '-dark' : ''}${reduced ? '-reduce' : ''}${flag('--before') ? '-before' : ''}`;
mkdirSync(outDir, { recursive: true });

// 修正前的規則（只還原這次動到的幾條）：面板高度、日數牌不讓開、經文框內再捲
const BEFORE_CSS = `
@media (max-width: 720px) {
  .jf-more { max-height: calc(100svh - 160px) !important; }
  .jf-more-open .jf-day.is-on { opacity: 1 !important; }
  .jf-more-open .jf-return { visibility: visible !important; }
  .jf-box[data-offers='2'] .jf-verse-text { max-height: 5.6em; overflow-y: auto; }
  .jf-box[data-bars='true'] .jf-verse-text { max-height: 4.6em; overflow-y: auto; }
}`;

const port = 9361 + (mobile ? 1 : 0) + (dark ? 2 : 0) + (reduced ? 4 : 0) + (iph ? 8 : 0);
let b;
if (iph) {
  b = await launchIphone({ profile, port, url, dark, reduced, nobar: flag('--nobar'), wait: 5000 });
  if (flag('--before')) await b.evaluate(`(() => { const s = document.createElement('style'); s.textContent = ${JSON.stringify(BEFORE_CSS)}; document.head.append(s); })()`);
} else {
  const W = mobile ? 390 : 1440, H = mobile ? 844 : 900;
  b = await launch({ width: W, height: H, mobile, dpr: 1, port, gpu: true });
  await b.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: dark ? 'dark' : 'light' }, { name: 'prefers-reduced-motion', value: reduced ? 'reduce' : 'no-preference' }] });
  await b.send('Page.addScriptToEvaluateOnNewDocument', { source: `try { localStorage.setItem('jf-coach-seen', '1') } catch {}` });
  await b.send('Page.navigate', { url });
  await sleep(5000);
}
const H = await b.evaluate('innerHeight');

const beats = (await b.evaluate(`[...document.querySelectorAll('.jf-beat')].map(el => ({ id: el.dataset.beat, top: el.getBoundingClientRect().top + scrollY, h: el.offsetHeight }))`)).filter((x) => !only || only.includes(x.id));
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
if (!only) {
  for (const sel of ['.jf-end', '#jf-credits']) {
    await b.evaluate(`(() => { const el = document.querySelector('${sel}'); if (el) window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 40); })()`);
    await sleep(1200);
    widths.add(await b.evaluate('JSON.stringify([innerWidth, document.documentElement.scrollWidth])'));
    await b.shot(join(outDir, `${tag}-${String(++i).padStart(2, '0')}-${sel.replace(/[^a-z]/g, '')}.png`));
  }
}
console.log(`${tag}: ${beats.length} 拍；寬度 ${[...widths].join(' ')}${iph ? `；安全區 ${b.safeMode}` : ''}`);
const errs = b.consoleLog.filter((l) => /^\[(exception|error)\]/.test(l));
console.log(errs.length ? errs.join('\n') : 'console 無錯誤');
await b.close();
process.exit(0);
