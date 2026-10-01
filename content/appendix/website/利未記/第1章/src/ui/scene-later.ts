import { DEST_LABEL, PORTIONS, type Dest } from '../data/compare';
import { BRING, WHY, resolveEntry, type BringId, type WhyId } from '../data/entry';
import { EIGHTH, EIGHTH_VARIANT, MANUAL, ORDAIN, QUESTIONS, type Card } from '../data/later';
import { OFFERINGS, OFFERING_BY_ID } from '../data/offerings';
import { EIGHTH_DAY, ORDINATION, SEVEN_DAYS } from '../data/priesthood';
import { SCENES, SCENE_BY_ID, type SceneId } from '../data/story';
import { h, svg } from './dom';
import { factLine } from './evidence';
import { mountCompare } from './compare';
import { EV_ICON, ICONS } from './icons';
import { OFFERING_STYLE } from './meta';
import { mountDress, mountMarks, timeline } from './priesthood';
import { more, readingMore } from './scene-offering';
import { sceneHref, sceneNav } from './shell';
import { omark } from './simulator';
import { listSource, mountTheater } from './theater';

const head = (id: SceneId, title: string, lede: string, mark: HTMLElement | null = null) => {
  const s = SCENE_BY_ID[id];
  const pos = SCENES.findIndex((x) => x.id === id) + 1;
  return h('header', { class: 'scene-head' },
    h('div', { class: 'kicker' }, `${s.range ? `${s.range}・` : ''}第 ${pos} 幕，共 ${SCENES.length} 幕`),
    h('h1', null, mark, title),
    h('p', { class: 'lede' }, lede));
};

const keyCard = (c: Card, extra: HTMLElement | null = null, wide = false) => h('div', { class: `key card${wide ? ' wide' : ''}` },
  h('h3', null, c.title),
  h('ul', { class: 'key-lines' }, ...c.lines.map((l) => h('li', null, factLine(l)))),
  extra);

const layer = (title: string, hint: string | null, ...body: (HTMLElement | null)[]) =>
  h('section', { class: 'layer' }, h('h2', { class: 'layer-title' }, title, hint ? h('small', null, hint) : null), ...body);

const voicesLink = (title: string, hint: string) => h('a', { class: 'voices-link card', href: sceneHref('voices') },
  svg(EV_ICON.interpretation), h('span', null, h('b', null, title), h('small', null, hint), h('small', null, '全部集中在最後一幕「各家怎麼讀」')),
  svg(ICONS.next));

/** 五種祭的東西最後到了哪裡：每種一張卡 */
function portionsGrid(): HTMLElement {
  const ICON: Record<Dest, string> = { god: 'god', priest: 'priest', offerer: 'home', outside: 'outside' };
  return h('div', { class: 'portions' }, ...OFFERINGS.map((o) => {
    const p = PORTIONS[o.id];
    return h('a', { class: 'card portion', href: sceneHref(o.id), style: `--c:${OFFERING_STYLE[o.id].color};border-top:4px solid var(--c);text-decoration:none;color:inherit` },
      h('h4', null, omark(o.id), o.name),
      ...(Object.keys(DEST_LABEL) as Dest[]).map((d) => h('div', { class: `dest${p[d].length ? '' : ' none'}` },
        h('span', { class: 'ic', title: DEST_LABEL[d] }, svg(ICONS[ICON[d]])),
        h('div', null, h('div', { style: 'font-size:.8em;color:var(--ink-3)' }, DEST_LABEL[d]), p[d].length ? p[d].join('、') : '—'))));
  }));
}

/* ============================================================ 給祭司的條例 */

export function buildManual(): HTMLElement {
  const compareHost = h('div');
  return h('article', { class: 'scene', style: '--c:var(--priest)' },
    h('div', { class: 'wrap' },
      head('manual', '給祭司的條例', MANUAL.lede, omark('priesthood' as never)),
      layer('重點', null, h('div', { class: 'keys' }, ...MANUAL.cards.map((c) => keyCard(c)))),
      layer('五種祭，東西最後到了哪裡', '點一張卡回到那一種祭', portionsGrid()),
      layer('細節', '想多知道一點，再點開', h('div', { class: 'mores' },
        more('五種祭並排比較', '帶什麼來、血怎麼處理、誰吃哪一份，一張表看完', () => { mountCompare(compareHost); return compareHost; }),
        readingMore(MANUAL.read))),
      sceneNav('manual')));
}

/* ============================================================ 承接聖職 */

