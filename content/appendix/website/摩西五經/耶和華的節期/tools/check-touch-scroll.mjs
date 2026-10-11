// 觸控捲動檢查（iPhone 模擬，真的送 touch 手勢）：逐拍捲到中段，分別在
//   (a) 場景區（說明框上方、避開按鈕與互動區）往上滑 → 頁面一定要往下走；
//   (b) 說明框內文：內文還能捲 → 先捲內文（頁面不動也可以）；內文捲到底之後「再滑一次」→ 頁面一定要往下走
//       （iOS 同一手勢不會串接，但下一次手勢必須讓頁面走）；內文本來就不能捲 → 頁面要走；
//   (c) 說明框外緣的空白（框左右 8px 邊、框與標題列之間）→ 頁面要走；
//   (d) 打開「四家怎麼說」又關閉後、收起／展開說明框後，(a)(b) 仍正常（--after 子集，另跑）。
// 另外靜態量每一拍的「擋住捲動的格子」：用 elementFromPoint 的結果與祖先鏈的 touch-action 判斷，
// 回報 touch-action:none 的面積佔場景區的比例與最大的空白區。
// 用法：node tools/check-touch-scroll.mjs <url> [--profile=iphone15] [--dark] [--only=beatId,..] [--nobar] [--noafter]
import { launchIphone, parseArgs, sleep, touchSwipeUp, listBeats, widthProbe } from './iphone.mjs';

const args = parseArgs();
const url = args.positional[0];
if (!url) throw new Error('用法：node tools/check-touch-scroll.mjs <url> [--profile=...] [--only=...]');
const noAfter = args.flags.has('--noafter');
const b = await launchIphone({ profile: args.profile, port: 9611, url, dark: args.dark, reduced: args.reduced, nobar: args.nobar });
const W = b.profile.width, H = b.profile.height, SAFE_T = b.profile.top, SAFE_B = b.profile.bottom;

const scrollY = () => b.evaluate('Math.round(scrollY)');
const settle = (ms = 650) => sleep(ms);

const beats = (await listBeats(b)).filter((x) => !args.only || args.only.includes(x.id));
const problems = [];
const info = [];
let gestures = 0;
let tapChecked = 0;

/** 頁面內：分析目前畫面，回傳場景區自由點、框的位置與可捲狀態、擋住捲動的面積 */
const analyse = (id) => b.evaluate(`JSON.stringify((() => {
  const el = document.querySelector('[data-beat="${id}"]');
  const box = el.querySelector('.jf-box');
  const body = box && box.querySelector('.jf-box-body');
  const br = box && !box.hidden ? box.getBoundingClientRect() : null;
  const vis = br && br.height > 0 && br.bottom > 0 && br.top < innerHeight;
  const W = innerWidth, H = innerHeight;
  const safeT = ${SAFE_T};
  const sceneTop = safeT + 170; // 標題列、月份導覽、日數牌之下
  const sceneBot = vis ? br.top - 14 : H - 90;
  // 擋住捲動的判斷：沿祖先鏈找 touch-action（none 或不含 pan-y）
  const blocks = (e) => {
    for (let n = e; n && n.nodeType === 1; n = n.parentElement) {
      const t = getComputedStyle(n).touchAction;
      if (t === 'none') return true;
      if (t !== 'auto' && t !== 'manipulation' && !/pan-y/.test(t)) return true;
    }
    return false;
  };
  const kind = (e) => {
    if (!e || e === document.documentElement || e === document.body) return 'free';
    if (e.id === 'jf-canvas' || e.id === 'jf-fallback') return 'free';
    if (e.closest('.jf-box')) return 'box';
    if (e.closest('.jf-touch')) return blocks(e) ? 'drag' : 'tap';
    if (e.closest('button, a, [role=button]')) return 'ui';
    if (e.closest('.jf-hero, .jf-chaphead, .jf-title, .jf-chaptitle, .jf-chapdate, .jf-hero-ref')) return 'free'; // 標題文字可以拖著捲
    if (e.closest('dialog')) return 'dialog';
    if (e.id === 'jf-app') return 'free'; // 不設 pointer-events 的外層容器，等同 body
    return 'other:' + (e.className || e.tagName);
  };
  let total = 0, drag = 0, ui = 0, tap = 0, other = {}, free = [];
  for (let y = sceneTop; y < sceneBot; y += 20) for (let x = 12; x < W - 8; x += 20) {
    total++;
    const e = document.elementFromPoint(x, y);
    const k = kind(e);
    if (k === 'free') free.push([x, y]);
    else if (k === 'drag') drag++;
    else if (k === 'ui') ui++;
    else if (k === 'tap') tap++; // touch-action: pan-y，點一下才算，縱向捲動照常
    else other[k] = (other[k] || 0) + 1;
  }
  // 自由點：挑最靠中間的
  free.sort((a, b) => Math.abs(a[0] - W / 2) + Math.abs(a[1] - (sceneTop + sceneBot) / 2) - (Math.abs(b[0] - W / 2) + Math.abs(b[1] - (sceneTop + sceneBot) / 2)));
  // 另外兩個自由點：最左與最右
  const left = free.filter((p) => p[0] < W * 0.3)[0] || null;
  const right = free.filter((p) => p[0] > W * 0.7)[0] || null;
  const bodyInfo = body ? { sh: body.scrollHeight, ch: body.clientHeight, st: Math.round(body.scrollTop), ov: getComputedStyle(body).overflowY } : null;
  return { box: vis ? [Math.round(br.left), Math.round(br.top), Math.round(br.right), Math.round(br.bottom)] : null, body: bodyInfo,
    total, drag, ui, tap, other, free: free.slice(0, 1).concat(left ? [left] : [], right ? [right] : []), nfree: free.length, sceneTop, sceneBot, bodyRect: body ? (() => { const r = body.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)]; })() : null };
})())`);

