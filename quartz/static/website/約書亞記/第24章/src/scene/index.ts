import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clamp01, clampDt } from '../story/state';
import { createCastAndCrowd } from './actors';
import type { AnchorProjection, SceneHandle, SceneOptions } from './api';
import { createChoreographer } from './choreography';
import type { TagAnchorSpec } from './choreography';
import { createMemoryMap } from './memory-map';
import { ease, sampleStation } from './stations';
import { ENTER_PX } from '../data/storytelling';
import { viewportHeight } from '../ui/viewport';
import { createPaintPass } from './paint-pass';
import { createSceneProps } from './props';
import { createValleyTerrain, type DemGridData } from './terrain';
import {
  createShechemPanorama,
  ShechemEnvironmentCrossfader,
  environmentHorizonColor,
  environmentNightMix,
  shechemEnvironmentAt,
} from './environment';

export interface ProjectedLabelItem {
  id: string;
  label: string;
  x: number;
  y: number;
  headX: number;
  headY: number;
  visible: boolean;
}

export interface BubblePlacement {
  /** 泡泡左上角（視窗座標，CSS px） */
  x: number;
  y: number;
  /** 尾巴接在泡泡下緣的位置（與泡泡左緣的水平距離）、尾巴長度 */
  tailX: number;
  tailLen: number;
  /** 說話者頭頂的螢幕座標 */
  headX: number;
  headY: number;
}

export interface ExtendedSceneHandle extends SceneHandle {
  openingPixels(): { joshua: number; oak: number; textures: { name: string; width: number; height: number }[] };
  visualDiagnostics(): {environment: ReturnType<typeof shechemEnvironmentAt>; figures:{id:string;headX:number;headY:number;footX:number;footY:number;inFrame:boolean}[]};
  /** 依說話者頭頂的螢幕位置擺放對話泡泡，避開約書亞、其他人物與名牌；找不到可見的說話者時回傳 null */
  placeBubble(actorIds: string[], w: number, h: number, topInset: number): BubblePlacement | null;
  /** 目前可見人物在螢幕上的範圍（驗收截圖腳本量測用） */
  getBodyBoxes(): { id: string; x0: number; y0: number; x1: number; y1: number }[];
  applyDemGrid(dem: DemGridData): void;
  applyBlenderModels(castB64?: string, propsUrl?: string): Promise<void>;
  applyMapReliefUrl(dataUrl: string): void;
  getCurrentLabels(): ProjectedLabelItem[];
  setFrameListener(fn: (() => void) | null): void;
  cardDiagnostics(): {maxYawError:number;visibleCards:number;visibleTribes:number;visibleWalkingTribes:number;atlasTextures:number;crowdDrawCalls:number;paintStrength:number;stoneRotation:number};
}