export function buildOrdination(): HTMLElement {
  const theater = mountTheater(listSource('承接聖職', 'var(--priest)', '三隻祭牲', ORDINATION));
  const dressHost = h('div');
  mountDress(dressHost);
  const marksHost = h('div');
  return h('article', { class: 'scene', style: '--c:var(--priest)' },
    h('div', { class: 'wrap' }, head('ordination', '七天承接聖職', ORDAIN.lede, omark('priesthood' as never))),
    theater.el,
    h('div', { class: 'wrap' },
      layer('重點', null, h('div', { class: 'keys' },
        keyCard({ title: '先後次序', lines: [] }, timeline(SEVEN_DAYS)),
        ...ORDAIN.cards.map((c) => keyCard(c)))),
      layer('照經文的次序穿上聖衣', '亞倫七件、兒子三件：猜猜看先穿哪一件', dressHost),
      layer('細節', '想多知道一點，再點開', h('div', { class: 'mores' },
        more('血抹在三個地方', '右耳垂、右手大拇指、右腳大拇指', () => { mountMarks(marksHost); return marksHost; }),
        readingMore(ORDAIN.read))),
      voicesLink('聖衣的次序、抹血的三處，各家註釋讀法不同', '例如：耳朵、手、腳代表什麼？'),
      sceneNav('ordination')));
}

/* ============================================================ 第八天 */

export function buildEighth(): HTMLElement {
  const theater = mountTheater(listSource('第八天', 'var(--priest)', '', [EIGHTH_VARIANT]));
  return h('article', { class: 'scene', style: '--c:var(--priest)' },
    h('div', { class: 'wrap' }, head('eighth', '第八天', EIGHTH.lede, omark('priesthood' as never))),
    theater.el,
    h('div', { class: 'wrap' },
      layer('重點', null, h('div', { class: 'keys' },
        keyCard({ title: '這一天的次序', lines: [] }, h('div', null,
          h('p', { style: 'font-size:.85em;color:var(--ink-2);margin:0 0 6px' }, h('span', { style: 'color:var(--sin);font-weight:700' }, '■ 先為自己'), '　',
            h('span', { style: 'color:var(--peace);font-weight:700' }, '■ 再為百姓')),
          timeline(EIGHTH_DAY))),
        ...EIGHTH.cards.map((c) => keyCard(c)))),
      layer('細節', '想多知道一點，再點開', h('div', { class: 'mores' }, readingMore(EIGHTH.read))),
      voicesLink('次序的意思、那把火從哪裡來，各家註釋讀法不同', '例如：為什麼先為自己、再為百姓？'),
      sceneNav('eighth')));
}

/* ============================================================ 複習 */

export function buildReview(): HTMLElement {
  // 填空測驗：讀完前面各幕，再來試
  let bring: BringId | '' = '';
  let why: WhyId | '' = '';
  const result = h('div', { class: 'quiz-result', 'aria-live': 'polite' });
  const sel = <T extends string>(label: string, opts: readonly { id: T; label: string }[], set: (v: T | '') => void) => {
    const s = h('select', { class: 'quiz-sel', 'aria-label': label }, h('option', { value: '' }, '選一樣'), ...opts.map((o) => h('option', { value: o.id }, o.label)));
    s.addEventListener('change', () => { set(s.value as T | ''); update(); });
    return s;
  };
  function update() {
    if (!bring || !why) { result.replaceChildren(h('span', { style: 'color:var(--ink-3)' }, '兩格都選好，看經文怎麼說。')); return; }
    const r = resolveEntry(bring, why);
    if (r.ok) {
      const o = OFFERING_BY_ID[r.offering];
      result.replaceChildren(h('a', { class: 'quiz-name', href: sceneHref(r.offering), style: `--c:${OFFERING_STYLE[r.offering].color}` }, omark(r.offering), o.name, ' →'),
        h('div', null, factLine(r.fact)));
    } else result.replaceChildren(h('b', null, '經文沒有這樣獻的。'), h('div', null, factLine(r.fact)));
  }
  update();
  const quiz = h('div', { class: 'card quiz' },
    h('p', { class: 'quiz-line' }, '我帶著', sel('帶著什麼', BRING, (v) => (bring = v)), '來到會幕門口，因為', sel('因為什麼', WHY, (v) => (why = v)), '。'),
    result);

  const qs = h('div', { class: 'mores' }, ...QUESTIONS.map((q, i) => more(`${i + 1}. ${q.q}`, '先想一想，再點開看答案', () => h('div', null,
    h('ul', { class: 'key-lines' }, ...q.answers.map((a) => h('li', null, factLine(a)))),
    h('p', { style: 'margin:10px 0 0;font-size:.9em' }, '回到：', ...q.scenes.map((id) => h('a', { href: sceneHref(id as SceneId), style: 'margin-right:10px' }, SCENE_BY_ID[id as SceneId].short)))))));

  const compareHost = h('div');
  mountCompare(compareHost);
  return h('article', { class: 'scene' },
    h('div', { class: 'wrap' },
      head('review', '複習', '利未記 1–9 章走完了。用一張總表、一個填空和六個問題，看看自己記得多少。'),
      layer('五種祭總表', '點任何一格看經文；點祭名可以標亮那一欄', compareHost),
      layer('填空：我帶著什麼來？', '選錯了也沒關係，經文會告訴你為什麼', quiz),
      layer('讀完答得出來嗎？', null, qs),
      sceneNav('review')));
}
