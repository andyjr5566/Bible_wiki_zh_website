// 夏日過場（passage）：月份導覽隨該拍捲動依序點亮三、四、五、六月，之後吹角節點亮七月；
// 並驗過場沒有標題卡、說明框、章末、日數牌，高度 100–120vh；點三到六月的刻度會跳到過場裡對應的位置。
// 用法：node tools/check-months.mjs <url> [outDir] [--mobile]
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { launch, sleep } from './cdp.mjs';

const [url, outDir] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const mobile = process.argv.includes('--mobile');
if (outDir) mkdirSync(outDir, { recursive: true });
let failed = 0;
const ok = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => { failed++; console.log(`  × ${m}`); };
const W = mobile ? 390 : 1440, H = mobile ? 844 : 900;
const b = await launch({ width: W, height: H, mobile, port: 9481 + (mobile ? 1 : 0), gpu: true });
await b.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }, { name: 'prefers-reduced-motion', value: 'no-preference' }] });
await b.send('Page.addScriptToEvaluateOnNewDocument', { source: `try { localStorage.setItem('jf-coach-seen', '1'); localStorage.setItem('jf-motion', 'on') } catch {}` });
await b.send('Page.navigate', { url });
await sleep(4500);

const geo = JSON.parse(await b.evaluate(`JSON.stringify((() => {
  const el = document.querySelector('[data-chapter="summer"]');
  const r = el.getBoundingClientRect();
  return { top: r.top + scrollY, h: el.offsetHeight, vh: innerHeight, box: !!el.querySelector('.jf-box:not(.jf-box-none)'), head: !!el.querySelector('.jf-chaphead,.jf-hero'), end: !!document.querySelector('.jf-end[data-chapter="summer"]'), text: el.textContent.trim() };
})())`));
console.log(mobile ? '手機' : '桌機', JSON.stringify(geo));
geo.h >= geo.vh && geo.h <= geo.vh * 1.2 ? ok(`高度 ${geo.h}px = ${(geo.h / geo.vh).toFixed(2)}vh（100–120vh）`) : fail(`高度 ${(geo.h / geo.vh).toFixed(2)}vh`);
!geo.box && !geo.head && !geo.end && geo.text === '' ? ok('沒有說明框、標題卡、章末、文字') : fail('過場裡有不該有的東西');

const cur = () => b.evaluate(`JSON.stringify([window.__jfStory.chapter, window.__jfStory.month, document.querySelector('.jf-tick.is-current .jf-m-label')?.textContent ?? null, document.querySelector('.jf-day')?.classList.contains('is-on') ?? false, +window.__jfStory.beatProgress.toFixed(2)])`);
const seen = [];
for (const p of [0.05, 0.3, 0.55, 0.8, 0.97]) {
  const y = geo.top - 0.6 * geo.vh + p * geo.h;
  await b.evaluate(`window.scrollTo(0, ${Math.round(y)})`);
  await sleep(700);
  const [ch, m, label, day, bp] = JSON.parse(await cur());
  console.log(`  p≈${p}：chapter ${ch}、story.month ${m}、點亮「${label}」、日數牌 ${day ? '顯示' : '隱藏'}、beatProgress ${bp}`);
  seen.push(m);
  if (day) fail('過場有日數牌');
  if (outDir && (p === 0.3 || p === 0.8)) await b.shot(join(outDir, `months-${mobile ? 'm' : 'd'}-${p}.png`));
}
JSON.stringify(seen) === JSON.stringify([3, 4, 5, 6, 6]) ? ok('依序點亮 3、4、5、6') : fail(`月份序列 ${JSON.stringify(seen)}`);
await b.evaluate(`window.scrollTo(0, ${Math.round(geo.top + geo.h + 0.2 * geo.vh)})`);
await sleep(700);
const [ch2, m2, label2] = JSON.parse(await cur());
console.log(`  過場之後：chapter ${ch2}、story.month ${m2}、點亮「${label2}」`);
m2 === 7 && label2 === '七月' ? ok('吹角節點亮七月') : fail('吹角節沒有點亮七月');

// 點四月刻度：落在過場裡四月被點亮的那一段
const names = ['三月', '四月', '五月', '六月'];
for (let i = 0; i < names.length; i++) {
  await b.evaluate(`window.scrollTo(0, 0)`);
  await sleep(300);
  const clicked = await b.evaluate(`(() => { const t = [...document.querySelectorAll('.jf-m')].find((e) => e.textContent.trim() === ${JSON.stringify(names[i])}); if (!t || t.disabled) return false; t.click(); return true; })()`);
  await sleep(900);
  const [chk, mk] = JSON.parse(await cur());
  clicked && chk === 'summer' && mk === 3 + i ? ok(`點「${names[i]}」→ 過場、story.month ${mk}`) : fail(`點「${names[i]}」：clicked ${clicked}、chapter ${chk}、month ${mk}`);
}
const w = await b.evaluate('JSON.stringify([innerWidth, document.documentElement.scrollWidth])');
console.log(`  [innerWidth, scrollWidth] = ${w}`);
const errs = b.consoleLog.filter((l) => /^\[(exception|error)\]/.test(l));
errs.length ? fail(`console 錯誤 ${errs.length} 則（${errs[0].split(/\r?\n/)[0]}）`) : ok('console 無錯誤');
await b.close();
console.log(failed ? `共 ${failed} 項失敗` : '全部通過');
process.exit(failed ? 1 : 0);
