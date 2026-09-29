import { DEBATES } from '../data/debates';
import { VOICES } from '../data/voices';
import type { VoiceTopic } from '../data/voices';
import { fill, h } from './dom';
import { badge, factLine, interpHeading, voiceBlock } from './evidence';

const TOPIC_TITLE: Record<VoiceTopic, string> = {
  east: '東邊・猶大營',
  south: '南邊・流便營',
  west: '西邊・以法蓮營',
  north: '北邊・但營',
  banner: '纛與旗號',
  center: '中間：會幕與利未營',
  cross: '十字與聖城',
  mother: '為什麼這樣分組',
  order: '行軍次序',
  trumpet: '銀號',
  levites: '利未三族的分工',
  count: '數字的意思',
};

const TOPICS = Object.keys(TOPIC_TITLE) as VoiceTopic[];

/** 05 註釋家怎麼讀 */
export function mountVoices(host: HTMLElement) {
  let cur: VoiceTopic = 'east';
  const tabs = h('div', { class: 'tabs', role: 'tablist', 'aria-label': '註釋家的讀法：主題' });
  const body = h('div', { class: 'voice-body', role: 'tabpanel' });
  const render = () => {
    fill(tabs, ...TOPICS.map((t) => h('button', {
      class: 'tab', type: 'button', role: 'tab', 'aria-selected': String(t === cur),
      onclick: () => { cur = t; render(); },
    }, TOPIC_TITLE[t])));
    fill(body,
      h('div', { class: 'voice-head' }, h('h3', null, TOPIC_TITLE[cur]), badge('interpretation')),
      h('div', { class: 'voice-grid' }, ...VOICES[cur].map(voiceBlock)));
  };
  render();
  host.append(
    h('div', { class: 'card pad' },
      h('p', { class: 'muted' }, '下面的話取自本庫《民數記》第 2、3、10 章主檔的「本章整理」。有引號的是註釋家原話，沒有引號的是主檔的轉述。四套註釋：CT、GT（ccbiblestudy）、KC（KingComments）、BH（BibleHub Study）。'),
      tabs, body));
}

/** 06 經文沒說的事 */
export function mountUnsaid(host: HTMLElement) {
  host.append(h('div', { class: 'deb-grid' }, ...DEBATES.map((d) => h('article', { class: 'card pad deb', id: `deb-${d.id}` },
    h('h3', null, d.title),
    h('p', { class: 'ask' }, d.ask),
    h('ul', { class: 'facts' }, ...d.facts.map((f) => h('li', null, factLine(f)))),
    d.voices.length ? h('div', null, interpHeading(), ...d.voices.map(voiceBlock)) : null,
    d.shown ? h('p', { class: 'shown' }, h('b', null, '畫面說明：'), d.shown) : null))));
}
