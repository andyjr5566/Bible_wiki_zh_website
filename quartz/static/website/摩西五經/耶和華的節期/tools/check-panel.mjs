// 面板高度：在指定的拍點開「四家怎麼說」，量 .jf-more 的高度（要 > 200px，除非內容本來就短、沒有被截掉），兩種桌機尺寸各量一次。
// 用法：node tools/check-panel.mjs <url> [--only=beatId,beatId]（不給 --only 就量全部有「四家怎麼說」的拍）
import { launch, sleep } from './cdp.mjs';

const url = process.argv[2];
const only = process.argv.find((x) => x.startsWith('--only='))?.slice(7).split(',');
let bad = 0;
for (const [W, H] of [[1280, 720], [1440, 900]]) {
  const b = await launch({ width: W, height: H, port: 9581 + (W === 1280 ? 0 : 1), gpu: true });
  await b.send('Page.addScriptToEvaluateOnNewDocument', { source: `try { localStorage.setItem('jf-coach-seen', '1') } catch {}` });
  await b.send('Page.navigate', { url });
  await sleep(4500);
  const ids = JSON.parse(await b.evaluate(`JSON.stringify([...document.querySelectorAll('.jf-beat')].filter(el => [...el.querySelectorAll('button')].some(x => x.textContent.startsWith('四家怎麼說'))).map(el => el.dataset.beat))`))
    .filter((id) => !only || only.includes(id));
  const rows = [];
  for (const id of ids) {
    await b.evaluate(`(() => { const el = document.querySelector('[data-beat="${id}"]'); window.scrollTo(0, el.getBoundingClientRect().top + scrollY + Math.max(0, el.offsetHeight - innerHeight) * 0.5); })()`);
    await sleep(900);
    await b.evaluate(`[...document.querySelector('[data-beat="${id}"]').querySelectorAll('button')].find(x => x.textContent.startsWith('四家怎麼說')).click()`);
    await sleep(700);
    const hgt = Number(await b.evaluate(`(() => { const m = [...document.querySelector('[data-beat="${id}"]').querySelectorAll('.jf-more')].find(x => !x.hidden); return m ? Math.round(m.getBoundingClientRect().height) : -1 })()`));
    const cut = Number(await b.evaluate(`(() => { const m = [...document.querySelector('[data-beat="${id}"]').querySelectorAll('.jf-more')].find(x => !x.hidden); const y = m?.querySelector('.jf-more-body'); return y ? y.scrollHeight - y.clientHeight : -1 })()`));
    await b.evaluate(`document.querySelector('[data-beat="${id}"] .jf-more:not([hidden]) .jf-more-x')?.click()`);
    await sleep(300);
    const ok = hgt > 200 || cut <= 1;
    if (!ok) bad++;
    rows.push(`${id.padEnd(18)}${String(hgt).padEnd(6)}截掉 ${cut}${ok ? (hgt > 200 ? '' : '（內容短，未截）') : '  ✗'}`);
  }
  console.log(`== ${W}×${H}（${ids.length} 拍）\n` + rows.join('\n'));
  await b.close();
}
console.log(`面板被擠扁（≤ 200px 且內容被截）的：${bad}`);
