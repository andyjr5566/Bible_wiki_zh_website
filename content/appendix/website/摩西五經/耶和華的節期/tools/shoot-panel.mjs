// 打開「四家怎麼說」或「原文」面板後截圖（iPhone 模擬）。--before 把修正的規則還原成修正前，拿來做對照。
// 用法：node tools/shoot-panel.mjs <url> <outDir> --beats=new-moon,hyssop [--kind=notes|words] [--profile=iphone15] [--dark] [--before] [--nobar]
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { launchIphone, parseArgs, sleep } from './iphone.mjs';

const args = parseArgs();
const [url, outDir] = args.positional;
const beats = (process.argv.find((x) => x.startsWith('--beats='))?.slice(8) ?? 'new-moon').split(',');
const kind = process.argv.find((x) => x.startsWith('--kind='))?.slice(7) ?? 'notes';
const before = process.argv.includes('--before');
mkdirSync(outDir, { recursive: true });
const BEFORE_CSS = `@media (max-width: 720px) {
  .jf-more { max-height: calc(100svh - 160px) !important; }
  .jf-more-open .jf-day.is-on { opacity: 1 !important; }
  .jf-more-open .jf-return { visibility: visible !important; }
}`;
const b = await launchIphone({ profile: args.profile, port: 9631, url, dark: args.dark, nobar: args.nobar });
if (before) await b.evaluate(`(() => { const s = document.createElement('style'); s.textContent = ${JSON.stringify(BEFORE_CSS)}; document.head.append(s); })()`);
const label = kind === 'notes' ? '四家怎麼說' : '原文';
for (const id of beats) {
  await b.evaluate(`(() => { const el = document.querySelector('[data-beat="${id}"]'); window.scrollTo(0, el.getBoundingClientRect().top + scrollY + Math.max(0, el.offsetHeight - innerHeight) * 0.5); })()`);
  await sleep(1500);
  const ok = await b.evaluate(`(() => { const x = [...document.querySelector('[data-beat="${id}"]').querySelectorAll('button')].find(x => x.textContent.startsWith('${label}')); if (!x) return false; x.click(); return true; })()`);
  if (!ok) { console.log(`${id}: 沒有「${label}」`); continue; }
  await sleep(900);
  await b.shot(join(outDir, `panel-${args.profile}${args.dark ? '-dark' : ''}${before ? '-before' : '-after'}-${id}-${kind}.png`));
  await b.evaluate(`document.querySelector('.jf-more:not([hidden]) .jf-more-x')?.click()`);
  await sleep(300);
}
await b.close();
process.exit(0);
