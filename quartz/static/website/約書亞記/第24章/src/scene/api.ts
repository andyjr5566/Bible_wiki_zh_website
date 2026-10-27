import type { StoryState } from '../story/state';
import type { SiteData } from '../data/types';

export type SceneEvent =
  | { type: 'ready' }
  | { type: 'stone-landed'; auto: boolean }
  | { type: 'marker-hover'; kind: 'coffin' | 'place' | 'verb'; id: string; x: number; y: number }
  | { type: 'marker-leave' }
  | { type: 'webgl-lost' };

export interface AnchorProjection {
  id: string;
  x: number;
  y: number;
  visible: boolean;
}

export interface SceneOptions {
  canvas: HTMLCanvasElement;
  oakMount?: HTMLElement;
  state: StoryState;
  data: SiteData;
  onEvent: (e: SceneEvent) => void;
}

export interface SceneHandle {
  resize(width: number, height: number, dpr: number): void;
  projectedAnchors(): AnchorProjection[];
  interactiveRects(): DOMRect[];
  wake(): void;
  benchInfo(): { frameMs: number; triangles: number; drawCalls: number };
  dispose(): void;
}

export type CreateScene = (opts: SceneOptions) => SceneHandle | null;
