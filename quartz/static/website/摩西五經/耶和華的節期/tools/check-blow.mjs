// 在整合後的網站上驗「吹」。有兩拍 blow：吹角節（cue blow）與七的節奏的禧年角聲（cue sv-horn），
// 兩拍的 done／auto／blasts 要分開記。
// 每一種情境（桌機滑鼠、手機觸控、動態開與關）依序驗：
//   1. 吹角節那一拍：按住約 2 秒，story.blow.done 要是 true、blasts >= 1，放開後 level 要回到 0。
//   2. 捲到禧年角聲：story.blow 是乾淨的（blasts 0、done false、auto false），status「還沒有吹」；
//      按住 2 秒 done = true；放開 level 回 0。
//   3. 捲回吹角節：狀態還在（blasts 沒被禧年角聲改掉）；再捲回禧年角聲：狀態還在。
// 另外驗鍵盤（空白鍵按住，兩拍各一次）與「捲過去沒做 → auto」（兩拍各自標 auto，互不影響）。
// 每種都印出 status 文字原文。用法：node tools/check-blow.mjs <url> [outDir]
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { launch, sleep } from './cdp.mjs';

const [url, outDir] = process.argv.slice(2);
if (!url) throw new Error('用法：node tools/check-blow.mjs <url> [outDir]');
if (outDir) mkdirSync(outDir, { recursive: true });

let port = 9421;
let failed = 0;
const fail = (msg) => { failed++; console.log(`  × ${msg}`); };
const ok = (msg) => console.log(`  ✓ ${msg}`);

const TRUMPET = { cue: 'blow', id: 'trumpet', label: '吹角節' };
const HORN = { cue: 'sv-horn', id: 'horn', label: '禧年角聲' };

