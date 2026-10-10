/**
 * 章末與頁尾：
 * - 章末（每個節期章的最後一拍之後）：經文全文、延伸閱讀、新約、下一個節期。
 *   開場章（opening）沒有自己的章末，它的經文與條目併進接下來第一個節期章的章末。
 * - 頁尾「資料來源與授權」。
 */
import type { AudioSource, OtNote, StoryChapter } from '../data/types';
import { SITE } from '../data/site';
import { chapterUrl, entryUrl, lawUrl } from '../data/links';
import { ext, h } from './dom';
import { STEP_REPO } from './panels';
import type { EchoUI } from './echo';
import { fullRef } from './text';

const uniq = <T>(xs: T[]): T[] => [...new Set(xs)];

function entryItem(title: string): HTMLElement | null {
  const e = SITE.entries[title];
  if (!e) return null;
  return h('li', { class: 'jf-entry' },
    h('p', { class: 'jf-entry-name' }, e.title),
    h('p', { class: 'jf-entry-gist' }, e.gist),
    h('p', { class: 'jf-entry-go' }, ext(entryUrl(e.type, e.title), '查看完整條目（另開網頁）')));
}

/** 章末「律法地圖」的一筆：條文名稱（取自律法地圖）＋連過去的另開連結 */
function lawItem(law: { id: string; title: string }): HTMLElement {
  return h('li', { class: 'jf-entry jf-law', 'data-law': law.id },
    h('p', { class: 'jf-entry-name' }, law.title),
    h('p', { class: 'jf-entry-go' }, ext(lawUrl(law.id), '在律法地圖看這一條（另開網頁）')));
}

function passageItem(ref: string): HTMLElement | null {
  const block = SITE.verses[ref];
  if (!block) return null;
  return h('details', { class: 'jf-pass' },
    h('summary', { class: 'jf-pass-sum' }, h('span', { class: 'jf-pass-ref' }, block.ref)),
    h('div', { class: 'jf-pass-body' },
      block.lines.map((ln) => h('p', { class: 'jf-pass-line' }, h('span', { class: 'jf-vn jf-vn-inline', 'aria-label': `第${ln.v}節` }, String(ln.v)), ln.text))));
}

/** 章末「舊約其他書卷」的兩小節：標題照規格；「同樣的字」那一節另有一行固定說明 */
const OT_SECTIONS: { kind: OtNote['kind']; title: string; note?: string }[] = [
  { kind: 'kept', title: '後來的人怎麼守' },
  { kind: 'word', title: '同樣的字，不同的場合', note: '這些經文和本章的節期用了相同的說法，說的卻是別的場合；每一條都寫明原文是不是同一個字。' },
];

function otItem(o: OtNote): HTMLElement | null {
  const block = SITE.verses[o.ref];
  if (!block) return null;
  return h('li', { class: 'jf-ot-item', 'data-kind': o.kind },
    h('p', { class: 'jf-ot-ref' }, fullRef(block)),
    h('p', { class: 'jf-ot-note' }, o.note),
    h('details', { class: 'jf-pass jf-ot-pass' },
      h('summary', { class: 'jf-pass-sum' }, h('span', { class: 'jf-pass-ref' }, '經文')),
      h('div', { class: 'jf-pass-body' },
        block.lines.map((ln) => h('p', { class: 'jf-pass-line' }, h('span', { class: 'jf-vn jf-vn-inline', 'aria-label': `第${ln.v}節` }, String(ln.v)), ln.text)),
        // 知識庫有這一章的章頁才放連結
        block.kb ? h('p', { class: 'jf-ot-kb' }, ext(chapterUrl(block.bookNum, block.book, block.chapter), '知識庫這一章（另開網頁）')) : null)));
}

/**
 * ot：本章自己的；carried：開場章（月朔）併進來的，另起「月朔」小標，免得讀者以為那幾段在講本章的節期。
 */
function otBlock(ot: OtNote[], carried: OtNote[], echoes: HTMLElement[]): HTMLElement | null {
  if (!ot.length && !carried.length && !echoes.length) return null;
  const subs = OT_SECTIONS.map((sec) => {
    // 「後來的人怎麼守」：本章的回聲拍排在最前面，其餘 ot 照原順序接在後面
    const items = [...(sec.kind === 'kept' ? echoes : []), ...ot.filter((o) => o.kind === sec.kind).map(otItem).filter(Boolean)];
    const moon = carried.filter((o) => o.kind === sec.kind).map(otItem).filter(Boolean);
    if (!items.length && !moon.length) return null;
    return h('section', { class: 'jf-ot-sub', 'data-kind': sec.kind },
      h('h4', { class: 'jf-ot-h' }, sec.title),
      sec.note ? h('p', { class: 'jf-ot-fixed' }, sec.note) : null,
      items.length ? h('ul', { class: 'jf-ot-list' }, items) : null,
      moon.length ? h('p', { class: 'jf-ot-group' }, '月朔') : null,
      moon.length ? h('ul', { class: 'jf-ot-list' }, moon) : null);
  }).filter(Boolean);
  if (!subs.length) return null;
  return h('div', { class: 'jf-end-block jf-ot' },
    h('h3', { class: 'jf-end-h' }, '舊約其他書卷'),
    subs);
}

