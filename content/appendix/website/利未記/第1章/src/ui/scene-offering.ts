import VERSES from '../data/verses.json';
import { DEST_LABEL, PORTIONS, type Dest } from '../data/compare';
import { DEBATES, TRIVIA } from '../data/debates';
import { OBJECTS } from '../data/objects';
import { OFFERING_BY_ID } from '../data/offerings';
import { GROUP_LABEL, OFFERING_KEYS, SCENES, SCENE_BY_ID, type KeyCard, type LaneStep } from '../data/story';
import type { OfferingId } from '../data/types';
import { h, motionOff, on, svg } from './dom';
import { factLine, refChips } from './evidence';
import { EV_ICON, ICONS } from './icons';
import { ACTOR, OFFERING_STYLE } from './meta';
import { openObject } from './objects';
import { sceneHref, sceneNav } from './shell';
import { mountSimulator, omark } from './simulator';
import { mountTheater, offeringSource } from './theater';

const verses = VERSES as Record<string, string>;
const DEST_ICON: Record<Dest, string> = { god: 'god', priest: 'priest', offerer: 'home', outside: 'outside' };

/** 可展開的細節 */
export function more(title: string, hint: string, body: HTMLElement | (() => HTMLElement), id?: string): HTMLDetailsElement {
  const d = h('details', { class: 'more card', 'data-more': id ?? null },
    h('summary', null, h('span', null, h('b', null, title), h('small', null, hint)), h('span', { class: 'chev' }, svg(ICONS.chev))));
  // 細節第一次打開才建，避免一進來就把地圖、播放器全畫出來
  let built = false;
  const ensure = () => {
    if (built) return;
    built = true;
    d.append(h('div', { class: 'more-body' }, typeof body === 'function' ? body() : body));
  };
  d.addEventListener('toggle', () => d.open && ensure());
  (d as HTMLDetailsElement & { ensure?: () => void }).ensure = ensure;
  return d;
}

/** 「讀經文」：整段和合本，節號小字 */
export function readingMore(read: { ch: number; from: number; to: number; title: string }[]): HTMLDetailsElement {
  const body = () => h('div', { class: 'reading' }, ...read.map((r) => {
    const ps: HTMLElement[] = [];
    for (let v = r.from; v <= r.to; v++) {
      const t = verses[`利${r.ch}:${v}`];
      if (t) ps.push(h('span', { class: 'rverse' }, h('sup', null, `${r.ch}:${v}`), t));
    }
    return h('section', null, h('h4', null, r.title), h('p', null, ...ps));
  }));
  return more('讀經文', read.map((r) => `利${r.ch}:${r.from}-${r.to}`).join('、'), body, 'read');
}

function lanes(steps: LaneStep[]): HTMLElement {
  const grid = h('div', { class: 'lanes', style: `--n:${steps.length}` },
    h('div', { class: 'lane-head', style: '--col:1;--row:1' }, h('span', { class: 'dot', style: `background:${ACTOR.offerer.color}` }, ACTOR.offerer.glyph), '獻祭的人'),
    h('div', { class: 'lane-head', style: '--col:1;--row:2' }, h('span', { class: 'dot', style: `background:${ACTOR.priest.color}` }, ACTOR.priest.glyph), '祭司'));
  steps.forEach((s, i) => {
    const r = s.who === 'offerer' ? '1' : s.who === 'priest' ? '2' : '1 / span 2';
    grid.append(h('div', { class: `lane-step ${s.who}`, style: `--col:${i + 2};--row:${r}` },
      h('span', { class: 'n' }, i + 1),
      h('span', { class: 'lab' }, s.label, s.who === 'unstated' ? h('small', null, '經文沒說由誰做') : null),
      ...refChips(s.fact.refs, s.fact.q)));
  });
  return grid;
}

function portions(id: OfferingId): HTMLElement {
  const p = PORTIONS[id];
  return h('div', { class: 'dests' }, ...(Object.keys(DEST_LABEL) as Dest[]).map((d) => h('div', { class: `dest-box${p[d].length ? '' : ' none'}` },
    h('span', { class: 'ic' }, svg(ICONS[DEST_ICON[d]])),
    h('small', null, DEST_LABEL[d]),
    h('b', null, p[d].length ? p[d].join('、') : '沒有'))));
}

function card(c: KeyCard, extra: HTMLElement | null, wide = false): HTMLElement {
  return h('div', { class: `key card${wide ? ' wide' : ''}`, 'data-key': c.id },
    h('h3', null, c.title),
    h('ul', { class: 'key-lines' }, ...c.lines.map((l) => h('li', null, factLine(l)))),
    extra);
}

