// 在 file:// 下驗節期網站 ↔ 律法地圖的互連（兩個網站都要先 npm run build）：
//  1. 節期網站每章章末的「律法地圖」欄：每筆是「條文名稱」＋「在律法地圖看這一條（另開網頁）」，數量等於 site.json 的 laws；
//     連結 target=_blank、rel 含 noopener、href 是 …/律法地圖/dist/index.html#/law/<id>。
//  2. 逐一打開每個連結（file://）：律法地圖載入、網址 hash 正確、條文頁的標題等於章末列出的名稱，不是「找不到這條律法」。
//  3. 條文頁的「在節期網站看「<章名>」（另開網頁）」：節期網站 law_links 反推的每一章都在、文字與章名一致、
//     href 是 …/耶和華的節期/dist/index.html#ch=<章 id>、target=_blank。
//  4. 逐一打開那些連結（file://）：節期網站載入後 story.chapter 等於 hash 的章 id（深連結），沒有橫向捲動。
// 桌機與手機各跑一次。用法：node tools/check-lawmap-links.mjs [outDir]
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launch, sleep } from './cdp.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const SITE_DIR = resolve(here, '..');
const FEAST_URL = pathToFileURL(resolve(SITE_DIR, 'dist/index.html')).href;
const outDir = process.argv[2];
if (outDir) mkdirSync(outDir, { recursive: true });

const site = JSON.parse(readFileSync(resolve(SITE_DIR, 'src/data/site.json'), 'utf8'));
/** 開場章的律法併進接下來第一個節期章的章末（和 ending.ts 一致） */
const expectedByEnd = {};
{
  let carry = [];
  for (const c of site.chapters) {
    if (c.kind === 'opening') { carry.push(...(c.laws ?? [])); continue; }
    if (c.kind === 'passage') continue;
    const seen = new Set();
    expectedByEnd[c.id] = [...carry, ...(c.laws ?? [])].filter((l) => (seen.has(l.id) ? false : (seen.add(l.id), true)));
    carry = [];
  }
}
/** 條文 id → 引用它的章 id（law_links 反推；章名取 site.json 的 title） */
const chaptersOfLaw = {};
for (const c of site.chapters) for (const l of c.laws ?? []) (chaptersOfLaw[l.id] ??= []).push({ id: c.id, title: c.title });

let failed = 0;
const fail = (msg) => { failed++; console.log(`  × ${msg}`); };
const ok = (msg) => console.log(`  ✓ ${msg}`);

