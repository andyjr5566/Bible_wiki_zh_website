// 「四家怎麼說」「原文」面板打開後：iPhone 模擬（瀏海＋底部橫條安全區）下逐拍逐面板檢查
//   1. 「關閉」看得見、按得到：不被任何看得見的固定介面（日數牌、標題列、月份導覽、頂部底板、往下看／回到）的矩形壓住，
//      也不被別的元素蓋住（elementFromPoint 的 9 個取樣點）；在瀏海下方、畫面內。
//   2. 面板頂端不進標題列／月份導覽的範圍（面板整個在固定介面下方）。
//   3. 面板內容能捲到最後一則，且最後一則的底邊在底部安全區之上。
// 用法：node tools/check-more-close.mjs <url> [--profile=iphone15|iphone14|promax|short|all] [--dark] [--only=beatId,...] [--nobar]
// 預設跑 iphone15、iphone14、promax、short 四種。
import { launchIphone, parseArgs, sleep, PROFILES, widthProbe } from './iphone.mjs';

const args = parseArgs();
const url = args.positional[0];
if (!url) throw new Error('用法：node tools/check-more-close.mjs <url> [--profile=...] [--dark] [--only=...]');
const profiles = args.profile === 'iphone15' && !process.argv.some((x) => x.startsWith('--profile=')) ? Object.keys(PROFILES) : args.profile === 'all' ? Object.keys(PROFILES) : [args.profile];

