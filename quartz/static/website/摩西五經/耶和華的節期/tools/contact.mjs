// 把幾張截圖拼成一張聯絡表（用 headless Chrome 排版再截圖）。
// 用法：node tools/contact.mjs <out.png> <cols> <cellWidth> <img1> <img2> …
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, basename } from 'node:path';
import { pathToFileURL } from 'node:url';
import { launch, sleep } from './cdp.mjs';

const [outArg, colsArg, cwArg, ...imgs] = process.argv.slice(2);
const cols = Number(colsArg);
const cw = Number(cwArg);
const rows = Math.ceil(imgs.length / cols);
const html = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#222;display:grid;grid-template-columns:repeat(${cols},${cw}px);gap:4px;padding:4px;font:12px sans-serif;color:#eee">${imgs
  .map((f) => `<figure style="margin:0"><img src="${pathToFileURL(resolve(f)).href}" style="width:${cw}px;display:block"><figcaption>${basename(f)}</figcaption></figure>`)
  .join('')}</body>`;
const dir = mkdtempSync(join(tmpdir(), 'jfshoot-html-'));
const file = join(dir, 'c.html');
writeFileSync(file, html);
// 取第一張圖的長寬比估高度
const b = await launch({ width: cols * (cw + 4) + 4, height: 900, port: 9651 });
await b.send('Page.navigate', { url: pathToFileURL(file).href });
await sleep(1500);
const h = await b.evaluate('document.documentElement.scrollHeight');
await b.send('Emulation.setDeviceMetricsOverride', { width: cols * (cw + 4) + 4, height: h, deviceScaleFactor: 1, mobile: false });
await sleep(400);
await b.shot(resolve(outArg));
await b.close();
void rows;
console.log(resolve(outArg));
process.exit(0);
