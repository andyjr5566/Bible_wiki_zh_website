// bulls 拍的長條圖：在進度 0.05、0.5、0.95 各截一張，回報「目前日」與「已畫出的條數」，
// 並驗「目前那一天的條一定已經畫出來」（目前日 = 已畫出的最後一根）。逐步掃 0.01–1.00 全部檢查一次。
// 用法：node tools/check-bars.mjs <url> [outDir] [--mobile]
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { launch, sleep } from './cdp.mjs';

const [url, outDir] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const mobile = process.argv.includes('--mobile');
if (outDir) mkdirSync(outDir, { recursive: true });
const W = mobile ? 390 : 1440, H = mobile ? 844 : 900;
const b = await launch({ width: W, height: H, mobile, port: 9501 + (mobile ? 1 : 0), gpu: true });
await b.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }, { name: 'prefers-reduced-motion', value: 'no-preference' }] });
await b.send('Page.addScriptToEvaluateOnNewDocument', { source: `try { localStorage.setItem('jf-coach-seen', '1'); localStorage.setItem('jf-motion', 'on') } catch {}` });
await b.send('Page.navigate', { url });
await sleep(4500);

const geo = JSON.parse(await b.evaluate(`JSON.stringify((() => { const el = document.querySelector('[data-beat="bulls"]'); return { top: el.getBoundingClientRect().top + scrollY, h: el.offsetHeight, vh: innerHeight }; })())`));
const read = async () => JSON.parse(await b.evaluate(`JSON.stringify((() => {
  const where = innerWidth <= 720 ? 'inline' : 'side';
  const root = [...document.querySelectorAll('.jf-bars[data-where="' + where + '"]')].find((r) => r.closest('[data-beat="bulls"]'));
  const cols = [...root.querySelectorAll('.jf-vb')];
  const on = cols.filter((c) => c.classList.contains('is-on'));
  const cur = cols.findIndex((c) => c.classList.contains('is-current'));
  const fillH = cols.map((c) => Math.round(c.querySelector('.jf-vb-fill').getBoundingClientRect().height));
  return { p: +window.__jfStory.beatProgress.toFixed(3), drawn: on.length, current: cur + 1, currentLabel: root.querySelector('.is-current .jf-vb-l')?.textContent, listLabel: root.querySelector('.jf-bars-day-h')?.textContent, curFillPx: cur >= 0 ? fillH[cur] : null, visible: !root.hidden && getComputedStyle(root).display !== 'none' };
})())`));
let bad = 0;
for (let i = 1; i <= 100; i++) {
  const p = i / 100;
  await b.evaluate(`window.scrollTo(0, ${Math.round(geo.top - 0.6 * geo.vh + p * geo.h)})`);
  await sleep(60);
  const r = await read();
  if (r.visible && !(r.current === r.drawn && r.curFillPx > 0)) { bad++; console.log(`  × p=${r.p}：目前日 ${r.current}、已畫出 ${r.drawn}、目前條高 ${r.curFillPx}px`); }
}
console.log(bad ? `掃描 0.01–1.00：${bad} 處不一致` : '掃描 0.01–1.00：每一格「目前日」都等於已畫出的條數，且目前那根條高 > 0');
for (const p of [0.05, 0.5, 0.95]) {
  await b.evaluate(`window.scrollTo(0, ${Math.round(geo.top - 0.6 * geo.vh + p * geo.h)})`);
  await sleep(1200);
  const r = await read();
  console.log(`${mobile ? '390' : '1440'} 進度 ${p}（實際 ${r.p}）：目前日 ${r.current}（${r.currentLabel}）、清單「${r.listLabel}」、已畫出 ${r.drawn} 條、目前條高 ${r.curFillPx}px、圖可見 ${r.visible}`);
  if (outDir) await b.shot(join(outDir, `bulls-${mobile ? 'm' : 'd'}-${p}.png`));
}
const w = await b.evaluate('JSON.stringify([innerWidth, document.documentElement.scrollWidth])');
console.log(`[innerWidth, scrollWidth] = ${w}`);
await b.close();
process.exit(bad ? 1 : 0);
