import { DATES, TIMED_EXACT, stationMonths, timeLabel } from '../data/dates';
import { EVENTS, KIND_LABEL } from '../data/events';
import PLACES from '../data/places.json';
import { FHL_STATEMENTS, LEVEL_HELP, LEVEL_LABEL, SITES, SITE_VOICES, candLabel, entryUrl, obUrl } from '../data/sites';
import type { Level } from '../data/sites';
import { station, stationRef } from '../data/stations';
import { OVERVIEW_FACTS } from '../data/voices';
import * as store from '../store';
import { fill, h, svg } from './dom';
import { badge, factLine, interpHeading, refChip, voiceBlock } from './evidence';
import { ICONS } from './icons';

const places = PLACES as Record<string, string>;

const KIND_ICON: Record<string, string> = { water: 'drop', food: 'grain', battle: 'sword', judgment: 'fire', death: 'cross', law: 'book', guidance: 'cloud', other: 'flag' };
export const kindIcon = (kind: string) => svg(ICONS[KIND_ICON[kind] ?? 'flag'], `kind-ic kind-${kind}`);

export const levelChip = (level: Level, long = false) =>
  h('span', { class: `lvchip lv-${level}`, title: LEVEL_HELP[level] }, h('i', { class: `lg-dot lv-${level}` }), long ? `位置可信度：${LEVEL_LABEL[level]}` : LEVEL_LABEL[level]);

const KIND_OF_POINT: Record<string, string> = { point: '遺址', center: '一帶', 'representative point': '代表點' };

function overview(): HTMLElement {
  const counts: Record<Level, number> = { high: 0, mid: 0, low: 0, none: 0 };
  for (const s of SITES) counts[s.level]++;
  return h('div', null,
    h('div', { class: 'panel-head' },
      h('h3', null, '曠野四十二站'),
      h('p', null, '民數記 33 章是一份清單：從蘭塞到摩押平原，一站接一站。點地圖上的站，或左邊的清單，看這一站的經文、位置、發生的事。')),
    h('ul', { class: 'facts' }, ...OVERVIEW_FACTS.map((f) => h('li', null, factLine(f)))),
    h('h4', { class: 'sub' }, '位置有多準？'),
    h('p', { class: 'small-p' }, '經文只給站名，不給座標。地圖上的點是現代的候選地點，可信度來自 OpenBible 的綜合分數；四十二站裡：'),
    h('div', { class: 'lv-counts' }, ...(['high', 'mid', 'low', 'none'] as Level[]).map((l) => h('div', null, levelChip(l), h('b', null, `${counts[l]} 站`)))),
    h('p', { class: 'small-p muted' }, '「低」和「不詳」佔多數，特別是三十八年飄流的那一段。畫在圖上的路線只是把候選地點連起來，不是他們走的路。'),
    h('h4', { class: 'sub' }, 'FHL〈民圖五〉怎麼說'),
    interpHeading('地圖說明'),
    voiceBlock(FHL_STATEMENTS.confirmed),
    voiceBlock(FHL_STATEMENTS.wandering),
    h('div', { class: 'panel-actions' },
      h('button', { class: 'btn primary', type: 'button', onclick: () => store.set({ playing: true, at: store.get().at >= 42 ? 1 : store.get().at }) }, svg(ICONS.play), '開始走'),
      h('button', { class: 'btn', type: 'button', onclick: () => store.selectStation(1) }, svg(ICONS.flag), '從第 1 站看起')),
  );
}