export function buildOffering(id: OfferingId): HTMLElement {
  const o = OFFERING_BY_ID[id];
  const keys = OFFERING_KEYS[id]!;
  const scene = SCENE_BY_ID[id];
  const color = OFFERING_STYLE[id].color;
  const pos = SCENES.findIndex((s) => s.id === id) + 1;

  /* ---------------- 細節層 */
  let sim: ReturnType<typeof mountSimulator> | null = null;
  const stepsBody = () => {
    const host = h('div', { class: 'sim-host' });
    sim = mountSimulator(host, { only: id });
    return h('div', null,
      h('p', { class: 'more-lede' }, '選一種祭物，按「開始」一步一步看；也可以直接點右邊清單的任何一步。地圖上的圓點是這一步由誰做，虛線圈是在院子的哪裡。'),
      host);
  };
  const steps = more('平面圖版本', '院子俯視圖＋全部步驟清單＋「這一次的結果」對照表', stepsBody, 'steps');
  const theater = mountTheater(offeringSource(id));

  const reading = readingMore(keys.read);

  const rules = more(`${o.name}不管怎麼獻都一樣的規矩`, `${o.rules.length} 條，出自給祭司的條例`, h('ul', { class: 'key-lines' }, ...o.rules.map((r) => h('li', null, factLine(r)))), 'rules');

  const objs = OBJECTS.filter((x) => x.usedBy.includes(id));
  const things = more('會看到的器具和地點', `${objs.length} 樣，點開看經文怎麼描述`, () => h('div', { class: 'thing-grid' }, ...objs.map((x) =>
    h('button', { class: 'thing', type: 'button', onclick: () => openObject(x) },
      h('span', { class: 'ico' }, svg(ICONS[x.icon] ?? ICONS.q)),
      h('span', null, h('b', null, x.name), h('small', null, x.summary))))), 'things');

  /* ---------------- 重點層 */
  const byId = Object.fromEntries(keys.cards.map((c) => [c.id, c])) as Record<KeyCard['id'], KeyCard>;
  // 「帶什麼來」：三種由大到小，點一種直接打開那一種的步驟
  const tiers = h('div', { class: 'tiers' }, ...o.axes[0].options.map((op, i) => h('button', {
    class: 'tier', type: 'button', style: `--s:${id === 'burnt' ? 1.25 - i * 0.18 : 1}`,
    onclick: () => {
      theater.choose({ [o.axes[0].id]: op.id });
      sim?.choose({ [o.axes[0].id]: op.id });
      theater.el.scrollIntoView({ behavior: motionOff() ? 'auto' : 'smooth', block: 'start' });
    },
  }, op.label)), h('small', { class: 'tiers-hint' }, '點一種，在上面的 3D 院子看它怎麼獻'));

  const lanesBlock = keys.lanes ? h('div', null,
    h('div', { class: 'lanes-cap' }, keys.lanes.caption),
    lanes(keys.lanes.steps),
    keys.lanes.foot ? h('p', { class: 'lanes-foot' }, factLine(keys.lanes.foot)) : null) : null;

  const debates = DEBATES.filter((d) => d.offering === id);
  const trivia = TRIVIA.filter((t) => t.offering === id);

  return h('article', { class: 'scene scene-offering', style: `--c:${color}` },
    h('div', { class: 'wrap' },
      h('header', { class: 'scene-head' },
        h('div', { class: 'kicker' }, `${scene.range}・${GROUP_LABEL[scene.group].replace(/（.*/, '')}・第 ${pos} 幕，共 ${SCENES.length} 幕`),
        h('h1', null, omark(id), o.name),
        h('p', { class: 'lede' }, o.tagline))),

    theater.el,

    h('div', { class: 'wrap' },

      h('section', { class: 'layer' },
        h('h2', { class: 'layer-title' }, '重點'),
        h('div', { class: 'keys' },
          card(byId.when, null),
          card(byId.bring, tiers),
          card(byId.who, lanesBlock, true),
          card(byId.where, portions(id), true))),

      h('section', { class: 'layer' },
        h('h2', { class: 'layer-title' }, '細節', h('small', null, '想多知道一點，再點開')),
        h('div', { class: 'mores' }, steps, reading, rules, things)),

      debates.length || trivia.length ? h('a', { class: 'voices-link card', href: sceneHref('voices') },
        svg(EV_ICON.interpretation),
        h('span', null,
          h('b', null, `${o.name}有 ${debates.length} 個地方，各家註釋讀法不同`),
          h('small', null, `例如：${debates.slice(0, 2).map((d) => d.question).join('　')}`),
          h('small', null, '全部集中在最後一幕「各家怎麼讀」')),
        svg(ICONS.next)) : null,

      sceneNav(id)));
}

// 從器具說明「走一次某祭」跳過來時，打開那一幕的步驟
on('open-steps', () => {
  const d = document.querySelector<HTMLDetailsElement>('.scene-offering details[data-more="steps"]');
  if (d) {
    d.open = true;
    (d as unknown as { ensure: () => void }).ensure();
  }
});
