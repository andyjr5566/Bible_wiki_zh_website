/**
 * 場景層對外的介面。介面層（src/main.ts、src/ui）只透過這裡和場景溝通。
 * 場景層的實作在 src/scene/ 底下（Three.js + 刻線著色器），介面層不直接碰 Three.js 物件。
 */
import type { Palette } from '../data/types';
import type { HyssopPart, StoryState } from '../story/state';

export type SceneEvent =
  | { type: 'hyssop-dip' }
  | { type: 'hyssop-strike'; part: HyssopPart }
  | { type: 'hyssop-miss' }
  | { type: 'hyssop-done'; auto: boolean }
  | { type: 'door-shut' }
  /** 初熟禾捆：搖了一下（拖曳甩動或按鈕） */
  | { type: 'wave-swing' }
  /** 搖滿三下；讀者沒做就捲過去時 auto=true */
  | { type: 'wave-done'; auto: boolean }
  | { type: 'ready' }
  | { type: 'webgl-lost' };

export interface SceneOptions {
  canvas: HTMLCanvasElement;
  story: StoryState;
  /** 各章配色（feasts.yaml），key 是章 id */
  palettes: Record<string, Palette>;
  /** 回聲拍（story.later）用的舊紙配色 */
  laterPalette: Palette;
  onEvent: (e: SceneEvent) => void;
}

export interface SceneHandle {
  /** 視窗尺寸或 devicePixelRatio 改變時呼叫 */
  resize(width: number, height: number, dpr: number): void;
  /** 停止 render loop 並釋放 GPU 資源 */
  dispose(): void;
  /**
   * 鍵盤／按鈕的替代操作（無法拖曳的讀者用）：
   * 'dip' 蘸血；'lintel'/'left'/'right' 打在該處。行為與拖曳完全相同（含動畫與事件）。
   */
  hyssopAction(action: 'dip' | HyssopPart): void;
  /** 初熟禾捆的按鈕替代操作：搖一下（與拖曳甩動一下相同，含動畫與事件） */
  waveAction(): void;
  /**
   * 畫布上目前可互動的區域（介面層據此只在這些區域攔截觸控，其餘照常捲動）。座標是 CSS px。
   * cue 是 hyssop 時：[把手, 盆, 門框區]；cue 是 wave 時：[禾捆把手]；其他 cue 回傳空陣列。
   * 第一個矩形一律是「按住拖曳」的把手（介面層對它用 touch-action: none）。
   */
  interactiveRects(): DOMRect[];
}

/** 不支援 WebGL2 時回傳 null，介面層改用預先輸出的靜態插圖。 */
export type CreateScene = (opts: SceneOptions) => SceneHandle | null;
