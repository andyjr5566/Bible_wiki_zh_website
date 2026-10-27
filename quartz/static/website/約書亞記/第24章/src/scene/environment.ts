import * as THREE from 'three';
import type { StoryState } from '../story/state';
import dawnUrl from '../assets/shechem-env/dawn.webp';
import morningUrl from '../assets/shechem-env/morning.webp';
import afternoonUrl from '../assets/shechem-env/afternoon.webp';
import duskUrl from '../assets/shechem-env/dusk.webp';
import nightUrl from '../assets/shechem-env/night.webp';
import { deferredTexture } from './texture';

export type ShechemTime = 'dawn' | 'morning' | 'afternoon' | 'dusk' | 'night';

export interface EnvironmentBlend {
  from: ShechemTime;
  to: ShechemTime;
  amount: number;
}

export class ShechemEnvironmentCrossfader {
  private target: ShechemTime = 'dawn';
  private from: ShechemTime = 'dawn';
  private startedAt = 0;
  private lastBlend: EnvironmentBlend = { from: 'dawn', to: 'dawn', amount: 0 };
  private wasOrbit = false;

  update(target: EnvironmentBlend, nowMs: number): EnvironmentBlend {
    const isOrbit = target.from !== target.to;
    if (isOrbit) {
      this.lastBlend = target;
      this.wasOrbit = true;
      return target;
    }

    if (target.from !== this.target || this.wasOrbit) {
      this.from = this.wasOrbit
        ? (this.lastBlend.amount < 0.5 ? this.lastBlend.from : this.lastBlend.to)
        : (this.lastBlend.amount < 0.5 ? this.lastBlend.from : this.lastBlend.to);
      this.target = target.from;
      this.startedAt = nowMs;
      this.wasOrbit = false;
    }
    const progress = Math.max(0, Math.min(1, (nowMs - this.startedAt) / 900));
    const amount = progress * progress * (3 - 2 * progress);
    const blend = { from: this.from, to: this.target, amount };
    this.lastBlend = progress >= 1 ? fixed(this.target) : blend;
    return blend;
  }
}

const ORDER: ShechemTime[] = ['afternoon', 'dusk', 'night'];
const HORIZON: Record<ShechemTime, string> = {
  // Match the panorama's ground at the join, rather than the bright sky.
  dawn: '#a87f52',
  morning: '#ccac79',
  afternoon: '#c09765',
  dusk: '#41281a',
  night: '#2f2823',
};

function fixed(time: ShechemTime): EnvironmentBlend {
  return { from: time, to: time, amount: 0 };
}

function orbitBlend(turns: number): EnvironmentBlend {
  const phase = ((turns % 1) + 1) % 1;
  const position = phase * ORDER.length;
  const index = Math.floor(position);
  const progress = position - index;
  const amount = progress * progress * (3 - 2 * progress);
  return {
    from: ORDER[index],
    to: ORDER[(index + 1) % ORDER.length],
    amount,
  };
}

export function shechemEnvironmentAt(state: StoryState, elapsed: number): EnvironmentBlend {
  if (state.segment === 'prologue' || state.segment === 'act-1') return fixed('dawn');
  if (state.segment === 'act-3' || state.segment === 'act-4') return fixed('morning');
  if (state.segment === 'act-5') {
    return state.cue === 'dismiss' || state.cue === 'family-5'
      ? fixed('dusk')
      : fixed('afternoon');
  }
  if (state.segment === 'act-6') {
    if (state.cue === 'elders') {
      return orbitBlend(state.beatProgress * 3.2 + (state.motionOff ? 0 : elapsed * 0.04));
    }
    if (state.cue === 'family-6') {
      return orbitBlend(3.2 + (state.motionOff ? 0 : elapsed * 0.03));
    }
    return fixed('afternoon');
  }
  if (state.segment === 'epilogue') return fixed('dusk');
  return fixed('morning');
}

export function environmentNightMix(blend: EnvironmentBlend): number {
  if (blend.from === 'night' && blend.to === 'night') return 1;
  if (blend.from === 'night') return 1 - blend.amount;
  if (blend.to === 'night') return blend.amount;
  return 0;
}

export function environmentHorizonColor(blend: EnvironmentBlend): THREE.Color {
  return new THREE.Color(HORIZON[blend.from]).lerp(new THREE.Color(HORIZON[blend.to]), blend.amount);
}

const urls: Record<ShechemTime, string> = {
  dawn: dawnUrl,
  morning: morningUrl,
  afternoon: afternoonUrl,
  dusk: duskUrl,
  night: nightUrl,
};

export interface ShechemPanoramaHandle {
  mesh: THREE.Mesh;
  overlay: THREE.Mesh;
  prepare(state: StoryState): void;
  setBlend(blend: EnvironmentBlend): void;
  setIntensity(intensity: number): void;
  dispose(): void;
}