/** 本章的回聲拍（有 echoes 的拍）：自動列在「後來的人怎麼守」的最前面，內容只有出處、經文、跳回故事的連結 */
function echoItem(beatId: string, ref: string, echo: EchoUI): HTMLElement | null {
  const block = SITE.verses[ref];
  if (!block) return null;
  return h('li', { class: 'jf-ot-item jf-ot-echo', 'data-kind': 'kept', 'data-beat': beatId },
    h('p', { class: 'jf-ot-ref' }, fullRef(block)),
    h('details', { class: 'jf-pass jf-ot-pass' },
      h('summary', { class: 'jf-pass-sum' }, h('span', { class: 'jf-pass-ref' }, '經文')),
      h('div', { class: 'jf-pass-body' },
        block.lines.map((ln) => h('p', { class: 'jf-pass-line' }, h('span', { class: 'jf-vn jf-vn-inline', 'aria-label': `第${ln.v}節` }, String(ln.v)), ln.text)))),
    h('p', { class: 'jf-ot-go' },
      h('button', { type: 'button', class: 'jf-echo-link jf-ot-story', 'data-to': beatId, onclick: () => echo.jumpToBeat(beatId) }, '看故事裡的這一段')));
}

export function buildEndings(echo: EchoUI): HTMLElement[] {
  const out: HTMLElement[] = [];
  let carry: StoryChapter[] = [];
  for (const chapter of SITE.chapters) {
    if (chapter.kind === 'opening') {
      carry.push(chapter);
      continue;
    }
    // 無字的時光過場沒有章末
    if (chapter.kind === 'passage') continue;
    const group = [...carry, chapter];
    carry = [];
    out.push(buildEnding(chapter, group, echo));
  }
  return out;
}

function buildEnding(chapter: StoryChapter, group: StoryChapter[], echo: EchoUI): HTMLElement {
  // 開場章併進來的經文，若已被這章較大的一段完整包含（例如出12:1-6 之於出12:1-14），就不重複列
  const all = uniq(group.flatMap((c) => c.passages));
  const contained = (a: string, b: string) => {
    const x = SITE.verses[a];
    const y = SITE.verses[b];
    return !!x && !!y && a !== b && x.book === y.book && x.chapter === y.chapter && x.from <= y.from && x.to >= y.to && (x.from < y.from || x.to > y.to);
  };
  const kept = all.filter((p) => !all.some((q) => contained(q, p)));
  // 書卷照第一次出現的順序，同一卷內照章節順序排
  const bookOrder = [...new Set(kept.map((p) => SITE.verses[p]?.book))];
  const passages = [...kept].sort((a, b) => {
    const x = SITE.verses[a];
    const y = SITE.verses[b];
    if (!x || !y) return 0;
    return bookOrder.indexOf(x.book) - bookOrder.indexOf(y.book) || x.chapter - y.chapter || x.from - y.from;
  });
  const entries = uniq(group.flatMap((c) => c.entries));
  const nt = uniq(group.flatMap((c) => c.nt));
  // 律法地圖：本章自己的條文（開場章併進來的不重複列，它的 law_links 併進這一章）
  const lawSeen = new Set<string>();
  const laws = group.flatMap((c) => c.laws ?? []).filter((l) => (lawSeen.has(l.id) ? false : (lawSeen.add(l.id), true)));
  const passageEls = passages.map(passageItem).filter(Boolean);
  const entryEls = entries.map(entryItem).filter(Boolean);
  const ntEls = nt.map(entryItem).filter(Boolean);
  const n = chapter.next;

  return h('section', { class: 'jf-end', id: `jf-end-${chapter.id}`, 'data-chapter': chapter.id, 'aria-label': `${chapter.title}章末` },
    h('div', { class: 'jf-end-inner' },
      h('header', { class: 'jf-end-head' },
        h('h2', { class: 'jf-end-title' }, chapter.title),
        chapter.date ? h('p', { class: 'jf-end-date' }, chapter.date) : null),
      passageEls.length
        ? h('div', { class: 'jf-end-block' },
          h('h3', { class: 'jf-end-h' }, '經文全文'),
          h('div', { class: 'jf-pass-list' }, passageEls))
        : null,
      entryEls.length
        ? h('div', { class: 'jf-end-block' },
          h('h3', { class: 'jf-end-h' }, '延伸閱讀'),
          h('ul', { class: 'jf-entries' }, entryEls))
        : null,
      laws.length
        ? h('div', { class: 'jf-end-block jf-laws' },
          h('h3', { class: 'jf-end-h' }, '律法地圖'),
          h('ul', { class: 'jf-entries' }, laws.map(lawItem)))
        : null,
      ntEls.length
        ? h('div', { class: 'jf-end-block' },
          h('h3', { class: 'jf-end-h' }, '新約'),
          h('ul', { class: 'jf-entries jf-entries-one' }, ntEls))
        : null,
      otBlock(chapter.ot ?? [], group.filter((c) => c.kind === 'opening').flatMap((c) => c.ot ?? []), chapter.beats.filter((b) => b.echoes?.length && b.verse).map((b) => echoItem(b.id, b.verse!, echo)).filter((x): x is HTMLElement => !!x)),
      n
        ? h('div', { class: 'jf-end-block jf-next' },
          h('h3', { class: 'jf-end-h' }, '下一個節期'),
          h('p', { class: 'jf-next-line' }, h('span', { class: 'jf-next-title' }, n.title), h('span', { class: 'jf-next-date' }, n.date)))
        : null));
}

