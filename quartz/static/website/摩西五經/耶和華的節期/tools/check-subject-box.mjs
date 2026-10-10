// 量「主角」跟「說明框」在螢幕上重疊多少：對整合後網站的每一拍捲到中段，算主角的螢幕包圍盒，跟該拍 .jf-box 的 rect 比。
// 用法：node tools/check-subject-box.mjs <url> [--mobile] [--dark] [--only=cue,cue] [--exclude=cue,前綴-] [--at=0.5] [--shots=<dir>] [--json=<file>] [--fold]
//   --only / --exclude  只量／跳過哪些 cue（exclude 以 - 結尾的當前綴）
//   --at     捲到該拍的哪個位置（0..1，預設 0.5＝中段）
//   --shots  每拍另存一張疊了框的截圖（紅＝主角、藍＝說明框、黃點＝鏡頭目標點、綠線＝標題列下緣）
//   --json   把結果存成 JSON（調整前後對照用）
//   --fold   先按「收起」再量（驗收起後主角已回到畫面中央，不再偏向說明框那一側）
//
// 「主角」的定義（三部分取聯集）：
//   1. 鏡頭目標點：場景當幀的 tracks.cam 的 (tx,ty,tz)，由 canvas.__jfTrack() 取得。以它為中心、水平 ±0.6m、垂直 ±0.7m 的盒子（一個人、一隻動物、一座祭壇的尺度），
//      代表「導演要你看的那一點」，不管那一點上有沒有東西。
//   2. 目標點附近的物件：canvas.__jfWorld.scene 裡所有可見的 Mesh／InstancedMesh（實例逐個算），
//      其世界包圍盒中心離目標點水平 ≤ 2.8m、離地中心 < 目標高 +3.5m、盒高 ≥ 0.4m、對角線 ≤ 8m 的，取它們的八個角投影到螢幕後的外框聯集；外框占畫面 35% 以上的當環境丟掉。
//      這會抓到人、動物、帳棚、棚架、火堆這類「那一拍在講的東西」。
//   3. 月亮圓面（可見、在畫面內、且離目標點的螢幕位置水平 ≤ 25% 寬、垂直 ≤ 25% 高時才算）。
//   4. 漩渦（七的節奏章的螢幕座標覆蓋層）：canvas.__jfVortex() 給的圓（外圈半徑），畫出來才算。
//   投影用 world.camera 當幀的 matrixWorldInverse × projectionMatrix（含手機往上推／桌機左右推用的 view offset），所以是真實的螢幕位置。
// 重疊比例 ＝ 主角外框與 .jf-box 外框的交集面積 ÷ 主角外框面積。
// 另列：目標點的螢幕位置（占高度 %）、主角外框被頂端工具列（.jf-top／.jf-months 的下緣以上）蓋住的比例、主角外框超出畫面左右的比例。
//
// 限制：
//   - 這是外框（矩形）比矩形，人形與帳棚的輪廓比外框小，所以比例偏保守（偏高）；0% 才是真的沒碰，10–25% 通常只是外框角落。
//   - 近景（物件外框聯集超過畫面 50%，例如在會幕裡面）退回只用縮小一半的目標點盒子（±0.3m／±0.35m，當成一件手邊的東西），表上標「近景」。
//   - 任何角落在鏡頭後方的物件整個丟掉（投影會爆開）。
//   - 合併成單一大網格的場景件（對角線 > 8m，如整片地形、整排房子）不算在內，靠目標點盒子代表。
//   - 不含 DOM 的互動物件（手機吃羊羔的分格 [data-jf-panel]、牛膝草把手等）；它們的位置由各自的版面程式決定。
//   - 說明框用該拍 section 內的 .jf-box；沒有說明框的拍（時光過場）跳過。
//   - 說明框有進場位移動畫，量測前等 2.2 秒。
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launch, sleep } from './cdp.mjs';

const [url] = process.argv.slice(2);
if (!url) throw new Error('用法：node tools/check-subject-box.mjs <url> [--mobile] [--only=cue,cue] [--shots=dir] [--json=file]');
const arg = (k) => process.argv.find((x) => x.startsWith(`--${k}=`))?.slice(k.length + 3);
const mobile = process.argv.includes('--mobile');
const dark = process.argv.includes('--dark');
const fold = process.argv.includes('--fold');
const at = Number(arg('at') ?? 0.5);
const only = arg('only')?.split(',');
const exclude = arg('exclude')?.split(',') ?? []; // 要跳過的 cue（完整名稱，或以 - 結尾的前綴，如 sv-）
const shots = arg('shots');
const jsonOut = arg('json');
const thr = Number(arg('thr') ?? 0.15); // 重疊門檻，預設 15%
const W = mobile ? 390 : 1440;
const H = mobile ? 844 : 900;
if (shots) mkdirSync(shots, { recursive: true });

