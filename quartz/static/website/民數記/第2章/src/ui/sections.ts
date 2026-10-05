import './sections.css';
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

/** 註釋家怎麼讀：左邊選主題，右邊 CT、GT、KC、BH 四欄並排 */
export function mountVoices(host: HTMLElement) {
  let cur: VoiceTopic = 'east';
  const tabs = h('div', { class: 'vx-topics', role: 'tablist', 'aria-label': '註釋家的讀法：主題', 'aria-orientation': 'vertical' });
  const body = h('div', { class: 'vx-panel', role: 'tabpanel', tabindex: 0 });
  const families = ['CT', 'GT', 'KC', 'BH'] as const;

  const render = () => {
    fill(tabs, ...TOPICS.map((t, index) => h('button', {
      class: `vx-tab${t === cur ? ' vx-selected' : ''}`,
      type: 'button',
      role: 'tab',
      id: `vx-tab-${t}`,
      'aria-controls': 'vx-voice-panel',
      'aria-selected': String(t === cur),
      tabindex: t === cur ? 0 : -1,
      onclick: () => { cur = t; render(); tabs.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus(); },
      onkeydown: (e: KeyboardEvent) => {
        let next = index;
        if (e.key === 'ArrowDown') next = (index + 1) % TOPICS.length;
        else if (e.key === 'ArrowUp') next = (index - 1 + TOPICS.length) % TOPICS.length;
        else if (e.key === 'Home') next = 0;
        else if (e.key === 'End') next = TOPICS.length - 1;
        else return;
        e.preventDefault();
        cur = TOPICS[next];
        render();
        tabs.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next].focus();
      },
    }, TOPIC_TITLE[t])));
    body.id = 'vx-voice-panel';
    body.setAttribute('aria-labelledby', `vx-tab-${cur}`);
    fill(body,
      h('div', { class: 'vx-heading' }, h('h3', null, TOPIC_TITLE[cur]), badge('interpretation')),
      h('div', { class: 'vx-grid' }, ...families.map((family) => {
        const voices = VOICES[cur].filter((voice) => voice.who.startsWith(family));
        const entries = voices.length ? voices.map((voice) => h('div', { class: 'vx-entry interp-layer' },
          // 欄名已經是 CT／KC／BH 時不重複；GT 底下各書名、人名照列
          voice.who !== family ? h('div', { class: 'vx-who' }, voice.who) : null,
          h('p', { class: 'vx-says' }, voice.says),
          voice.quote ? h('blockquote', { class: 'vx-quote' }, h('span', { class: 'q' }, voice.quote)) : null,
        )) : [h('p', { class: 'vx-empty-text' }, '這個主題沒有收錄這套註釋的讀法。')];
        return h('div', { class: `vx-cell${voices.length ? '' : ' vx-empty'}` },
          h('div', { class: 'vx-code' }, family),
          ...entries,
        );
      })),
    );
  };
  render();
  host.append(h('div', { class: 'vx' },
    h('p', { class: 'vx-intro muted' }, '下面的話取自本庫《民數記》第 2、3、10 章主檔的「本章整理」。有引號的是註釋家原話，沒有引號的是主檔的轉述。四套註釋：CT、GT（ccbiblestudy）、KC（KingComments）、BH（BibleHub Study）。'),
    h('div', { class: 'vx-layout' }, tabs, body),
  ));
}

/** 經文沒說的事：寬螢幕左邊問題、右邊詳情；窄螢幕是可展開的清單 */
export function mountUnsaid(host: HTMLElement) {
  let cur = DEBATES.findIndex((d) => `#deb-${d.id}` === location.hash);
  if (cur < 0) cur = 0;
  const tabs = h('ol', { class: 'ux-list', role: 'tablist', 'aria-orientation': 'vertical', 'aria-label': '經文沒說的事：問題' });
  const detail = h('article', { class: 'ux-detail', role: 'tabpanel' });
  const renderDetail = () => {
    const d = DEBATES[cur];
    detail.id = `deb-${d.id}`;
    detail.setAttribute('aria-labelledby', `ux-tab-${d.id}`);
    fill(detail,
      h('h3', null, d.title),
      h('p', { class: 'ask' }, d.ask),
      h('ul', { class: 'facts' }, ...d.facts.map((f) => h('li', null, factLine(f)))),
      d.voices.length ? h('div', { class: 'ux-interpretation interp-layer' }, interpHeading(), ...d.voices.map(voiceBlock)) : null,
      d.shown ? h('p', { class: 'shown' }, h('b', null, '畫面說明：'), d.shown) : null,
    );
  };
  fill(tabs, ...DEBATES.map((d, index) => h('li', { class: 'ux-row' }, h('button', {
    class: `ux-tab${index === cur ? ' ux-selected' : ''}`,
    type: 'button',
    role: 'tab',
    id: `ux-tab-${d.id}`,
    'aria-controls': `deb-${DEBATES[cur].id}`,
    'aria-selected': String(index === cur),
    tabindex: index === cur ? 0 : -1,
    onclick: () => { cur = index; render(); },
    onkeydown: (e: KeyboardEvent) => {
      let next = index;
      if (e.key === 'ArrowDown') next = (index + 1) % DEBATES.length;
      else if (e.key === 'ArrowUp') next = (index - 1 + DEBATES.length) % DEBATES.length;
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = DEBATES.length - 1;
      else return;
      e.preventDefault();
      cur = next;
      render();
      tabs.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next].focus();
    },
  }, h('span', { class: 'ux-title' }, d.title), h('span', { class: 'ux-ask' }, d.ask)))));
  const render = () => {
    tabs.querySelectorAll<HTMLButtonElement>('[role="tab"]').forEach((tab, index) => {
      const selected = index === cur;
      tab.className = `ux-tab${selected ? ' ux-selected' : ''}`;
      tab.setAttribute('aria-selected', String(selected));
      tab.setAttribute('tabindex', selected ? '0' : '-1');
      tab.setAttribute('aria-controls', `deb-${DEBATES[cur].id}`);
    });
    renderDetail();
  };
  render();

  const mobile = h('div', { class: 'ux-mobile' }, ...DEBATES.map((d, index) => h('details', { class: 'ux-item', open: index === cur },
    h('summary', null, h('span', { class: 'ux-title' }, d.title), h('span', { class: 'ux-ask' }, d.ask)),
    h('div', { class: 'ux-mobile-detail' },
      h('ul', { class: 'facts' }, ...d.facts.map((f) => h('li', null, factLine(f)))),
      d.voices.length ? h('div', { class: 'ux-interpretation interp-layer' }, interpHeading(), ...d.voices.map(voiceBlock)) : null,
      d.shown ? h('p', { class: 'shown' }, h('b', null, '畫面說明：'), d.shown) : null,
    ),
  )));
  host.append(h('div', { class: 'ux' },
    h('div', { class: 'ux-desktop' }, tabs, detail),
    mobile,
  ));
}
