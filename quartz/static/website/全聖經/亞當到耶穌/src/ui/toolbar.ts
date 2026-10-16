import type { GenealogyData, Person } from '../data/types';
import { h } from './dom';
import { createSearch } from './search';
import { FONT_SCALE_EVENT, PAGE_SCALE_MAX, PAGE_SCALE_MIN, PAGE_SCALE_STEP, getPageScale, setPageScale } from './fontscale';

export type PageId = 'catalog' | 'tree' | 'compare' | 'ages' | 'notes' | 'roles' | 'returns';
export type LineFilter = 'both' | '馬太' | '路加';

export interface ToolbarActions {
  selectPerson(person: Person): void;
  setPage(page: PageId): void;
  setLine(line: LineFilter): void;
  restartTour(): void;
  /** 帶你讀經：打開或離開 */
  toggleReading(): void;
  isReading(): boolean;
  zoom(factor: number): void;
  fit(): void;
  getLine(): LineFilter;
  getPage(): PageId;
}

export function createToolbar(data: GenealogyData, actions: ToolbarActions): { el: HTMLElement; setState(): void; hintRead(on: boolean): void } {
  const search = createSearch(data, actions.selectPerson);
  const lineButtons = new Map<LineFilter, HTMLButtonElement>();
  const lineGroup = h('div', { className: 'ag-line-toggle', role: 'group', 'aria-label': '顯示家譜線' });
  for (const [id, label] of [['both', '兩條線'], ['馬太', '馬太'], ['路加', '路加']] as const) {
    const button = h('button', { className: 'ag-segment-button', type: 'button', 'aria-pressed': String(actions.getLine() === id) }, label);
    button.addEventListener('click', () => { actions.setLine(id); setState(); });
    lineButtons.set(id, button);
    lineGroup.append(button);
  }
  const tabs: Array<[PageId, string]> = [
    ['catalog', '目錄'], ['tree', '家譜樹'], ['compare', '兩條線對照'], ['ages', '年歲時間軸'], ['notes', '經文不同的地方'], ['roles', '大衛立的職位'], ['returns', '歸回的名單'],
  ];
  const tabButtons = new Map<PageId, HTMLButtonElement>();
  const tabBar = h('nav', { className: 'ag-tabs', 'aria-label': '家譜檢視' });
  for (const [id, label] of tabs) {
    const button = h('button', { className: 'ag-tab', type: 'button', 'aria-pressed': String(actions.getPage() === id) }, label);
    button.addEventListener('click', () => { actions.setPage(id); setState(); });
    tabButtons.set(id, button);
    tabBar.append(button);
  }
  const zoomOut = h('button', { className: 'ag-icon-button', type: 'button', title: '縮小', 'aria-label': '縮小' }, '−');
  const zoomIn = h('button', { className: 'ag-icon-button', type: 'button', title: '放大', 'aria-label': '放大' }, '+');
  const fit = h('button', { className: 'ag-icon-button ag-fit-button', type: 'button', title: '回到主線全景' }, '全景');
  zoomOut.addEventListener('click', () => actions.zoom(0.82));
  zoomIn.addEventListener('click', () => actions.zoom(1.22));
  fit.addEventListener('click', actions.fit);
  const restart = h('button', { className: 'ag-quiet-button', type: 'button' }, '重播導覽');
  const readButton = h('button', { className: 'ag-rd-entry', type: 'button', 'aria-pressed': 'false' }, '帶你讀經');
  readButton.addEventListener('click', () => { actions.toggleReading(); setState(); });
  restart.addEventListener('click', actions.restartTour);
  const theme = h('button', { className: 'ag-quiet-button', type: 'button', 'aria-pressed': 'false' }, '深色');
  const motion = h('button', { className: 'ag-quiet-button', type: 'button', 'aria-pressed': 'true' }, '動畫');
  const root = document.documentElement;
  const settings = {
    get(key: string) { try { return localStorage.getItem(`adam-jesus:${key}`); } catch { return null; } },
    set(key: string, value: string) { try { localStorage.setItem(`adam-jesus:${key}`, value); } catch { /* 瀏覽器不允許儲存時仍可操作 */ } },
  };
  const savedTheme = settings.get('theme');
  if (savedTheme === 'dark' || savedTheme === 'light') root.dataset.theme = savedTheme;
  const savedMotion = settings.get('motion');
  root.dataset.motion = savedMotion === 'off' ? 'off' : 'on';
  const darkNow = () => root.dataset.theme === 'dark' || (!root.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
  const syncPreferences = () => {
    theme.textContent = darkNow() ? '亮色' : '深色';
    theme.setAttribute('aria-pressed', String(darkNow()));
    motion.setAttribute('aria-pressed', String(root.dataset.motion !== 'off'));
  };
  theme.addEventListener('click', () => {
    root.dataset.theme = darkNow() ? 'light' : 'dark';
    settings.set('theme', root.dataset.theme);
    syncPreferences();
  });
  motion.addEventListener('click', () => {
    root.dataset.motion = root.dataset.motion === 'off' ? 'on' : 'off';
    settings.set('motion', root.dataset.motion);
    syncPreferences();
  });
  syncPreferences();
  // 大小滑桿：字、圓盤、方塊一起放大；兩端的 A 點一下各走一格
  const smaller = h('button', { className: 'ag-size-end ag-size-small', type: 'button', title: '變小', 'aria-label': '變小' }, 'A');
  const larger = h('button', { className: 'ag-size-end ag-size-large', type: 'button', title: '變大', 'aria-label': '變大' }, 'A');
  const slider = h('input', {
    className: 'ag-size-range', type: 'range', min: String(PAGE_SCALE_MIN), max: String(PAGE_SCALE_MAX), step: String(PAGE_SCALE_STEP), 'aria-label': '大小',
  }) as HTMLInputElement;
  const percent = h('output', { className: 'ag-size-value' });
  const fontGroup = h('div', { className: 'ag-font-size', role: 'group', 'aria-label': '大小' }, smaller, slider, larger, percent);
  const syncFont = () => {
    const scale = getPageScale();
    slider.value = String(scale);
    slider.setAttribute('aria-valuetext', `${Math.round(scale * 100)}%`);
    percent.textContent = `${Math.round(scale * 100)}%`;
    smaller.disabled = scale <= PAGE_SCALE_MIN + 1e-6;
    larger.disabled = scale >= PAGE_SCALE_MAX - 1e-6;
    fontGroup.title = `大小 ${Math.round(scale * 100)}%`;
  };
  slider.addEventListener('input', () => setPageScale(Number(slider.value)));
  smaller.addEventListener('click', () => setPageScale(getPageScale() - 0.1));
  larger.addEventListener('click', () => setPageScale(getPageScale() + 0.1));
  window.addEventListener(FONT_SCALE_EVENT, syncFont);
  syncFont();
  const controls = h('div', { className: 'ag-controls' }, readButton, lineGroup, zoomOut, zoomIn, fit, restart, fontGroup, theme, motion);
  const header = h('header', { className: 'ag-header' },
    h('div', { className: 'ag-brand' },
      h('span', { className: 'ag-brand-mark', 'aria-hidden': 'true' }, '譜'),
      h('div', {}, h('strong', {}, '從亞當到耶穌'), h('small', {}, '家譜畫布'))),
    search.el,
    controls,
    tabBar);
  const setState = () => {
    for (const [id, button] of lineButtons) button.setAttribute('aria-pressed', String(actions.getLine() === id));
    // 讀經時沒有哪個分頁是「目前這頁」
    for (const [id, button] of tabButtons) button.setAttribute('aria-pressed', String(!actions.isReading() && actions.getPage() === id));
    readButton.setAttribute('aria-pressed', String(actions.isReading()));
    readButton.textContent = actions.isReading() ? '離開讀經' : '帶你讀經';
  };
  /** 導覽的「一起讀經」站：把「帶你讀經」按鈕標亮（朱色呼吸框） */
  const hintRead = (on: boolean) => readButton.classList.toggle('is-hint', on);
  return { el: header, setState, hintRead };
}
