// 指定幾個拍，各捲到中段截圖，並量 [innerWidth, scrollWidth]（手機要相等）。
// 用法：node tools/shoot-beats.mjs <url> <outDir> <beatId,beatId,…> [--mobile] [--dark] [--motion-off] [--end=<chapterId>]
// --end=booths 另外截章末（.jf-end[data-chapter]）：捲到「舊約其他書卷」區塊。
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { launch, sleep } from './cdp.mjs';

const [url, outDir, ids] = process.argv.slice(2);
const mobile = process.argv.includes('--mobile');
const dark = process.argv.includes('--dark');
const motionOff = process.argv.includes('--motion-off');
const end = process.argv.find((a) => a.startsWith('--end='))?.slice(6);
const W = mobile ? 390 : 1440, H = mobile ? 844 : 900;
const tag = `${mobile ? 'm' : 'd'}${dark ? '-dark' : ''}${motionOff ? '-off' : ''}`;
mkdirSync(outDir, { recursive: true });

const b = await launch({ width: W, height: H, mobile, dpr: 1, port: 9471 + (mobile ? 1 : 0) + (dark ? 2 : 0), gpu: true });
await b.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: dark ? 'dark' : 'light' }, { name: 'prefers-reduced-motion', value: motionOff ? 'reduce' : 'no-preference' }] });
await b.send('Page.addScriptToEvaluateOnNewDocument', { source: `try { localStorage.setItem('jf-coach-seen', '1'); localStorage.setItem('jf-motion', '${motionOff ? 'off' : 'on'}') } catch {}` });
await b.send('Page.navigate', { url });
await sleep(4500);
const widths = new Set();
for (const id of (ids ?? '').split(',').filter(Boolean)) {
  const f = Number(process.env.JF_AT ?? 0.5);
  await b.evaluate(`(() => { const el = document.querySelector('[data-beat="${id}"]'); window.scrollTo(0, el.getBoundingClientRect().top + scrollY + Math.max(0, el.offsetHeight - innerHeight) * ${f}); })()`);
  await sleep(2200);
  widths.add(await b.evaluate('JSON.stringify([innerWidth, document.documentElement.scrollWidth])'));
  const file = join(outDir, `${tag}-${id}.png`);
  await b.shot(file);
  console.log(file);
}
if (end) {
  await b.evaluate(`(() => { const el = document.querySelector('.jf-end[data-chapter="${end}"] .jf-ot') ?? document.querySelector('.jf-end[data-chapter="${end}"]'); window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 90 + ${Number(process.env.JF_ENDY ?? 0)}); })()`);
  await sleep(1200);
  widths.add(await b.evaluate('JSON.stringify([innerWidth, document.documentElement.scrollWidth])'));
  const file = join(outDir, `${tag}-end-${end}${process.env.JF_ENDY ? "-" + process.env.JF_ENDY : ""}.png`);
  await b.shot(file);
  console.log(file);
}
console.log(`${tag}: 寬度 ${[...widths].join(' ')}`);
const errs = b.consoleLog.filter((l) => /^\[(exception|error)\]/.test(l));
console.log(errs.length ? `console 錯誤 ${errs.length} 則；例：${errs[0].split(/\r?\n/)[0]}` : 'console 無錯誤');
await b.close();
process.exit(0);
