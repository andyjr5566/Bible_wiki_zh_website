import './styles.css';
import './reading.css';
import { DATA, READING, VERSES, buildGraph, isPlacementNode, loadRoles, loadRoster, loadWall, lookupVerses, makeSyntheticData, pathToFirstAncestor } from './data/model';
import { SPEECH_FIXES } from './data/speech-fixes';
import type { GenealogyData, GenealogyNote, Person } from './data/types';
import { createAges } from './ui/ages';
import { createCanvas, type CanvasApi } from './ui/canvas';
import { createCompare } from './ui/compare';
import { createPersonCard, type PersonCard } from './ui/card';
import { button, h } from './ui/dom';
import { createNotes } from './ui/notes';
import { createToolbar, type LineFilter, type PageId } from './ui/toolbar';
import { createReader } from './ui/reader';
import { createRoles } from './ui/roles';
import { createRoster } from './ui/roster';
import { createSpeech } from './ui/speech';
import { createTour } from './ui/tour';
import { createCatalog } from './ui/catalog';
import { createReturns } from './ui/returns';
import { createTreeStage } from './ui/tree-stage';
import { createWall } from './ui/wall';

const synthetic = import.meta.env.DEV && new URLSearchParams(location.search).get('synthetic') === '1';
const data: GenealogyData = synthetic ? makeSyntheticData() : DATA;
const graph = buildGraph(data);
let line: LineFilter = 'both';
let page: PageId = 'tree';

const app = document.querySelector<HTMLElement>('#app');
if (!app) throw new Error('Missing #app root');
const verseLayer = h('div', { className: 'ag-modal-layer', hidden: true });

const closeDialog = () => { verseLayer.hidden = true; verseLayer.replaceChildren(); };
// 點視窗外的暗處或按 Esc 也能關閉（按下與放開都要在暗處，避免拖曳選字時誤關）
const showDialog = (dialog: HTMLElement) => {
  const scrim = h('div', { className: 'ag-dialog-scrim' }, dialog);
  let pressedOnScrim = false;
  let releasedOnScrim = false;
  scrim.addEventListener('pointerdown', (event) => { pressedOnScrim = event.target === scrim; releasedOnScrim = false; });
  scrim.addEventListener('pointerup', (event) => { releasedOnScrim = event.target === scrim; });
  scrim.addEventListener('click', (event) => { if (pressedOnScrim && releasedOnScrim && event.target === scrim) closeDialog(); });
  verseLayer.hidden = false;
  verseLayer.replaceChildren(scrim);
};
document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !verseLayer.hidden) closeDialog(); });