async function session({ mobile, motionOff, mode }) {
  const tag = `${mobile ? '手機觸控' : '桌機滑鼠'}／動態${motionOff ? '關' : '開'}${mode === 'key' ? '／鍵盤' : mode === 'skip' ? '／捲過去' : ''}`;
  console.log(tag);
  const W = mobile ? 390 : 1440, H = mobile ? 844 : 900;
  const b = await launch({ width: W, height: H, mobile, port: port++, gpu: true });
  await b.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }, { name: 'prefers-reduced-motion', value: motionOff ? 'reduce' : 'no-preference' }] });
  await b.send('Page.addScriptToEvaluateOnNewDocument', { source: `try { localStorage.setItem('jf-coach-seen', '1'); localStorage.setItem('jf-motion', '${motionOff ? 'off' : 'on'}') } catch {}` });
  await b.send('Page.navigate', { url });
  await sleep(4500);
  const story = async () => JSON.parse(await b.evaluate('JSON.stringify(window.__jfStory.blow)'));
  const status = (cue) => b.evaluate(`document.querySelector('[data-cue="${cue}"] .jf-blow-status')?.textContent ?? null`);
  const scrollToCue = (cue, f = 0.5) => b.evaluate(`(() => { const el = document.querySelector('section[data-cue="${cue}"]'); window.scrollTo(0, el.getBoundingClientRect().top + scrollY + Math.max(0, el.offsetHeight - innerHeight) * ${f}); })()`);
  const show = async (what, cue) => console.log(`  ${what}`, JSON.stringify(await story()), '／status', JSON.stringify(await status(cue)));
  const clean = (s) => s.blasts === 0 && !s.done && !s.auto;

  if (mode === 'skip') {
    // 捲過吹角節沒做 → 吹角節 auto；禧年角聲還沒到，不受影響
    await scrollToCue('trumpet-offerings');
    await sleep(1800);
    let s = await story();
    await show('捲過吹角節', TRUMPET.cue);
    s.auto && s.done && s.blasts === 0 && s.level === 0 ? ok('吹角節：auto、done，沒有補聲波（level 0、blasts 0）') : fail('吹角節捲過去沒做的狀態不對');
    (await status(TRUMPET.cue)) === '已替你吹過' ? ok('吹角節 status「已替你吹過」') : fail('吹角節 status 不是「已替你吹過」');
    await scrollToCue(HORN.cue);
    await sleep(1800);
    s = await story();
    await show('到禧年角聲', HORN.cue);
    clean(s) ? ok('禧年角聲：狀態是乾淨的（blasts 0、done false、auto false），沒有被吹角節帶過來') : fail('禧年角聲的狀態被吹角節影響');
    (await status(HORN.cue)) === '還沒有吹' ? ok('禧年角聲 status「還沒有吹」') : fail('禧年角聲 status 不是「還沒有吹」');
    (await status(TRUMPET.cue)) === '已替你吹過' ? ok('吹角節 status 仍是「已替你吹過」') : fail('吹角節 status 變了');
    // 再捲過禧年角聲沒做 → 禧年角聲 auto
    await scrollToCue('sv-liberty');
    await sleep(1800);
    s = await story();
    await show('捲過禧年角聲', HORN.cue);
    s.auto && s.done && s.blasts === 0 && s.level === 0 ? ok('禧年角聲：auto、done，沒有補聲波') : fail('禧年角聲捲過去沒做的狀態不對');
    (await status(HORN.cue)) === '已替你吹過' ? ok('禧年角聲 status「已替你吹過」') : fail('禧年角聲 status 不是「已替你吹過」');
    // 捲回吹角節：它自己的紀錄還在
    await scrollToCue(TRUMPET.cue);
    await sleep(1500);
    s = await story();
    s.auto && s.done ? ok('捲回吹角節：auto、done 還在') : fail('捲回吹角節後狀態不見了');
    await b.close();
    return;
  }

  const press = async (cue, r) => {
    if (mode === 'key') {
      await b.evaluate(`document.querySelector('section[data-cue="${cue}"] .jf-blow-btn').focus()`);
      await b.send('Input.dispatchKeyEvent', { type: 'keyDown', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
    } else if (mobile) {
      await b.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: r[0], y: r[1] }] });
    } else {
      await b.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: r[0], y: r[1] });
      await b.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: r[0], y: r[1], button: 'left', clickCount: 1 });
    }
  };
  const release = async (r) => {
    if (mode === 'key') await b.send('Input.dispatchKeyEvent', { type: 'keyUp', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
    else if (mobile) await b.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    else await b.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: r[0], y: r[1], button: 'left', clickCount: 1 });
  };

  /** 在某一拍吹一次，驗升降與 done */
  async function blowOnce(beat) {
    console.log(` ─ ${beat.label}`);
    await scrollToCue(beat.cue);
    await sleep(2200);
    const r = JSON.parse(await b.evaluate(`JSON.stringify((() => { const r = document.querySelector('section[data-cue="${beat.cue}"] .jf-blow-btn').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2, r.width, r.height]; })())`));
    const before = await story();
    await show('按之前', beat.cue);
    if (beat.id === 'horn') {
      clean(before) ? ok('禧年角聲：按之前狀態是乾淨的（blasts 0、done false、auto false），和吹角節分開') : fail('禧年角聲按之前的狀態不是乾淨的');
      (await status(beat.cue)) === '還沒有吹' ? ok('禧年角聲 status「還沒有吹」') : fail('禧年角聲按之前 status 不是「還沒有吹」');
    }
    if (outDir) await b.shot(join(outDir, `blow-${beat.id}-${mobile ? 'm' : 'd'}-${motionOff ? 'off' : 'on'}${mode === 'key' ? '-key' : ''}-0.png`));

    await press(beat.cue, r);
    await sleep(700);
    const mid = await story();
    await show('按住 0.7 秒', beat.cue);
    mid.holding && mid.level > 0.2 && mid.level < 1 ? ok('按住中 level 在升（0.2–1 之間）') : fail(`按住 0.7 秒的 level 不在 0.2–1：${mid.level}`);
    await sleep(1300);
    const held = await story();
    await show('按住 2 秒', beat.cue);
    if (outDir) await b.shot(join(outDir, `blow-${beat.id}-${mobile ? 'm' : 'd'}-${motionOff ? 'off' : 'on'}${mode === 'key' ? '-key' : ''}-1.png`));
    held.done && held.blasts >= 1 ? ok(`done = true、blasts = ${held.blasts}`) : fail('按住 2 秒後 done 不是 true 或 blasts < 1');

    await release(r);
    await sleep(300);
    const rel = await story();
    await show('放開 0.3 秒', beat.cue);
    !rel.holding && rel.level < held.level ? ok('放開後 holding = false、level 回落中') : fail('放開後沒有回落');
    await sleep(900);
    const end = await story();
    await show('放開 1.2 秒', beat.cue);
    end.level === 0 ? ok('level 回到 0') : fail(`level 沒回到 0：${end.level}`);
    return end;
  }

  const t = await blowOnce(TRUMPET);
  const h = await blowOnce(HORN);

  // 兩拍的紀錄各自保留：捲回吹角節、再捲回禧年角聲
  console.log(' ─ 兩拍狀態分開');
  await scrollToCue(TRUMPET.cue);
  await sleep(1500);
  const backT = await story();
  await show('捲回吹角節', TRUMPET.cue);
  backT.done && backT.blasts === t.blasts ? ok(`吹角節紀錄還在（blasts ${backT.blasts}，沒有被禧年角聲加上去）`) : fail(`吹角節紀錄變了：${backT.blasts}，原本 ${t.blasts}`);
  const tText = await status(TRUMPET.cue);
  tText && /^吹了/.test(tText) ? ok(`吹角節 status 原文「${tText}」`) : fail(`吹角節 status 不對：${tText}`);
  await scrollToCue(HORN.cue);
  await sleep(1500);
  const backH = await story();
  await show('捲回禧年角聲', HORN.cue);
  backH.done && backH.blasts === h.blasts ? ok(`禧年角聲紀錄還在（blasts ${backH.blasts}）`) : fail(`禧年角聲紀錄變了：${backH.blasts}，原本 ${h.blasts}`);
  const hText = await status(HORN.cue);
  hText && /^吹了/.test(hText) ? ok(`禧年角聲 status 原文「${hText}」`) : fail(`禧年角聲 status 不對：${hText}`);

  const w = JSON.parse(await b.evaluate('JSON.stringify([innerWidth, document.documentElement.scrollWidth])'));
  console.log(`  [innerWidth, scrollWidth] = ${JSON.stringify(w)}`);
  w[0] === w[1] ? ok('沒有橫向捲動') : fail('scrollWidth 不等於 innerWidth');
  const errs = b.consoleLog.filter((l) => /^\[(exception|error)\]/.test(l));
  errs.length ? fail(`console 錯誤 ${errs.length} 則（不重複：${[...new Set(errs.map((e) => e.split(/\r?\n/)[0]))].slice(0, 3).join(' | ')}）`) : ok('console 無錯誤');
  await b.close();
}

for (const motionOff of [false, true]) {
  await session({ mobile: false, motionOff });
  await session({ mobile: true, motionOff });
}
await session({ mobile: false, motionOff: false, mode: 'key' });
await session({ mobile: false, motionOff: false, mode: 'skip' });
console.log(failed ? `共 ${failed} 項失敗` : '全部通過');
process.exit(failed ? 1 : 0);
