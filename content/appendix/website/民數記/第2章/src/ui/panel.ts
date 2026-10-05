import { LEVI_OUT_FACT, OVERVIEW_FACTS, PRIEST_TRUMPET_FACT, TABERNACLE_FACTS, TOTAL_FACT } from '../data/center';
import { CLANS, LOADS, clan, clanFacts } from '../data/levites';
import { MARCH_NUM10, MARCHES } from '../data/march';
import {
  CAMPS, MATRIARCH, SIDE_LABEL, TOTAL_2, camp, campFacts, fmt, tribe, tribeExtraFacts, tribeFacts, tribesOf,
} from '../data/tribes';
import type { CampId, ClanId, Fact, TribeId } from '../data/types';
import { VOICES } from '../data/voices';
import type { VoiceTopic } from '../data/voices';
import { PEOPLE_PER_TENT } from '../layout';
import { linkFor, selToHash } from '../deeplink';
import * as store from '../store';
import { selLabel } from './campmap';
import { emit, fill, h, svg } from './dom';
import { factLine, interpHeading, refChips, voiceBlock } from './evidence';
import { ICONS } from './icons';
import { CAMP_STYLE, SIDE_NAME } from './meta';
import { smoothScrollTo } from './motion';

const shapeChip = (id: CampId) => h('span', { class: 'omark', 'data-shape': CAMP_STYLE[id].shape, style: `--c:${CAMP_STYLE[id].color}` });

const kv = (k: string, ...v: (Node | string)[]) => h('div', { class: 'kv-row' }, h('dt', null, k), h('dd', null, ...v));

const factList = (facts: Fact[]) => h('ul', { class: 'facts' }, ...facts.map((f) => h('li', null, factLine(f))));

const voiceList = (topics: VoiceTopic[]) => {
  const vs = topics.flatMap((t) => VOICES[t]);
  if (!vs.length) return null;
  return h('div', null, interpHeading(), ...vs.map(voiceBlock));
};

/** 民10 實際行軍時，這一營排第幾批 */
const batchOf = (id: CampId) => MARCH_NUM10.findIndex((s) => s.camps?.includes(id)) + 1;

function goMarch() {
  emit('mapmode', 'march');
  store.set({ mode: 'num10', phase: 1, playing: true });
  if (!narrow()) return;
  const stage = document.querySelector<HTMLElement>('#map .stage');
  if (stage && stage.getBoundingClientRect().top < 0) smoothScrollTo(stage.getBoundingClientRect().top + scrollY - 70, 500);
}

const narrow = () => matchMedia('(max-width: 980px)').matches;

/**
 * 選了東西之後，讓使用者看得到資訊欄。
 * 窄螢幕的資訊欄排在地圖下面，要捲過去；寬螢幕的資訊欄黏在地圖旁邊，只要地圖區在畫面上就好。
 */
export function revealPanel() {
  requestAnimationFrame(() => {
    const target = document.querySelector<HTMLElement>(narrow() ? '#map .panel' : '#map .map-layout');
    if (!target) return;
    const r = target.getBoundingClientRect();
    const ok = narrow() ? r.top >= 50 && r.top < innerHeight * 0.45 : r.top < innerHeight * 0.4 && r.bottom > innerHeight * 0.6;
    if (!ok) smoothScrollTo(r.top + scrollY - 70, 600);
  });
}

/** 關掉資訊欄時，窄螢幕捲回地圖 */
function backToStage() {
  if (!narrow()) return;
  const stage = document.querySelector<HTMLElement>('#map .stage');
  if (stage && stage.getBoundingClientRect().top < 0) smoothScrollTo(stage.getBoundingClientRect().top + scrollY - 70, 500);
}

const pickSel = (sel: store.Selection) => { store.set({ sel }); revealPanel(); };

const marchButton = () => h('button', { class: 'btn primary', type: 'button', onclick: goMarch }, svg(ICONS.play), '開始拔營');
const selectButton = (label: string, sel: store.Selection, icon?: string) =>
  h('button', { class: 'btn', type: 'button', onclick: () => pickSel(sel) }, icon ? svg(ICONS[icon]) : null, label);

