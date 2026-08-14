import type { AppPort } from '../types/app';
import type { AssetProfile, AssetRuntimeState } from '../types/assets';
import type { ExperienceState } from '../types/experience';
import type { UIState } from '../types/ui';
import { ExperiencePanel } from './ExperiencePanel';
import { ModeNavigation } from './ModeNavigation';

const profiles: Array<{ id: AssetProfile; label: string }> = [
  { id: 'desktop-high', label: '完整會幕' },
  { id: 'desktop-structural', label: '框架剖面' },
  { id: 'fallback-low', label: '低模備援' },
];

const details = [
  ['tabernacle-ark-alternative', '約櫃'],
  ['tabernacle-burnt-altar-detail', '燔祭壇'],
  ['tabernacle-table-shewbread-detail', '陳設餅桌'],
  ['tabernacle-incense-altar-detail', '香壇'],
  ['tabernacle-menorah-detail', '金燈臺'],
  ['tabernacle-laver-detail', '洗濯盆'],
] as const;

export class AppShell {
  readonly canvas: HTMLCanvasElement;
  readonly #modeNavigation: ModeNavigation;
  readonly #experiencePanel: ExperiencePanel;
  readonly #assetStatus: HTMLElement;
  readonly #researchPanel: HTMLElement;
  readonly #sheetToggle: HTMLButtonElement;
  readonly #profileButtons = new Map<AssetProfile, HTMLButtonElement>();
  readonly #detailButtons = new Map<string, HTMLButtonElement>();
  #uiState: Readonly<UIState> | null = null;
  #experienceState: Readonly<ExperienceState> | null = null;
  #unsubscribe: (() => void) | null = null;
  #assetUnsubscribe: (() => void) | null = null;
  #experienceUnsubscribe: (() => void) | null = null;

  constructor(root: HTMLElement) {
    root.innerHTML = `<main class="app-shell">
      <canvas class="scene-canvas" tabindex="0" aria-label="可拖曳旋轉、滾輪縮放的 3D 會幕場景"></canvas>
      <header class="museum-header">
        <div class="brand-lockup"><span class="brand-mark" aria-hidden="true"></span><div><p>EXODUS 25 · NON-COMMERCIAL</p><h1>互動式會幕研讀</h1></div></div>
        <nav class="mode-navigation"></nav>
        <button class="credits-button" type="button" data-credits-trigger>資料來源</button>
      </header>
      <aside class="research-panel is-sheet-collapsed"><button class="panel-sheet-toggle" type="button" data-sheet-toggle aria-expanded="false" aria-controls="experience-panel"><span aria-hidden="true">↑</span><span>展開控制</span></button><div class="experience-panel" id="experience-panel"></div>
        <details class="asset-drawer"><summary>模型檢視選項</summary><nav class="profile-buttons" aria-label="3D 模型方案"></nav><nav class="detail-buttons" aria-label="器物細節"></nav><p class="asset-status" data-testid="asset-status" aria-live="polite"></p></details>
      </aside>
      <footer class="control-legend" aria-label="3D 操作說明"><span><i class="mouse-icon" aria-hidden="true"></i><strong>拖曳</strong>旋轉視角</span><span><strong>滾輪</strong>拉近縮遠</span><span><strong>點目前頁籤</strong>重設視角</span></footer>
    </main>`;
    const canvas = root.querySelector('canvas');
    const modeNav = root.querySelector<HTMLElement>('.mode-navigation');
    const experience = root.querySelector<HTMLElement>('.experience-panel');
    const assetStatus = root.querySelector<HTMLElement>('.asset-status');
    const researchPanel = root.querySelector<HTMLElement>('.research-panel');
    const sheetToggle = root.querySelector<HTMLButtonElement>('[data-sheet-toggle]');
    if (!(canvas instanceof HTMLCanvasElement) || !modeNav || !experience || !assetStatus || !researchPanel || !sheetToggle) throw new Error('App shell failed to create required elements.');
    this.canvas = canvas;
    this.#researchPanel = researchPanel;
    this.#sheetToggle = sheetToggle;
    this.#modeNavigation = new ModeNavigation(modeNav);
    this.#experiencePanel = new ExperiencePanel(experience);
    this.#assetStatus = assetStatus;
    this.installAssetControls(root);
  }

