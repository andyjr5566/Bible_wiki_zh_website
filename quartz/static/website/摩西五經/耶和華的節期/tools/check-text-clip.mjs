// 文字被擋檢查（iPhone 模擬：瀏海＋底部橫條安全區）。逐拍量說明框：
//   1. 框整個在畫面內：頂端不被標題列／月份導覽／頂部底板／日數牌／回到鈕蓋住（矩形重疊，不靠 elementFromPoint——
//      日數牌是 pointer-events:none），底邊在底部安全區之上。
//   2. 框內每一個有字的元素（敘述、經文、出處、按鈕、連結、回看／後來、長條圖、獻祭清單……）：
//      (a) 沒有橫向被裁（元素矩形不超出內文區；scrollWidth 不大於 clientWidth）；
//      (b) 把內文捲到讓它置中以後，整個元素在內文區內，且不被「往下看」提示、收起鈕、「後來」標籤蓋住
//          （元素比內文區還高的不驗，那種靠捲動分段看）。
//   3. 內文捲到底後最後一個元素的下緣不超出內文區；「往下看」提示：可捲時頂端有、捲到底沒有。
//   4. 章標題／開場大標題在標題列之下；章末、「聖經裡還有的節期」、「資料來源與授權」所有元素不出界（左右），頁尾最後一行在安全區之上。
// 用法：node tools/check-text-clip.mjs <url> [--profile=iphone15|iphone14|promax|short] [--dark] [--only=beatId,..] [--nobar] [--shots=dir]
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { launchIphone, parseArgs, sleep, widthProbe } from './iphone.mjs';

const args = parseArgs();
const url = args.positional[0];
if (!url) throw new Error('用法：node tools/check-text-clip.mjs <url> [--profile=...] [--only=...]');
const shotsDir = process.argv.find((x) => x.startsWith('--shots='))?.slice(8);
if (shotsDir) mkdirSync(shotsDir, { recursive: true });
const b = await launchIphone({ profile: args.profile, port: 9621, url, dark: args.dark, reduced: args.reduced, nobar: args.nobar });
const problems = [];
let elements = 0;
const widths = new Set();

const ids = JSON.parse(await b.evaluate(`JSON.stringify([...document.querySelectorAll('.jf-beat')].map(el => el.dataset.beat))`)).filter((id) => !args.only || args.only.includes(id));

// 頁面內的共用函式
await b.evaluate(`window.__tc = {
  rect(el) { const q = el.getBoundingClientRect(); return { l: q.left, r: q.right, t: q.top, b: q.bottom }; },
  hit(a, c, e = 0.5) { return a.r > c.l + e && a.l < c.r - e && a.b > c.t + e && a.t < c.b - e; },
  vis(el) { const cs = getComputedStyle(el); return cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.05; },
  safeB() { const p = document.createElement('div'); p.style.cssText = 'position:fixed;visibility:hidden;padding-bottom:env(safe-area-inset-bottom,0px)'; document.body.append(p); const v = parseFloat(getComputedStyle(p).paddingBottom) || 0; p.remove(); return v; },
  fixedUi() {
    const out = [];
    const add = (name, el) => { if (el && this.vis(el)) { const r = this.rect(el); if (r.r > r.l && r.b > r.t) out.push({ name, r }); } };
    add('日數牌', document.querySelector('.jf-day'));
    add('站名', document.querySelector('.jf-brand'));
    document.querySelectorAll('.jf-bar .jf-btn').forEach((e) => add('標題列按鈕', e));
    add('頂部底板', document.querySelector('.jf-topbg'));
    document.querySelectorAll('.jf-m-label').forEach((e) => add('月份', e));
    add('月份軌道', document.querySelector('.jf-rail'));
    add('往下捲提示', document.querySelector('.jf-scrollcue'));
    const ret = document.querySelector('.jf-return'); if (ret && !ret.hidden) add('回到', ret);
    return out;
  },
}`);

const gotoMid = (id) => b.evaluate(`(() => { const el = document.querySelector('[data-beat="${id}"]'); window.scrollTo(0, Math.round(el.getBoundingClientRect().top + scrollY + Math.max(0, el.offsetHeight - innerHeight) * 0.5)); })()`);