export function createScene(opts: SceneOptions): ExtendedSceneHandle | null {
  const { canvas, state, data, onEvent } = opts;

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false,
    });
  } catch (err) {
    console.warn('WebGL 初始化失敗，降級為靜態插圖背景', err);
    return null;
  }

  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const paint = createPaintPass(renderer);
  const panorama = createShechemPanorama();
  const environmentCrossfader = new ShechemEnvironmentCrossfader();
  scene.add(panorama.mesh, panorama.overlay);
  const bgLight = new THREE.Color('#dfd5be');
  const bgDark = new THREE.Color('#15130e');
  const bgPast = new THREE.Color('#cdb28c');
  const bgLater = new THREE.Color('#d6cbb0');
  const workBg = new THREE.Color('#dfd5be');

  scene.background = workBg;
  const fog = new THREE.FogExp2('#dfd5be', 0.00024);
  scene.fog = fog;

  const camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.35, 7800);

  // 光源：暖色天光＋主太陽光（陰影聚焦在集會空地 26m 範圍內，清晰柔和）
  const hemiLight = new THREE.HemisphereLight('#fff4de', '#8a7658', 0.95);
  scene.add(hemiLight);

  const sunLight = new THREE.DirectionalLight('#fff0d2', 1.85);
  sunLight.position.set(38, 28, 16);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(1024, 1024);
  sunLight.shadow.camera.near = 2;
  sunLight.shadow.camera.far = 140;
  const shadowExtent = 22;
  sunLight.shadow.camera.left = -shadowExtent;
  sunLight.shadow.camera.right = shadowExtent;
  sunLight.shadow.camera.top = shadowExtent;
  sunLight.shadow.camera.bottom = -shadowExtent;
  sunLight.shadow.bias = -0.0008;
  scene.add(sunLight);
  scene.add(sunLight.target);

  // 組裝場景層：示劍山谷地形、場景道具、人物與群眾、記憶地圖
  const terrain = createValleyTerrain(null);
  const props = createSceneProps();
  const cast = createCastAndCrowd();
  const memMap = createMemoryMap(data);

  scene.add(terrain.group);
  scene.add(props.root);
  scene.add(cast.root);
  scene.add(memMap.group);

  const choreographer = createChoreographer(terrain, props, cast, memMap);

  const driftDir = new THREE.Vector3();
  const driftSide = new THREE.Vector3();
  let viewW = Math.max(1, window.innerWidth);
  let viewH = Math.max(1, viewportHeight());
  let currentDpr = 1;
  // 手機畫不及時自動降解析度（只降不升）：捲動時掉格會讓畫面一頓一頓追進度，看起來像劇烈抖動
  let dprCap = Infinity;
  let frameEma = 16.7;
  let framesSinceDprChange = 0;
  let lastOffsetX = -99999;
  let lastOffsetY = -99999;
  let disposed = false;
  let rafId = 0;
  let prevNow = performance.now();
  let elapsed = 0;
  let lastCueRendered = '';
  let lastFrameMs = 16;
  let frameListener: (() => void) | null = null;
  let currentEnvironment = shechemEnvironmentAt(state, 0);

  // 鏡頭平滑狀態（同一 cue 內平滑跟隨捲動；跨 cue 遠距離換場立即剪接，遵守規則 7）
  const camPosCur = new THREE.Vector3(-3.2, 1.85, 6.2);
  const camLookCur = new THREE.Vector3(0.4, 1.45, -2.5);
  const projTmp = new THREE.Vector3();
  const bridgePos = camPosCur.clone();
  const bridgeLook = camLookCur.clone();
  let bridgeForward = true;
  const stageProps = [props.prologueGroup, props.scrollGroup, props.pastPit, props.pastBundle, props.coffinFull];
  const previousProps = new Set<THREE.Object3D>();
  const arrivingProps = new Set<THREE.Object3D>();

  const placedBoxes: { x0: number; y0: number; x1: number; y1: number }[] = Array.from(
    { length: 12 },
    () => ({ x0: 0, y0: 0, x1: 0, y1: 0 }),
  );
  const labelPool: ProjectedLabelItem[] = Array.from({ length: 12 }, () => ({
    id: '',
    label: '',
    x: 0,
    y: 0,
    headX: 0,
    headY: 0,
    visible: false,
  }));
  const currentLabels: ProjectedLabelItem[] = [];
  const actorBounds = new THREE.Box3();
  const bodyBoxes: { id: string; x0: number; y0: number; x1: number; y1: number }[] = [];
  let lastPlacedCount = 0;
  const bubbleOut: BubblePlacement = { x: 0, y: 0, tailX: 0, tailLen: 0, headX: 0, headY: 0 };
  let bubbleChoice: { key: string; offsetX: number; offsetY: number } | null = null;

  const onContextLost = (e: Event) => {
    e.preventDefault();
    onEvent({ type: 'webgl-lost' });
  };
  canvas.addEventListener('webglcontextlost', onContextLost, false);

  /**
   * 依視窗版面將攝影機光學中心對準「未被說明框遮住的 3D 舞台區」：
   * - 桌機（>768px）：右側 37% 為說明框、左緣為事奉線 → 光心左移 14%，主角落在左中開闊區正中央
   * - 手機（<=768px）：下半 338px 為固定高度說明框 → 光心上移 16%，主角落在上半無遮擋舞台正中央
   */
  function syncCameraFramingOffset(): void {
    const landscapePhone = viewH <= 520 && viewW > viewH;
    const isMobile = viewW <= 768 && !landscapePhone;
    // 手機橫拿：說明框佔右側約 46%，光心再往左移，主角落在左半舞台中央
    // 一拍只講一種東西以後：經文框縮成角落小框。桌機右側仍有右上的小工具，光心略往左；
    // 手機橫拿的經文框在左下，光心反過來略往右。
    const ox = isMobile
      ? 0
      : Math.round(
          viewW * (landscapePhone ? -0.05 : state.cue === 'epilogue-diff' ? 0.17 : 0.08),
        );
    const oy = isMobile ? Math.round(viewH * 0.165) : -Math.round(viewH * 0.02);
    if (ox !== lastOffsetX || oy !== lastOffsetY) {
      lastOffsetX = ox;
      lastOffsetY = oy;
      camera.setViewOffset(viewW, viewH, ox, oy, viewW, viewH);
    }
  }

  let sizedKey = '';
  function resize(width: number, height: number, dpr: number): void {
    // 網址列伸縮等不影響畫布大小的 resize 事件不重設緩衝區與鏡頭比例
    const key = `${Math.round(width)}:${Math.round(height)}:${dpr}`;
    if (key === sizedKey) return;
    sizedKey = key;
    viewW = Math.max(1, width);
    viewH = Math.max(1, height);
    const isMobile = viewW <= 768;
    currentDpr = Math.min(dpr || 1, isMobile || viewH <= 520 ? 1.5 : 1.75, dprCap);
    renderer.setPixelRatio(currentDpr);
    renderer.setSize(viewW, viewH, false);
    paint.resize(viewW, viewH, currentDpr);
    camera.aspect = viewW / viewH;
    lastOffsetX = -99999;
    syncCameraFramingOffset();
    camera.updateProjectionMatrix();
  }

  /** 所有可見人物的身體在螢幕上的範圍（名牌與對話泡泡都要避開） */
  function computeBodyBoxes(): void {
    bodyBoxes.length = 0;
    for (const [aid, actor] of Object.entries(cast.actors)) {
      if (!actor.group.visible) continue;
      actorBounds.setFromObject(actor.card);
      const box = { id: aid, x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
      for (let corner = 0; corner < 8; corner++) {
        projTmp.set(
          corner & 1 ? actorBounds.max.x : actorBounds.min.x,
          corner & 2 ? actorBounds.max.y : actorBounds.min.y,
          corner & 4 ? actorBounds.max.z : actorBounds.min.z,
        ).project(camera);
        if (projTmp.z < -1 || projTmp.z > 1) continue;
        const px = (projTmp.x * 0.5 + 0.5) * viewW;
        const py = (-projTmp.y * 0.5 + 0.5) * viewH;
        box.x0 = Math.min(box.x0, px - 4);
        box.x1 = Math.max(box.x1, px + 4);
        box.y0 = Math.min(box.y0, py - 4);
        box.y1 = Math.max(box.y1, py + 4);
      }
      if (Number.isFinite(box.x0)) bodyBoxes.push(box);
    }
  }

  function updateLabelsFromTags(
    tags: TagAnchorSpec[],
  ): void {
    let placedCount = 0;
    lastPlacedCount = 0;
    currentLabels.length = 0;
    // 名牌也避開所有可見主角的身體，包含沒有名牌的說話者。
    computeBodyBoxes();
    if (tags.length === 0) return;

    const landscapePhone = viewH <= 520 && viewW > viewH;
    const isMobile = viewW <= 768 && !landscapePhone;
    const minX = isMobile ? 42 : landscapePhone ? 40 : 68;
    const maxX = isMobile
      ? viewW - 42
      : Math.round(viewW * (landscapePhone ? 0.5 : 0.6));
    const minY = landscapePhone ? 48 : 66;
    const maxY = isMobile ? Math.max(140, viewH - 356) : viewH - (landscapePhone ? 20 : 38);

    for (let i = 0; i < tags.length; i++) {
      const t = tags[i];
      if (i >= labelPool.length) {
        labelPool.push({ id: '', label: '', x: 0, y: 0, headX: 0, headY: 0, visible: false });
      }
      const slot = labelPool[i];
      slot.id = t.id;
      slot.label = t.label;

      if (t.actorId) {
        cast.actors[t.actorId].headAnchor.getWorldPosition(projTmp);
      } else {
        projTmp.copy(t.worldPos);
      }
      projTmp.project(camera);
      if (projTmp.z < -1 || projTmp.z > 1) {
        slot.x = -999;
        slot.y = -999;
        slot.visible = false;
        currentLabels.push(slot);
        continue;
      }

      const headX = (projTmp.x * 0.5 + 0.5) * viewW;
      const headY = (-projTmp.y * 0.5 + 0.5) * viewH;
      slot.headX = headX;
      slot.headY = headY;
      let sx = headX;
      let sy = t.actorId ? headY - (isMobile || landscapePhone ? 8 : 12) : headY;

      // CSS 的原點在名牌下緣（translateY(-100%)），碰撞框使用相同基準。
      const estHalfW = Math.max(28, t.label.length * 6.2 + 10);
      const labelHeight = 27;
      if (t.id === 'coffin-map') {
        // 固定放在地圖左下方的圖說帶，避開各拍中部的地名與行軍路線。
        sx = minX + estHalfW + 8;
        sy = viewH - 8;
      }
      const anchorX = sx;
      const anchorY = sy;
      let inBounds = false;
      const offsets = [0, -12, 12, -24, 24, -40, 40, -60, 60, -90, 90, -120, 120];
      const isActorTag = Boolean(t.actorId);
      const maxGap = isMobile || landscapePhone ? 16 : 24;
      const baseGap = isMobile || landscapePhone ? 8 : 12;
      const rowStep = isActorTag ? 4 : 30;
      const maxRows = isActorTag ? Math.floor((maxGap - baseGap) / rowStep) : 7;
      // 人物名牌以頭頂螢幕錨點為準，只在 24/16px 範圍內避讓；不再因身體碰撞整列上移。
      for (const dx of offsets) {
        for (let row = 0; row <= maxRows && !inBounds; row++) {
          const x = anchorX + dx;
          const y = anchorY - row * rowStep;
          const x0 = x - estHalfW, x1 = x + estHalfW;
          const y0 = y - labelHeight, y1 = y;
          if (isActorTag && headY - y > maxGap) continue;
          const limitY = t.id === 'coffin-map' ? viewH - 6 : maxY;
          if (x0 < minX || x1 > maxX || y0 < minY || y1 > limitY) continue;
          const hits = (b: { id?: string; x0: number; y0: number; x1: number; y1: number }) => {
            if (isActorTag && b.id === t.actorId) return false;
            const overlapX = Math.min(x1, b.x1 + 4) - Math.max(x0, b.x0 - 4);
            const overlapY = Math.min(y1, b.y1 + 4) - Math.max(y0, b.y0 - 4);
            return isActorTag ? overlapX > 12 && overlapY > 8 : overlapX > 0 && overlapY > 0;
          };
          if (bodyBoxes.some(hits) || placedBoxes.some((box, idx) => idx < placedCount && hits(box))) continue;
          sx = x;
          sy = y;
          inBounds = true;
          break;
        }
        if (inBounds) break;
      }
      if (!inBounds && isActorTag) {
        let bestScore = Infinity;
        let bestX = 0;
        let bestY = 0;
        const overlap = (b: { x0: number; y0: number; x1: number; y1: number }, x0: number, y0: number, x1: number, y1: number) =>
          Math.max(0, Math.min(x1, b.x1 + 4) - Math.max(x0, b.x0 - 4)) *
          Math.max(0, Math.min(y1, b.y1 + 4) - Math.max(y0, b.y0 - 4));
        for (const dx of offsets) {
          for (let row = 0; row <= maxRows; row++) {
            const x = anchorX + dx;
            const y = anchorY - row * rowStep;
            const x0 = x - estHalfW, x1 = x + estHalfW;
            const y0 = y - labelHeight, y1 = y;
            const limitY = t.id === 'coffin-map' ? viewH - 6 : maxY;
            if (x0 < minX || x1 > maxX || y0 < minY || y1 > limitY) continue;
            const bodyArea = bodyBoxes.reduce((sum, box) => sum + (box.id === t.actorId ? 0 : overlap(box, x0, y0, x1, y1)), 0);
            const tagArea = placedBoxes.reduce((sum, box, idx) => sum + (idx < placedCount ? overlap(box, x0, y0, x1, y1) : 0), 0);
            const score = tagArea * 1_000_000 + bodyArea + Math.abs(dx) * 0.01 + row * 0.1;
            if (score < bestScore) {
              bestScore = score;
              bestX = x;
              bestY = y;
            }
          }
        }
        if (Number.isFinite(bestScore)) {
          sx = bestX;
          sy = bestY;
          inBounds = true;
        }
      }
      if (inBounds) {
        if (placedCount >= placedBoxes.length) {
          placedBoxes.push({ x0: 0, y0: 0, x1: 0, y1: 0 });
        }
        const pb = placedBoxes[placedCount++];
        pb.x0 = sx - estHalfW;
        pb.y0 = sy - labelHeight;
        pb.x1 = sx + estHalfW;
        pb.y1 = sy;
      }

      slot.x = sx;
      slot.y = sy;
      slot.visible = inBounds;
      currentLabels.push(slot);
    }
    lastPlacedCount = placedCount;
  }

  function placeBubble(
    actorIds: string[],
    w: number,
    h: number,
    topInset: number,
  ): BubblePlacement | null {
    let speakerId = '';
    for (const aid of actorIds) {
      const a = cast.actors[aid as keyof typeof cast.actors];
      if (a && a.group.visible) {
        speakerId = aid;
        break;
      }
    }
    if (!speakerId) return null;
    const actor = cast.actors[speakerId as keyof typeof cast.actors];
    actorBounds.setFromObject(actor.card);
    actor.headAnchor.getWorldPosition(projTmp);
    projTmp.project(camera);
    if (projTmp.z < -1 || projTmp.z > 1) return null;
    const hx = (projTmp.x * 0.5 + 0.5) * viewW;
    let hy = (-projTmp.y * 0.5 + 0.5) * viewH;
    if (hx < 0 || hx > viewW || hy < 0 || hy > viewH) return null;
    // 鏡頭很近時，頭頂框的四個上角投影高低差很大：取最高的那個，尾巴才不會戳進頭裡
    for (let corner = 0; corner < 4; corner++) {
      projTmp.set(
        corner & 1 ? actorBounds.max.x : actorBounds.min.x,
        actorBounds.max.y + 0.05,
        corner & 2 ? actorBounds.max.z : actorBounds.min.z,
      ).project(camera);
      if (projTmp.z < -1 || projTmp.z > 1) continue;
      hy = Math.min(hy, (-projTmp.y * 0.5 + 0.5) * viewH);
    }

    const landscapePhone = viewH <= 520 && viewW > viewH;
    const minX = landscapePhone ? 52 : 64;
    const maxX = viewW - 12;
    const minY = topInset;
    const tailMargin = landscapePhone || viewW <= 768 ? 8 : 20;
    // 與其他人物的身體範圍相疊的面積（身體範圍本身已外擴 4px）；名牌多留 4px 的空
    const overlapArea = (x0: number, y0: number, x1: number, y1: number): number => {
      let area = 0;
      for (const bx of bodyBoxes) {
        if (bx.id === speakerId) continue;
        // 留出取整與呼吸動態的餘裕，避免視覺上只差不到一個像素仍相疊。
        const gap = bx.id === 'joshua' ? 4 : 0;
        const ox = Math.min(x1, bx.x1 + gap) - Math.max(x0, bx.x0 - gap);
        const oy = Math.min(y1, bx.y1 + gap) - Math.max(y0, bx.y0 - gap);
        if (ox > 0 && oy > 0) area += ox * oy + (bx.id === 'joshua' ? 1e9 : 0);
      }
      for (let i = 0; i < lastPlacedCount; i++) {
        const bx = placedBoxes[i];
        const ox = Math.min(x1, bx.x1 + 4) - Math.max(x0, bx.x0 - 4);
        const oy = Math.min(y1, bx.y1 + 4) - Math.max(y0, bx.y0 - 4);
        if (ox > 0 && oy > 0) area += 1e9 + ox * oy * 3;
      }
      return area;
    };

    // 先正上方，再左右挪，再往上一層（尾巴變長），最後是貼著頂列的最高位置
    const shifts = [0, 0.1, -0.1, 0.2, -0.2, 0.3, -0.3, 0.35, -0.35, 0.4, -0.4, 0.5, -0.5, 0.6, -0.6, 0.8, -0.8];
    const tailLens: number[] = [];
    const maxTailGap = landscapePhone || viewW <= 768 ? 16 : 24;
    const baseTailGap = landscapePhone || viewW <= 768 ? 8 : 12;
    for (let len = baseTailGap; len <= maxTailGap; len += 4) {
      if (hy - len - h < minY) break;
      tailLens.push(len);
    }
    const topLen = hy - h - minY;
    if (topLen >= baseTailGap && topLen <= maxTailGap &&
      (tailLens.length === 0 || topLen > tailLens[tailLens.length - 1] + 1)) {
      tailLens.push(topLen);
    }
    if (tailLens.length === 0) tailLens.push(Math.max(4, Math.min(baseTailGap, hy - h - minY)));

    let bestX = 0;
    let bestY = 0;
    let bestLen = 0;
    let bestScore = Infinity;
    search: for (let ti = 0; ti < tailLens.length; ti++) {
      const tailLen = tailLens[ti];
      const by = Math.max(minY, hy - tailLen - h);
      for (const sft of shifts) {
        let bx = hx - w / 2 + sft * w;
        bx = Math.max(minX, Math.min(maxX - w, bx));
        if (hx < bx + tailMargin || hx > bx + w - tailMargin) continue;
        const score = overlapArea(bx, by, bx + w, by + h) + ti * 0.5;
        if (score < bestScore) {
          bestScore = score;
          bestX = bx;
          bestY = by;
          bestLen = hy - (by + h);
          if (score < 1) break search;
        }
      }
    }
    if (!Number.isFinite(bestScore)) {
      // 左右都擺不到尾巴接得上的位置：貼著頭頂
      bestY = Math.max(minY, hy - baseTailGap - h);
      bestLen = Math.max(4, Math.min(maxTailGap, hy - (bestY + h)));
      bestX = Math.max(minX, Math.min(maxX - w, hx - w / 2));
    }
    if (bestScore >= 1e9) {
      // 手機橫拿時角色卡片常只擦到泡泡邊緣；以 1px 小步微調，維持短尾巴並避開約書亞。
      for (let radius = 1; radius <= 64 && bestScore >= 1e9; radius++) {
        for (const dx of [-radius, radius]) {
          const x = bestX + dx;
          if (x < minX || x > maxX - w || hx < x + tailMargin || hx > x + w - tailMargin) continue;
          const score = overlapArea(x, bestY, x + w, bestY + h);
          if (score < bestScore) {
            bestX = x;
            bestScore = score;
          }
        }
      }
    }
    const choiceKey = `${state.cue}:${speakerId}:${w}:${h}:${viewW}:${viewH}`;
    if (bubbleChoice?.key === choiceKey) {
      const oldX = Math.max(minX, Math.min(maxX - w, hx + bubbleChoice.offsetX));
      const oldY = Math.max(minY, hy + bubbleChoice.offsetY);
      const oldScore = overlapArea(oldX, oldY, oldX + w, oldY + h);
      // Keep the last viable side unless another placement is materially better.
      if (oldScore < 1e9 && oldScore <= bestScore + w * h * .12) {
        bestX = oldX; bestY = oldY; bestLen = hy - (oldY + h);
      }
    }
    bubbleChoice = { key: choiceKey, offsetX: bestX - hx, offsetY: bestY - hy };
    bubbleOut.x = bestX;
    bubbleOut.y = bestY;
    bubbleOut.tailX = Math.max(tailMargin, Math.min(w - tailMargin, hx - bestX));
    bubbleOut.tailLen = bestLen;
    bubbleOut.headX = hx;
    bubbleOut.headY = hy;
    return bubbleOut;
  }

  function adaptResolution(interval: number): void {
    const phone = viewW <= 932 || viewH <= 520;
    if (!phone || !(interval > 0 && interval < 250)) return;
    frameEma = frameEma * 0.95 + interval * 0.05;
    framesSinceDprChange++;
    // 約每秒不到 40 格持續 1.5 秒以上：解析度降一階（1.5 → 1.25 → 1）
    if (frameEma > 25 && framesSinceDprChange > 60 && currentDpr > 1.01) {
      dprCap = Math.max(1, currentDpr - 0.25);
      currentDpr = dprCap;
      renderer.setPixelRatio(currentDpr);
      renderer.setSize(viewW, viewH, false);
      paint.resize(viewW, viewH, currentDpr);
      sizedKey = `${Math.round(viewW)}:${Math.round(viewH)}:${window.devicePixelRatio || 1}`;
      framesSinceDprChange = 0;
      frameEma = 16.7;
    }
  }

  function renderFrame(now: number): void {
    if (disposed) return;
    rafId = window.requestAnimationFrame(renderFrame);
    if (document.hidden) {
      prevNow = now;
      return;
    }

    const t0 = performance.now();
    const interval = now - prevNow;
    const dt = clampDt(interval / 1000);
    prevNow = now;
    adaptResolution(interval);
    if (!state.motionOff) {
      elapsed += dt;
    }

    // 處理「按住把石頭立起來」互動進度（互動本身不受 motionOff 阻擋）
    if (state.raiseStone.holding && !state.raiseStone.done) {
      state.raiseStone.progress = clamp01(state.raiseStone.progress + dt * 0.68);
      if (state.raiseStone.progress >= 1) {
        state.raiseStone.progress = 1;
        state.raiseStone.done = true;
        state.raiseStone.holding = false;
        state.raiseStone.auto = false;
        props.triggerDust(elapsed);
        onEvent({ type: 'stone-landed', auto: false });
      }
    }

    // 評估當前 36 拍分鏡與人物位置
    const { shot, tags } = choreographer.evaluate(state, elapsed);
    const station = sampleStation(state.beat, state.beatProgress);
    const environment = environmentCrossfader.update(shechemEnvironmentAt(state, elapsed), now);
    currentEnvironment = environment;
    const nightMix = environmentNightMix(environment);
    if (station) {
      terrain.group.visible = false;
      props.root.visible = false;
      cast.root.visible = false;
      memMap.setVisibility(1);
      const t = ease(0, 1, station.flightProgress);
      const focus = memMap.stationFlight(station.index, t, station.verse, state.onlyI, elapsed);
      const height = 24 + Math.sin(t * Math.PI) * 20;
      shot.pos.set(focus.x, height, focus.z + height * .55);
      shot.look.set(focus.x, .2, focus.z);
      shot.fov = 48;
      tags.length = 0;
    } else {
      cast.root.visible = true;
      terrain.group.visible = true;
    }
    props.updateIdle(elapsed, dt, state.motionOff, shot.windStrength);

    // 主題與時代背景色（亮／暗／從前暖棕／後來舊紙）
    workBg.copy(state.dark ? bgDark : bgLight);
    if (state.pastBlend > 0.01 && !state.dark) {
      workBg.lerp(bgPast, state.pastBlend * 0.65);
    } else if (state.later && !state.dark) {
      workBg.lerp(bgLater, 0.55);
    }
    const horizonTint = environmentHorizonColor(environment);
    if (state.dark) horizonTint.lerp(bgDark, 0.35);
    else if (state.pastBlend > 0.01) horizonTint.lerp(bgPast, state.pastBlend * 0.35);
    else if (state.later) horizonTint.lerp(bgLater, 0.28);
    fog.color.copy(state.space === 'map' ? workBg : horizonTint);
    scene.background = workBg;
    panorama.mesh.visible = state.space !== 'map';
    panorama.overlay.visible = state.space !== 'map';
    panorama.prepare(state);
    if (state.segment === 'act-6' || state.cue === 'dismiss' || state.cue === 'family-5') props.preloadNight();
    if (state.space !== 'map') panorama.setBlend(environment);
    panorama.setIntensity(state.dark ? 0.55 : state.pastBlend > 0.1 ? 0.85 : 1);
    fog.density = state.space === 'map' ? 0.00035 : 0.00082;
    terrain.setTheme(state.dark, state.pastBlend, state.later, nightMix);

    // 燈光更新
    sunLight.position.copy(shot.sunDir);
    const daylight = 1 - nightMix * 0.82;
    sunLight.intensity = (state.dark ? shot.sunIntensity * 0.52 : shot.sunIntensity) * daylight;
    hemiLight.intensity = (state.dark ? shot.hemiIntensity * 0.8 : shot.hemiIntensity * 1.5) * (1 - nightMix * 0.55);

    // 鏡頭定位：換 cue 時立即剪接（只有 valley↔map 兩處垂直轉場在 choreographer 內插），同 cue 內柔順跟隨捲動
    const isSmoothBridge =
      (lastCueRendered === 'family-1' && state.cue === 'beyond-river') ||
      (lastCueRendered === 'family-2' && state.cue === 'now');

    const cueChanged = lastCueRendered !== state.cue;
    if (cueChanged) {
      bridgePos.copy(camPosCur); bridgeLook.copy(camLookCur);
      const order = data.segments.flatMap(s => s.beats.map(b => b.cue));
      bridgeForward = order.indexOf(state.cue) >= order.indexOf(lastCueRendered);
      arrivingProps.clear();
      for (const prop of stageProps) if(prop.visible && !previousProps.has(prop)) arrivingProps.add(prop);
    }
    previousProps.clear();
    for (const prop of stageProps) if(prop.visible) previousProps.add(prop);
    const trackLength = document.querySelector<HTMLElement>(`section[data-cue="${state.cue}"]`)?.offsetHeight ?? 1400;
    const entryDistance = (bridgeForward ? state.beatProgress : 1 - state.beatProgress) * trackLength;
    const entry = ease(0, ENTER_PX, entryDistance);
    for (const prop of stageProps) prop.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      if (!object.userData.storyMaterials) {
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        const copies = materials.map(material => material.clone());
        object.material = Array.isArray(object.material) ? copies : copies[0];
        object.userData.storyMaterials = copies.map(material => ({ material, opacity: material.opacity }));
      }
      for (const item of object.userData.storyMaterials as { material: THREE.Material; opacity: number }[]) {
        item.material.transparent = true;
        item.material.opacity = item.opacity * (arrivingProps.has(prop) ? entry : 1);
      }
    });
    if (!station && entry < 1 && lastCueRendered) {
      camPosCur.lerpVectors(bridgePos, shot.pos, entry);
      camLookCur.lerpVectors(bridgeLook, shot.look, entry);
      lastCueRendered = state.cue;
    } else if (station || (cueChanged && !isSmoothBridge)) {
      camPosCur.copy(shot.pos);
      camLookCur.copy(shot.look);
      lastCueRendered = state.cue;
    } else {
      const k = 1 - Math.exp(-dt * 12);
      camPosCur.lerp(shot.pos, k);
      camLookCur.lerp(shot.look, k);
      lastCueRendered = state.cue;
    }

    syncCameraFramingOffset();
    if (camera.fov !== shot.fov) {
      camera.fov = shot.fov;
      camera.updateProjectionMatrix();
    }

    // 裝飾動態：微幅手持呼吸感（motionOff 時完全歸零）
    const swayX = state.motionOff || station || state.cue.startsWith('family-') ? 0 : Math.sin(elapsed * 0.85) * 0.03;
    const swayY = state.motionOff || station || state.cue.startsWith('family-') ? 0 : Math.cos(elapsed * 1.15) * 0.016;

    // 捲動帶動的慢推：示劍各拍從頭到尾鏡頭朝注視點推近約 8%、橫移一點，文字停留較久時畫面也不會停格。
    // 跟進度綁定（不是時間），往回捲會倒回；地圖與第二幕的站不加。
    const drift = station || state.space === 'map' ? 0 : state.beatProgress - 0.5;
    driftDir.subVectors(camLookCur, camPosCur);
    driftSide.crossVectors(driftDir, camera.up).normalize();
    camera.position.set(
      camPosCur.x + swayX + driftDir.x * drift * 0.08 + driftSide.x * drift * 0.5,
      camPosCur.y + swayY + driftDir.y * drift * 0.08,
      camPosCur.z + driftDir.z * drift * 0.08 + driftSide.z * drift * 0.5,
    );
    camera.lookAt(camLookCur);
    panorama.mesh.position.copy(camera.position);
    panorama.overlay.position.copy(camera.position);
    props.updateOakBillboard(camera, nightMix);

    cast.updateCards(camera, shot.sunDir, elapsed, state.motionOff, state.cue, state.beatProgress, dt);
    cast.root.updateMatrixWorld(true);
    paint.render(scene, camera);
    updateLabelsFromTags(tags);
    frameListener?.();
    lastFrameMs = performance.now() - t0;
  }

  resize(window.innerWidth, viewportHeight(), window.devicePixelRatio || 1);
  rafId = window.requestAnimationFrame(renderFrame);
  window.setTimeout(() => onEvent({ type: 'ready' }), 50);

  return {
    // Acceptance checks the rendered result, including texture alpha and
    // occlusion. Anchor positions alone cannot detect a failed GPU upload.
    openingPixels() {
      const width = 480, height = Math.round(width * viewH / viewW);
      const target = new THREE.WebGLRenderTarget(width, height);
      const previous = renderer.getRenderTarget();
      const read = () => {
        renderer.setRenderTarget(target);
        renderer.render(scene, camera);
        const pixels = new Uint8Array(width * height * 4);
        renderer.readRenderTargetPixels(target, 0, 0, width, height, pixels);
        return pixels;
      };
      try {
        const baseline = read();
        const difference = (object: THREE.Object3D) => {
          const visible = object.visible;
          let changed = 0;
          try {
            object.visible = false;
            const hidden = read();
            for (let i = 0; i < baseline.length; i += 4) {
              if (Math.max(Math.abs(baseline[i] - hidden[i]), Math.abs(baseline[i + 1] - hidden[i + 1]), Math.abs(baseline[i + 2] - hidden[i + 2])) > 8) changed++;
            }
          } finally { object.visible = visible; }
          return changed;
        };
        const textures: { name: string; width: number; height: number }[] = [];
        const inspect = (name: string, object: THREE.Object3D) => object.traverse(child => {
          if (!(child instanceof THREE.Mesh)) return;
          const materials = Array.isArray(child.material) ? child.material : [child.material];
          for (const material of materials) {
            const image = (material as THREE.MeshBasicMaterial).map?.image;
            if (image) textures.push({ name, width: image.width, height: image.height });
          }
        });
        inspect('joshua', cast.actors.joshua.card);
        inspect('oak', props.oakGroup.getObjectByName('tabor_oak_day_card')!);
        inspect('panorama', panorama.mesh);
        inspect('ground', terrain.mesh);
        inspect('stone', props.stonePivot);
        return { joshua: difference(cast.actors.joshua.group), oak: difference(props.oakGroup.getObjectByName('tabor_oak_day_card')!), textures };
      } finally { renderer.setRenderTarget(previous); target.dispose(); }
    },
    visualDiagnostics() {
      return {environment:currentEnvironment,figures:cast.figureAnchors().map(a=>{
        const head=a.head.clone().project(camera),foot=a.foot.clone().project(camera);
        return {id:a.id,headX:(head.x*.5+.5)*viewW,headY:(-.5*head.y+.5)*viewH,
          footX:(foot.x*.5+.5)*viewW,footY:(-.5*foot.y+.5)*viewH,
          inFrame:head.z>=-1&&head.z<=1&&Math.abs(head.x)<1&&Math.abs(head.y)<1};
      })};
    },
    resize,
    placeBubble,
    getBodyBoxes() {
      return bodyBoxes.map((b) => ({ ...b }));
    },
    cardDiagnostics() {
      return {...cast.diagnostics(),paintStrength:0.45,stoneRotation:props.stonePivot.rotation.z};
    },
    projectedAnchors(): AnchorProjection[] {
      return currentLabels.map((l) => ({
        id: l.id,
        x: l.x,
        y: l.y,
        visible: l.visible,
      }));
    },
    getCurrentLabels() {
      return currentLabels;
    },
    setFrameListener(fn) {
      frameListener = fn;
    },
    interactiveRects(): DOMRect[] {
      return [];
    },
    wake(): void {
      prevNow = performance.now();
    },
    benchInfo() {
      return {
        frameMs: Number(lastFrameMs.toFixed(2)),
        triangles: renderer.info.render.triangles,
        drawCalls: renderer.info.render.calls,
      };
    },
    applyDemGrid(dem: DemGridData) {
      terrain.applyDem(dem);
    },
    async applyBlenderModels(castB64?: string, propsUrl?: string) {
      if (castB64) {
        await cast.upgradeActorsFromGltf(castB64);
      }
      if (propsUrl) {
        const loader = new GLTFLoader();
        await new Promise<void>((resolve) => {
          try {
            loader.load(
              propsUrl,
              (gltf) => {
                props.swapFromBlenderGltf(gltf.scene);
                resolve();
              },
              undefined,
              () => resolve(),
            );
          } catch {
            resolve();
          }
        });
      }
    },
    applyMapReliefUrl(dataUrl: string) {
      const img = new Image();
      img.onload = () => {
        memMap.applyReliefImage(img);
      };
      img.src = dataUrl;
    },
    dispose() {
      disposed = true;
      window.cancelAnimationFrame(rafId);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      renderer.dispose();
      paint.dispose();
      panorama.dispose();
      cast.dispose();
    },
  };
}