/** 在 (x,y) 往上滑一次；回傳 [頁面位移, 內文位移]（內文用 id 對應的 box-body） */
async function swipe(id, x, y, dist = 240) {
  const y0 = await scrollY();
  const s0 = await b.evaluate(`document.querySelector('[data-beat="${id}"] .jf-box-body')?.scrollTop ?? 0`);
  await touchSwipeUp(b, x, y, dist);
  gestures++;
  await sleep(120);
  const y1 = await scrollY();
  const s1 = await b.evaluate(`document.querySelector('[data-beat="${id}"] .jf-box-body')?.scrollTop ?? 0`);
  return [y1 - y0, Math.round(s1 - s0)];
}

async function gotoBeat(id, f = 0.5) {
  await b.evaluate(`(() => { const el = document.querySelector('[data-beat="${id}"]'); window.scrollTo(0, Math.round(el.getBoundingClientRect().top + scrollY + Math.max(0, el.offsetHeight - innerHeight) * ${f})); })()`);
  await settle();
}

async function testBeat(bt, tag = '') {
  const id = bt.id;
  const p = (msg) => problems.push(`${id}${tag} ${msg}`);
  await gotoBeat(id);
  // 起點需有足夠的往下空間
  const maxY = await b.evaluate('document.documentElement.scrollHeight - innerHeight');
  const a = JSON.parse(await analyse(id));
  info.push({ id, tag, ...a });
  // (a) 場景區
  if (a.free.length === 0) p('(a) 場景區找不到任何可以觸控捲動的自由點（整個場景區都被擋住）');
  for (const [i, pt] of a.free.entries()) {
    await gotoBeat(id);
    const [dy] = await swipe(id, pt[0], pt[1], 200);
    if (dy < 100) p(`(a) 場景區 (${pt}) 往上滑頁面只走 ${dy}px`);
  }
  // 場景區擋住的比例（回報用；超過一半才算問題）
  if (a.total && (a.drag + a.ui) / a.total > 0.5) p(`(a) 場景區 ${(((a.drag + a.ui) / a.total) * 100).toFixed(0)}% 是按鈕／拖曳區`);
  if (!a.box) return;
  const [bl, bt2, br2, bb] = a.box;
  // (b) 框內文
  if (a.body) {
    const scrollable = a.body.sh > a.body.ch + 2 && /auto|scroll/.test(a.body.ov);
    const [rl, rt, rr, rb] = a.bodyRect;
    // 起點挑在內文區中間偏左（避開按鈕；若有按鈕就接受，按鈕上滑照樣可捲）
    const bx = Math.round((rl + rr) / 2), by = Math.round(rt + (rb - rt) * 0.5);
    if (scrollable) {
      await gotoBeat(id);
      await b.evaluate(`document.querySelector('[data-beat="${id}"] .jf-box-body').scrollTop = 0`);
      const [dy1, ds1] = await swipe(id, bx, by, 120);
      if (ds1 <= 0 && dy1 < 40) p(`(b) 內文可捲（${a.body.sh}/${a.body.ch}）但第一次滑內文與頁面都沒動`);
      // 用真的手勢把內文捲到底（程式直接設 scrollTop 時，合成器還不知道，第一次手勢會被它吃掉，不能代表真人操作），再滑一次 → 頁面要走
      await gotoBeat(id);
      let guard = 0;
      while (guard++ < 10) {
        const atEnd = await b.evaluate(`(() => { const e = document.querySelector('[data-beat="${id}"] .jf-box-body'); return e.scrollTop + e.clientHeight >= e.scrollHeight - 1; })()`);
        if (atEnd) break;
        await swipe(id, bx, by, 160);
      }
      await sleep(150);
      const [dy2, ds2] = await swipe(id, bx, by, 200);
      if (dy2 < 100) p(`(b) 內文用手勢捲到底後再滑一次，頁面只走 ${dy2}px（內文 ${ds2}）`);
    } else {
      await gotoBeat(id);
      const [dy] = await swipe(id, bx, by, 200);
      if (dy < 100) p(`(b) 內文不能捲，在框內往上滑頁面只走 ${dy}px`);
    }
  }
  // (c) 框外緣空白：框左右 8px 的邊、框上緣的外側（收起標籤之外）
  const edges = [];
  if (bl >= 6) edges.push([Math.round(bl / 2), Math.round((bt2 + bb) / 2), '框左側邊']);
  if (W - br2 >= 6) edges.push([Math.round((br2 + W) / 2), Math.round((bt2 + bb) / 2), '框右側邊']);
  for (const [x, y, name] of edges) {
    await gotoBeat(id);
    const [dy, ds] = await swipe(id, x, y, 200);
    if (dy < 100) p(`(c) ${name} (${x},${y}) 往上滑頁面只走 ${dy}px（內文 ${ds}）`);
  }
  void maxY;
}