async function beatCheck(id) {
  await gotoMid(id);
  await sleep(1300);
  widths.add(await widthProbe(b));
  const r = JSON.parse(await b.evaluate(`(async () => JSON.stringify(await (async () => {
    const T = window.__tc;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const el = document.querySelector('[data-beat="${id}"]');
    const box = el.querySelector('.jf-box');
    const issues = [];
    let n = 0;
    if (!box || box.hidden || getComputedStyle(box).display === 'none') return { n, issues, none: true };
    const body = box.querySelector('.jf-box-body');
    const sb = T.safeB();
    const br = T.rect(box);
    // 說明框要真的看得見（進場淡入完成）；ScrollTrigger 沒標到 jf-in 時整框會一直是透明的
    if (!box.classList.contains('jf-in') || Number(getComputedStyle(box).opacity) < 0.99) issues.push('說明框捲到該拍中段卻還沒顯示（class=' + box.className + ' opacity=' + getComputedStyle(box).opacity + '）');
    // 框內不得再有第二層捲動區：手指落在上面只會捲它、頁面與內文都不動，而且 iOS 看不到捲軸，字看起來被截掉
    for (const q of body.querySelectorAll('*')) {
      if (q.closest('.jf-more')) continue;
      const cs = getComputedStyle(q);
      if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') && q.scrollHeight > q.clientHeight + 1) issues.push('框內巢狀捲動區（內容 ' + q.scrollHeight + ' > 可視 ' + q.clientHeight + '）<' + q.tagName.toLowerCase() + '.' + String(q.className).split(' ')[0] + '>');
    }
    // 1. 框在畫面內、沒被固定介面蓋
    if (br.b > innerHeight - sb + 0.5) issues.push('說明框下緣 ' + Math.round(br.b) + ' 進到底部安全區（可視高度 ' + Math.round(innerHeight - sb) + '）');
    if (br.t < 0) issues.push('說明框上緣在畫面外 ' + Math.round(br.t));
    const fold = box.querySelector('.jf-boxfold');
    const boxPlusTag = fold ? { l: br.l, r: br.r, t: Math.min(br.t, T.rect(fold).t), b: br.b } : br;
    for (const u of T.fixedUi()) if (u.name !== '往下捲提示' && T.hit(boxPlusTag, u.r)) issues.push('說明框被' + u.name + '蓋住');
    // 2. 逐元素
    const leaves = [...body.querySelectorAll('p, blockquote, figcaption, button, a, li, dt, dd, h1, h2, h3, h4, summary, .jf-vb, .jf-offer-item, .jf-offer-role, .jf-cell-label, .jf-bake-btn, .jf-bars-total, .jf-bars-day-h')]
      .filter((e) => T.vis(e) && e.getClientRects().length && !e.closest('.jf-more'));
    const hint = box.querySelector('.jf-box-hint');
    const bodyRect = () => T.rect(body);
    if (body.scrollWidth > body.clientWidth + 1) issues.push('內文區橫向溢出 scrollWidth=' + body.scrollWidth + ' > ' + body.clientWidth);
    const name = (e) => (e.className && String(e.className).split(' ')[0]) + '「' + (e.textContent || '').trim().slice(0, 12) + '」';
    for (const e of leaves) {
      n++;
      const er = T.rect(e), bw = bodyRect();
      if (er.r > bw.r + 1 || er.l < bw.l - 1) issues.push('橫向被裁 ' + name(e) + ' [' + Math.round(er.l) + ',' + Math.round(er.r) + '] vs 內文區 [' + Math.round(bw.l) + ',' + Math.round(bw.r) + ']');
      const cs = getComputedStyle(e);
      if (e.scrollWidth > e.clientWidth + 1 && cs.display !== 'inline' && cs.overflowX !== 'visible' && !e.closest('.jf-sr') && e.clientWidth > 2) issues.push('元素內容橫向溢出 ' + name(e));
    }
    // 「往下看」提示不得壓在內文區上（它蓋住的字沒有任何捲動位置躲得開）
    body.scrollTop = 0;
    await wait(60);
    if (hint && !hint.hidden && T.vis(hint) && T.hit(T.rect(hint), bodyRect(), 1)) issues.push('「往下看」提示壓在內文區上（提示 ' + Math.round(T.rect(hint).t) + '–' + Math.round(T.rect(hint).b) + '，內文區下緣 ' + Math.round(bodyRect().b) + '）');
    // 垂直：捲到讓它置中，看全不全、有沒有被提示／標籤蓋住
    const avail = body.clientHeight;
    for (const e of leaves) {
      body.scrollTop = 0;
      const er0 = T.rect(e), bw0 = bodyRect();
      const eh = er0.b - er0.t;
      body.scrollTop = Math.max(0, er0.t - bw0.t - Math.max(0, (avail - eh) / 2));
      await wait(45); // 「往下看」提示靠 scroll 事件更新
      const er = T.rect(e), bw = bodyRect();
      if (eh <= avail - 2) {
        if (er.t < bw.t - 1 || er.b > bw.b + 1) issues.push('捲到置中仍看不全 ' + name(e) + ' 元素 ' + Math.round(er.t) + '–' + Math.round(er.b) + ' 內文區 ' + Math.round(bw.t) + '–' + Math.round(bw.b));
        const lt = box.querySelector('.jf-later-tag');
        if (hint && !hint.hidden && T.vis(hint) && T.hit(er, T.rect(hint), 3)) issues.push('被「往下看」提示蓋住 ' + name(e));
        if (fold && T.vis(fold) && T.hit(er, T.rect(fold), 3)) issues.push('被收起鈕蓋住 ' + name(e));
        if (lt && T.vis(lt) && T.hit(er, T.rect(lt), 3)) issues.push('被「後來」標籤蓋住 ' + name(e));
      }
    }
    // 3. 捲到底
    body.scrollTop = body.scrollHeight;
    await wait(45);
    const bw = bodyRect();
    const last = leaves[leaves.length - 1];
    if (last) { const lr = T.rect(last); if (lr.b > bw.b + 1) issues.push('捲到底最後一個元素下緣 ' + Math.round(lr.b) + ' 超出內文區 ' + Math.round(bw.b)); }
    body.scrollTop = 0;
    return { n, issues };
  })()))()`));
  elements += r.n || 0;
  for (const i of r.issues || []) problems.push(`${id}: ${i}`);
  if (shotsDir && (r.issues || []).length) await b.shot(join(shotsDir, `clip-${args.profile}-${id}.png`));
}