const MEASURE = `(() => {
  const cv = document.getElementById('jf-canvas');
  const world = cv.__jfWorld, tk = cv.__jfTrack();
  const cam = world.camera;
  const V = cam.matrixWorldInverse.elements, P = cam.projectionMatrix.elements;
  const W = innerWidth, H = innerHeight;
  const T = [tk.cam[3], tk.cam[4], tk.cam[5]];
  // 世界點 → 螢幕 CSS px；在鏡頭後方回傳 null
  const proj = (x, y, z) => {
    const vx = V[0] * x + V[4] * y + V[8] * z + V[12], vy = V[1] * x + V[5] * y + V[9] * z + V[13], vz = V[2] * x + V[6] * y + V[10] * z + V[14];
    const cx = P[0] * vx + P[4] * vy + P[8] * vz + P[12], cy = P[1] * vx + P[5] * vy + P[9] * vz + P[13], cw = P[3] * vx + P[7] * vy + P[11] * vz + P[15];
    if (cw <= 0.01) return null;
    return [(cx / cw * 0.5 + 0.5) * W, (1 - (cy / cw * 0.5 + 0.5)) * H];
  };
  const rect = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 };
  const objR = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 }; // 只含物件的外框，用來判斷是不是近景
  let growObj = false;
  const grow = (p) => { if (!p) return; rect.x0 = Math.min(rect.x0, p[0]); rect.x1 = Math.max(rect.x1, p[0]); rect.y0 = Math.min(rect.y0, p[1]); rect.y1 = Math.max(rect.y1, p[1]);
    if (growObj) { objR.x0 = Math.min(objR.x0, p[0]); objR.x1 = Math.max(objR.x1, p[0]); objR.y0 = Math.min(objR.y0, p[1]); objR.y1 = Math.max(objR.y1, p[1]); } };
  // 1. 目標點盒子
  const hx = 0.6, hy = 0.7; // 一個人／一隻動物／一座祭壇的尺度
  for (const dx of [-hx, hx]) for (const dy of [-hy, hy]) for (const dz of [-hx, hx]) grow(proj(T[0] + dx, T[1] + dy, T[2] + dz));
  const proxy = { ...rect };
  // 近景用的小盒子（±0.3m／±0.35m，一件手邊的東西：血、香爐、禾捆）
  const small = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 };
  for (const dx of [-0.3, 0.3]) for (const dy of [-0.35, 0.35]) for (const dz of [-0.3, 0.3]) { const q = proj(T[0] + dx, T[1] + dy, T[2] + dz); if (q) { small.x0 = Math.min(small.x0, q[0]); small.x1 = Math.max(small.x1, q[0]); small.y0 = Math.min(small.y0, q[1]); small.y1 = Math.max(small.y1, q[1]); } }
  const tp = proj(T[0], T[1], T[2]);
  growObj = true;
  // 2. 附近的物件
  const mul = (a, b) => { const o = new Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; };
  const xf = (m, x, y, z) => [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];
  let used = 0;
  const consider = (m, bb) => {
    const cs = [];
    let lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
    for (const x of [bb.min.x, bb.max.x]) for (const y of [bb.min.y, bb.max.y]) for (const z of [bb.min.z, bb.max.z]) {
      const w = xf(m, x, y, z); cs.push(w);
      for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], w[i]); hi[i] = Math.max(hi[i], w[i]); }
    }
    const diag = Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]);
    const c = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];
    if (diag > 8 || hi[1] - lo[1] < 0.4) return;
    if (Math.hypot(c[0] - T[0], c[2] - T[2]) > 2.8 || c[1] > T[1] + 3.5) return;
    // 有角落在鏡頭後方（或貼著鏡頭）的物件投影會爆開，整個丟掉
    const ps = cs.map((w) => proj(w[0], w[1], w[2]));
    if (ps.some((p) => !p)) return;
    const xs = ps.map((p) => p[0]), ys = ps.map((p) => p[1]);
    if ((Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys)) > W * H * 0.35) return; // 占了三分之一個畫面以上的是環境，不是主角
    used++;
    for (const p of ps) grow(p);
  };
  world.scene.updateMatrixWorld(true);
  world.scene.traverseVisible((o) => {
    if (!o.isMesh || !o.geometry) return;
    if (o === world.moon || o === world.moonHull || o === world.sun) return;
    const g = o.geometry;
    if (!g.boundingBox) g.computeBoundingBox();
    if (!g.boundingBox) return;
    const mw = o.matrixWorld.elements;
    if (o.isInstancedMesh) {
      const n = o.count, arr = o.instanceMatrix.array;
      for (let i = 0; i < n; i++) consider(mul(mw, Array.from(arr.subarray(i * 16, i * 16 + 16))), g.boundingBox);
    } else consider(mw, g.boundingBox);
  });
  growObj = false;
  // 近景（物件外框的聯集超過畫面 50%，如帳幕裡面）：物件外框沒有意義，退回只用目標點盒子
  let closeUp = false;
  if (used > 0 && (objR.x1 - objR.x0) * (objR.y1 - objR.y0) > W * H * 0.5) { closeUp = true; Object.assign(rect, small); }
  // 3. 月亮：圓面中心離目標點的螢幕投影水平 ≤ 25% 畫面寬、而且在畫面內時，當作主角的一部分（夜裡那一拍在講的是月亮）
  let moon = null;
  if (!closeUp && world.moon.visible && tp) {
    const mp = world.moon.position, r = world.moon.scale.x, E = cam.matrixWorld.elements;
    const c0 = proj(mp.x, mp.y, mp.z), c1 = proj(mp.x + E[0] * r, mp.y + E[1] * r, mp.z + E[2] * r);
    if (c0 && c1) {
      const rr = Math.hypot(c1[0] - c0[0], c1[1] - c0[1]);
      if (Math.abs(c0[0] - tp[0]) < W * 0.25 && Math.abs(c0[1] - tp[1]) < H * 0.25 && c0[1] > -rr && c0[1] < H + rr) {
        moon = [c0[0], c0[1], rr];
        grow([c0[0] - rr, c0[1] - rr]); grow([c0[0] + rr, c0[1] + rr]);
      }
    }
  }
  // 4. 漩渦（螢幕座標的覆蓋層，七的節奏那一章）：外圈半徑的圓，直接取場景算好的位置
  const vx = cv.__jfVortex && cv.__jfVortex();
  if (vx && vx.on) { grow([vx.x - vx.r, vx.y - vx.r]); grow([vx.x + vx.r, vx.y + vx.r]); }
  // 說明框、頂端工具列
  const beat = document.querySelector('.jf-beat[data-cue="' + window.__jfCueNow + '"]');
  const boxEl = beat && beat.querySelector('.jf-box');
  const br = boxEl && boxEl.getBoundingClientRect();
  let topBar = 0;
  for (const sel of ['.jf-top', '.jf-months']) { const e = document.querySelector(sel); if (e) { const r = e.getBoundingClientRect(); if (r.width > 0 && r.top < H * 0.3) topBar = Math.max(topBar, r.bottom); } }
  return { rect, tp, topBar, used, moon, closeUp, box: br ? { x0: br.left, y0: br.top, x1: br.right, y1: br.bottom, shown: br.width > 0 && br.height > 0 && getComputedStyle(boxEl).display !== 'none' } : null, fold: tk.fold, W, H, sw: [innerWidth, document.documentElement.scrollWidth] };
})()`;

