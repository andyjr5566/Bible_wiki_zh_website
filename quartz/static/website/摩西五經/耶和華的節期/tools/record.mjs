// 錄影：CDP screencast 一路捲動整頁（在塗血、烤餅、吹角、搖禾捆那幾拍停下來操作），frames → ffmpeg → mp4。
// 用法：node record.mjs <url> <out.mp4> [--mobile] [--dark] [--reduced] [--from=<拍 id>] [--to-end=<章 id>]
//   --from：從這一拍開始錄（預設從頭）；--to-end：錄到這一章的章末上緣為止（預設錄到頁尾）。
//   blow 那一拍：長按「吹」直到 story.blow.done（照 tools/check-blow.mjs），再多按 0.6 秒才放開。
//   另外寫 <out>.marks.json：每個 cue 第一次出現的影片秒數（抽畫格用）。
import { launch, sleep } from './cdp.mjs';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

import { resolve } from 'node:path';
const [url, outArg] = process.argv.slice(2);
const out = resolve(outArg);
const mobile = process.argv.includes('--mobile');
const dark = process.argv.includes('--dark');
const reduced = process.argv.includes('--reduced');
const fromBeat = process.argv.find((a) => a.startsWith('--from='))?.slice(7);
const toEnd = process.argv.find((a) => a.startsWith('--to-end='))?.slice(9);
const W = mobile ? 390 : 1440, H = mobile ? 844 : 900;
const frameDir = out.replace(/\.mp4$/, '-frames');
rmSync(frameDir, { recursive: true, force: true });
mkdirSync(frameDir, { recursive: true });

const b = await launch({ width: W, height: H, mobile, dpr: mobile ? 2 : 1, port: 9351 + (mobile ? 1 : 0), gpu: true });
const media = [];
media.push({ name: 'prefers-color-scheme', value: dark ? 'dark' : 'light' });
if (reduced) media.push({ name: 'prefers-reduced-motion', value: 'reduce' });
if (media.length) await b.send('Emulation.setEmulatedMedia', { features: media });
// 跳過新手導覽（錄影只看故事本身）
await b.send('Page.addScriptToEvaluateOnNewDocument', { source: `try { localStorage.setItem('jf-coach-seen', '1') } catch {}` });
await b.send('Page.navigate', { url });
await sleep(6000);

const frames = [];
let t0 = null;
const { send } = b;
const onFrame = async (m) => {
  if (m.method !== 'Page.screencastFrame') return;
  const { data, metadata, sessionId } = m.params;
  const ts = metadata.timestamp;
  if (t0 === null) t0 = ts;
  const f = join(frameDir, `f${String(frames.length).padStart(5, '0')}.jpg`);
  writeFileSync(f, Buffer.from(data, 'base64'));
  frames.push({ f, t: ts - t0 });
  send('Page.screencastFrameAck', { sessionId }).catch(() => {});
};
// cdp.mjs 的 listeners 沒有公開；用 Runtime 以外的方式掛：直接包一層 ws 監聽
b.onEvent?.(onFrame);
if (!b.onEvent) throw new Error('cdp.mjs 需要 onEvent');
await send('Page.startScreencast', { format: 'jpeg', quality: 80, maxWidth: W * (mobile ? 2 : 1), maxHeight: H * (mobile ? 2 : 1), everyNthFrame: 1 });

