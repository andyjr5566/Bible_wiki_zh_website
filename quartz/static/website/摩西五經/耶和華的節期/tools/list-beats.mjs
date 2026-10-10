// 列出每一拍的捲動位置：DOM 上緣／下緣、ScrollTrigger 的起訖（上緣在畫面 60% 處到下緣在 60% 處），
// 以及實際一路捲過去時 story.beat 變化的區間（beat id 第一次、最後一次出現的 scrollY），兩邊對照。
// 用法：node tools/list-beats.mjs <url> [--mobile] [--csv]
import { launch, sleep } from './cdp.mjs';

const url = process.argv[2];
const mobile = process.argv.includes('--mobile');
const W = mobile ? 390 : 1440, H = mobile ? 844 : 900;
const b = await launch({ width: W, height: H, mobile, port: 9511 + (mobile ? 1 : 0), gpu: true });
await b.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }, { name: 'prefers-reduced-motion', value: 'no-preference' }] });
await b.send('Page.addScriptToEvaluateOnNewDocument', { source: `try { localStorage.setItem('jf-coach-seen', '1'); localStorage.setItem('jf-motion', 'on') } catch {}` });
await b.send('Page.navigate', { url });
await sleep(4500);

const dom = JSON.parse(await b.evaluate(`JSON.stringify([...document.querySelectorAll('.jf-beat')].map((el, i) => { const r = el.getBoundingClientRect(); return { i, id: el.dataset.beat, chapter: el.dataset.chapter, top: Math.round(r.top + scrollY), bottom: Math.round(r.bottom + scrollY), h: el.offsetHeight }; }))`));
const total = await b.evaluate('document.documentElement.scrollHeight - innerHeight');
// 實際捲過去：每 12px 一格（慢一點才不漏），記下 story.beat 的變化
const seen = [];
let y = 0;
while (y <= total) {
  // scrollTo 之後要等兩個 rAF，ScrollTrigger 才會在下一幀更新 story；立刻讀會讀到上一格的舊值
  const id = await b.evaluate(`new Promise((res) => { window.scrollTo(0, ${y}); requestAnimationFrame(() => requestAnimationFrame(() => res(window.__jfStory.beat))); })`);
  const last = seen.at(-1);
  if (!last || last.id !== id) seen.push({ id, from: y, to: y });
  else last.to = y;
  y += 12;
}
console.log(`${mobile ? '手機 390' : '桌機 1440'}：${dom.length} 拍，頁高 ${total + H}`);
const rows = dom.map((d) => {
  const trigStart = Math.round(d.top - 0.6 * H);
  const trigEnd = Math.round(d.bottom - 0.6 * H);
  const runs = seen.filter((s) => s.id === d.id);
  const first = runs.length ? runs[0].from : null;
  const lastY = runs.length ? runs.at(-1).to : null;
  return { ...d, trigStart, trigEnd, first, lastY, runs: runs.length };
});
let bad = 0;
for (const r of rows) {
  // 預期：第 0 拍從 0 起；其餘從 trigStart 起，到下一拍的 trigStart 前一格；story.beat 只在這段區間內是這一拍
  const exp0 = r.i === 0 ? 0 : r.trigStart;
  const next = rows[r.i + 1];
  const expEnd = next ? next.trigStart - 1 : null;
  const okStart = r.first !== null && Math.abs(r.first - exp0) <= 12;
  const okEnd = expEnd === null || (r.lastY !== null && Math.abs(r.lastY - expEnd) <= 12);
  const ok = okStart && okEnd && r.runs === 1;
  if (!ok) bad++;
  console.log(`${String(r.i).padStart(2)} ${r.id.padEnd(18)} DOM ${String(r.top).padStart(6)}–${String(r.bottom).padStart(6)}（高 ${String(r.h).padStart(5)}）  觸發 ${String(r.trigStart).padStart(6)}–${String(r.trigEnd).padStart(6)}  story.beat 實際 ${r.first}–${r.lastY}（${r.runs} 段）${ok ? '' : '  ← 與預期不符'}`);
}
const dup = rows.filter((r, i) => rows.findIndex((x) => x.top === r.top) !== i);
console.log(`重複的 DOM 上緣：${dup.length ? dup.map((d) => d.id).join('、') : '無'}；與預期不符：${bad} 拍`);
const errs = b.consoleLog.filter((l) => /^\[(exception|error)\]/.test(l));
console.log(errs.length ? `console 錯誤 ${errs.length} 則；例：${errs[0].split(/\r?\n/)[0]}` : 'console 無錯誤');
await b.close();
process.exit(0);