function stationCard(n: number): HTMLElement {
  const st = station(n);
  const site = SITES[n - 1];
  const events = EVENTS.filter((e) => e.st === n);
  const dates = DATES.filter((d) => d.st === n);
  const months = stationMonths(n);
  const exact = TIMED_EXACT.has(n);
  const def = st.entry ? places[st.entry] : undefined;

  const cands = h('table', { class: 'cand-table' },
    h('thead', null, h('tr', null, h('th', null, '候選地點'), h('th', null, '種類'), h('th', null, '分數'), h('th'))),
    h('tbody', null, ...site.cands.map((c, i) => h('tr', { class: `${i === site.pick ? 'pick' : ''}`, 'data-i': i },
      h('th', { scope: 'row' }, candLabel(c.name), i === site.pick ? h('em', null, '　採用') : site.zone?.used.includes(c) ? h('em', null, '　計入') : null),
      h('td', null, KIND_OF_POINT[c.kind] ?? c.kind),
      h('td', { class: 'num' }, String(c.score)),
      h('td', null, h('button', { class: 'linkbtn', type: 'button', onclick: () => store.set({ cand: { n, i }, follow: false }) }, '在地圖上看'))))));

  const links = st.key === 'moab'
    ? [h('a', { href: obUrl('bethjeshimoth'), rel: 'noopener', target: '_blank' }, 'OpenBible：伯耶施末'), h('a', { href: obUrl('abelshittim'), rel: 'noopener', target: '_blank' }, 'OpenBible：亞伯什亭')]
    : [h('a', { href: obUrl(st.key), rel: 'noopener', target: '_blank' }, 'OpenBible 上這個地名的候選與投票')];

  return h('div', null,
    h('div', { class: 'panel-head' },
      h('div', { class: 'ph-top' },
        h('span', { class: `stnum lv-${site.level}` }, String(n)),
        h('span', { class: 'ph-camp' }, `第 ${n} 站`),
        levelChip(site.level, true)),
      h('h3', null, st.name),
      h('p', null, h('span', { class: 'q' }, st.q), ' ', refChip(stationRef(st), st.q), ' ', badge('explicit'))),
    h('dl', { class: 'kv' },
      h('div', { class: 'kv-row' }, h('dt', null, '時間'), h('dd', null, timeLabel(months), exact ? '（經文有日期）' : '（平均分配，示意）')),
      h('div', { class: 'kv-row' }, h('dt', null, '現代位置'), h('dd', null,
        site.mode === 'route' ? '沒有座標；圖上依前後兩站畫在路線上'
          : site.mode === 'zone' ? `${site.label}；可能在這一帶，範圍約 ${Math.round(site.zone!.rKm)} 公里`
            : site.label))),
    h('div', { class: 'panel-actions' },
      h('button', { class: 'btn', type: 'button', disabled: n <= 1, onclick: () => store.selectStation(n - 1) }, svg(ICONS.prev), '上一站'),
      h('button', { class: 'btn', type: 'button', disabled: n >= 42, onclick: () => store.selectStation(n + 1) }, '下一站', svg(ICONS.next)),
      h('button', { class: 'btn', type: 'button', onclick: () => store.set({ playing: true, at: n, follow: true }) }, svg(ICONS.play), '從這裡開始走')),

    h('h4', { class: 'sub' }, '這一站發生的事'),
    events.length || dates.length
      ? h('ul', { class: 'facts ev-list' },
        ...dates.map((d) => h('li', null, kindIcon('other'), h('span', null, factLine({ text: d.label, status: d.status, refs: [d.ref], q: d.q, note: d.note })))),
        ...events.map((e) => h('li', null, kindIcon(e.kind), h('span', null, h('b', { class: 'kind-tag' }, KIND_LABEL[e.kind]), ' ', factLine({ text: e.text, status: e.status, refs: e.refs, q: e.q, note: e.note })))))
      : h('p', { class: 'small-p muted' }, badge('not_stated'), ' 本站整理的經文裡，沒有記這一站發生的事；民數記 33 章只列了站名。'),

    h('h4', { class: 'sub' }, '位置'),
    h('p', { class: 'small-p' }, LEVEL_HELP[site.level]),
    site.mode === 'zone'
      ? h('div', { class: 'note' }, `這一站在三十八年飄流那一段，位置多半無法確定。地圖上的點是${site.zone!.used.length > 1 ? `下面標「計入」的 ${site.zone!.used.length} 個候選的中間值（依分數加權）` : '唯一可信候選的位置'}，淡圈是候選散布的範圍；分數低於最高分 35% 的候選不計入，但仍列在下面。挨得太近的站會被輕輕撥開，所以點和圈的中心可能差一點。`)
      : null,
    site.why ? h('div', { class: 'note' }, site.why) : null,
    site.cands.length ? cands : null,
    h('p', { class: 'fine' }, '分數是 OpenBible 的綜合分數（網友投票加路線時間一致性），約 −200 到 1000，只表示各候選之間的相對可信度。座標是現代地點，不是經文寫的。 ', ...links),
    (SITE_VOICES[n]?.length ?? 0) > 0 ? h('div', null, interpHeading(), ...SITE_VOICES[n].map(voiceBlock)) : null,

    st.ctGloss || st.ctSpirit
      ? h('div', { class: 'interp-layer ct-block' },
        h('h4', { class: 'sub' }, 'CT 的字義與靈意'),
        st.ctGloss ? h('p', { class: 'small-p' }, badge('interpretation'), ' 原文字義：', h('span', { class: 'q' }, st.ctGloss.replace(/^「[^」]*」/, '')), h('span', { class: 'muted' }, `　（${st.ctGloss.match(/^「([^」]*)」/)?.[1] ?? ''}）`)) : null,
        st.ctSpirit ? h('p', { class: 'small-p' }, badge('interpretation'), ' 靈意註解：', h('span', { class: 'q' }, st.ctSpirit)) : null,
        h('p', { class: 'fine' }, '出處：CT（ccbiblestudy 逐節註解）民數記33。靈意是屬靈的解讀，不是經文的意思。'))
      : null,

    h('h4', { class: 'sub' }, '知識庫的地點條目'),
    st.entry && def
      ? h('div', null,
        h('p', { class: 'small-p def' }, ...def.split('\n').map((p, i) => (i ? [h('br'), p] : p)).flat()),
        h('p', { class: 'fine' }, `知識庫條目「${st.entry}」的定義（節錄）。`, ' ',
          h('a', { href: entryUrl(st.entry), target: '_blank', rel: 'noopener' }, '查看完整條目（另開網頁）')))
      : h('p', { class: 'small-p muted' }, badge('not_stated'), st.key === 'moab' ? '' : ' 知識庫還沒有這個地名的條目；它只出現在民數記 33 章的清單裡。'),

    h('div', { class: 'panel-foot' },
      h('button', { class: 'panel-close', type: 'button', onclick: () => store.selectStation(null) }, svg(ICONS.x), '回到總覽'),
      copyLink(n)),
  );
}

