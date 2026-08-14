import type { AppKernel } from '../app/AppKernel';
import type { AtmosphereMode } from '../types/atmosphere';

export class SettingsModal {
  readonly element: HTMLElement;
  #isOpen = false;
  #appKernel: AppKernel | null = null;

  constructor(container: HTMLElement) {
    this.element = document.createElement('div');
    this.element.className = 'settings-modal-overlay is-hidden';
    this.element.innerHTML = `
      <div class="settings-modal-card" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <header class="settings-header">
          <h2 id="settings-title">⚙️ 探索體驗與環境設定</h2>
          <button type="button" class="settings-close-btn" data-settings-action="close" aria-label="關閉設定">×</button>
        </header>
        
        <div class="settings-body">
          <!-- Atmosphere Switcher -->
          <section class="settings-section">
            <h3>🌄 大氣氛圍與時間 (Atmosphere)</h3>
            <p class="settings-desc">切換曠野的時間光影與上帝同在的火柱顯現（出 40:38）。</p>
            <div class="settings-btn-group" data-group="atmosphere">
              <button type="button" class="settings-opt-btn" data-atmosphere="dawn">🌅 晨曦 (Dawn)</button>
              <button type="button" class="settings-opt-btn is-active" data-atmosphere="midday">☀️ 曠野正午 (Midday)</button>
              <button type="button" class="settings-opt-btn" data-atmosphere="night">✨ 聖夜火柱 (Night / Fire)</button>
            </div>
          </section>

          <!-- Graphics Quality -->
          <section class="settings-section">
            <h3>🎨 3D 渲染品質 (Graphics Quality)</h3>
            <div class="settings-btn-group" data-group="quality">
              <button type="button" class="settings-opt-btn is-active" data-quality="high">精細 (High DPI + 柔和陰影)</button>
              <button type="button" class="settings-opt-btn" data-quality="medium">平衡 (1.0x DPI + 陰影)</button>
              <button type="button" class="settings-opt-btn" data-quality="low">效能 (省電流暢模式)</button>
            </div>
          </section>

          <!-- Audio Settings -->
          <section class="settings-section">
            <h3>🔊 空間環境音效 (Web Audio Engine)</h3>
            <p class="settings-desc">真實合成曠野呼嘯風聲、燔祭壇火燄爆裂、洗濯盆水聲與至聖所神聖和弦。</p>
            <div class="settings-audio-controls">
              <button type="button" class="settings-mute-toggle" data-settings-action="toggle-mute">🔊 靜音開關</button>
              <label class="settings-slider-label">
                <span>主音量：</span>
                <input type="range" min="0" max="100" value="70" class="settings-volume-slider" data-settings-slider="volume" />
              </label>
            </div>
          </section>

          <!-- Camera FOV -->
          <section class="settings-section">
            <h3>📷 鏡頭廣角視角 (Field of View)</h3>
            <label class="settings-slider-label">
              <span>FOV (視角)：<b id="fov-readout">48°</b></span>
              <input type="range" min="35" max="75" value="48" class="settings-fov-slider" data-settings-slider="fov" />
            </label>
          </section>
        </div>

        <footer class="settings-footer">
          <button type="button" class="primary-button" data-settings-action="close">完成並返回探索</button>
        </footer>
      </div>
    `;

    container.appendChild(this.element);
    this.element.addEventListener('click', this.#onClick);
    this.element.addEventListener('input', this.#onInput);
  }

  bind(kernel: AppKernel): void {
    this.#appKernel = kernel;
  }

  open(): void {
    this.#isOpen = true;
    this.element.classList.remove('is-hidden');
  }

  close(): void {
    this.#isOpen = false;
    this.element.classList.add('is-hidden');
  }

  toggle(): void {
    if (this.#isOpen) this.close();
    else this.open();
  }

  readonly #onClick = (e: MouseEvent): void => {
    const target = (e.target as HTMLElement).closest<HTMLElement>('[data-settings-action],[data-atmosphere],[data-quality]');
    if (!target) {
      if ((e.target as HTMLElement).classList.contains('settings-modal-overlay')) this.close();
      return;
    }

    if (target.dataset.settingsAction === 'close') {
      this.close();
      return;
    }

    if (target.dataset.settingsAction === 'toggle-mute') {
      if (this.#appKernel) {
        void this.#appKernel.audio.enableAudio();
        const muted = this.#appKernel.audio.toggleMute();
        target.textContent = muted ? '🔇 目前已靜音' : '🔊 靜音開關';
      }
      return;
    }

    if (target.dataset.atmosphere) {
      const mode = target.dataset.atmosphere as AtmosphereMode;
      this.element.querySelectorAll('[data-atmosphere]').forEach((btn) => btn.classList.toggle('is-active', btn === target));
      this.#appKernel?.setAtmosphere(mode);
      return;
    }

    if (target.dataset.quality) {
      const q = target.dataset.quality as 'high' | 'medium' | 'low';
      this.element.querySelectorAll('[data-quality]').forEach((btn) => btn.classList.toggle('is-active', btn === target));
      this.#appKernel?.setQuality(q);
      return;
    }
  };

  readonly #onInput = (e: Event): void => {
    const input = e.target as HTMLInputElement;
    if (input.dataset.settingsSlider === 'volume') {
      const vol = Number(input.value) / 100;
      this.#appKernel?.audio.setVolume(vol);
    } else if (input.dataset.settingsSlider === 'fov') {
      const fov = Number(input.value);
      const readout = this.element.querySelector('#fov-readout');
      if (readout) readout.textContent = `${fov}°`;
      this.#appKernel?.scene.context.cameraManager.setFov(fov);
    }
  };

  dispose(): void {
    this.element.removeEventListener('click', this.#onClick);
    this.element.removeEventListener('input', this.#onInput);
    this.element.remove();
  }
}
