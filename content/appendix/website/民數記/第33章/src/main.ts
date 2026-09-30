import './styles.css';
import './journey.css';
import { parseHash } from './deeplink';
import { STATIONS } from './data/stations';
import { SITE_SOURCES } from './data/sites';
import { H, POSITIONS, W, landPaths } from './geo';
import * as store from './store';
import { emit, h, motionOff, svg } from './ui/dom';
import { badge } from './ui/evidence';
import { ICONS } from './ui/icons';
import { createJourneyMap } from './ui/journeymap';
import { STATUS_HELP } from './ui/meta';
import { reveal, smoothScrollTo } from './ui/motion';
import { closePeek, initPeek } from './ui/peek';
import { initPlayback } from './ui/playback';
import * as playhead from './ui/playhead';
import { createPlayer } from './ui/player';
import { revealMap } from './ui/reveal';
import { mountCompare, mountCrossing, mountPatterns, mountUnsaid } from './ui/sections';
import { mountQuiz } from './ui/quiz';
import { createStationCard } from './ui/stationcard';
import { createLeftPane } from './ui/stationlist';
import { createTimeline } from './ui/timeline';

/* ------------------------------------------------------------ 使用者設定（只存在這台裝置） */
const root = document.documentElement;
const settings = {
  get(k: string) {
    try { return localStorage.getItem(`num-journey:${k}`); } catch { return null; }
  },
  set(k: string, v: string) {
    try { localStorage.setItem(`num-journey:${k}`, v); } catch { /* 私密模式等情況，不保存也能用 */ }
  },
};
for (const k of ['theme', 'big', 'motion', 'interp']) {
  const v = settings.get(k);
  if (v) root.dataset[k] = v;
}

function toolButton(icon: string, label: string, pressed: () => boolean, toggle: () => void) {
  const b = h('button', { class: 'iconbtn', type: 'button', title: label, 'aria-label': label, 'aria-pressed': String(pressed()) }, svg(ICONS[icon]));
  b.addEventListener('click', () => {
    toggle();
    b.setAttribute('aria-pressed', String(pressed()));
  });
  return b;
}