const openVerse = (ref: string) => {
  const lines = lookupVerses(ref);
  const found = lines.some((line) => line.text);
  const verseBody = !found
    ? h('p', { className: 'ag-empty-state' }, '這節經文暫時沒有收錄。')
    : lines.length === 1
      ? h('p', { className: 'ag-verse-text' }, lines[0]!.text!)
      : h('div', { className: 'ag-verse-list' }, ...lines.map((line) => h('p', { className: 'ag-verse-text' },
        h('span', { className: 'ag-verse-no' }, line.key.replace(/^.*:/, '')), line.text ?? '（這節暫時沒有收錄）')));
  const dialog = h('section', { className: 'ag-verse-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'ag-verse-title' },
    h('div', { className: 'ag-dialog-head' }, h('div', {}, h('p', { className: 'ag-eyebrow' }, '經文全文'), h('h2', { id: 'ag-verse-title' }, ref)),
      button('關閉', closeDialog, 'ag-card-close')),
    verseBody);
  showDialog(dialog);
};

let canvas: CanvasApi;
let card: PersonCard;
let activeCardPerson: Person | null = null;
const selectPerson = (person: Person | null) => {
  if (!person) {
    activeCardPerson = null;
    card.show(null);
    canvas.select(null);
    if (location.hash.startsWith('#p=')) history.replaceState(null, '', `${location.pathname}${location.search}`);
    return;
  }
  page = 'tree';
  applyPage();
  activeCardPerson = person;
  const focusId = focusIdForPerson(person);
  canvas.select(focusId);
  // 先開人物卡，鏡頭才知道卡片蓋住哪裡，把人移到看得到的地方
  card.show(person);
  if (focusId) canvas.focusPerson(focusId, true);
  history.replaceState(null, '', `${location.pathname}${location.search}#p=${encodeURIComponent(person.id)}`);
};

canvas = createCanvas(data, selectPerson, openNote);
card = createPersonCard(data, {
  select: (id) => {
    const person = graph.byId.get(id);
    if (person) selectPerson(person);
  },
  tree: focusTreeTarget,
  verse: openVerse,
  trace: traceToAdam,
  note: openNote,
});

const canvasWrap = h('div', { className: 'ag-canvas-wrap' }, canvas.el,
    h('div', { className: 'ag-canvas-legend-panel' },
      h('div', { className: 'ag-legend' },
        h('span', {}, h('i', { className: 'ag-dot ag-dot-common' }), '共同主線'),
        h('span', {}, h('i', { className: 'ag-dot ag-dot-matthew' }), '馬太'),
        h('span', {}, h('i', { className: 'ag-dot ag-dot-luke' }), '路加'),
        h('span', {}, h('i', { className: 'ag-dot ag-dot-side' }), '旁支'),
        h('span', {}, h('i', { className: 'ag-legend-line ag-legend-list' }), '只列在名單裡')),
      h('div', { className: 'ag-canvas-hint' }, '拖曳移動畫布 · 滾輪縮放 · 觸控可平移與雙指縮放')));
const treePage = h('section', { className: 'ag-workspace ag-page-view', 'data-page': 'tree' }, canvasWrap);
const comparePage = createCompare(data, (id) => {
  const person = graph.byId.get(id);
  if (person) selectPerson(person);
});
const agesPage = createAges(data, VERSES, (id) => {
  const person = graph.byId.get(id);
  if (person) selectPerson(person);
}, openVerse);
const notesPage = createNotes(data, VERSES, (id) => {
  const person = graph.byId.get(id);
  if (person) selectPerson(person);
}, openVerse);
// 大衛立的職位：平常是自己的分頁；讀經時這個元素被借去當舞台（疊在畫布上），讀完再放回來，始終只有一份
const rolesView = createRoles({
  load: loadRoles,
  data,
  reading: READING,
  onTreePerson(id) {
    // 讀經中：換到家譜樹看那個人（停止跟隨、出「回到朗讀處」）；平常：回家譜樹分頁並選取他
    if (reader?.isOpen()) { reader.showOnTree(id); return; }
    const person = graph.byId.get(id);
    if (person) selectPerson(person);
  },
});
const rolesPage = h('section', { className: 'ag-page-view ag-rd-roles-page', 'data-page': 'roles' }, rolesView.el);
// 目錄（最左邊）和「歸回的名單」：點一段就從那裡開始帶你讀
const catalogPage = h('section', { className: 'ag-page-view', 'data-page': 'catalog' },
  createCatalog({ reading: READING, onOpen(start) { reader.open(start); } }));
const returnsView = createReturns({ reading: READING, loadRoster, loadWall, onOpen(start) { reader.open(start); } });
const returnsPage = h('section', { className: 'ag-page-view', 'data-page': 'returns' }, returnsView.el);
const pageNodes = new Map<PageId, HTMLElement>([
  ['catalog', catalogPage], ['tree', treePage], ['compare', comparePage], ['ages', agesPage], ['notes', notesPage], ['roles', rolesPage], ['returns', returnsPage],
]);

function focusTreeTarget(id: string) {
  const target = graph.byId.get(id);
  if (!target) return;
  page = 'tree';
  applyPage();
  canvas.expandFor(id);
  canvas.select(id);
  canvas.focusPerson(id, true);
  if (activeCardPerson) history.replaceState(null, '', `${location.pathname}${location.search}#p=${encodeURIComponent(activeCardPerson.id)}`);
}

// 每個人在大圖上都有自己的節點（經文只列在名單裡的，掛在名單牌子底下）
function focusIdForPerson(person: Person): string | null {
  canvas.expandFor(person.id);
  return canvas.layoutNow().nodes.some((node) => node.id === person.id) ? person.id : null;
}

function applyPage() {
  for (const [id, element] of pageNodes) element.hidden = id !== page;
  if (page === 'roles') rolesView.showPage();
  if (page === 'returns') returnsView.showPage();
  toolbar?.setState();
}

const toolbar = createToolbar(data, {
  selectPerson,
  setPage(id) {
    // 讀經時分頁照常看得到；點分頁就離開讀經、到那一頁
    if (reader.isOpen()) reader.close();
    if (id !== page) {
      activeCardPerson = null;
      card.show(null);
    }
    page = id;
    applyPage();
  },
  setLine(value) { line = value; canvas.setLine(value); },
  restartTour() { reader.close(); page = 'tree'; applyPage(); tour.start(); },
  toggleReading() { if (reader.isOpen()) reader.close(); else reader.open(); },
  isReading: () => reader.isOpen(),
  zoom: (factor) => canvas.zoom(factor),
  fit: () => canvas.fitSpine(true, true),
  getLine: () => line,
  getPage: () => page,
});
const treeStage = createTreeStage(canvas, data, graph, canvasWrap, READING);
// 歸回的名冊：只在讀經時出現（疊在畫布上），平常不在頁面上
const rosterStage = createRoster({
  load: loadRoster,
  reading: READING,
  data,
  graph,
  onTreePerson(id) { reader?.showOnTree(id); },
  onJump(key) { reader?.jumpTo(key); },
});
// 修城牆的人（尼 3）：同樣只在讀經時疊在畫布上
const wallStage = createWall({
  load: loadWall,
  reading: READING,
  onJump(key) { reader?.jumpTo(key); },
  onTreePerson(id) { reader?.showOnTree(id); },
});
const reader = createReader(READING, { tree: treeStage, roles: rolesView, roster: rosterStage, wall: wallStage }, {
  speech: createSpeech({ replacements: SPEECH_FIXES }),
  onOpenChange(open) {
    // 讀經時職位圖借去疊在畫布上；離開讀經就放回分頁
    if (open) canvasWrap.append(rolesView.el, rosterStage.el, wallStage.el);
    else { rolesPage.append(rolesView.el); rosterStage.el.remove(); wallStage.el.remove(); }
    if (open) {
      tour.stop(false);
      page = 'tree';
      applyPage();
      activeCardPerson = null;
      card.show(null);
      canvas.select(null);
    }
    toolbar.setState();
  },
});
// 家譜樹上的職位印：點了到「大衛立的職位」，捲到那個方塊並標亮那個人（讀經時印只是標示，不換頁）
canvas.onRoleSeal((boxId, personId) => {
  if (reader.isOpen()) return;
  activeCardPerson = null;
  card.show(null);
  page = 'roles';
  applyPage();
  void rolesView.ready().then(() => rolesView.focusBox(boxId, personId));
});
const tour = createTour(data, canvas, openVerse, {
  hintRead: (on) => toolbar.hintRead(on),
  showCatalog() { if (page !== 'catalog') { activeCardPerson = null; card.show(null); page = 'catalog'; applyPage(); } },
  showTree() { if (page !== 'tree') { page = 'tree'; applyPage(); } },
});
const main = h('main', { className: 'ag-main' });
for (const element of pageNodes.values()) main.append(element);
main.append(card.el, reader.panel);
canvasWrap.append(reader.stage);
const footer = h('footer', { className: 'ag-footer' },
  h('span', {}, '家譜照經文的記載畫出。'),
  h('span', {}, synthetic ? '合成壓力測試資料' : `${data.persons.length.toLocaleString()} 位人物`));
app.replaceChildren(toolbar.el, main, footer, tour.el, verseLayer);
applyPage();

function applyDeepLink() {
  const hash = location.hash.slice(1);
  if (hash.startsWith('read=')) {
    let ref = '';
    try { ref = decodeURIComponent(hash.slice('read='.length)); } catch { return; }
    tour.stop(false);
    reader.open(ref, false);
    return;
  }
  if (hash.startsWith('p=')) {
    let id = '';
    try { id = decodeURIComponent(hash.slice(2)); } catch { return; }
    const person = graph.byId.get(id);
    if (!person) return;
    tour.stop(false);
    selectPerson(person);
    return;
  }
  if (hash.startsWith('family=')) {
    let id = '';
    try { id = decodeURIComponent(hash.slice('family='.length)); } catch { return; }
    if (!id) return;
    tour.stop(false);
    page = 'tree';
    applyPage();
    activeCardPerson = null;
    card.show(null);
    canvas.expandFamily(id);
  }
}

window.addEventListener('hashchange', applyDeepLink);
requestAnimationFrame(() => {
  if (!location.hash && window.matchMedia('(max-width: 520px)').matches) {
    const first = Object.values(data.spine.lines)[0]?.[0];
    if (first) canvas.focusPerson(first, false);
  }
  requestAnimationFrame(applyDeepLink);
});

function traceToAdam(id: string) {
  const person = graph.byId.get(id);
  if (!person) return;
  const route = pathToFirstAncestor(id, data, graph);
  if (!route) {
    canvas.expandFor(id);
    canvas.setTrace([], []);
    // 往上找他掛在哪一塊名單牌子底下
    let upward = graph.treeParent.get(id);
    while (upward && !isPlacementNode(graph.byId.get(upward))) upward = graph.treeParent.get(upward);
    const holder = upward ? graph.byId.get(upward) : undefined;
    const message = holder?.kind === 'list'
      ? `經文把他列在『${holder.name}』這段名單裡，沒有寫他接在哪一代底下。`
      : !person.parents?.length && !holder
        ? '經文沒有記載他的父母。'
        : '經文沒有記載他和主線的關係。';
    card.setTraceMessage(message, false);
    const focusId = focusIdForPerson(person);
    if (focusId) canvas.focusPerson(focusId, true);
    return;
  }
  const drawingEdges = route.edges.map((edge) => ({
    from: edge.to,
    to: edge.from,
    kind: edge.kind,
  }));
  canvas.setTrace(route.ids, drawingEdges);
  canvas.expandPath(route.ids);
  card.setTraceMessage('', route.hasUnknownGenerations);
  // 路徑可能一路到亞當、上千個單位高：放不下時以他自己所在的位置為準，往上看祖先
  canvas.focusIds(route.ids, true, undefined, id);
}

function openNote(noteId: string) {
  const note = data.notes.find((item) => item.id === noteId);
  if (!note) return;
  showDialog(noteDialog(note));
}

function noteDialog(note: GenealogyNote): HTMLElement {
  const dialog = h('section', { className: 'ag-note-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'ag-note-dialog-title' },
    h('div', { className: 'ag-dialog-head' }, h('div', {}, h('p', { className: 'ag-eyebrow' }, '經文不同的地方'), h('h2', { id: 'ag-note-dialog-title' }, note.title)),
      button('關閉', closeDialog, 'ag-card-close')));
  for (const item of note.scripture ?? []) {
    const text = item.quote ?? VERSES[item.ref] ?? '這節經文暫時沒有收錄。';
    dialog.append(h('blockquote', {}, h('p', {}, `「${text}」`), button(item.ref, () => openVerse(item.ref), 'ag-text-button')));
  }
  if (note.text) dialog.append(h('p', { className: 'ag-note-text' }, note.text));
  for (const view of note.views ?? []) {
    dialog.append(h('section', { className: 'ag-view-card' },
      view.source ? h('h3', {}, String(view.source)) : null,
      view.quote ? h('blockquote', {}, `「${String(view.quote)}」`) : null,
      view.translation ? h('p', {}, String(view.translation)) : null,
      view.paraphrase ? h('p', {}, String(view.paraphrase)) : null,
      view.url ? h('a', { href: String(view.url), target: '_blank', rel: 'noopener noreferrer' }, '查看來源網址') : null));
  }
  const attached = h('div', { className: 'ag-chip-list' });
  for (const id of note.attach ?? []) {
    const person = graph.byId.get(id);
    if (!person) continue;
    attached.append(button(person.name, () => {
      closeDialog();
      selectPerson(person);
    }, 'ag-person-link'));
  }
  if (attached.childElementCount) dialog.append(h('p', {}, '相關人物'), attached);
  return dialog;
}