function overview(): HTMLElement {
  const rows = CAMPS.map((c) => h('button', {
    class: 'camp-row', type: 'button', style: `--c:${CAMP_STYLE[c.id].color}`,
    onclick: () => pickSel({ kind: 'camp', id: c.id }),
  },
  shapeChip(c.id),
  h('span', { class: 'cr-main' }, h('b', null, camp(c.id).bannerName), h('small', null, tribesOf(c.id).map((t) => t.name).join('・'))),
  h('span', { class: 'cr-side' }, SIDE_NAME[c.side]),
  h('span', { class: 'cr-n' }, fmt(c.total.n)),
  h('span', { class: 'cr-o' }, c.orderName)));
  return h('div', null,
    h('div', { class: 'panel-head' }, h('h3', null, '環繞會幕安營'), h('p', null, '點地圖上的任何一個支派、旗、利未族或會幕，這裡會列出人數、首領、方向和出發順序。')),
    h('div', { class: 'camp-rows' }, ...rows),
    h('dl', { class: 'kv' },
      kv('被數點的總數', `${fmt(TOTAL_2.n)} 名`),
      kv('一頂帳棚', `約 ${fmt(PEOPLE_PER_TENT)} 名（示意）`)),
    h('div', { class: 'panel-actions' }, marchButton()),
    factList([TOTAL_FACT, LEVI_OUT_FACT, ...OVERVIEW_FACTS]),
  );
}

function tribePanel(id: TribeId): HTMLElement {
  const t = tribe(id);
  const c = camp(t.camp);
  const mother = MATRIARCH[t.mother];
  const mates = tribesOf(t.camp);
  return h('div', null,
    h('div', { class: 'panel-head', style: `--c:${CAMP_STYLE[t.camp].color}` },
      h('div', { class: 'ph-top' }, shapeChip(t.camp), h('span', { class: 'ph-camp' }, `${SIDE_NAME[c.side]}・${tribe(c.head).name}營`)),
      h('h3', null, `${t.name}支派`),
      h('p', null, t.rank === 1 ? '這一營的領頭支派，纛立在這裡。' : t.rank === 2 ? '「挨著他安營」的支派。' : '「又有」的支派。')),
    h('dl', { class: 'kv' },
      kv('方向', SIDE_NAME[c.side]),
      kv('出發順序', `民2：${c.orderName}`, ' · ', `民10：第 ${batchOf(t.camp)} 批`),
      kv('人數', `${fmt(t.c2.n)} 名`),
      kv('首領', `${t.father}的兒子${t.leader}`),
      kv('獻禮日', `民7：第 ${t.day} 日`),
      kv('母系', h('span', { style: `color:${mother.color};font-weight:700` }, mother.name), mother.role === '妻' ? '' : `（${mother.role}）`, t.id === 'ephraim' || t.id === 'manasseh' ? '一系' : '所生')),
    h('div', { class: 'panel-actions' },
      marchButton(),
      selectButton(`看整個${c.bannerName.replace('的纛', '')}`, { kind: 'camp', id: t.camp }, 'flag')),
    h('h4', { class: 'sub' }, '同一營的三個支派'),
    h('div', { class: 'mates' }, ...mates.map((m) => h('button', {
      class: 'mate', type: 'button', 'aria-pressed': String(m.id === id), onclick: () => pickSel({ kind: 'tribe', id: m.id }),
    }, h('b', null, m.name), h('small', null, fmt(m.c2.n))))),
    h('h4', { class: 'sub' }, '經文怎麼說'),
    factList([...tribeFacts(t), ...tribeExtraFacts(t)]),
    voiceList([c.side]),
  );
}