for (const bt of beats) {
  await testBeat(bt);
}

// (d) 面板開／關、收起／展開之後
if (!noAfter) {
  const sample = beats.filter((x) => !args.only).length ? ['new-moon', 'hyssop', 'bake', 'sinai', 'blow', 'sabbath', 'neh-booths', 'sabbath-rest-for', 'wait'].filter((id) => beats.some((x) => x.id === id)) : beats.map((x) => x.id);
  for (const id of sample) {
    const bt = beats.find((x) => x.id === id);
    await gotoBeat(id);
    const has = await b.evaluate(`!![...document.querySelector('[data-beat="${id}"]').querySelectorAll('button')].find(x => /^(四家怎麼說|原文)/.test(x.textContent))`);
    if (has) {
      await b.evaluate(`[...document.querySelector('[data-beat="${id}"]').querySelectorAll('button')].filter(x => /^(四家怎麼說|原文)/.test(x.textContent))[0].click()`);
      await sleep(700);
      // 點面板以外的場景要能收起面板（面板頂端離固定介面夠遠才有地方點）
      const tapInfo = JSON.parse(await b.evaluate(`JSON.stringify((() => {
        const m = document.querySelector('.jf-more:not([hidden])'); if (!m) return null;
        const p = document.createElement('div'); p.style.cssText = 'position:fixed;visibility:hidden;height:var(--jf-ui-top)'; document.body.append(p);
        const ui = p.getBoundingClientRect().height; p.remove();
        return { top: m.getBoundingClientRect().top, ui };
      })())`));
      if (tapInfo && tapInfo.top - tapInfo.ui > 50) {
        const ty = Math.round(tapInfo.ui + 20);
        await b.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: Math.round(W / 2), y: ty, id: 1 }] });
        await sleep(60);
        await b.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await sleep(400);
        const still = await b.evaluate(`!!document.querySelector('.jf-more:not([hidden])') || document.documentElement.classList.contains('jf-more-open')`);
        tapChecked++;
        if (still) problems.push(`${id} 點面板外的場景 (${Math.round(W / 2)},${ty}) 沒有收起面板`);
      }
      await b.evaluate(`document.querySelector('.jf-more:not([hidden]) .jf-more-x')?.click()`);
      await sleep(400);
      await testBeat(bt, '（開關面板後）');
    }
    // 收起 → 展開
    await gotoBeat(id);
    await b.evaluate(`document.querySelector('[data-beat="${id}"] .jf-boxfold').click()`);
    await sleep(500);
    const a = JSON.parse(await analyse(id));
    for (const pt of a.free.slice(0, 2)) {
      const [dy] = await swipe(id, pt[0], pt[1], 200);
      if (dy < 100) problems.push(`${id}（收起後）場景區 (${pt}) 往上滑頁面只走 ${dy}px`);
      await gotoBeat(id);
    }
    await b.evaluate(`document.querySelector('[data-beat="${id}"] .jf-boxfold').click()`);
    await sleep(500);
    await testBeat(bt, '（收起又展開後）');
  }
}

const w = await widthProbe(b);
const maxDrag = info.reduce((m, x) => Math.max(m, x.total ? x.drag / x.total : 0), 0);
const maxUi = info.reduce((m, x) => Math.max(m, x.total ? x.ui / x.total : 0), 0);
console.log(`== ${args.profile} ${W}×${H} safe(${SAFE_T},${SAFE_B})[${b.safeMode}] ${args.dark ? '暗' : '亮'}：${beats.length} 拍，${gestures} 次手勢，寬度 ${w}`);
console.log(`   場景區被 touch-action:none 擋住的格子最多 ${(maxDrag * 100).toFixed(1)}%，被按鈕佔據最多 ${(maxUi * 100).toFixed(1)}%；找不到自由點的拍 ${info.filter((x) => x.free.length === 0).length}；點面板外收起面板驗了 ${tapChecked} 次`);
const odd = info.filter((x) => Object.keys(x.other).length).slice(0, 5);
for (const x of odd) console.log(`   [其他元素佔據場景區] ${x.id}${x.tag} ${JSON.stringify(x.other)}`);
for (const pr of problems) console.log('  ✗ ' + pr);
console.log(problems.length ? `失敗 ${problems.length}` : '全部通過');
await b.close();
process.exit(problems.length ? 1 : 0);
