import type { AppKernel } from '../app/AppKernel';
import type { CinematicState } from '../systems/CinematicTourController';

export class CinematicOverlay {
  readonly element: HTMLElement;
  #kernel: AppKernel | null = null;
  #state: Readonly<CinematicState> | null = null;
  #returnFocus: HTMLElement | null = null;

  constructor(container: HTMLElement) {
    this.element = document.createElement('section');
    this.element.className = 'cinematic-overlay is-hidden';
    this.element.setAttribute('role', 'dialog');
    this.element.setAttribute('aria-modal', 'true');
    this.element.setAttribute('aria-labelledby', 'cinema-act-title');
    this.element.setAttribute('aria-label', '逐幕 3D 導覽播放器');
    this.element.innerHTML = `
      <!-- Top Letterbox Bar -->
      <div class="cinema-letterbox top-bar">
        <div class="cinema-title-lockup">
          <span class="cinema-badge">BIBLICAL 3D GUIDED TOUR</span>
          <h2 id="cinema-act-title">第一幕：曠野中的聖所與東門</h2>
          <span class="cinema-hebrew-tag" id="cinema-hebrew-term">חֲצַר הַמִּשְׁכָּן</span>
        </div>
        <div class="cinema-top-actions">
          <button type="button" class="cinema-pill-btn" data-cinema-action="unit-toggle" title="切換尺寸單位">📏 單位: <b id="cinema-unit-label">肘 (Cubit)</b></button>
          <button type="button" class="cinema-pill-btn" data-cinema-action="dim-toggle" title="顯示/隱藏 3D 尺寸線">📐 3D 標尺: <b id="cinema-dim-label">開啟</b></button>
          <button type="button" class="cinema-close-btn" data-cinema-action="exit" aria-label="退出電影模式">✕ 退出</button>
        </div>
      </div>

      <!-- Center Click Area to Pause/Play or Orbit -->

      <!-- Bottom Letterbox Bar & Subtitle Card -->
      <div class="cinema-letterbox bottom-bar">
        <div class="cinema-subtitle-card">
          <div class="subtitle-head">
            <span class="scripture-ref-pill" id="cinema-verse-ref">出埃及記 27:9–19</span>
            <span class="act-counter" id="cinema-act-counter">1 / 8</span>
          </div>
          <p class="subtitle-text" id="cinema-verse-text">
            你要做帳幕的院子。院子的南面當用撚的細麻做帷子... 院子的門當有簾子，長二十肘...
          </p>
          <details class="cinema-full-scripture"><summary>閱讀本幕完整經文</summary><p id="cinema-full-text"></p></details>
          <div class="act-timeline-track">
            <div class="act-timeline-fill" id="cinema-timeline-fill" style="width: 0%"></div>
          </div>
        </div>

        <!-- Cinema Transport Bar -->
        <nav class="cinema-transport-bar" aria-label="電影導覽控制">
          <button type="button" class="cinema-transport-btn" data-cinema-action="prev" title="上一幕 (←)">⏮ 上一幕</button>
          <button type="button" class="cinema-transport-btn primary-play" data-cinema-action="toggle-play" id="cinema-play-btn" title="播放/暫停 (Space)">⏸ 暫停</button>
          <button type="button" class="cinema-transport-btn" data-cinema-action="next" title="下一幕 (→)">下一幕 ⏭</button>
          <button type="button" class="cinema-transport-btn" data-cinema-action="replay" title="重播本站">↻ 重播</button>
          <button type="button" class="cinema-transport-btn" data-cinema-action="speed" id="cinema-speed-btn" title="播放速度">1.0x</button>
        </nav>
      </div>
    `;

    container.appendChild(this.element);
    this.element.addEventListener('click', this.#onClick);
    window.addEventListener('keydown', this.#onKeyDown);
  }

  bind(kernel: AppKernel): void {
    this.#kernel = kernel;
  }

  render(state: Readonly<CinematicState>): void {
    const wasPlaying = this.#state?.isPlaying ?? false;
    const changedAct = this.#state?.currentAct.id !== state.currentAct.id || this.#state?.currentAct.hotspotId !== state.currentAct.hotspotId;
    this.#state = state;
    if (!state.isPlaying) {
      this.element.classList.add('is-hidden');
      if (wasPlaying) {
        const returnFocus = this.#returnFocus;
        this.#returnFocus = null;
        if (returnFocus?.isConnected) returnFocus.focus();
      }
      return;
    }

    this.element.classList.remove('is-hidden');
    if (!wasPlaying) {
      this.#returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      queueMicrotask(() => this.element.querySelector<HTMLButtonElement>('.cinema-close-btn')?.focus());
    }

    const actTitle = this.element.querySelector('#cinema-act-title');
    const hebrewTerm = this.element.querySelector('#cinema-hebrew-term');
    const verseRef = this.element.querySelector('#cinema-verse-ref');
    const verseText = this.element.querySelector('#cinema-verse-text');
    const actCounter = this.element.querySelector('#cinema-act-counter');
    const timelineFill = this.element.querySelector<HTMLElement>('#cinema-timeline-fill');
    const playBtn = this.element.querySelector('#cinema-play-btn');
    const hintIcon = this.element.querySelector('#cinema-hint-icon');
    const dimLabel = this.element.querySelector('#cinema-dim-label');
    const unitLabel = this.element.querySelector('#cinema-unit-label');
    const speedBtn = this.element.querySelector('#cinema-speed-btn');
    const hotspots = this.element.querySelector<HTMLElement>('#cinema-hotspots');

    if (actTitle) actTitle.textContent = state.currentAct.title;
    if (hebrewTerm) hebrewTerm.textContent = state.currentAct.hebrewTerm ?? '';
    if (verseRef) verseRef.textContent = `${state.currentAct.scriptureReference} · 節錄`;
    const lines = state.currentAct.scriptureText.split('\n').filter(Boolean);
    if (verseText) verseText.textContent = lines.find((line) => !line.endsWith('說：')) ?? lines[0] ?? '';
    const fullText = this.element.querySelector('#cinema-full-text');
    if (fullText) fullText.textContent = state.currentAct.scriptureText;
    if (changedAct) {
      const drawer = this.element.querySelector<HTMLDetailsElement>('.cinema-full-scripture');
      if (drawer) drawer.open = false;
    }
    if (actCounter) actCounter.textContent = `${state.currentAct.actNumber} / ${state.currentAct.totalActs}`;
    if (timelineFill) timelineFill.style.width = `${Math.round(state.progressRatio * 100)}%`;

    if (playBtn) playBtn.textContent = state.isPaused ? '▶ 繼續播放' : '⏸ 暫停';
    if (hintIcon) hintIcon.textContent = state.isPaused ? '▶' : '⏸';
    if (dimLabel) dimLabel.textContent = state.showDimensions ? '開啟' : '關閉';
    if (unitLabel) {
      unitLabel.textContent =
        state.dimensionUnit === 'cubit'
          ? '肘 (Cubit)'
          : state.dimensionUnit === 'cm'
          ? '公分 (cm)'
          : '英吋 (in)';
    }
    if (speedBtn) speedBtn.textContent = `${state.playbackSpeed.toFixed(1)}x`;
    if (hotspots) {
      hotspots.innerHTML = state.currentAct.hotspots.length
        ? state.currentAct.hotspots.map((hotspot) => `<button type="button" data-cinema-action="hotspot" data-hotspot-id="${escapeAttribute(hotspot.id)}" aria-pressed="${String(state.currentAct.hotspotId === hotspot.id)}" class="${state.currentAct.hotspotId === hotspot.id ? 'is-active' : ''}">${escapeHtml(hotspot.label)}</button>`).join('')
        : '';
    }
  }

  dispose(): void {
    this.element.removeEventListener('click', this.#onClick);
    window.removeEventListener('keydown', this.#onKeyDown);
    this.element.remove();
  }

  readonly #onClick = (e: MouseEvent): void => {
    const target = (e.target as HTMLElement).closest<HTMLElement>('[data-cinema-action]');
    if (!target || !this.#kernel) return;

    const action = target.dataset.cinemaAction;
    if (action === 'exit') {
      this.#kernel.stopCinematicTour();
    } else if (action === 'toggle-play') {
      this.#kernel.toggleCinematicPlayPause();
    } else if (action === 'next') {
      this.#kernel.nextCinematicAct();
    } else if (action === 'prev') {
      this.#kernel.prevCinematicAct();
    } else if (action === 'dim-toggle') {
      this.#kernel.toggleCinematicDimensions();
    } else if (action === 'unit-toggle') {
      const nextUnit =
        this.#state?.dimensionUnit === 'cubit'
          ? 'cm'
          : this.#state?.dimensionUnit === 'cm'
          ? 'inch'
          : 'cubit';
      this.#kernel.setCinematicDimensionUnit(nextUnit);
    } else if (action === 'speed') {
      const nextSpeed = this.#state?.playbackSpeed === 1.0 ? 1.5 : 1.0;
      this.#kernel.setCinematicSpeed(nextSpeed);
    } else if (action === 'replay') {
      this.#kernel.replayCinematicTour();
    } else if (action === 'hotspot') {
      this.#kernel.selectCinematicHotspot(target.dataset.hotspotId ?? null);
    }
  };

  readonly #onKeyDown = (e: KeyboardEvent): void => {
    if (!this.#state?.isPlaying || !this.#kernel) return;

    if (e.code === 'Space') {
      e.preventDefault();
      this.#kernel.toggleCinematicPlayPause();
    } else if (e.code === 'ArrowRight') {
      e.preventDefault();
      this.#kernel.nextCinematicAct();
    } else if (e.code === 'ArrowLeft') {
      e.preventDefault();
      this.#kernel.prevCinematicAct();
    } else if (e.code === 'Escape' && isTopOverlay(this.element)) {
      e.preventDefault();
      this.#kernel.stopCinematicTour();
    } else if (e.code === 'KeyD') {
      e.preventDefault();
      this.#kernel.toggleCinematicDimensions();
    }
  };
}

function isTopOverlay(element: HTMLElement): boolean {
  const overlays = Array.from(document.querySelectorAll<HTMLElement>('.cinematic-overlay:not(.is-hidden), .settings-modal-overlay:not(.is-hidden), .scripture-modal-overlay:not(.is-hidden), .credits-sheet'));
  return overlays[overlays.length - 1] === element;
}

function escapeHtml(value: string): string { return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] ?? character); }
function escapeAttribute(value: string): string { return escapeHtml(value); }
