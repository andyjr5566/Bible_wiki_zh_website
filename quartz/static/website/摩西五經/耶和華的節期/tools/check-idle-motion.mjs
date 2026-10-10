// 驗收「靜止不動的畫面」問題：對整合後網站的每一拍，捲到中段、停 1.5 秒，相隔 1 秒連拍兩張，算不同像素的比例。
// 動態開：每拍都要 > 0.5%；動態關：要 < 0.1%（讀者互動除外）。輸出 cue | 開 | 關 的表格。
// 用法：node tools/check-idle-motion.mjs <url> [--mobile] [--dark] [--fps]
//   --fps：另外在三個比較重的拍量 rAF 平均幀時間（毫秒）。
import { launch, sleep } from './cdp.mjs';

const [url] = process.argv.slice(2);
const mobile = process.argv.includes('--mobile');
const dark = process.argv.includes('--dark');
const wantFps = process.argv.includes('--fps');
const W = mobile ? 390 : 1440;
const H = mobile ? 844 : 900;

async function run(motionOff, port) {
  const b = await launch({ width: W, height: H, mobile, port, gpu: true });
  await b.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: dark ? 'dark' : 'light' }, { name: 'prefers-reduced-motion', value: 'no-preference' }] });
  await b.send('Page.addScriptToEvaluateOnNewDocument', { source: `try { localStorage.setItem('jf-coach-seen', '1'); localStorage.setItem('jf-motion', '${motionOff ? 'off' : 'on'}'); } catch {}` });
  await b.send('Page.navigate', { url });
  await sleep(5000);
  const beats = await b.evaluate(`JSON.stringify([...document.querySelectorAll('.jf-beat')].map(el => ({ cue: el.dataset.cue, id: el.dataset.beat })))`);
  const only = process.argv.find((x) => x.startsWith('--only='))?.slice(7).split(',');
  const list = JSON.parse(beats).filter((x) => !only || only.includes(x.cue));
  const cap = async () => (await b.send('Page.captureScreenshot', { format: 'png' })).data;
  const diff = (a, c) =>
    b.evaluate(`(async () => {
      const load = (s) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = 'data:image/png;base64,' + s; });
      const [x, y] = await Promise.all([load(${JSON.stringify(a)}), load(${JSON.stringify(c)})]);
      const cv = document.createElement('canvas'); cv.width = x.width; cv.height = x.height;
      const g = cv.getContext('2d', { willReadFrequently: true });
      g.drawImage(x, 0, 0); const A = g.getImageData(0, 0, cv.width, cv.height).data;
      g.drawImage(y, 0, 0); const B = g.getImageData(0, 0, cv.width, cv.height).data;
      let n = 0; const total = A.length / 4;
      for (let i = 0; i < A.length; i += 4) { if (Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]) > 36) n++; }
      return n / total;
    })()`);
  const out = [];
  for (let i = 0; i < list.length; i++) {
    const cue = list[i].cue;
    await b.evaluate(`(() => { const el = document.querySelector('[data-cue="${cue}"]'); window.scrollTo(0, el.getBoundingClientRect().top + scrollY + Math.max(0, el.offsetHeight - innerHeight) * 0.5); })()`);
    await sleep(1500);
    const a = await cap();
    await sleep(1000);
    const c = await cap();
    out.push([cue, await diff(a, c)]);
  }
  const fps = [];
  if (wantFps && !motionOff) {
    // headless 的 rAF 在這台機器被鎖在約 30，量不出餘裕；改量場景每幀實際花的時間（含 gl.finish），換算成可達的 fps
    await b.evaluate(`document.getElementById('jf-canvas').__jfBench(true)`);
    for (const cue of ['title', 'depart', 'weeks-offerings', 'rejoice', 'barley-ripe']) {
      await b.evaluate(`(() => { const el = document.querySelector('[data-cue="${cue}"]'); window.scrollTo(0, el.getBoundingClientRect().top + scrollY + Math.max(0, el.offsetHeight - innerHeight) * 0.5); })()`);
      await sleep(3000);
      const info = JSON.parse(await b.evaluate(`JSON.stringify(document.getElementById('jf-canvas').__jfInfo())`));
      fps.push([cue, info.gpuMs >= 0 ? info.gpuMs : info.frameMs, info.triangles, info.gpuMs >= 0 ? 'GPU' : 'CPU']);
    }
  }
  const errs = b.consoleLog.filter((l) => /^\[(exception|error)\]/.test(l));
  await b.close();
  return { out, fps, errs };
}

const on = await run(false, 9441 + (mobile ? 1 : 0));
const off = await run(true, 9451 + (mobile ? 1 : 0));
const pct = (x) => `${(x * 100).toFixed(2)}%`;
let badOn = 0;
let badOff = 0;
console.log(`cue`.padEnd(18) + '開'.padEnd(10) + '關');
for (let i = 0; i < on.out.length; i++) {
  const [cue, a] = on.out[i];
  const c = off.out[i][1];
  const mark = (a > 0.005 ? '' : ' ✗開') + (c < 0.001 ? '' : ' ✗關');
  if (a <= 0.005) badOn++;
  if (c >= 0.001) badOff++;
  console.log(cue.padEnd(18) + pct(a).padEnd(10) + pct(c) + mark);
}
console.log(`動態開未達 0.5% 的拍：${badOn}；動態關超過 0.1% 的拍：${badOff}`);
if (wantFps) console.log('每幀耗時（動態開）：' + on.fps.map(([c, ms, tr, k]) => `${c} ${ms.toFixed(1)}ms ${k}（≈${(1000 / ms).toFixed(0)}fps，${tr} 三角形）`).join('；'));
for (const [tag, r] of [['開', on], ['關', off]]) console.log(r.errs.length ? `console 錯誤（${tag}）：\n${r.errs.slice(0, 3).join('\n')}` : `console 無錯誤（${tag}）`);
process.exit(0);