async function run(mobile, port) {
  console.log(mobile ? '手機（觸控）' : '桌機（滑鼠）');
  const W = mobile ? 390 : 1440, H = mobile ? 844 : 900;
  const b = await launch({ width: W, height: H, mobile, port, gpu: true });
  await b.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }, { name: 'prefers-reduced-motion', value: 'no-preference' }] });
  await b.send('Page.addScriptToEvaluateOnNewDocument', { source: `try { localStorage.setItem('jf-coach-seen', '1'); localStorage.setItem('jf-motion', 'on') } catch {}` });
  const widthOk = async (label) => {
    const w = JSON.parse(await b.evaluate('JSON.stringify([innerWidth, document.documentElement.scrollWidth])'));
    w[0] === w[1] ? ok(`${label}：[innerWidth, scrollWidth] = ${JSON.stringify(w)}`) : fail(`${label}：橫向捲動 ${JSON.stringify(w)}`);
  };
  const load = async (url, wait = 5000) => {
    await b.send('Page.navigate', { url: 'about:blank' });
    await sleep(200);
    await b.send('Page.navigate', { url });
    await sleep(wait);
  };

  // ---- 1. 節期網站章末的「律法地圖」欄 ----
  await load(FEAST_URL);
  const ends = JSON.parse(await b.evaluate(`JSON.stringify([...document.querySelectorAll('.jf-end')].map((e) => ({
    chapter: e.dataset.chapter,
    head: e.querySelector('.jf-laws .jf-end-h')?.textContent ?? null,
    laws: [...e.querySelectorAll('.jf-laws .jf-law')].map((li) => {
      const a = li.querySelector('a');
      return { id: li.dataset.law, title: li.querySelector('.jf-entry-name').textContent, text: a.textContent, href: a.href, target: a.target, rel: a.rel };
    }),
  })))`));
  const links = new Map(); // href → {id, title}
  for (const e of ends) {
    const want = expectedByEnd[e.chapter] ?? [];
    if (!want.length) {
      e.head === null ? ok(`章末 ${e.chapter}：沒有律法地圖欄`) : fail(`章末 ${e.chapter}：不該有律法地圖欄`);
      continue;
    }
    e.head === '律法地圖' ? ok(`章末 ${e.chapter}：欄名「${e.head}」，${e.laws.length} 筆`) : fail(`章末 ${e.chapter}：欄名是 ${JSON.stringify(e.head)}`);
    JSON.stringify(e.laws.map((l) => l.id)) === JSON.stringify(want.map((l) => l.id)) ? ok('  條文 id 與 site.json 一致') : fail(`章末 ${e.chapter}：條文 ${JSON.stringify(e.laws.map((l) => l.id))}，應為 ${JSON.stringify(want.map((l) => l.id))}`);
    for (const l of e.laws) {
      const w = want.find((x) => x.id === l.id);
      if (!w) continue;
      if (l.title !== w.title) fail(`${l.id}：名稱「${l.title}」，應為「${w.title}」`);
      if (l.text !== '在律法地圖看這一條（另開網頁）') fail(`${l.id}：連結文字是「${l.text}」`);
      if (l.target !== '_blank' || !/noopener/.test(l.rel)) fail(`${l.id}：target=${l.target} rel=${l.rel}`);
      if (!l.href.startsWith('file:///') || !/\/律法地圖\/dist\/index\.html#\/law\//.test(decodeURI(l.href)) || !decodeURI(l.href).endsWith(`#/law/${l.id}`)) fail(`${l.id}：href 不對 ${l.href}`);
      links.set(l.href, { id: l.id, title: w.title });
    }
  }
  // 截圖：章末的律法地圖欄
  await b.evaluate(`(() => { const el = document.querySelector('.jf-end[data-chapter="sevens"] .jf-laws'); window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 80); })()`);
  await sleep(800);
  await widthOk('節期網站章末');
  if (outDir) await b.shot(join(outDir, `lawmap-feast-end-${mobile ? 'm' : 'd'}.png`));

  // ---- 2、3. 節期 → 律法地圖，以及條文頁上的反向連結 ----
  const back = new Map(); // 節期網站 href → {chapter}
  let n = 0;
  for (const [href, law] of links) {
    n++;
    await b.send('Page.navigate', { url: href });
    await sleep(700);
    const page = JSON.parse(await b.evaluate(`JSON.stringify({
      hash: location.hash,
      title: document.querySelector('.lm-law-page h1')?.textContent ?? null,
      links: [...document.querySelectorAll('.lm-feast-links a')].map((a) => ({ text: a.textContent, href: a.href, target: a.target, rel: a.rel })),
    })`));
    const label = `${law.id}「${law.title}」`;
    if (page.hash !== `#/law/${law.id}`) fail(`${label}：hash ${page.hash}`);
    else if (page.title !== law.title) fail(`${label}：條文頁標題是 ${JSON.stringify(page.title)}`);
    else {
      const want = chaptersOfLaw[law.id] ?? [];
      const got = page.links.map((l) => l.text);
      const wantText = want.map((c) => `在節期網站看「${c.title}」（另開網頁）`);
      const sameSet = got.length === wantText.length && wantText.every((t) => got.includes(t));
      if (!sameSet) fail(`${label}：反向連結 ${JSON.stringify(got)}，應為 ${JSON.stringify(wantText)}`);
      for (const l of page.links) {
        const c = want.find((x) => l.text === `在節期網站看「${x.title}」（另開網頁）`);
        if (!c) continue;
        if (l.target !== '_blank' || !/noopener/.test(l.rel)) fail(`${label}：反向連結 target=${l.target} rel=${l.rel}`);
        if (!decodeURI(l.href).endsWith(`/耶和華的節期/dist/index.html#ch=${c.id}`) || !l.href.startsWith('file:///')) fail(`${label}：反向連結 href 不對 ${l.href}`);
        back.set(l.href, c.id);
      }
    }
    if (outDir && law.id === 'lev25-08') {
      await widthOk('律法地圖條文頁 lev25-08');
      await b.shot(join(outDir, `lawmap-law-lev25-08-${mobile ? 'm' : 'd'}.png`));
    }
  }
  ok(`節期網站 → 律法地圖：逐一打開 ${n} 個條文連結，標題都對得上（失敗會另列）`);

  // ---- 4. 律法地圖 → 節期網站（深連結） ----
  for (const [href, chapter] of back) {
    await load(href, 5000);
    const st = JSON.parse(await b.evaluate('JSON.stringify({ chapter: window.__jfStory?.chapter ?? null, y: Math.round(scrollY) })'));
    const bad = st.chapter !== chapter;
    bad ? fail(`#ch=${chapter}：story.chapter 是 ${st.chapter}（scrollY ${st.y}）`) : ok(`#ch=${chapter}：story.chapter = ${st.chapter}（scrollY ${st.y}）`);
    if (chapter === 'sevens') {
      await widthOk('節期網站深連結 #ch=sevens');
      if (outDir) await b.shot(join(outDir, `lawmap-deeplink-sevens-${mobile ? 'm' : 'd'}.png`));
    }
  }
  const errs = b.consoleLog.filter((l) => /^\[(exception|error)\]/.test(l));
  errs.length ? fail(`console 錯誤 ${errs.length} 則（${[...new Set(errs.map((e) => e.split(/\r?\n/)[0]))].slice(0, 3).join(' | ')}）`) : ok('console 無錯誤');
  await b.close();
}

await run(false, 9451);
await run(true, 9452);
console.log(failed ? `共 ${failed} 項失敗` : '全部通過');
process.exit(failed ? 1 : 0);
