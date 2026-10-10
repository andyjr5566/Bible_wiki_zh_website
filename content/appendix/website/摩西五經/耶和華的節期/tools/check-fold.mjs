// 驗「收起說明框」：在一拍按「收起」，捲到別拍也維持收起；有互動的拍（blow）收起時互動按鈕還在、按得到；
// 再按「展開說明」全部回來。桌機與手機各跑一次，量 [innerWidth, scrollWidth]，並各截收起前後的圖。
// 用法：node tools/check-fold.mjs <url> [outDir]
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launch, sleep } from './cdp.mjs';

const [url, outDir] = process.argv.slice(2);
if (!url) throw new Error('用法：node tools/check-fold.mjs <url> [outDir]');
if (outDir) mkdirSync(outDir, { recursive: true });

let port = 9461;
let failed = 0;
const fail = (msg) => { failed++; console.log(`  × ${msg}`); };
const ok = (msg) => console.log(`  ✓ ${msg}`);

async function run(mobile) {
  const tag = mobile ? 'mobile' : 'desktop';
  console.log(mobile ? '手機' : '桌機');
  const W = mobile ? 390 : 1440, H = mobile ? 844 : 900;
  const b = await launch({ width: W, height: H, mobile, port: port++, gpu: true });
  await b.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }, { name: 'prefers-reduced-motion', value: 'no-preference' }] });
  await b.send('Page.addScriptToEvaluateOnNewDocument', { source: `try { localStorage.setItem('jf-coach-seen', '1'); localStorage.setItem('jf-motion', 'on') } catch {}` });
  await b.send('Page.navigate', { url });
  await sleep(4500);
  const scrollToCue = (cue) => b.evaluate(`(() => { const el = document.querySelector('[data-cue="${cue}"]'); window.scrollTo(0, el.getBoundingClientRect().top + scrollY + Math.max(0, el.offsetHeight - innerHeight) * 0.5); })()`);
  const shot = async (name) => {
    if (!outDir) return;
    const { data } = await b.send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(outDir, `${tag}-${name}.png`), Buffer.from(data, 'base64'));
  };
  // 目前在畫面上的說明框：它的 body 有沒有顯示、框多大、收起鈕的字
  const state = async (cue) => JSON.parse(await b.evaluate(`JSON.stringify((() => {
    const box = document.querySelector('[data-cue="${cue}"] .jf-box');
    const body = box.querySelector('.jf-box-body');
    const btn = box.querySelector('.jf-boxfold');
    const r = box.getBoundingClientRect();
    const br = btn.getBoundingClientRect();
    const hit = document.elementFromPoint(br.x + br.width / 2, br.y + br.height / 2);
    return { folded: document.documentElement.hasAttribute('data-fold'), bodyShown: getComputedStyle(body).display !== 'none',
      w: Math.round(r.width), h: Math.round(r.height), label: btn.textContent, expanded: btn.getAttribute('aria-expanded'),
      btnHit: hit === btn || btn.contains(hit), hitBy: hit ? (hit.className || hit.tagName) : null, sw: [innerWidth, document.documentElement.scrollWidth] };
  })())`));
  const click = async (cue) => {
    const [x, y] = JSON.parse(await b.evaluate(`JSON.stringify((() => { const r = document.querySelector('[data-cue="${cue}"] .jf-boxfold').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })())`));
    if (mobile) {
      await b.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      await b.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } else {
      await b.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
      await b.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
    }
    await sleep(600);
  };

  await scrollToCue('incense');
  await sleep(2000);
  const s0 = await state('incense');
  console.log('  收起前', JSON.stringify(s0));
  await shot('incense-open');
  s0.btnHit ? ok('「收起」按得到（沒被別的東西蓋住）') : fail('「收起」被蓋住');
  await click('incense');
  const s1 = await state('incense');
  console.log('  收起後', JSON.stringify(s1));
  await shot('incense-folded');
  s1.folded && !s1.bodyShown && s1.label === '展開說明' && s1.expanded === 'false' ? ok('收起：內文隱藏、標籤改成「展開說明」') : fail('收起狀態不對');
  s1.h < 60 ? ok(`收起後框只剩標籤（高 ${s1.h}px）`) : fail(`收起後框還有 ${s1.h}px 高`);

  await scrollToCue('afflict');
  await sleep(1500);
  const s2 = await state('afflict');
  s2.folded && !s2.bodyShown ? ok('捲到下一拍仍是收起') : fail('捲到下一拍又展開了');
  await shot('afflict-folded');

  await scrollToCue('blow');
  await sleep(1800);
  const blow = JSON.parse(await b.evaluate(`JSON.stringify((() => { const btn = document.querySelector('.jf-blow-btn'); const r = btn.getBoundingClientRect(); const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return { shown: r.width > 0 && r.height > 0, hit: hit === btn || btn.contains(hit), text: getComputedStyle(document.querySelector('[data-cue="blow"] .jf-text')).display }; })())`));
  console.log('  blow 拍', JSON.stringify(blow));
  blow.shown && blow.hit && blow.text === 'none' ? ok('有互動的拍：收起時敘述隱藏，「吹」還在、按得到') : fail('有互動的拍收起時互動按鈕不對');
  await shot('blow-folded');

  await click('blow');
  const s3 = await state('blow');
  !s3.folded && s3.bodyShown && s3.label === '收起' ? ok('按「展開說明」：全部回來') : fail('展開後狀態不對');
  for (const s of [s0, s1, s2, s3]) if (mobile && s.sw[0] !== s.sw[1]) fail(`手機橫向溢出 ${s.sw}`);
  const errors = b.consoleLog.filter((l) => l.startsWith('[error]') || l.startsWith('[exception]'));
  errors.length ? fail(`console 錯誤：${errors.join('；')}`) : ok('console 無錯誤');
  await b.close();
}

await run(false);
await run(true);
console.log(failed ? `失敗 ${failed} 項` : '全部通過');
process.exit(failed ? 1 : 0);