// ---------------------------------------------------------------------------

/** 頁尾「聖經裡還有的節期」：標題、intro、逐項（名稱、note、經文）。文字全部來自 SITE.others（feasts.yaml 的 others），這裡不加任何字。 */
export function buildOthers(): HTMLElement {
  const o = SITE.others;
  return h('section', { class: 'jf-others', id: 'jf-others', 'aria-labelledby': 'jf-others-h' },
    h('div', { class: 'jf-others-inner' },
      h('h2', { class: 'jf-others-h', id: 'jf-others-h' }, o.title),
      h('p', { class: 'jf-others-intro' }, o.intro),
      h('ul', { class: 'jf-others-list' },
        o.items.map((it) =>
          h('li', { class: 'jf-others-item' },
            h('h3', { class: 'jf-others-name' }, it.name),
            h('p', { class: 'jf-others-note' }, it.note),
            h('div', { class: 'jf-others-verses' },
              it.verses.map((v) =>
                h('div', { class: 'jf-others-verse' },
                  h('p', { class: 'jf-others-ref' }, v.ref),
                  h('p', { class: 'jf-others-text' }, v.text)))),
            it.sources?.length
              ? h('p', { class: 'jf-others-src' }, '註釋：', it.sources.map((s, i) => [i > 0 ? '　' : '', ext(s.url, `${s.site} ${s.book}${s.chapter}章`)]))
              : null)))));
}

const CC0 = 'https://creativecommons.org/publicdomain/zero/1.0/';
const CC_BY = 'https://creativecommons.org/licenses/by/4.0/';
const IMING_REPO = 'https://github.com/ichitenfont/I.Ming';
const IPA_LICENSE = 'https://opensource.org/license/ipa';

function audioItem(a: AudioSource): HTMLElement {
  const pages = a.pages && a.pages.length ? a.pages : [a.page];
  return h('li', { class: 'jf-audio' },
    h('p', { class: 'jf-audio-main' },
      h('span', { class: 'jf-audio-title', lang: 'en' }, a.title),
      '　',
      h('span', { class: 'jf-audio-author' }, a.author),
      '　',
      ext(CC0, 'CC0'),
      '　',
      pages.map((p, i) => [i > 0 ? '、' : '', ext(p, pages.length > 1 ? `來源頁 ${i + 1}` : '來源頁')])),
    a.edit ? h('p', { class: 'jf-audio-edit' }, `剪輯：${a.edit}`) : null);
}

export function buildCredits(): HTMLElement {
  // 每章的來源連結：同一章的幾個來源放在同一列
  const rows = new Map<string, { label: string; items: { site: string; url: string }[] }>();
  for (const s of SITE.sources) {
    const key = `${s.book}${s.chapter}`;
    if (!rows.has(key)) rows.set(key, { label: `${s.book} ${s.chapter} 章`, items: [] });
    rows.get(key)!.items.push({ site: s.site, url: s.url });
  }
  return h('footer', { class: 'jf-credits', id: 'jf-credits', 'aria-labelledby': 'jf-credits-h' },
    h('div', { class: 'jf-credits-inner' },
      h('h2', { class: 'jf-credits-h', id: 'jf-credits-h' }, '資料來源與授權'),
      h('div', { class: 'jf-credit-block' },
        h('h3', null, '經文'),
        h('p', null, '和合本。')),
      h('div', { class: 'jf-credit-block' },
        h('h3', null, '原文'),
        h('p', null, ext(STEP_REPO, 'STEP Bible（STEPBible-Data）'), '，依 ', ext(CC_BY, 'CC BY 4.0'), ' 授權使用。')),
      h('div', { class: 'jf-credit-block' },
        h('h3', null, '註釋與原文資料的原站'),
        h('ul', { class: 'jf-src-list' },
          [...rows.values()].map((r) =>
            h('li', null,
              h('span', { class: 'jf-src-label' }, r.label),
              r.items.map((it, i) => [i > 0 ? '　' : '', ext(it.url, it.site)]))))),
      h('div', { class: 'jf-credit-block' },
        h('h3', null, '音檔'),
        h('ul', { class: 'jf-audio-list' }, SITE.audio.map(audioItem))),
      h('div', { class: 'jf-credit-block' },
        h('h3', null, '字型'),
        h('p', null, '漩渦上的字以一點明體（', ext(IMING_REPO, 'I.Ming'), '）預先繪成圖片使用；一點明體依 ', ext(IPA_LICENSE, 'IPA Font License v1.0'), ' 授權。')),
      h('p', { class: 'jf-credits-note' }, '本網站僅供非商業教育與聖經研讀使用。')));
}
