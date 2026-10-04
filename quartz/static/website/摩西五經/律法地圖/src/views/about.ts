import { books, DB, laws, lawsOfGroup, lawsOfTopic, refText, topicById } from '../data/db';
import { WIKI_BASE } from '../data/links';
import { download, lawsCsv } from '../lib/csv';
import { href } from '../router';
import { ext, h } from '../ui/dom';
import { setRibbonBase } from '../ui/ribbon';

/** 關於：資料從哪裡來、收錄進度、分布表與下載。給想查證或拿資料去用的人。 */
export function aboutView(): HTMLElement {
  setRibbonBase(null);
  return h('div', { class: 'lm-page lm-about' },
    h('h1', null, '關於這個網站'),
    h('p', { class: 'lm-lede' }, '這裡把摩西五經的律法一條一條整理出來，標上主題，接上別卷的記載，再連回知識庫。解經的內容都在知識庫，這裡只整理律法在哪裡、彼此怎麼連。'),
    h('h2', null, '這個網站怎麼看律法'),
    h('p', null, '律法在希伯來文叫 ', he('תּוֹרָה'), '（妥拉）。STEP Bible 簡明詞典（H8451）列的字義有律法、指引、教導，所以這裡把每一條律法當作一段指引來讀。字根 ', he('יָרָה'), ' 在同一部詞典（H3384）裡有射箭，也有指出、教導的意思。'),
    h('p', null, '每條律法先給一句話和經文。經文自己交代了理由的，把那一節的和合本原句放在一句話下面，網站不替經文解釋。別卷又記了一次的，接在後面，可以並排逐字比較。'),
    h('h2', null, '畫面上的東西從哪裡來'),
    h('ul', null,
      h('li', null, '經文用和合本，照錄，不改寫。'),
      h('li', null, '每條律法的標題、一句話、主題和段落由本站整理。那一句話只重述經文說了什麼，並標出依據哪幾節。'),
      h('li', null, '首頁的問題由本站撰寫，只問經文本身回答得了的事；翻開看到的是條文自己的那一句話和經文。'),
      h('li', null, '說某條律法在別卷又記了一次，都要有知識庫裡的出處，出處的原句寫在條文頁最後一層。找不到出處的就不連。'),
      h('li', null, '經文裡劃線的人物、地方與觀念連到知識庫的條目。這裡只給名稱和一句簡介，完整內容請按「查看完整條目」到知識庫讀。')),
    h('p', null, '知識庫：', ext(WIKI_BASE, WIKI_BASE)),

    h('h2', null, '每一類在各卷收了幾條'),
    matrix(),

    h('h2', null, '收錄進度'),
    h('p', { class: 'lm-note' }, '「不收」是刻意不收的敘事或勸勉；「還沒整理」是還沒處理的節。'),
    coverage(),

    h('h2', null, '下載'),
    h('p', null, `目前 ${laws.length} 條、${DB.relations.length} 條關聯。`),
    h('div', { class: 'lm-actions' },
      h('button', { type: 'button', class: 'lm-btn', onclick: () => download('摩西五經律法-條文.csv', lawsCsv(laws, refText, (id) => topicById.get(id)?.name ?? id), 'text/csv;charset=utf-8') }, '條文清單（CSV）'),
      h('button', { type: 'button', class: 'lm-btn', onclick: () => download('摩西五經律法.json', JSON.stringify(DB, null, 2), 'application/json') }, '完整資料（JSON）')),
    h('p', { class: 'lm-note' }, '本站僅供非商業的教育與聖經研讀使用。'));
}

const he = (t: string) => h('span', { lang: 'he', dir: 'rtl' }, t);

function matrix(): HTMLElement {
  const cell = (n: number, target: string) => h('td', { class: n ? 'lm-cell' : 'lm-cell lm-cell-empty' }, n ? h('a', { href: target }, String(n)) : '·');
  const rows: HTMLElement[] = [];
  for (const g of DB.groups) {
    const gl = lawsOfGroup(g.id);
    rows.push(h('tr', { class: 'lm-mrow-group', style: `--c: var(--g${g.color})` }, h('th', { scope: 'row' }, h('a', { href: href('topic', g.id) }, g.name)), ...books.map((b) => cell(gl.filter((l) => l.book === b.name).length, href('topic', g.id)))));
    for (const tid of g.topics) {
      const ls = lawsOfTopic(tid);
      if (!ls.length) continue;
      rows.push(h('tr', { class: 'lm-mrow-topic' }, h('th', { scope: 'row' }, h('a', { href: href('topic', tid) }, topicById.get(tid)!.name)), ...books.map((b) => cell(ls.filter((l) => l.book === b.name).length, href('topic', tid)))));
    }
  }
  return h('div', { class: 'lm-table-wrap' },
    h('table', { class: 'lm-table lm-matrix' },
      h('thead', null, h('tr', null, h('th', null, ''), ...books.map((b) => h('th', { scope: 'col' }, b.name)))),
      h('tbody', null, ...rows)),
    h('p', { class: 'lm-note' }, '一條律法可以同時屬於好幾個主題，所以各列相加會大於總條數。'));
}

function coverage(): HTMLElement {
  return h('div', { class: 'lm-table-wrap' }, h('table', { class: 'lm-table' },
    h('thead', null, h('tr', null, ...['章', '節數', '已收', '不收', '還沒整理'].map((t) => h('th', null, t)))),
    h('tbody', null, ...DB.coverage.map((c) => h('tr', null,
      h('td', null, h('a', { href: href('ref', `${books.find((b) => b.name === c.book)!.abbr}${c.chapter}`) }, `${c.book}${c.chapter}`)),
      h('td', null, String(c.total)), h('td', null, String(c.covered)), h('td', null, String(c.excluded)),
      h('td', null, c.missing.map(([a, b]) => (a === b ? `${a}` : `${a}-${b}`)).join('、') || '—'))))));
}