function campPanel(id: CampId): HTMLElement {
  const c = camp(id);
  const ts = tribesOf(id);
  const max = Math.max(...ts.map((t) => t.c2.n));
  return h('div', null,
    h('div', { class: 'panel-head', style: `--c:${CAMP_STYLE[id].color}` },
      h('div', { class: 'ph-top' }, shapeChip(id), h('span', { class: 'ph-camp' }, `${SIDE_NAME[c.side]}`)),
      h('h3', null, c.bannerName),
      h('p', null, `${ts.map((t) => t.name).join('、')}，一共 ${fmt(c.total.n)} 名。`)),
    h('dl', { class: 'kv' },
      kv('方向', SIDE_NAME[c.side]),
      kv('出發順序', `民2：${c.orderName}`, ' · ', `民10：第 ${batchOf(id)} 批`),
      kv('全營人數', `${fmt(c.total.n)} 名`),
      kv('佔全部', `${((c.total.n / TOTAL_2.n) * 100).toFixed(1)}%`)),
    h('div', { class: 'panel-actions' }, marchButton()),
    h('h4', { class: 'sub' }, '三個支派'),
    h('div', { class: 'bars' }, ...ts.map((t) => h('button', {
      class: 'bar-row', type: 'button', onclick: () => pickSel({ kind: 'tribe', id: t.id }),
    }, h('span', { class: 'bar-name' }, t.name),
    h('span', { class: 'bar-track' }, h('span', { class: 'bar-fill', style: `width:${(t.c2.n / max) * 100}%;background:${CAMP_STYLE[id].color}` })),
    h('span', { class: 'bar-n' }, fmt(t.c2.n))))),
    h('h4', { class: 'sub' }, '經文怎麼說'),
    factList(campFacts(c)),
    voiceList([c.side]),
  );
}

function loadsBlock(): HTMLElement {
  return h('div', null,
    h('h4', { class: 'sub' }, '哥轄人抬的聖物（民4:5-14）'),
    h('ul', { class: 'loads' }, ...LOADS.map((l) => h('li', null,
      h('b', null, l.name), '：', l.layers.join(' → '), ' ',
      h('span', { class: `outer ${l.outer}` }, l.outer === 'blue' ? '最外面：純藍色毯子' : '最外面：海狗皮'), ' ',
      ...refChips([l.ref], l.q)))),
  );
}

function clanPanel(id: ClanId): HTMLElement {
  const c = clan(id);
  return h('div', null,
    h('div', { class: 'panel-head', style: '--c:var(--levi)' },
      h('div', { class: 'ph-top' }, h('span', { class: 'omark', 'data-shape': 'star', style: '--c:var(--levi)' }), h('span', { class: 'ph-camp' }, `帳幕的${SIDE_LABEL[c.side]}邊`)),
      h('h3', null, c.name),
      h('p', null, id === 'priests' ? '安營在帳幕前東邊，會幕門口的那一面；吹銀號的是亞倫子孫作祭司的（民10:8）。' : '利未人不算在十二支派的數目裡，安營在會幕四圍。')),
    h('dl', { class: 'kv' },
      kv('位置', `帳幕的${SIDE_LABEL[c.side]}邊`),
      c.count ? kv('人數', `${fmt(c.count.n)} 名（一個月以外的男子）`) : null,
      c.leader ? kv('宗族首領', `${c.leader.father}的兒子${c.leader.name}`) : null,
      id !== 'priests' ? kv('車與牛', c.wagons.n ? `${c.wagons.n} 輛車、${c.wagons.oxen} 隻牛` : '沒有，用肩頭抬') : null),
    h('div', { class: 'panel-actions' }, marchButton()),
    h('h4', { class: 'sub' }, '經文怎麼說'),
    factList(clanFacts(c)),
    id === 'kohath' ? loadsBlock() : null,
    id === 'priests' ? h('div', { class: 'note' }, factLine(PRIEST_TRUMPET_FACT), ' 號聲的用法見「拔營」。') : null,
    voiceList(['levites']),
  );
}

function tabernaclePanel(): HTMLElement {
  return h('div', null,
    h('div', { class: 'panel-head', style: '--c:var(--gold)' },
      h('div', { class: 'ph-top' }, svg(ICONS.altar)),
      h('h3', null, '會幕'),
      h('p', null, '十二支派對著會幕的四圍安營，會幕在正中間。')),
    h('div', { class: 'panel-actions' }, marchButton()),
    h('h4', { class: 'sub' }, '經文怎麼說'),
    factList(TABERNACLE_FACTS),
    voiceList(['center', 'cross']),
  );
}

function copyLinkButton(sel: store.Selection): HTMLElement {
  const label = h('span', null, '複製連結');
  const b = h('button', { class: 'panel-close', type: 'button', title: '複製直接開到這裡的網址' }, svg(ICONS.link), label);
  b.addEventListener('click', async () => {
    const url = linkFor(selToHash(sel));
    try {
      await navigator.clipboard.writeText(url);
      label.textContent = '已複製';
    } catch {
      // 不能用剪貼簿（例如某些瀏覽器的本機檔案）：改成把網址換上去，讓使用者從網址列複製
      history.replaceState(null, '', selToHash(sel));
      label.textContent = '網址列已換成這裡的連結';
    }
    setTimeout(() => { label.textContent = '複製連結'; }, 2200);
  });
  return b;
}

