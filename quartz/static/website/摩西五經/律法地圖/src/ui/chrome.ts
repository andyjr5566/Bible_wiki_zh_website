import { store } from '../store';
import { fill, h } from './dom';
import { startCoach } from './coach';
import { ribbon } from './ribbon';
import { searchBox } from './searchbox';

/** 頂列：站名、搜尋、關於、深淺色與大字；下面一條細的五經律法帶（首頁不放，首頁有大的）。 */
export function buildChrome(): HTMLElement {
  const prefs = h('div', { class: 'lm-prefs' });
  const renderPrefs = () => fill(prefs,
    h('button', {
      type: 'button', class: 'lm-icon-btn', title: '切換深淺色', 'aria-label': `深淺色：${store.theme === 'auto' ? '跟著系統' : store.theme === 'dark' ? '深色' : '淺色'}`,
      onclick: () => store.setTheme(store.theme === 'auto' ? 'dark' : store.theme === 'dark' ? 'light' : 'auto'),
    }, store.theme === 'auto' ? '◐' : store.theme === 'dark' ? '●' : '○'),
    h('button', { type: 'button', class: 'lm-icon-btn', 'aria-pressed': String(store.big), title: '字放大', onclick: () => store.setBig(!store.big) }, '大'));
  store.on('prefs', renderPrefs);
  renderPrefs();

  return h('header', { class: 'lm-top' },
    h('div', { class: 'lm-top-row' },
      h('a', { class: 'lm-brand', href: '#/' }, h('span', { class: 'lm-brand-mark', 'aria-hidden': 'true' }), '摩西五經的律法'),
      searchBox(false),
      h('nav', { class: 'lm-top-nav' }, h('button', { type: 'button', class: 'lm-top-guide', onclick: () => startCoach() }, '新手教學'), h('a', { href: '#/about' }, '關於')),
      prefs),
    h('div', { class: 'lm-top-rib' }, ribbon('slim')));
}
