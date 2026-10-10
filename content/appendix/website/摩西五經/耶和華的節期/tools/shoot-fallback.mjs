// WebGL 不可用時的靜態插圖：用場景實驗室逐 cue 截圖，存成 public/fallback/<cue>.webp。
// 用法：先開 dev server（npx vite --port 3071 --strictPort），再 node tools/shoot-fallback.mjs [port] [--only=cue,cue,…]
//   --only：只重拍這幾個 cue（其他圖不動）
import { mkdirSync, writeFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, sleep } from './cdp.mjs';

const port = Number(process.argv[2] ?? 3071);
const only = process.argv.find((a) => a.startsWith('--only='))?.slice(7).split(',');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public', 'fallback');
mkdirSync(out, { recursive: true });

// 每個 cue 取哪一個進度點：大多取中段；有動作的拍取動作完成之後
const SHOTS = [
  ['title', 0.5], ['month', 0.6], ['day-10', 0.6], ['day-14', 0.6],
  ['dusk-street', 0.6], ['hyssop', 0.5], ['door-shut', 0.8], ['meal', 0.5],
  ['midnight', 0.6], ['wailing', 0.5], ['depart', 0.5], ['vigil', 0.5], ['children', 0.5],
  // 第二階段第一批（春季）
  ['new-moon', 0.5], ['bake', 0.5], ['seven-days', 0.5], ['no-leaven', 0.5], ['remember', 0.5],
  ['barley-ripe', 0.5], ['wave', 0.5], ['lamb-offering', 0.5], ['not-yet', 0.5],
  ['sinai', 0.5], ['unclean', 0.5], ['wait', 0.5], ['second-month', 0.5],
  ['count', 0.9], ['two-loaves', 0.5], ['weeks-offerings', 0.5], ['rejoice', 0.5], ['corners', 0.5],
  // 第二階段第二批（秋季＋舊約回聲）
  ['echo-gilgal', 0.35], ['echo-hezekiah', 0.75], ['echo-ruth', 0.6], ['summer', 0.3],
  ['seventh-moon', 0.5], ['blow', 0.5, { blow: 0.7 }], ['trumpet-offerings', 0.6], ['echo-water-gate', 0.5],
  ['veil', 0.6], ['linen', 0.5], ['lots', 0.4], ['incense', 0.6], ['sprinkle', 0.5], ['confess', 0.7], ['scapegoat', 0.55], ['afflict', 0.3],
  ['ingathering', 0.5], ['branches', 0.5], ['booth', 0.8], ['bulls', 0.4], ['booths-rejoice', 0.5], ['eighth-day', 0.6], ['echo-roofs', 0.8],
  // 第二階段第三批（七的節奏＋收尾）：取畫面長齊之後（有抹除轉場的拍，p 不要超過 0.75，不然拍到抹除）
  ['sv-sabbath', 0.6], ['sv-creation', 0.78], ['sv-ox', 0.6], ['sv-weeks', 0.6], ['sv-month7', 0.8], ['sv-fallow', 0.7], ['sv-sixth', 0.6],
  ['sv-release', 0.3], ['sv-egypt', 0.5], ['sv-reading', 0.6], ['sv-49', 0.7], ['sv-horn', 0.5, { blow: 0.9 }], ['sv-liberty', 0.7], ['sv-land', 0.3],
  ['echo-zedekiah', 0.4], ['echo-land-rest', 0.6], ['echo-oath', 0.6], ['coda-night', 0.5],
];

const b = await launch({ width: 1280, height: 800, gpu: true, port: 9341 });
let failed = 0;
try {
  for (const [cue, p, extra] of SHOTS) {
    if (only && !only.includes(cue)) continue;
    await b.send('Page.navigate', { url: `http://127.0.0.1:${port}/lab/scene-lab.html?cue=${cue}&p=${p}&ui=0&motion=1${extra?.blow ? '&blow=' + extra.blow : ''}` });
    await sleep(3500);
    const info = await b.evaluate('JSON.stringify(window.__lab ? window.__lab.story.cue : null)');
    if (JSON.parse(info) !== cue) { console.log(`✗ ${cue}：實驗室沒有切到這個 cue（${info}）`); failed++; continue; }
    const { data } = await b.send('Page.captureScreenshot', { format: 'webp', quality: 62 });
    const file = join(out, `${cue}.webp`);
    writeFileSync(file, Buffer.from(data, 'base64'));
    console.log(`✓ ${cue}  ${(statSync(file).size / 1024).toFixed(0)} KB`);
  }
  if (b.consoleLog.some((l) => l.startsWith('[exception]') || l.startsWith('[error]'))) {
    console.log('console 有錯誤：\n' + b.consoleLog.filter((l) => /^\[(exception|error)\]/.test(l)).join('\n'));
    failed++;
  }
} finally {
  await b.close();
}
process.exit(failed ? 1 : 0);