for (const id of ids) await beatCheck(id);

// 「往下看」提示的行為
for (const id of ids) {
  await gotoMid(id);
  await sleep(450);
  const h = await b.evaluate(`new Promise((resolve) => {
    const box = document.querySelector('[data-beat="${id}"] .jf-box'); if (!box || box.hidden) return resolve(null);
    const body = box.querySelector('.jf-box-body'); const hint = box.querySelector('.jf-box-hint');
    const can = body.scrollHeight - body.clientHeight > 4;
    body.scrollTop = 0;
    setTimeout(() => {
      const top = hint ? !hint.hidden : null;
      body.scrollTop = body.scrollHeight;
      setTimeout(() => { const bottom = hint ? !hint.hidden : null; body.scrollTop = 0; resolve(JSON.stringify({ can, top, bottom })); }, 220);
    }, 160);
  })`);
  if (!h) continue;
  const o = JSON.parse(h);
  if (o.can && !o.top) problems.push(`${id}: 內文可捲但頂端沒有「往下看」提示`);
  if (o.bottom) problems.push(`${id}: 捲到底「往下看」提示還在`);
  if (!o.can && o.top) problems.push(`${id}: 內文不能捲卻顯示「往下看」提示`);
}

// 固定在上方的介面：標題列、月份導覽都在畫面內，彼此不重疊
{
  const r = JSON.parse(await b.evaluate(`JSON.stringify((() => {
    const T = window.__tc; const issues = [];
    window.scrollTo(0, 3000);
    const items = [['站名', document.querySelector('.jf-brand')], ...[...document.querySelectorAll('.jf-bar .jf-btn')].map((e, i) => ['標題列按鈕' + i, e]), ...[...document.querySelectorAll('.jf-m-label')].map((e, i) => ['月份' + (i + 1), e])]
      .filter(([, e]) => e && e.getClientRects().length).map(([n, e]) => [n, T.rect(e), e]);
    for (const [n, q] of items) if (q.l < -0.5 || q.r > innerWidth + 0.5) issues.push(n + ' 超出畫面 [' + Math.round(q.l) + ',' + Math.round(q.r) + ']');
    const top = items.filter(([n]) => !n.startsWith('月份')), mon = items.filter(([n]) => n.startsWith('月份'));
    for (const grp of [top, mon]) for (let i = 0; i < grp.length; i++) for (let j = i + 1; j < grp.length; j++) if (T.hit(grp[i][1], grp[j][1], 1)) issues.push(grp[i][0] + ' 與 ' + grp[j][0] + ' 重疊');
    for (const [n, q, e] of top) if (e.scrollWidth > e.clientWidth + 1) issues.push(n + ' 文字被裁（scrollWidth ' + e.scrollWidth + ' > ' + e.clientWidth + '）');
    return issues;
  })())`));
  for (const x of r) problems.push('頂端介面: ' + x);
}

// 4. 章標題、開場大標題
const nHeads = await b.evaluate(`document.querySelectorAll('.jf-hero, .jf-chaphead').length`);
for (let i = 0; i < nHeads; i++) {
  await b.evaluate(`(() => { const e = [...document.querySelectorAll('.jf-hero, .jf-chaphead')][${i}]; if (e.classList.contains('jf-hero')) window.scrollTo(0, 0); else window.scrollTo(0, Math.round(e.getBoundingClientRect().top + scrollY - innerHeight * 0.4)); })()`);
  await sleep(450);
  const res = JSON.parse(await b.evaluate(`JSON.stringify((() => {
    const e = [...document.querySelectorAll('.jf-hero, .jf-chaphead')][${i}];
    const T = window.__tc; const issues = [];
    for (const t of e.querySelectorAll('.jf-title, .jf-chaptitle, .jf-chapdate, .jf-hero-ref')) {
      const q = T.rect(t);
      if (q.r > innerWidth + 0.5 || q.l < -0.5) issues.push('標題橫向出界 ' + t.textContent.trim().slice(0, 10) + ' [' + Math.round(q.l) + ',' + Math.round(q.r) + ']');
      for (const u of T.fixedUi()) if (u.name !== '往下捲提示' && T.hit(q, u.r)) issues.push('標題被' + u.name + '蓋住 ' + t.textContent.trim().slice(0, 10));
    }
    return { issues, name: (e.querySelector('.jf-title, .jf-chaptitle') || e).textContent.trim().slice(0, 10) };
  })())`));
  for (const x of res.issues) problems.push(`標題「${res.name}」: ${x}`);
  elements++;
}

