import type { StageId } from '../data/types';

/**
 * 讀經的「舞台」：讀經程式（reader.ts）不直接碰畫布，只透過這個介面
 * 移鏡頭、標亮、展開、畫墨線、蓋印。家譜樹（tree-stage.ts，包住 canvas.ts）
 * 和大衛立的職位（roles.ts）各實作一份。
 */
export interface StageMarks {
  /** 這一節讀到、亮著的人（家譜樹人物 id 或職位圖 rid） */
  lit: Set<string>;
  /** 上一節讀過、慢慢退掉的人 */
  trail: Set<string>;
  /**
   * 正在讀的人：家譜樹人物 id、職位圖 rid，或歸回連結指到的職位圖成員「role:<方塊 id>:<成員 key>」。
   * 舞台不認得的（has() 回 false）就不移鏡頭。
   */
  current: string | null;
  /** 這一節蓋的朱印（id 是印蓋在誰身上） */
  seals: Array<{ id: string; label: string; key: string }>;
  /** 墨線（只有家譜樹畫） */
  ink: Array<{ from: string; to: string; key: string }>;
  /** 這一次新加的（要有落筆、蓋印的動畫） */
  fresh: Set<string>;
  /** 職位圖：這一節要亮的方塊（RoleBox.id） */
  boxes: Set<string>;
  /**
   * 歸回層：讀到這裡為止已經讀過的歸回連結（ReadingData.links 的索引）。
   * 職位圖依此把二十四班的格子變紅／畫虛線；家譜樹依此亮祖先。讀過就留著，跳回前面時會變少。
   */
  links: Set<number>;
}

export interface ReadingStage {
  id: StageId;
  /** 放在畫面區的元素（家譜樹是現有的畫布容器，職位圖是自己的容器） */
  el: HTMLElement;
  /** 第一次用到時才載入資料（職位圖的 roles.json）；已載入就馬上 resolve */
  ready(): Promise<void>;
  /** 讀經模式開關（家譜樹：淡墨底；職位圖：讀經樣式） */
  setReading(on: boolean): void;
  setMarks(marks: StageMarks): void;
  /** 讀經程式每進一節先通知（在 reveal、setMarks 之前）：舞台可依這一節決定要怎麼呈現同一個人 */
  setVerse?(key: string): void;
  /**
   * 這一節讀到第幾個字（每一格畫面都會通知，只有這個舞台顯示在大畫面時才呼叫）。
   * 名冊用它讓「讀到哪寫到哪」：那一行、那個名字、人數條在讀到的時候才出現。
   * jumped＝跳讀、打開、換節按鈕造成的（直接畫好，不播動畫）。
   */
  setCursor?(chars: number, jumped: boolean): void;
  /** 打開這些人（或方塊）所在的位置，只重畫一次 */
  reveal(ids: string[]): void;
  /** 鏡頭移到這個人或方塊；已在舒適範圍內就不動；距離很遠先拉遠再推近。職位圖只捲動自己的容器 */
  flyTo(target: string, animate: boolean): Promise<void>;
  /** 這個人／方塊在這個舞台上有沒有位置（決定鏡頭停哪裡） */
  has(target: string): boolean;
  /** 使用者自己拖動、縮放或捲動時通知（讀經就停止跟隨） */
  onUserCamera(listener: (() => void) | null): void;
  /** 小地圖：這個人在舞台上的相對位置（0–1，相對於 miniature() 的畫面），沒有就回 null */
  locate(target: string): { x: number; y: number } | null;
  /** 小地圖用的縮影（一張靜態小圖；讀經程式在上面疊「目前讀到的人」的位置點） */
  miniature(): HTMLElement | SVGElement;
  /** 讀經開始前的展開狀態，離開讀經時還原 */
  saveView(): unknown;
  restoreView(saved: unknown): void;
}

export function emptyMarks(): StageMarks {
  return { lit: new Set(), trail: new Set(), current: null, seals: [], ink: [], fresh: new Set(), boxes: new Set(), links: new Set() };
}