const isDark = () => root.dataset.theme === 'dark' || (!root.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
const tools = h('div', { class: 'tools' },
  toolButton('moon', '深色模式', isDark, () => { root.dataset.theme = isDark() ? 'light' : 'dark'; settings.set('theme', root.dataset.theme); }),
  toolButton('text', '大字模式', () => root.dataset.big === '1', () => { root.dataset.big = root.dataset.big === '1' ? '0' : '1'; settings.set('big', root.dataset.big); }),
  toolButton('motion', '減少動態：播放時走動的人一站一站跳，鏡頭不滑動', () => root.dataset.motion === 'off', () => {
    root.dataset.motion = root.dataset.motion === 'off' ? 'on' : 'off';
    settings.set('motion', root.dataset.motion);
    emit('motion', root.dataset.motion === 'off');
  }),
  toolButton('eye', '顯示註釋家的解讀', () => root.dataset.interp !== 'off', () => {
    root.dataset.interp = root.dataset.interp === 'off' ? 'on' : 'off';
    settings.set('interp', root.dataset.interp);
  }),
);

const SECTIONS = [
  { id: 'journey', num: '01', title: '旅程地圖', short: '地圖',
    lede: '四十二站，一站接一站。點地圖上的站，或左邊的清單，看這一站的經文、位置、發生的事；按「開始走」，看走動的人怎麼一站一站往前。' },
  { id: 'time', num: '02', title: '十一天的路，走了四十年', short: '時間',
    lede: '前十二站只花了約三個月，中間隔著三十八年，最後九站在第四十年。把它畫成比例，就看得見時間都用在哪裡。' },
  { id: 'compare', num: '03', title: '同一段路，三份記錄', short: '對照',
    lede: '民33、民20–22、申10:6-7 走的是同一段路，站名和次序卻不完全一樣。' },
  { id: 'pattern', num: '04', title: '六程七站，和三段', short: '分段',
    lede: '四十二站不是經文自己分段的。CT 切成三段，GT 串珠排成六程、每程七站，還指出幾組整齊的對應。' },
  { id: 'unsaid', num: '05', title: '清單沒說的事', short: '沒說的',
    lede: '過海在哪裡、西乃山在哪裡、三十八年是哪幾站……清單和經文都沒有交代的地方，列出的是經文原話與各家讀法，網站不下結論。' },
  { id: 'crossing', num: '06', title: '清單之後：過河之前', short: '過河',
    lede: '民33:50-56 是清單寫完之後、在摩押平原說的話。' },
  { id: 'quiz', num: '07', title: '小測驗', short: '測驗',
    lede: '試試看：誰先誰後？這件事在哪一站？' },
];

const nav = h('nav', { class: 'nav', 'aria-label': '章節' }, ...SECTIONS.map((s) => h('a', { href: `#${s.id}` }, s.short)), h('a', { href: '#about' }, '關於'));
const brand = h('a', { class: 'brand', href: '#top' }, svg(ICONS.map), h('span', null, '曠野四十二站'));
const topbar = h('header', { class: 'topbar' }, h('div', { class: 'wrap' }, brand, nav, tools));

/* ------------------------------------------------------------ 開場：整條路線的小圖 */
const heroPts = [1, 12, 33, 42].map((n) => ({ n, p: POSITIONS[n - 1], name: STATIONS[n - 1].name }));
const heroLabels: Record<number, [number, number, string]> = { 1: [16, -16, 'start'], 12: [-16, 6, 'end'], 33: [-18, 14, 'end'], 42: [-14, -16, 'end'] };
const heroRoute = `M${POSITIONS.map((p) => `${p.x.toFixed(0)} ${p.y.toFixed(0)}`).join('L')}`;
const heroArt = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="從埃及蘭塞，經西乃、加低斯，到約但河東岸摩押平原的路線示意圖">
  <g class="hero-land">${landPaths().map((d) => `<path d="${d}" fill-rule="evenodd"/>`).join('')}</g>
  <path class="hero-route" d="${heroRoute}"/>
  ${motionOff() ? '' : `<circle class="hero-walker" r="13"><animateMotion dur="18s" repeatCount="indefinite" path="${heroRoute}"/></circle>`}
  ${heroPts.map(({ n, p, name }) => {
    const [dx, dy, anchor] = heroLabels[n];
    return `<circle class="hero-dot" cx="${p.x.toFixed(0)}" cy="${p.y.toFixed(0)}" r="9"/><text class="hero-label" x="${(p.x + dx).toFixed(0)}" y="${(p.y + dy).toFixed(0)}" text-anchor="${anchor}">${n} ${name}</text>`;
  }).join('')}
</svg>`;

const hero = h('section', { class: 'hero', id: 'top', 'aria-label': '開始' }, h('div', { class: 'wrap' },
  h('div', null,
    h('h1', null, '曠野四十二站'),
    h('p', { class: 'epi' }, '「', h('span', null, '摩西遵著耶和華的吩咐記載他們所行的路程。'), '」 ', h('span', { class: 'epi-ref' }, '民33:2')),
    h('p', { class: 'lede' }, '民數記 33 章把以色列人從蘭塞到摩押平原的路，一站一站記了下來：四十二個站口，大多數只有名字。這個網站把它們放上地圖，也把「經文沒說的事」老實標出來。'),
    h('div', { class: 'hero-stats' },
      h('div', null, h('b', null, '42'), h('span', null, '個站口（蘭塞到摩押平原）')),
      h('div', null, h('b', null, '11 天'), h('span', null, '從何烈山到加低斯巴尼亞的路程（申1:2）')),
      h('div', null, h('b', null, '38 年'), h('span', null, '離開加低斯巴尼亞到過撒烈溪（申2:14）'))),
    h('div', { class: 'hero-cta' },
      h('a', { class: 'btn primary', href: '#journey' }, svg(ICONS.map), '看旅程地圖'),
      h('button', { class: 'btn', type: 'button', onclick: () => {
        store.set({ playing: true, follow: true, at: 1, sel: 1 });
        const el = document.getElementById('journey');
        if (el) smoothScrollTo(el.getBoundingClientRect().top + scrollY - 64, 700);
      } }, svg(ICONS.play), '開始走'))),
  h('div', { class: 'hero-art', html: heroArt })));

/* ------------------------------------------------------------ 各區骨架 */
const main = h('main');
const blocks: Record<string, HTMLElement> = {};
for (const s of SECTIONS) {
  const body = h('div');
  blocks[s.id] = body;
  main.append(h('section', { class: 'block', id: s.id, 'aria-labelledby': `${s.id}-h` }, h('div', { class: 'wrap' },
    h('div', { class: 'sec-head' }, h('div', { class: 'sec-num' }, s.num), h('h2', { id: `${s.id}-h` }, s.title), h('p', null, s.lede)),
    body)));
}

/* ------------------------------------------------------------ 01 旅程地圖 */
{
  const map = createJourneyMap();
  initPlayback(); // 地圖先訂閱 store 再接播放，順序不影響，但要在任何操作之前
  initPeek(); // 內容區點地名：頁面不動，在原地開一張小卡
  const card = createStationCard();
  const left = createLeftPane();
  const layers = h('div', { class: 'layer-bar' },
    h('span', { class: 'muted' }, '圖上顯示：'),
    ...([['candidates', '其他候選地點'], ['labels', '全部站名'], ['events', '事件圖示']] as const).map(([k, label]) => {
      const b = h('button', { class: 'chipbtn', type: 'button', 'aria-pressed': String(store.get().layers[k]), onclick: () => store.setLayer(k, !store.get().layers[k]) }, label);
      store.subscribe((st) => b.setAttribute('aria-pressed', String(st.layers[k])));
      return b;
    }));
  // 事件圖示只影響左欄的清單，由 CSS 依 class 切換
  store.subscribe((st) => blocks.journey.classList.toggle('hide-events', !st.layers.events));
  blocks.journey.append(
    h('div', { class: 'journey' },
      h('div', { class: 'jl-player' }, createPlayer(), layers),
      h('div', { class: 'jl-left' }, left),
      h('div', { class: 'jl-right' }, map.el, card.el)),
    h('p', { class: 'shown' }, h('b', null, '畫面說明：'),
      '經文只給站名，沒有給座標。地圖是現代地形；每一站的位置是現代的候選地點，可信度是 OpenBible 的綜合分數，都只是示意。三十八年那一段大多數站的位置不明，圖上依前後站畫在路線上。'));
}

/* ------------------------------------------------------------ 02–07 */
blocks.time.append(h('div', { class: 'card pad' }, createTimeline()));
mountCompare(blocks.compare);
mountPatterns(blocks.pattern);
mountUnsaid(blocks.unsaid);
mountCrossing(blocks.crossing);
mountQuiz(blocks.quiz);

/* ------------------------------------------------------------ 關於 */
const ob = SITE_SOURCES.openbible;
const ne = SITE_SOURCES.naturalEarth;
const about = h('section', { class: 'block', id: 'about', 'aria-labelledby': 'about-h' }, h('div', { class: 'wrap' },
  h('div', { class: 'sec-head' }, h('div', { class: 'sec-num' }, '08'), h('h2', { id: 'about-h' }, '這個網站怎麼做的'),
    h('p', null, '每一句話都標了它的根據。看到標籤，就知道那句話是經文寫的，還是整理出來的，或是註釋家的讀法。')),
  h('div', { class: 'about-grid' },
    h('div', { class: 'card' }, h('h3', null, '四種標籤'), h('div', { class: 'evlist' },
      ...(['explicit', 'synthesis', 'interpretation', 'not_stated'] as const).map((st) => h('div', null, badge(st), ' ', STATUS_HELP[st])))),
    h('div', { class: 'card' }, h('h3', null, '資料從哪裡來'),
      h('p', null, '經文：和合本，取自本知識庫的 raw_scripture。點任何經節（例如 民33:8）都會顯示原文，引號裡的摘句會標出來。'),
      h('p', null, '註釋家的讀法：取自本庫《民數記》33 章主檔的「本章整理」、地點與解經爭議條目，以及 CT、GT（ccbiblestudy 的兩套）、KC（KingComments）、BH（BibleHub Study）的來源檔。每一段引句都標出處。'),
      h('p', null, '地圖說明：信望愛聖經地圖〈民圖五〉出埃及和進迦南的旅程（只引它的說明文字，沒有使用它的圖片）。')),
    h('div', { class: 'card' }, h('h3', null, '位置從哪裡來'),
      h('p', null, '經文沒有座標。每一站的候選現代地點與分數，取自 ', h('a', { href: ob.url, rel: 'noopener' }, ob.name), `（${ob.license}）；本站只取了其中與這四十二站有關的資料，並標示候選的分數與種類。`),
      h('p', null, '分數是 OpenBible 的綜合分數（網友投票加路線時間一致性），只表示各候選之間的相對可信度。三十八年那一段大多數站的位置本來就不明。'),
      h('p', null, '三十八年那一段（第 16–31 站）的位置多半無法確定，候選又分散。所以每一站畫在可信候選的中間值（依分數加權，分數低於最高分 35% 的不計入），一個很淡的圈圈出候選散布的範圍；站牌外的淡虛線環表示「只是可能在這一帶」。選到或走到那一站時，才會浮現它自己的圈和圈裡的候選點。'),
      h('p', null, '底圖：', h('a', { href: ne.url, rel: 'noopener' }, ne.name), `（${ne.license}）的海岸線、湖與河，是現代地形，不是三千多年前的樣子；蘇伊士運河等現代工程不在圖上。`)),
    h('div', { class: 'card' }, h('h3', null, '哪些是示意'),
      h('p', null, '所有座標、路線的走法、西乃山與過海地點的預設選擇、地區名稱的位置，都只是示意；三十八年那一段的站更只是候選的中間值。'),
      h('p', null, '時間軸上只有幾站的日期是經文給的，其他站在兩個日期之間平均分配；三十八年裡每一站停多久，經文沒有寫。'),
      h('p', null, '走動的人與雲柱只是示意（民9:15-23：雲彩收上去，他們就起行）。')),
    h('div', { class: 'card' }, h('h3', null, '動態與無障礙'),
      h('p', null, '「開始走」是你按了才有的動作，所以就算作業系統設定了「減少動態」，走動的人還是會沿著路線移動、鏡頭還是會跟著滑；只有裝飾性的動畫（雲柱浮動、到站的漣漪、開場小圖的光點）會停用。'),
      h('p', null, '頂列的「減少動態」按鈕可以把播放也關掉：走動的人一站一站跳，鏡頭不滑動。'),
      h('p', null, '地圖上的站可以用 Tab 鍵選、Enter 打開；左欄的清單、經文和時間軸也都可以只用鍵盤操作。')),
    h('div', { class: 'card' }, h('h3', null, '同一系列'),
      h('p', null, '營地與行軍的細節，在同一套做法的另一個網站：'),
      h('p', null, h('a', { href: '../../第2章/dist/index.html' },'環繞會幕：民數記 2 章（十二支派與拔營）')),
      h('p', null, h('a', { href: '../../../出埃及記/第25章/dist/index.html' }, '照山上的樣式：出埃及記 25–27 章')),
      h('p', null, h('a', { href: '../../../利未記/第1章/dist/index.html' }, '會幕前的一天：利未記 1–9 章'))),
    h('div', { class: 'card' }, h('h3', null, '自動檢查'),
      h('p', null, '網站建置前會自動比對：站序由經文「從 X 起行」逐節推出，必須剛好是 42 站；每一段引號裡的經文都必須逐字出現在所引的經節；每一句註釋家與地圖說明的原話都必須逐字出現在出處檔；CT 的字義與靈意逐字對來源檔；位置可信度由分數機械推出。對不上，網站就不會建置。')),
  ),
));
main.append(about);
const footer = h('footer', null, h('div', { class: 'wrap' },
  '非商業的研經教材。經文引自和合本。',
  h('br'), '曠野四十二站・民數記 33 章互動旅程地圖',
  h('br'), `地理資料：${ob.name}（${ob.license}）；${ne.name}（${ne.license}）。`));

document.body.prepend(topbar, hero, main, footer);

// 各區的卡片捲進畫面時浮上來
reveal(document.querySelectorAll('.cmp-block, .pattern-layout > *, .deb-grid > *, .quiz-grid > *, .about-grid > *, .crossing'));

// 目前讀到哪一區
const links = [...nav.querySelectorAll('a')];
const io = new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting) links.forEach((a) => a.setAttribute('aria-current', String(a.hash === `#${e.target.id}`)));
}, { rootMargin: '-45% 0px -50% 0px' });
document.querySelectorAll('section[id]').forEach((s) => io.observe(s));

// 可分享的網址：#s12、#time、#text、#gt、#play
function applyHash() {
  const patch = parseHash(location.hash);
  if (!patch) return;
  store.set(patch);
  if (patch.sel !== undefined && patch.sel !== null || patch.playing) {
    closePeek(); // 帶站號的網址是一進來就帶到地圖，用不著小卡
    requestAnimationFrame(revealMap);
  }
}
applyHash();
// 一打開就帶著直達連結時，走動的人直接在那一站，不做「從第 1 站走過去」的動畫
playhead.jump(store.get().at);
addEventListener('hashchange', applyHash);

// 除錯：__num33.go(12) 直接到第 12 站；__num33.play(true) 開始走
Object.assign(window, {
  __num33: {
    store,
    playhead,
    go: (n: number) => store.selectStation(n),
    play: (on = true) => store.set({ playing: on }),
  },
});
