import { TOPICS, TOPIC_BY_ID, type Side, type Topic } from '../data/topics';
import type { ChapterNo } from '../data/overview';
import type { SceneId } from '../data/story';
import { fill, h, on } from './dom';
import { factLine, voiceBlock } from './evidence';
import { kicker, sceneHref, sceneNav } from './shell';

const CHAPTERS: ChapterNo[] = [11, 12, 13, 14, 15];

function sideCard(s: Side): HTMLElement {
  return h('section', { class: 'side card' }, h('h3', null, s.label), ...s.voices.map(voiceBlock));
}

function topicView(t: Topic): HTMLElement {
  return h('article', { class: `topic ch-${t.ch}` },
    h('header', { class: 'topic-head' }, h('span', { class: `tl-tag ch-${t.ch}` }, `${t.ch} 章`), h('h2', null, t.title)),
    h('p', { class: 'topic-ask' }, t.ask),
    h('div', { class: 'topic-text card' }, h('small', null, '經文怎麼說'), h('p', null, factLine(t.text, { quote: true }))),
    h('div', { class: 'sides' }, ...t.sides.map(sideCard)),
    t.common ? h('p', { class: 'topic-common' }, h('b', null, '共通的地方　'), t.common) : null,
    h('a', { class: 'topic-back', href: sceneHref(`c${t.ch}` as SceneId) }, `回到第 ${t.ch} 章`));
}

/** 網址 #/voices/girl 可以直接打開某一題 */
const topicFromHash = () => TOPIC_BY_ID[location.hash.replace(/^#\/?/, '').split('/')[1] ?? ''];

export function buildVoices(): HTMLElement {
  let chapter: 'all' | ChapterNo = 'all';
  let cur: Topic = topicFromHash() ?? TOPICS[0];
  const panel = h('div', { class: 'vc-panel', 'aria-live': 'polite' });
  const list = h('ul', { class: 'topic-list' });
  const tabs = h('div', { class: 'vc-tabs', role: 'group', 'aria-label': '依章篩選' });
  const pickSummary = h('summary', null);
  const pick = h('details', { class: 'topic-pick' }, pickSummary, list);
  if (matchMedia('(min-width: 901px)').matches) pick.open = true;

  function show(t: Topic, fromHash = false) {
    cur = t;
    if (chapter !== 'all' && chapter !== t.ch) chapter = 'all';
    fill(panel, topicView(t));
    renderList();
    if (!fromHash) history.replaceState(null, '', `#/voices/${t.id}`);
  }

  function renderList() {
    const shown = TOPICS.filter((t) => chapter === 'all' || t.ch === chapter);
    fill(list, ...shown.map((t) => h('li', null, h('button', {
      type: 'button', class: `topic-btn ch-${t.ch}`, 'aria-pressed': String(t === cur),
      onclick: () => { show(t); if (!matchMedia('(min-width: 901px)').matches) pick.open = false; },
    }, h('span', { class: 'tl-ch' }, String(t.ch)), t.title))));
    fill(pickSummary, h('small', null, `共 ${TOPICS.length} 題`), h('b', null, cur.title));
    fill(tabs, ...(['all', ...CHAPTERS] as const).map((c) => h('button', {
      type: 'button', class: 'opt', 'aria-pressed': String(c === chapter),
      onclick: () => { chapter = c; renderList(); },
    }, c === 'all' ? '全部' : `${c} 章`)));
  }

  show(cur, true);
  // 從別的幕進來，或在這一幕按上一頁、改網址：跟著網址換題
  const follow = () => {
    if (!location.hash.startsWith('#/voices')) return;
    const t = topicFromHash();
    if (t && t !== cur) show(t, true);
  };
  on('scene', (id: string) => id === 'voices' && follow());
  addEventListener('hashchange', follow);

  return h('article', { class: 'scene', style: '--c:var(--ev-interp)' },
    h('div', { class: 'wrap' },
      h('header', { class: 'scene-head' },
        h('div', { class: 'kicker' }, kicker('voices')),
        h('h1', null, '各家怎麼讀'),
        h('p', { class: 'lede' }, '前面五幕裡，來源說法不一樣的地方，集中在這裡，一題一題並排。每一題先看經文自己怎麼說，再看各家怎麼讀。這裡不替誰選答案；經文沒有說的，標明「經文沒說」。'))),
    h('div', { class: 'wrap' },
      h('div', { class: 'vc' },
        h('aside', { class: 'vc-side' }, tabs, pick),
        panel),
      sceneNav('voices')));
}