  bind(app: AppPort): void {
    this.#modeNavigation.bind(app);
    this.#experiencePanel.bind(app);
    this.#sheetToggle.addEventListener('click', this.#onSheetToggle);
    document.querySelector('[data-credits-trigger]')?.addEventListener('click', () => app.setCreditsOpen(true));
    this.#profileButtons.forEach((button, profile) => button.addEventListener('click', () => app.setAssetProfile(profile)));
    this.#detailButtons.forEach((button, assetId) => button.addEventListener('click', () => app.loadDetail(assetId)));
    this.#unsubscribe = app.subscribe((state) => { this.#uiState = state; this.render(); });
    this.#assetUnsubscribe = app.subscribeAssets((state) => this.renderAssetState(state));
    this.#experienceUnsubscribe = app.subscribeExperience((state) => { this.#experienceState = state; this.render(); });
  }

  dispose(): void {
    this.#unsubscribe?.(); this.#assetUnsubscribe?.(); this.#experienceUnsubscribe?.();
    this.#sheetToggle.removeEventListener('click', this.#onSheetToggle);
    this.#modeNavigation.dispose(); this.#experiencePanel.dispose();
  }

  readonly #onSheetToggle = (): void => {
    const collapsed = !this.#researchPanel.classList.contains('is-sheet-collapsed');
    this.#researchPanel.classList.toggle('is-sheet-collapsed', collapsed);
    this.#sheetToggle.setAttribute('aria-expanded', String(!collapsed));
    this.#sheetToggle.innerHTML = collapsed
      ? '<span aria-hidden="true">↑</span><span>展開控制</span>'
      : '<span aria-hidden="true">↓</span><span>收合控制</span>';
  };

  private installAssetControls(root: HTMLElement): void {
    const profileNav = root.querySelector<HTMLElement>('.profile-buttons');
    const detailNav = root.querySelector<HTMLElement>('.detail-buttons');
    if (!profileNav || !detailNav) throw new Error('Missing asset controls.');
    profiles.forEach(({ id, label }) => { const button = document.createElement('button'); button.type = 'button'; button.textContent = label; button.dataset.profile = id; profileNav.append(button); this.#profileButtons.set(id, button); });
    details.forEach(([id, label]) => { const button = document.createElement('button'); button.type = 'button'; button.textContent = label; button.dataset.detail = id; button.disabled = true; detailNav.append(button); this.#detailButtons.set(id, button); });
  }

  private render(): void {
    if (!this.#uiState || !this.#experienceState) return;
    this.#modeNavigation.render(this.#uiState.mode);
    this.#experiencePanel.render(this.#uiState.mode, this.#experienceState);
  }

  private renderAssetState(state: Readonly<AssetRuntimeState>): void {
    this.#profileButtons.forEach((button, profile) => { button.classList.toggle('is-active', state.profile === profile); button.setAttribute('aria-pressed', String(state.profile === profile)); });
    const detailsEnabled = state.profile === 'desktop-structural' && state.phase !== 'loading';
    this.#detailButtons.forEach((button) => { button.disabled = !detailsEnabled; });
    const progress = state.progress?.ratio == null ? '' : ` · ${Math.round(state.progress.ratio * 100)}%`;
    const active = state.activeAssetIds.length ? state.activeAssetIds.join('、') : '尚未載入';
    this.#assetStatus.textContent = state.phase === 'error' && state.error
      ? `載入失敗：${state.error.message}${state.error.fallbackAvailable ? '；可明確選擇低模備援。' : ''}`
      : `${state.phase === 'ready' ? '已就緒' : state.phase === 'loading' ? '載入中' : '待命'}${progress} · ${active}`;
  }
}