const b = await launch({ width: W, height: H, mobile, port: 9561 + (mobile ? 1 : 0), gpu: true });
await b.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: dark ? 'dark' : 'light' }, { name: 'prefers-reduced-motion', value: 'no-preference' }] });
await b.send('Page.addScriptToEvaluateOnNewDocument', { source: `try { localStorage.setItem('jf-coach-seen', '1'); localStorage.setItem('jf-motion', 'on') } catch {}` });
await b.send('Page.navigate', { url });
await sleep(5000);
if (fold) await b.evaluate(`document.querySelector('.jf-boxfold')?.click()`);
const beats = JSON.parse(await b.evaluate(`JSON.stringify([...document.querySelectorAll('.jf-beat')].map(el => ({ cue: el.dataset.cue, id: el.dataset.beat })))`));
const list = beats.filter((x) => (!only || only.includes(x.cue)) && !exclude.some((e) => (e.endsWith('-') ? x.cue.startsWith(e) : x.cue === e)));
const area = (r) => Math.max(0, r.x1 - r.x0) * Math.max(0, r.y1 - r.y0);
const inter = (a, c) => area({ x0: Math.max(a.x0, c.x0), y0: Math.max(a.y0, c.y0), x1: Math.min(a.x1, c.x1), y1: Math.min(a.y1, c.y1) });
const rows = [];
const widths = new Set();
for (const { cue, id } of list) {
  await b.evaluate(`window.__jfCueNow = ${JSON.stringify(cue)}; (() => { const el = document.querySelector('[data-cue="${cue}"]'); window.scrollTo(0, el.getBoundingClientRect().top + scrollY + Math.max(0, el.offsetHeight - innerHeight) * ${at}); })()`);
  await sleep(2200);
  const measure = async () => JSON.parse(await b.evaluate(`(() => { try { return JSON.stringify(${MEASURE}); } catch (e) { return JSON.stringify({ err: String(e.stack || e) }); } })()`));
  let m = await measure();
  if (!m.err && (!m.box || !m.box.shown)) { await sleep(1800); m = await measure(); } // 說明框偶爾還在淡入，多等一次
  if (m.err) throw new Error(m.err);
  widths.add(m.sw.join('/'));
  if (!m.box || !m.box.shown) { rows.push({ cue, id, skip: true }); continue; }
  const r = m.rect;
  const ov = area(r) > 0 ? inter(r, m.box) / area(r) : 0;
  const topCover = area(r) > 0 ? inter(r, { x0: -1e9, y0: -1e9, x1: 1e9, y1: m.topBar }) / area(r) : 0;
  const side = area(r) > 0 ? 1 - inter(r, { x0: 0, y0: -1e9, x1: m.W, y1: 1e9 }) / area(r) : 0;
  const row = { cue, id, ov, topCover, side, tx: m.tp ? m.tp[0] / m.W : null, ty: m.tp ? m.tp[1] / m.H : null, top: m.topBar, rect: [r.x0, r.y0, r.x1, r.y1].map(Math.round), box: [m.box.x0, m.box.y0, m.box.x1, m.box.y1].map(Math.round), n: m.used, closeUp: m.closeUp, fold: m.fold };
  rows.push(row);
  if (shots) {
    await b.evaluate(`(() => { const d = document.createElement('div'); d.id = '__sb'; d.style.cssText = 'position:fixed;inset:0;z-index:99999;pointer-events:none';
      const rc = (a, col) => { const e = document.createElement('div'); e.style.cssText = 'position:absolute;border:2px solid ' + col + ';left:' + a[0] + 'px;top:' + a[1] + 'px;width:' + (a[2] - a[0]) + 'px;height:' + (a[3] - a[1]) + 'px'; d.append(e); };
      rc(${JSON.stringify(row.rect)}, 'red'); rc(${JSON.stringify(row.box)}, 'blue');
      const l = document.createElement('div'); l.style.cssText = 'position:absolute;left:0;right:0;height:0;border-top:2px solid #0a0;top:${m.topBar}px'; d.append(l);
      ${m.tp ? `const p = document.createElement('div'); p.style.cssText = 'position:absolute;width:10px;height:10px;border-radius:5px;background:#fc0;border:2px solid #000;left:${m.tp[0] - 7}px;top:${m.tp[1] - 7}px'; d.append(p);` : ''}
      document.body.append(d); })()`);
    await b.shot(join(shots, `${mobile ? 'm' : 'd'}-${id}.png`));
    await b.evaluate(`document.getElementById('__sb')?.remove()`);
  }
}
const pct = (x) => `${(x * 100).toFixed(0)}%`;
console.log(`${mobile ? '手機 390×844' : '桌機 1440×900'}${fold ? '（已收起說明框）' : ''}，捲到各拍 ${pct(at)} 處；寬度 [innerWidth/scrollWidth] ${[...widths].join(' ')}`);
console.log('cue'.padEnd(18) + '重疊'.padEnd(7) + '目標點(x,y)'.padEnd(13) + '蓋標題列'.padEnd(9) + '出左右'.padEnd(7) + '可用帶(y)'.padEnd(11) + '主角外框 [x0 y0 x1 y1]');
let bad = 0;
for (const r of rows) {
  if (r.skip) { console.log(r.cue.padEnd(18) + '（無說明框，跳過）'); continue; }
  const flag = r.ov >= thr ? '  ◀ 重疊' : '';
  if (r.ov >= thr) bad++;
  console.log(r.cue.padEnd(18) + pct(r.ov).padEnd(7) + (r.tx === null ? '—' : `${pct(r.tx)},${pct(r.ty)}`).padEnd(13) + pct(r.topCover).padEnd(9) + pct(r.side).padEnd(7) + `${Math.round(r.top)}–${r.box[1]}`.padEnd(11) + `[${r.rect.join(' ')}]${r.closeUp ? ' 近景' : ''}${flag}`);
}
console.log(`重疊 ≥ ${pct(thr)} 的拍：${bad} / ${rows.filter((r) => !r.skip).length}`);
if (jsonOut) writeFileSync(jsonOut, JSON.stringify(rows, null, 1));
const errs = b.consoleLog.filter((l) => /^\[(exception|error)\]/.test(l));
console.log(errs.length ? `console 錯誤 ${errs.length} 則；例：${errs[0].split(/\r?\n/)[0]}` : 'console 無錯誤');
await b.close();
process.exit(0);
