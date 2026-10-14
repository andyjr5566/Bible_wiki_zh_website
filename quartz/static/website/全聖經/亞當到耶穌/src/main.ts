import './styles.css';
import { DATA, VERSES, buildGraph, lookupVerses, makeSyntheticData, pathToFirstAncestor } from './data/model';
import type { GenealogyData, GenealogyNote, Person } from './data/types';
import { createAges } from './ui/ages';
import { createCanvas, type CanvasApi } from './ui/canvas';
import { createCompare } from './ui/compare';
import { createPersonCard, type PersonCard } from './ui/card';
import { button, h } from './ui/dom';
import { createNTFamilies } from './ui/ntfamilies';
import { createNotes } from './ui/notes';
import { createToolbar, type LineFilter, type PageId } from './ui/toolbar';
import { createTour } from './ui/tour';
import { createUnconnectedFamilies } from './ui/unconnected';

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
  if (focusId) canvas.focusPerson(focusId, true);
  card.show(person);
  history.replaceState(null, '', `${location.pathname}${location.search}#p=${encodeURIComponent(person.id)}`);
};

canvas = createCanvas(data, selectPerson, openNote);
card = createPersonCard(data, {
  select: (id) => {
    const person = graph.byId.get(id);
    if (!person) return;
    if (page === 'families' || page === 'unconnected') showFamilyPagePerson(person);
    else selectPerson(person);
  },
  tree: focusTreeTarget,
  verse: openVerse,
  trace: traceToAdam,
  family: openPersonFamily,
  note: openNote,
});

const treePage = h('section', { className: 'ag-workspace ag-page-view', 'data-page': 'tree' },
  h('div', { className: 'ag-canvas-wrap' }, canvas.el,
    h('div', { className: 'ag-canvas-legend-panel' },
      h('div', { className: 'ag-legend' },
        h('span', {}, h('i', { className: 'ag-dot ag-dot-common' }), '共同主線'),
        h('span', {}, h('i', { className: 'ag-dot ag-dot-matthew' }), '馬太'),
        h('span', {}, h('i', { className: 'ag-dot ag-dot-luke' }), '路加'),
        h('span', {}, h('i', { className: 'ag-dot ag-dot-side' }), '旁支')),
      h('div', { className: 'ag-canvas-hint' }, '拖曳移動畫布 · 滾輪縮放 · 觸控可平移與雙指縮放'))));
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
const familiesPage = createNTFamilies(data, (id, groupId) => {
  const person = graph.byId.get(id);
  if (person) showFamilyPagePerson(person, groupId);
});
const unconnectedFamiliesPage = createUnconnectedFamilies(data, (id, groupId) => {
  const person = graph.byId.get(id);
  if (person) showFamilyPagePerson(person, groupId);
});
const pageNodes = new Map<PageId, HTMLElement>([
  ['tree', treePage], ['compare', comparePage], ['ages', agesPage], ['notes', notesPage], ['families', familiesPage.el], ['unconnected', unconnectedFamiliesPage.el],
]);

let activeFamilyGroup: string | null = null;
let activeFamilyPage: PageId | null = null;

function familyPageController(id: PageId) {
  return id === 'families' ? familiesPage : id === 'unconnected' ? unconnectedFamiliesPage : null;
}

function showFamilyPagePerson(person: Person, suppliedGroupId?: string) {
  const controller = familyPageController(page);
  if (!controller) return;
  const groupId = suppliedGroupId ?? controller.groupIdFor(person.id);
  if (groupId && (activeFamilyPage !== page || activeFamilyGroup !== groupId)) controller.focusPerson(person.id);
  controller.highlightPerson(groupId ? person.id : null);
  activeFamilyPage = page;
  activeFamilyGroup = groupId;
  activeCardPerson = person;
  card.show(person, treeTargetForPerson(person));
  history.replaceState(null, '', `${location.pathname}${location.search}#p=${encodeURIComponent(person.id)}`);
}

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

