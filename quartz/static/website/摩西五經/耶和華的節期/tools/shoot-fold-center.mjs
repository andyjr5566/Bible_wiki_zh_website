// 驗「收起說明框後主角回到畫面中央」：桌機與手機各挑幾拍，捲到中段，截收起前、按「收起」後 1 秒各一張，
// 並每 0.1 秒取樣場景的收起程度（__jfTrack().fold）與鏡頭目標點的螢幕位置，確認是平順移動、不是瞬跳。
// 另外用 motion=off 再跑一次手機，確認動態關閉時直接到位。
// 用法：node tools/shoot-fold-center.mjs <url> <outDir>
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { launch, sleep } from './cdp.mjs';

const [url, outDir] = process.argv.slice(2);
if (!url || !outDir) throw new Error('用法：node tools/shoot-fold-center.mjs <url> <outDir>');
mkdirSync(outDir, { recursive: true });

const TARGET = `(() => {
  const cv = document.getElementById('jf-canvas'); const tk = cv.__jfTrack(); const cam = cv.__jfWorld.camera;
  const V = cam.matrixWorldInverse.elements, P = cam.projectionMatrix.elements;
  const [x, y, z] = [tk.cam[3], tk.cam[4], tk.cam[5]];
  const vx = V[0] * x + V[4] * y + V[8] * z + V[12], vy = V[1] * x + V[5] * y + V[9] * z + V[13], vz = V[2] * x + V[6] * y + V[10] * z + V[14];
  const cx = P[0] * vx + P[4] * vy + P[8] * vz + P[12], cy = P[1] * vx + P[5] * vy + P[9] * vz + P[13], cw = P[3] * vx + P[7] * vy + P[11] * vz + P[15];
  return { fold: tk.fold, x: Math.round((cx / cw * 0.5 + 0.5) * innerWidth), y: Math.round((1 - (cy / cw * 0.5 + 0.5)) * innerHeight), sw: [innerWidth, document.documentElement.scrollWidth] };
})()`;

let port = 9611;
async function run(mobile, motionOff, cues) {
  const tag = `${mobile ? 'mobile' : 'desktop'}${motionOff ? '-motionoff' : ''}`;
  const W = mobile ? 390 : 1440, H = mobile ? 844 : 900;
  const b = await launch({ width: W, height: H, mobile, port: port++, gpu: true });
  await b.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }, { name: 'prefers-reduced-motion', value: motionOff ? 'reduce' : 'no-preference' }] });
  await b.send('Page.addScriptToEvaluateOnNewDocument', { source: `try { localStorage.setItem('jf-coach-seen', '1'); localStorage.setItem('jf-motion', '${motionOff ? 'off' : 'on'}') } catch {}` });
  await b.send('Page.navigate', { url });
  await sleep(4500);
  for (const cue of cues) {
    // 先確保是展開狀態
    await b.evaluate(`document.documentElement.hasAttribute('data-fold') && document.querySelector('.jf-boxfold').click()`);
    await b.evaluate(`(() => { const el = document.querySelector('[data-cue="${cue}"]'); window.scrollTo(0, el.getBoundingClientRect().top + scrollY + Math.max(0, el.offsetHeight - innerHeight) * 0.5); })()`);
    await sleep(2500);
    const before = JSON.parse(await b.evaluate(`JSON.stringify(${TARGET})`));
    await b.shot(join(outDir, `${tag}-${cue}-1-open.png`));
    // 按「收起」，每 0.1 秒取樣
    await b.evaluate(`document.querySelector('[data-cue="${cue}"] .jf-boxfold').click()`);
    const samples = [];
    const t0 = Date.now();
    while (Date.now() - t0 < 1000) {
      const m = JSON.parse(await b.evaluate(`JSON.stringify(${TARGET})`));
      samples.push([Date.now() - t0, +m.fold.toFixed(3), m.x, m.y]);
      await sleep(80);
    }
    await sleep(Math.max(0, 1000 - (Date.now() - t0)));
    const after = JSON.parse(await b.evaluate(`JSON.stringify(${TARGET})`));
    await b.shot(join(outDir, `${tag}-${cue}-2-folded.png`));
    // 再展開，看有沒有平順回來
    await b.evaluate(`document.querySelector('[data-cue="${cue}"] .jf-boxfold').click()`);
    const back = [];
    const t1 = Date.now();
    while (Date.now() - t1 < 900) {
      const m = JSON.parse(await b.evaluate(`JSON.stringify(${TARGET})`));
      back.push([Date.now() - t1, +m.fold.toFixed(3)]);
      await sleep(100);
    }
    const end = JSON.parse(await b.evaluate(`JSON.stringify(${TARGET})`));
    const maxStep = (arr, k) => Math.max(...arr.slice(1).map((s, i) => Math.abs(s[k] - arr[i][k])));
    const t95 = samples.find((s) => s[1] >= 0.95)?.[0];
    console.log(`${tag} ${cue}: 目標點 展開(${before.x},${before.y}) → 收起後1秒(${after.x},${after.y}) → 再展開(${end.x},${end.y})；fold 到 0.95 用 ${t95 ?? '>1000'}ms；收起時 fold 取樣 ${samples.map((s) => s[1]).join(',')}；展開時 ${back.map((s) => s[1]).join(',')}；寬度 ${before.sw}/${after.sw}/${end.sw}`);
    void maxStep;
  }
  const errs = b.consoleLog.filter((l) => /^\[(exception|error)\]/.test(l));
  console.log(errs.length ? `  console 錯誤：${errs[0]}` : '  console 無錯誤');
  await b.close();
}

await run(false, false, ['lots', 'echo-gilgal', 'booth']);
await run(true, false, ['echo-hezekiah', 'afflict', 'seven-days']);
await run(true, true, ['echo-hezekiah']);
process.exit(0);
