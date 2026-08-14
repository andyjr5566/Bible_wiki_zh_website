import type { AppPort } from '../types/app';
import type { Vector3Data } from '../types/core';

export interface MiniMapOptions {
  onSelectObject?: (objectId: string) => void;
  onSelectLocation?: (locationId: string) => void;
}

export class MiniMap {
  readonly element: HTMLElement;
  #playerMarker: HTMLElement | null = null;
  #playerCone: HTMLElement | null = null;
  #app: AppPort | null = null;

  constructor(container: HTMLElement) {
    this.element = document.createElement('div');
    this.element.className = 'interactive-minimap-container';
    this.element.innerHTML = `
      <div class="minimap-header">
        <span class="minimap-title">會幕平面配置圖 (東門進)</span>
        <span class="compass-indicator" title="東門在右(+Z向)">⟵ 西 (至聖所) ｜ 東 (入口) ⟶</span>
      </div>
      <div class="minimap-canvas-wrapper">
        <svg class="minimap-svg" viewBox="-16 -32 32 64" preserveAspectRatio="xMidYMid meet">
          <!-- Outer Court (100 x 50 cubits ~= 22m x 44m) -->
          <rect x="-11" y="-22" width="22" height="44" class="map-court-boundary" />
          <line x1="-11" y1="22" x2="11" y2="22" class="map-gate-line" />
          
          <!-- Tabernacle Tent Structure (30 x 10 cubits ~= 5m x 15m) -->
          <rect x="-3" y="-15" width="6" height="15" class="map-tent-structure" />
          
          <!-- Veil Dividing Line (Between Holy & Most Holy) -->
          <line x1="-3" y1="-7.5" x2="3" y2="-7.5" class="map-veil-line" />
          
          <!-- Zones Labels -->
          <text x="0" y="16" class="map-zone-label">外院 (Outer Court)</text>
          <text x="0" y="-3.5" class="map-zone-label">聖所 (Holy Place)</text>
          <text x="0" y="-11.5" class="map-zone-label">至聖所 (Most Holy)</text>
          
          <!-- Furnishing Pins -->
          <!-- Burnt Altar (z: 9) -->
          <circle cx="0" cy="9" r="1.8" class="map-pin-circle" data-map-object="burnt-altar" />
          <text x="0" y="9.5" class="map-pin-text" data-map-object="burnt-altar">燔祭壇</text>

          <!-- Laver (z: 0) -->
          <circle cx="0" cy="0" r="1.4" class="map-pin-circle" data-map-object="laver" />
          <text x="0" y="0.5" class="map-pin-text" data-map-object="laver">洗濯盆</text>

          <!-- Menorah (x: -1.2, z: -4.35) -->
          <circle cx="-1.4" cy="-4.35" r="0.9" class="map-pin-circle" data-map-object="menorah" />
          <text x="-1.4" y="-3.2" class="map-pin-text" data-map-object="menorah">金燈臺</text>

          <!-- Shewbread Table (x: 1.2, z: -4.35) -->
          <circle cx="1.4" cy="-4.35" r="0.9" class="map-pin-circle" data-map-object="shewbread-table" />
          <text x="1.4" y="-3.2" class="map-pin-text" data-map-object="shewbread-table">陳設餅桌</text>

          <!-- Incense Altar (x: 0, z: -5.85) -->
          <circle cx="0" cy="-5.85" r="0.9" class="map-pin-circle" data-map-object="incense-altar" />
          <text x="0" y="-6.5" class="map-pin-text" data-map-object="incense-altar">香壇</text>

          <!-- Ark of Covenant (x: 0, z: -9.18) -->
          <circle cx="0" cy="-9.18" r="1.3" class="map-pin-circle ark-pin" data-map-object="ark" />
          <text x="0" y="-8.2" class="map-pin-text" data-map-object="ark">約櫃</text>
        </svg>

        <!-- Player Position & Orientation Indicator -->
        <div class="minimap-player-beacon" id="minimap-beacon">
          <div class="player-heading-cone"></div>
          <div class="player-center-dot"></div>
        </div>
      </div>
    `;

    container.appendChild(this.element);
    this.#playerMarker = this.element.querySelector('#minimap-beacon');
    this.element.addEventListener('click', this.#onPinClick);
  }

  bind(app: AppPort): void {
    this.#app = app;
  }

  updatePlayer(position: Vector3Data, yaw: number): void {
    if (!this.#playerMarker) return;
    // Map bounds: X [-16, 16] -> [0%, 100%], Z [-32, 32] -> [0%, 100%]
    const pctX = ((position.x + 16) / 32) * 100;
    const pctZ = ((position.z + 32) / 64) * 100;

    this.#playerMarker.style.left = `${Math.max(4, Math.min(96, pctX))}%`;
    this.#playerMarker.style.top = `${Math.max(4, Math.min(96, pctZ))}%`;
    this.#playerMarker.style.transform = `translate(-50%, -50%) rotate(${(-yaw * 180) / Math.PI}deg)`;
  }

  readonly #onPinClick = (e: MouseEvent): void => {
    const target = (e.target as HTMLElement).closest<HTMLElement>('[data-map-object]');
    if (!target || !this.#app) return;
    const objectId = target.dataset.mapObject;
    if (objectId) {
      this.#app.selectLearningObject(objectId);
    }
  };

  dispose(): void {
    this.element.removeEventListener('click', this.#onPinClick);
    this.element.remove();
  }
}