function treeTargetForPerson(person: Person): string | null {
  const reachesSpine = (id: string) => graph.spineIds.has(id) || Boolean(pathToFirstAncestor(id, data, graph)?.ids.some((pathId) => graph.spineIds.has(pathId)));
  if (reachesSpine(person.id)) return person.id;

  const motherOf = data.persons.find((candidate) => reachesSpine(candidate.id) && (
    candidate.parents?.some((parent) => parent.id === person.id && /母|mother/i.test(parent.role ?? '')) ||
    candidate.mother_name === person.name || candidate.mother_name === person.id));
  if (motherOf) return motherOf.id;

  const spouse = person.spouses?.find((relation) => reachesSpine(relation.id));
  if (spouse) return spouse.id;
  const reverseSpouse = data.persons.find((candidate) => reachesSpine(candidate.id) && candidate.spouses?.some((relation) => relation.id === person.id));
  return reverseSpouse?.id ?? null;
}

function openPersonFamily(id: string) {
  card.show(null);
  activeCardPerson = null;
  activeFamilyGroup = null;
  activeFamilyPage = null;
  if (unconnectedFamiliesPage.hasPerson(id)) {
    page = 'unconnected';
    applyPage();
    unconnectedFamiliesPage.focusPerson(id);
    return;
  }
  const family = (data.ntFamilies ?? []).find((item) => item.members?.includes(id) || item.roots?.includes(id));
  if (family) {
    page = 'families';
    applyPage();
    familiesPage.focusPerson(id);
    return;
  }
  page = 'unconnected';
  applyPage();
}

function chooseSearchPerson(person: Person) {
  if (unconnectedFamiliesPage.hasPerson(person.id)) {
    page = 'unconnected';
    applyPage();
    activeFamilyGroup = null;
    activeFamilyPage = null;
    showFamilyPagePerson(person);
    return;
  }
  if (familiesPage.hasPerson(person.id)) {
    page = 'families';
    applyPage();
    activeFamilyGroup = null;
    activeFamilyPage = null;
    showFamilyPagePerson(person);
    return;
  }
  selectPerson(person);
}

function focusIdForPerson(person: Person): string | null {
  canvas.expandFor(person.id);
  if (canvas.layoutNow().nodes.some((node) => node.id === person.id)) return person.id;

  const childThroughMother = data.persons.find((candidate) =>
    candidate.parents?.some((parent) => parent.id === person.id && parent.role === '母') ||
    candidate.mother_name === person.name || candidate.mother_name === person.id);
  const childId = childThroughMother?.id ?? graph.children.get(person.id)?.[0];
  if (childId) {
    canvas.expandFor(childId);
    return childId;
  }

  const spouseId = person.spouses?.[0]?.id;
  if (spouseId) {
    canvas.expandFor(spouseId);
    return spouseId;
  }
  return null;
}

function applyPage() {
  for (const [id, element] of pageNodes) element.hidden = id !== page;
  toolbar?.setState();
}

const toolbar = createToolbar(data, {
  selectPerson: chooseSearchPerson,
  setPage(id) {
    if (id !== page) {
      activeCardPerson = null;
      activeFamilyGroup = null;
      activeFamilyPage = null;
      card.show(null);
    }
    page = id;
    applyPage();
  },
  setLine(value) { line = value; canvas.setLine(value); },
  restartTour() { page = 'tree'; applyPage(); tour.start(); },
  zoom: (factor) => canvas.zoom(factor),
  fit: () => canvas.fitSpine(true, true),
  getLine: () => line,
  getPage: () => page,
});
const tour = createTour(data, canvas, openVerse);
const main = h('main', { className: 'ag-main' });
for (const element of pageNodes.values()) main.append(element);
main.append(card.el);
const footer = h('footer', { className: 'ag-footer' },
  h('span', {}, '家譜依資料中的經文記載呈現。'),
  h('span', {}, synthetic ? '合成壓力測試資料' : `${data.persons.length.toLocaleString()} 位人物`));
app.replaceChildren(toolbar.el, main, footer, tour.el, verseLayer);
applyPage();

function applyDeepLink() {
  const hash = location.hash.slice(1);
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
    const unattached = data.unattached?.includes(id) ?? false;
    const message = !person.parents?.length && !unattached
      ? '經文沒有記載他的父母。'
      : '經文沒有記載他和主線的關係。';
    card.setTraceMessage(message, false, unattached);
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