const total = await b.evaluate('document.documentElement.scrollHeight - innerHeight');
const hyssopTop = await b.evaluate(`(() => { const el = document.querySelector('[data-cue="hyssop"], [data-beat="hyssop"]'); return el ? el.getBoundingClientRect().top + scrollY : -1; })()`);
const clickText = (txt) => b.evaluate(`(() => { const el = [...document.querySelectorAll('button')].find(e => e.textContent.trim() === ${JSON.stringify(txt)}); if (el) { el.click(); return true } return false })()`);
const topOf = (cue) => b.evaluate(`(() => { const el = document.querySelector('[data-cue="${cue}"]'); return el ? el.getBoundingClientRect().top + scrollY : -1; })()`);
// 長按某個按鈕（例如「按住烤餅」）：在按鈕中心按下、停 ms 毫秒、放開
const holdText = async (txt, ms, doneExpr = null, scope = 'body') => {
  const r = await b.evaluate(`(() => { const el = [...document.querySelectorAll(${JSON.stringify(scope + ' button')})].find(e => e.textContent.trim() === ${JSON.stringify(txt)} && e.offsetParent); if (!el) return null; const q = el.getBoundingClientRect(); return [q.x + q.width / 2, q.y + q.height / 2]; })()`);
  if (!r) return false;
  if (mobile) await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: r[0], y: r[1] }] });
  else {
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: r[0], y: r[1] });
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: r[0], y: r[1], button: 'left', clickCount: 1 });
  }
  if (doneExpr) {
    // 按住直到完成（最多 ms 毫秒），完成後再多按 0.6 秒，聲波與震動才看得到
    const t0 = Date.now();
    while (Date.now() - t0 < ms && !(await b.evaluate(doneExpr))) await sleep(100);
    await sleep(600);
  } else await sleep(ms);
  if (mobile) await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  else await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: r[0], y: r[1], button: 'left', clickCount: 1 });
  return true;
};
// 到了這些拍就停下來操作一次
const actions = [
  { at: hyssopTop, run: async () => { for (const t of ['蘸血', '打門楣', '蘸血', '打左門框', '蘸血', '打右門框']) { await clickText(t); await sleep(1100); } } },
  { at: await topOf('bake'), run: async () => { await holdText('按住烤餅', 2400); } },
  { at: await topOf('blow'), run: async () => { await holdText('吹', 6000, 'window.__jfStory.blow.done'); await sleep(900); } },
  // 七的節奏的禧年角聲（第二個吹角互動，按鈕在自己那一拍的說明框裡）
  { at: await topOf('sv-horn'), run: async () => { await holdText('吹', 6000, 'window.__jfStory.blow.done', '[data-cue="sv-horn"]'); await sleep(900); } },
  { at: await topOf('wave'), run: async () => { for (let i = 0; i < 3; i++) { await clickText('搖一搖'); await sleep(1000); } } },
].filter((a) => a.at > 0);
// 起訖：--from 那一拍的上緣往上留半個畫面；--to-end 那一章的章末上緣
const startY = fromBeat ? Math.max(0, Math.round(await b.evaluate(`(() => { const el = document.querySelector('[data-beat="${fromBeat}"]'); return el ? el.getBoundingClientRect().top + scrollY - innerHeight * 0.5 : 0; })()`))) : 0;
const endY = toEnd ? Math.min(total, Math.round(await b.evaluate(`(() => { const el = document.querySelector('.jf-end[data-chapter="${toEnd}"]'); return el ? el.getBoundingClientRect().top + scrollY - innerHeight * 0.2 : -1; })()`))) : total;
if (endY < 0) throw new Error(`找不到章末 ${toEnd}`);
for (const a of actions) if (a.at + H * 0.3 <= startY) a.done = true; // 起點之前的互動不做
const marks = {};
let y = startY;
if (startY) { await b.evaluate(`window.scrollTo(0, ${startY})`); await sleep(1500); }
const step = mobile ? 14 : 18;
while (y < endY) {
  y = Math.min(endY, y + step);
  const cue = await b.evaluate(`(() => { window.scrollTo(0, ${y}); return window.__jfStory.cue; })()`);
  if (!(cue in marks)) marks[cue] = +(frames.at(-1)?.t ?? 0).toFixed(2);
  await sleep(33);
  for (const a of actions) {
    if (!a.done && y >= a.at + H * 0.3) {
      a.done = true;
      await sleep(800);
      await a.run();
      await sleep(1200);
    }
  }
}
await sleep(1500);
await send('Page.stopScreencast');
writeFileSync(out.replace(/\.mp4$/, '.marks.json'), JSON.stringify(marks, null, 1));
console.log('frames', frames.length, 'console:', b.consoleLog.slice(0, 10).join(' | '));
await b.close();

// concat demuxer：每張圖的停留時間＝與下一張的時間差
const list = frames.map((fr, i) => `file '${fr.f.replace(/\\/g, '/')}'\nduration ${Math.max(0.016, ((frames[i + 1]?.t ?? fr.t + 0.04) - fr.t)).toFixed(4)}`).join('\n');
writeFileSync(join(frameDir, 'list.txt'), list + `\nfile '${frames.at(-1).f.replace(/\\/g, '/')}'\n`);
const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', join(frameDir, 'list.txt'), '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2,fps=30', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '24', out], { stdio: 'inherit' });
console.log('ffmpeg exit', r.status, out);