export function createPanel(): { el: HTMLElement; destroy(): void } {
  // 整個資訊欄很長，不設 aria-live；另用一行隱藏文字告訴螢幕閱讀器選到了什麼
  const live = h('p', { class: 'sr-only', 'aria-live': 'polite' });
  const body = h('div');
  const el = h('aside', { class: 'panel card', 'aria-label': '詳細資料' }, live, body);
  let key = '';
  const render = (st: Readonly<store.State>) => {
    const k = st.sel ? `${st.sel.kind}:${'id' in st.sel ? st.sel.id : ''}` : 'none';
    if (k === key) return;
    key = k;
    const sel = st.sel;
    live.textContent = sel ? `已選：${selLabel(sel)}` : '';
    fill(body,
      !sel ? overview()
        : sel.kind === 'tribe' ? tribePanel(sel.id)
          : sel.kind === 'camp' ? campPanel(sel.id)
            : sel.kind === 'clan' ? clanPanel(sel.id)
              : tabernaclePanel(),
      sel ? h('div', { class: 'panel-foot' },
        h('button', { class: 'panel-close', type: 'button', onclick: () => { store.set({ sel: null }); backToStage(); } }, svg(ICONS.x), '回到全圖'),
        copyLinkButton(sel)) : null);
  };
  const un = store.subscribe(render);
  render(store.get());
  return { el, destroy: un };
}

/** 清單檢視：地圖的無障礙備案，也是手機上的閱讀方式 */
export function createCampList(): HTMLElement {
  const el = h('div', { class: 'camp-list' });
  store.subscribe((st) => {
    el.querySelectorAll<HTMLElement>('.cl-tribe').forEach((b) => {
      const on = st.sel?.kind === 'tribe' && st.sel.id === b.dataset.tribe;
      b.setAttribute('aria-pressed', String(on));
    });
  });
  fill(el, ...CAMPS.map((c) => h('section', { class: 'cl-camp', style: `--c:${CAMP_STYLE[c.id].color}` },
    h('header', null, shapeChip(c.id), h('h3', null, h('button', { class: 'cl-camp-btn', type: 'button', onclick: () => pickSel({ kind: 'camp', id: c.id }) }, `${SIDE_NAME[c.side]}・${camp(c.id).bannerName}`)), h('span', null, `${c.orderName}・${fmt(c.total.n)}`)),
    h('div', { class: 'cl-tribes' }, ...tribesOf(c.id).map((t) => h('button', {
      class: 'cl-tribe', type: 'button', 'aria-pressed': 'false', 'data-tribe': t.id, onclick: () => pickSel({ kind: 'tribe', id: t.id }),
    }, h('b', null, t.name), h('small', null, `${fmt(t.c2.n)}・${t.father}的兒子${t.leader}`)))),
  )),
  h('section', { class: 'cl-camp', style: '--c:var(--levi)' },
    h('header', null, h('span', { class: 'omark', 'data-shape': 'star', style: '--c:var(--levi)' }), h('h3', null, '中間：會幕與利未營'), h('span', null, '不算在十二支派裡')),
    h('div', { class: 'cl-tribes' },
      h('button', { class: 'cl-tribe', type: 'button', onclick: () => pickSel({ kind: 'tabernacle' }) }, h('b', null, '會幕'), h('small', null, '在營的正中間')),
      ...CLANS.map((c) => h('button', { class: 'cl-tribe', type: 'button', onclick: () => pickSel({ kind: 'clan', id: c.id }) },
        h('b', null, c.id === 'priests' ? '祭司' : c.name),
        h('small', null, `帳幕的${SIDE_LABEL[c.side]}邊${c.count ? `・${fmt(c.count.n)}` : '・摩西、亞倫'}`))))),
  h('p', { class: 'cl-note' }, `民10 實際上路時共分 ${MARCHES.num10.steps.length} 批出發，見「拔營」。`));
  return el;
}