let bad = 0;
let port = 9601;
for (const profile of profiles) {
  const b = await launchIphone({ profile, port: port++, url, dark: args.dark, reduced: args.reduced, nobar: args.nobar });
  const list = JSON.parse(await b.evaluate(`JSON.stringify([...document.querySelectorAll('.jf-beat')].map(el => ({ id: el.dataset.beat, n: [...el.querySelectorAll('button')].filter(x => /^(四家怎麼說|原文)/.test(x.textContent)).length })).filter(x => x.n))`))
    .filter((x) => !args.only || args.only.includes(x.id));
  let opened = 0;
  const fails = [];
  const widths = new Set();
  for (const { id, n } of list) {
    await b.evaluate(`(() => { const el = document.querySelector('[data-beat="${id}"]'); window.scrollTo(0, el.getBoundingClientRect().top + scrollY + Math.max(0, el.offsetHeight - innerHeight) * 0.5); })()`);
    await sleep(1300); // 說明框進場的位移（0.85s）做完，fixed 的面板才不會跟著框的 transform 走
    for (let k = 0; k < n; k++) {
      await b.evaluate(`[...document.querySelector('[data-beat="${id}"]').querySelectorAll('button')].filter(x => /^(四家怎麼說|原文)/.test(x.textContent))[${k}].click()`);
      await sleep(650);
      widths.add(await widthProbe(b));
      const r = JSON.parse(await b.evaluate(`JSON.stringify((() => {
        const m = [...document.querySelectorAll('.jf-more')].find(x => !x.hidden);
        if (!m) return { open: false };
        const rect = (el) => { const q = el.getBoundingClientRect(); return { l: q.left, r: q.right, t: q.top, b: q.bottom }; };
        const hit = (a, c) => a.r > c.l + 0.5 && a.l < c.r - 0.5 && a.b > c.t + 0.5 && a.t < c.b - 0.5;
        const safeT = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--jf-safe-t')) || 0;
        const probe = document.createElement('div'); probe.style.cssText = 'position:fixed;visibility:hidden;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)'; document.body.append(probe);
        const st = parseFloat(getComputedStyle(probe).paddingTop), sb = parseFloat(getComputedStyle(probe).paddingBottom); probe.remove();
        const x = m.querySelector('.jf-more-x'), q = rect(x);
        const issues = [];
        // 看得見的固定介面（含 opacity 過渡中的半透明也算，> 0.05）
        const ui = [];
        const add = (name, el, sub) => { if (!el) return; const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) <= 0.05) return; ui.push({ name, r: rect(el) }); };
        add('日數牌', document.querySelector('.jf-day'));
        add('站名', document.querySelector('.jf-brand'));
        document.querySelectorAll('.jf-bar .jf-btn').forEach((e) => add('標題列按鈕', e));
        add('頂部底板', document.querySelector('.jf-topbg'));
        document.querySelectorAll('.jf-m-label').forEach((e) => add('月份', e));
        add('月份軌道', document.querySelector('.jf-rail'));
        add('往下捲提示', document.querySelector('.jf-scrollcue'));
        const ret = document.querySelector('.jf-return'); if (ret && !ret.hidden) add('回到', ret);
        for (const u of ui) if (hit(q, u.r)) issues.push('「關閉」被' + u.name + '壓住');
        // 面板頂端不進固定介面範圍（頂部底板或標題列、月份、日數牌的最低邊）
        const mr = rect(m);
        const lowest = Math.max(0, ...ui.filter((u) => u.name !== '往下捲提示' && u.name !== '回到' && u.name !== '頂部底板').map((u) => u.r.b));
        // 取樣點
        const pts = []; for (const fx of [0.15, 0.5, 0.85]) for (const fy of [0.2, 0.5, 0.8]) pts.push([q.l + (q.r - q.l) * fx, q.t + (q.b - q.t) * fy]);
        let covered = 0; for (const [px, py] of pts) { const e = document.elementFromPoint(px, py); if (!e || !(e === x || x.contains(e))) covered++; }
        if (covered) issues.push('「關閉」有 ' + covered + '/9 個取樣點被別的元素蓋住');
        if (q.t < st) issues.push('「關閉」在瀏海裡 top=' + Math.round(q.t) + ' < ' + st);
        if (q.t < 0 || q.b > innerHeight) issues.push('「關閉」在畫面外');
        if (mr.t < lowest - 0.5) issues.push('面板頂端 ' + Math.round(mr.t) + ' 進到固定介面範圍（最低邊 ' + Math.round(lowest) + '）');
        if (mr.b > innerHeight - sb + 0.5) issues.push('面板底邊 ' + Math.round(mr.b) + ' 進到底部安全區');
        // 捲到最後一則
        const body = m.querySelector('.jf-more-body');
        body.scrollTop = body.scrollHeight;
        const items = body.querySelectorAll('.jf-note, .jf-word, :scope > *');
        const lastEl = body.lastElementChild && (body.lastElementChild.lastElementChild || body.lastElementChild);
        const br = rect(body), lr = lastEl ? rect(lastEl) : br;
        if (lr.b > br.b + 1.5) issues.push('捲到底後最後一則下緣 ' + Math.round(lr.b) + ' 超出內容區 ' + Math.round(br.b));
        if (lr.b > innerHeight - sb + 0.5) issues.push('最後一則下緣進到底部安全區');
        body.scrollTop = 0;
        return { open: true, issues, panelTop: Math.round(mr.t), panelH: Math.round(mr.b - mr.t), closeTop: Math.round(q.t), scrollable: body.scrollHeight > body.clientHeight + 1 };
      })())`));
      if (r.open) opened++;
      if (!r.open || r.issues.length) { bad++; fails.push(`${id}#${k} ${r.open ? r.issues.join('；') + `（面板 top=${r.panelTop} h=${r.panelH}）` : '面板沒有打開'}`); }
      await b.evaluate(`document.querySelector('.jf-more:not([hidden]) .jf-more-x')?.click()`);
      await sleep(250);
    }
  }
  console.log(`== ${profile} ${b.profile.width}×${b.profile.height} safe(${b.profile.top},${b.profile.bottom})[${b.safeMode}] ${args.dark ? '暗' : '亮'}：打開 ${opened} 個面板，有問題 ${fails.length} 個；寬度 ${[...widths].join(' ')}`);
  for (const f of fails) console.log('  ✗ ' + f);
  await b.close();
}
console.log(bad ? `失敗 ${bad}` : '全部通過');
process.exit(bad ? 1 : 0);