// 章末、頁尾：先把所有 details 展開，量展開後的文字
const ends = JSON.parse(await b.evaluate(`JSON.stringify([...document.querySelectorAll('.jf-end, .jf-others, .jf-credits')].map((e, i) => ({ i, cls: e.className.split(' ')[0], ch: e.dataset.chapter || '' })))`));
await b.evaluate(`document.querySelectorAll('.jf-end details, .jf-others details, .jf-credits details').forEach((d) => { d.open = true; })`);
for (const { i, cls, ch } of ends) {
  await b.evaluate(`(() => { const e = [...document.querySelectorAll('.jf-end, .jf-others, .jf-credits')][${i}]; window.scrollTo(0, e.getBoundingClientRect().top + scrollY - 20); })()`);
  await sleep(200);
  widths.add(await widthProbe(b));
  const res = JSON.parse(await b.evaluate(`JSON.stringify((() => {
    const e = [...document.querySelectorAll('.jf-end, .jf-others, .jf-credits')][${i}];
    const T = window.__tc; const issues = []; let n = 0;
    const er = T.rect(e);
    if (e.scrollWidth > e.clientWidth + 1) issues.push('區塊橫向溢出 scrollWidth=' + e.scrollWidth + ' > ' + e.clientWidth);
    for (const d of e.querySelectorAll('*')) {
      if (!d.getClientRects().length) continue;
      const q = T.rect(d);
      if (q.r <= q.l || q.b <= q.t) continue;
      n++;
      const txt = (d.textContent || '').trim().slice(0, 12);
      const nm = '<' + d.tagName.toLowerCase() + '.' + String(d.className).split(' ')[0] + '>「' + txt + '」';
      if (q.r > innerWidth + 0.5 || q.l < -0.5) issues.push('出界 ' + nm + ' [' + Math.round(q.l) + ',' + Math.round(q.r) + ']');
      else if (q.r > er.r + 0.5 || q.l < er.l - 0.5) issues.push('超出區塊 ' + nm);
      const cs = getComputedStyle(d);
      if (!d.closest('.jf-sr') && d.clientWidth > 2 && d.scrollWidth > d.clientWidth + 1 && ['block', 'flex', 'grid', 'list-item', 'table-cell'].includes(cs.display) && cs.overflowX !== 'visible') issues.push('內容橫向溢出 ' + nm);
    }
    return { issues, n };
  })())`));
  elements += res.n;
  for (const x of res.issues) problems.push(`${cls}${ch ? '(' + ch + ')' : ''}#${i}: ${x}`);
}
// 頁尾最後一行在安全區之上
await b.evaluate('window.scrollTo(0, document.documentElement.scrollHeight)');
await sleep(300);
const foot = JSON.parse(await b.evaluate(`JSON.stringify((() => {
  const T = window.__tc; const sb = T.safeB();
  const c = document.querySelector('.jf-credits'); const last = [...c.querySelectorAll('p, li, a')].filter((e) => e.getClientRects().length).pop();
  const lr = T.rect(last);
  return { bottom: Math.round(lr.b), limit: Math.round(innerHeight - sb), ok: lr.b <= innerHeight - sb + 0.5 };
})())`));
if (!foot.ok) problems.push(`頁尾最後一行下緣 ${foot.bottom} 進到底部安全區（可視 ${foot.limit}）`);
if (shotsDir) await b.shot(join(shotsDir, `clip-${args.profile}-footer.png`));

console.log(`== ${args.profile} ${b.profile.width}×${b.profile.height} safe(${b.profile.top},${b.profile.bottom})[${b.safeMode}] ${args.dark ? '暗' : '亮'}：${ids.length} 拍，量 ${elements} 個元素；寬度 ${[...widths].join(' ')}；頁尾最後一行下緣 ${foot.bottom}/${foot.limit}`);
for (const p of problems) console.log('  ✗ ' + p);
console.log(problems.length ? `失敗 ${problems.length}` : '全部通過');
await b.close();
process.exit(problems.length ? 1 : 0);
