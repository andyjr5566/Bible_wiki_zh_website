// 用場景實驗室（lab/scene-lab.html）逐 cue 截圖，方便調鏡頭與場景。
// 用法：node tools/shoot-lab.mjs <port> <outDir> <cue:p[:blow],cue:p,…> [--mobile] [--dark] [--motion-off]
//   --mobile：390×844（lab 的版面 W≤720 時走手機構圖），並畫兩條洋紅虛線＝標題列下緣（118）與長說明框上緣（279）
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { launch, sleep } from './cdp.mjs';

const [portArg, outDir, list] = process.argv.slice(2);
const mobile = process.argv.includes('--mobile');
const dark = process.argv.includes('--dark');
const motionOff = process.argv.includes('--motion-off');
const W = mobile ? 390 : 1280, H = mobile ? 844 : 800;
mkdirSync(outDir, { recursive: true });
const b = await launch({ width: W, height: H, mobile, port: 9631 + (mobile ? 1 : 0), gpu: true });
await b.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: dark ? 'dark' : 'light' }, { name: 'prefers-reduced-motion', value: motionOff ? 'reduce' : 'no-preference' }] });
for (const item of list.split(',')) {
  const [cue, p, blow] = item.split(':');
  const url = `http://127.0.0.1:${portArg}/lab/scene-lab.html?cue=${cue}&p=${p ?? 0.5}&ui=0&motion=${motionOff ? 'off' : '1'}${dark ? '&dark=1' : ''}${blow ? '&blow=' + blow : ''}`;
  await b.send('Page.navigate', { url });
  await sleep(3200);
  const got = await b.evaluate('JSON.stringify(window.__lab ? window.__lab.story.cue : null)');
  if (mobile) await b.evaluate(`(() => { for (const y of [118, 279]) { const d = document.createElement('div'); d.style.cssText = 'position:fixed;left:0;right:0;top:' + y + 'px;border-top:2px dashed #f0f;z-index:99999;pointer-events:none'; document.body.append(d); } })()`);
  const file = join(outDir, `${mobile ? 'm' : 'd'}-${cue}-${String(p).replace('.', '')}.png`);
  await b.shot(file);
  console.log(`${got === JSON.stringify(cue) ? '✓' : '✗(' + got + ')'} ${file}`);
}
const errs = b.consoleLog.filter((l) => /^\[(exception|error)\]/.test(l));
console.log(errs.length ? `console 錯誤 ${errs.length} 則：\n${errs.slice(0, 6).join('\n')}` : 'console 無錯誤');
await b.close();
process.exit(0);
