import './styles.css';
import { bookByAbbr, groupById, lawById, topicById } from './data/db';
import { parse, type Route } from './router';
import { store } from './store';
import { buildChrome } from './ui/chrome';
import { coachSync, offerCoach } from './ui/coach';
import { fill, h } from './ui/dom';
import { setRibbonBase } from './ui/ribbon';
import { aboutView } from './views/about';
import { bookView, refView } from './views/book';
import { compareView } from './views/compare';
import { entryView } from './views/entry';
import { homeView } from './views/home';
import { lawView } from './views/law';
import { topicView } from './views/topic';
import { tourView } from './views/tour';

const VIEWS: Record<string, (r: Route) => HTMLElement> = {
  '': homeView,
  topic: topicView,
  law: lawView,
  compare: compareView,
  book: bookView,
  ref: refView,
  entry: entryView,
  tour: tourView,
  about: aboutView,
};

/** 分頁標題 */
function pageTitle(r: Route): string {
  const p = r.params[0] ?? '';
  switch (r.name) {
    case 'law': return lawById.get(p)?.title ?? p;
    case 'topic': return topicById.get(p)?.plain ?? groupById.get(p)?.name ?? p;
    case 'entry': return p;
    case 'book': return bookByAbbr.get(p)?.name ?? p;
    case 'ref': return p;
    case 'tour': return '照順序讀';
    case 'compare': return '並排看';
    case 'about': return '關於';
    default: return '';
  }
}

function applyPrefs() {
  const root = document.documentElement;
  if (store.theme === 'auto') delete root.dataset.theme;
  else root.dataset.theme = store.theme;
  root.dataset.big = String(store.big);
}

const app = document.getElementById('app')!;
const main = h('main', { class: 'lm-main', id: 'main', tabindex: '-1' });
// 網址的 # 給路由用，所以「跳到內容」不能用 #main，改成直接把焦點移過去
const skip = h('a', { class: 'lm-skip', href: '#/', onclick: (e: MouseEvent) => { e.preventDefault(); main.focus(); } }, '跳到內容');
fill(app, skip, buildChrome(), main);

function render() {
  const r = parse();
  document.documentElement.dataset.route = r.name || 'home';
  setRibbonBase(null);
  const view = VIEWS[r.name] ?? homeView;
  fill(main, view(r));
  const t = pageTitle(r);
  document.title = t ? `${t}｜摩西五經的律法` : '摩西五經的律法';
  // 換頁一律回到頂端（只有換頁時；頁內打開收合區塊不會捲動）
  window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  coachSync();
}

window.addEventListener('hashchange', render);
store.on('prefs', applyPrefs);
applyPrefs();
render();
offerCoach(!parse().name);