export function createShechemPanorama(): ShechemPanoramaHandle {
  const slots = Object.fromEntries((Object.keys(urls) as ShechemTime[]).map(name =>
    [name, deferredTexture(urls[name], [168, 127, 82, 255])],
  )) as Record<ShechemTime, ReturnType<typeof deferredTexture>>;
  const textures = {} as Record<ShechemTime, THREE.Texture>;
  for (const name of Object.keys(slots) as ShechemTime[]) {
    const texture = slots[name].texture;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.repeat.x = -1;
    texture.offset.x = 1;
    textures[name] = texture;
  }
  void slots.dawn.load();
  const fallback = new THREE.DataTexture(new Uint8Array([168, 127, 82, 255]), 1, 1);
  fallback.colorSpace = THREE.SRGBColorSpace;
  fallback.needsUpdate = true;
  let shown: THREE.Texture = fallback;
  let arrival: THREE.Texture = textures.dawn;
  let arrivalAt = -1;
  let waiting = true;

  const material = new THREE.MeshBasicMaterial({
    map: fallback,
    color: '#ffffff',
    side: THREE.BackSide,
    depthTest: false,
    depthWrite: false,
    fog: false,
    toneMapped: false,
  });
  const overlayMaterial = new THREE.MeshBasicMaterial({
    map: textures.dawn,
    color: '#ffffff',
    side: THREE.BackSide,
    // Both panorama draws must stay in the opaque queue, ahead of terrain
    // and people. A transparent full-screen sphere renders AFTER all opaque
    // actors regardless of its negative renderOrder, painting them out.
    transparent: false,
    blending: THREE.CustomBlending,
    blendSrc: THREE.SrcAlphaFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    blendEquation: THREE.AddEquation,
    opacity: 0,
    depthTest: false,
    depthWrite: false,
    fog: false,
    toneMapped: false,
  });

  const geometry = new THREE.SphereGeometry(7600, 64, 40);
  const mesh = new THREE.Mesh(geometry, material);
  const overlay = new THREE.Mesh(geometry, overlayMaterial);
  mesh.name = 'shechem_equirectangular_panorama';
  overlay.name = 'shechem_equirectangular_panorama_crossfade';
  mesh.rotation.y = -Math.PI / 6;
  overlay.rotation.y = -Math.PI / 6;
  mesh.renderOrder = -10000;
  overlay.renderOrder = -9999;
  mesh.frustumCulled = false;
  overlay.frustumCulled = false;

  return {
    mesh,
    overlay,
    prepare(state) {
      for (const time of panoramaPreloads(state)) void slots[time].load();
    },
    setBlend(blend) {
      void slots[blend.from].load();
      void slots[blend.to].load();
      // 尚未完成的時段沿用已顯示的全景，下載完成後再淡入。
      const target = blend.from === blend.to || blend.amount < .5 ? blend.from : blend.to;
      if (!slots[target].ready) { waiting = true; return; }
      if (waiting) {
        waiting = false;
        arrival = textures[target];
        arrivalAt = performance.now();
      }
      const fade = arrivalAt < 0 ? 1 : Math.min(1, (performance.now() - arrivalAt) / 600);
      if (fade < 1) {
        material.map = shown;
        overlayMaterial.map = arrival;
        overlayMaterial.opacity = fade;
      } else {
        arrivalAt = -1;
        shown = textures[target];
        material.map = slots[blend.from].ready ? textures[blend.from] : shown;
        overlayMaterial.map = slots[blend.to].ready ? textures[blend.to] : shown;
        overlayMaterial.opacity = blend.from === blend.to ? 0 : blend.amount;
      }
    },
    setIntensity(intensity) {
      material.color.setScalar(Math.max(0, intensity));
      overlayMaterial.color.setScalar(Math.max(0, intensity));
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      overlayMaterial.dispose();
      Object.values(textures).forEach((texture) => texture.dispose());
      fallback.dispose();
    },
  };
}

/** 只提早一段閱讀距離；直接跳讀仍會由 setBlend 補載當前時段。 */
export function panoramaPreloads(state: StoryState): ShechemTime[] {
  if (state.segment === 'prologue' || state.segment === 'act-1') return ['dawn'];
  if (state.segment === 'act-2') return state.cue === 'gifts' ? ['morning'] : [];
  if (state.segment === 'act-3') return ['morning'];
  if (state.segment === 'act-4') return ['morning', ...(state.cue === 'family-4' ? ['afternoon' as const] : [])];
  if (state.segment === 'act-5') return ['afternoon', ...(state.cue === 'raise' || state.cue === 'the-stone' || state.cue === 'dismiss' || state.cue === 'family-5' ? ['dusk' as const] : [])];
  if (state.segment === 'act-6') return ['afternoon', 'dusk', 'night'];
  return ['dusk'];
}