function copyLink(n: number): HTMLElement {
  const label = h('span', null, '複製連結');
  const b = h('button', { class: 'panel-close', type: 'button', title: '複製直接開到這一站的網址' }, svg(ICONS.link), label);
  b.addEventListener('click', async () => {
    const url = `${location.href.split('#')[0]}#s${n}`;
    try {
      await navigator.clipboard.writeText(url);
      label.textContent = '已複製';
    } catch {
      history.replaceState(null, '', `#s${n}`);
      label.textContent = '網址列已換成這一站的連結';
    }
    setTimeout(() => { label.textContent = '複製連結'; }, 2200);
  });
  return b;
}

export function createStationCard(): { el: HTMLElement } {
  // 整張卡很長，不設 aria-live；另用一行隱藏文字告訴螢幕閱讀器選到了哪一站
  const live = h('p', { class: 'sr-only', 'aria-live': 'polite' });
  const body = h('div');
  const el = h('aside', { class: 'card station-card', 'aria-label': '這一站的資料' }, live, body);
  let key = '';
  const render = (st: Readonly<store.State>) => {
    const k = String(st.sel);
    if (k !== key) {
      key = k;
      live.textContent = st.sel ? `已選：第${st.sel}站 ${station(st.sel).name}` : '';
      fill(body, st.sel === null ? overview() : stationCard(st.sel));
      // 換一張卡：淡入，並回到最上面（播放時一站換一張，才不會突然閃一下）
      el.scrollTop = 0;
      body.classList.remove('fade-in');
      void body.offsetWidth;
      body.classList.add('fade-in');
    }
    // 候選地點的高亮
    body.querySelectorAll<HTMLElement>('.cand-table tbody tr').forEach((tr) => {
      tr.classList.toggle('hot', !!st.cand && st.sel === st.cand.n && +tr.dataset.i! === st.cand.i);
    });
  };
  // 選了一站不會捲動頁面：卡片看不到時，由 peek.ts 在原地開一張小卡
  store.subscribe((st) => render(st));
  render(store.get());
  return { el };
}
