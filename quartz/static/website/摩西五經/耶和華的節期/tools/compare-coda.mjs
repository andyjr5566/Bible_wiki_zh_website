// 驗 coda-night 最後一格 = 開場（title）第一個畫面：用場景實驗室各截一張（動態關，免得風與漂移造成差異），算不同像素的比例。
// 用法：node tools/compare-coda.mjs <port> [--mobile] [--dark]
import { launch, sleep } from './cdp.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const port = process.argv[2] ?? '3171';
const mobile = process.argv.includes('--mobile');
const dark = process.argv.includes('--dark');
const W = mobile ? 390 : 1280, H = mobile ? 844 : 800;
const b = await launch({ width: W, height: H, mobile, port: 9661, gpu: true });
await b.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: dark ? 'dark' : 'light' }, { name: 'prefers-reduced-motion', value: 'reduce' }] });
const shot = async (cue, p) => {
  await b.send('Page.navigate', { url: `http://127.0.0.1:${port}/lab/scene-lab.html?cue=${cue}&p=${p}&ui=0&motion=off${dark ? '&dark=1' : ''}` });
  await sleep(3500);
  return (await b.send('Page.captureScreenshot', { format: 'png' })).data;
};
const a = await shot('title', 0);
const c = await shot('coda-night', 1);
const diff = await b.evaluate(`(async () => {
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
mkdirSync('review/sevens', { recursive: true });
const tag = `${mobile ? 'm' : 'd'}${dark ? '-dark' : ''}`;
writeFileSync(join('review/sevens', `${tag}-coda-vs-title-a.png`), Buffer.from(a, 'base64'));
writeFileSync(join('review/sevens', `${tag}-coda-vs-title-b.png`), Buffer.from(c, 'base64'));
console.log(`${tag}：coda 最後一格與 title 第一格不同的像素 ${(diff * 100).toFixed(3)}%`);
await b.close();
process.exit(0);
