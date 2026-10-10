// 漩渦上的字：每一圈旁邊一個小標籤、太陽正下方一行大字。
// 字是用一點明體（I.Ming，IPA Font License v1.0）預先畫好的圖集（src/scene/vortex-glyphs.png，tools/build-vortex-glyphs.py 產生；
// 字型檔本身不進專案、不嵌進網站）。這裡把圖集縮放畫進 2D canvas、一次建好一張貼圖（file:// 單檔輸出：圖集被內嵌成 data URI），
// 再套進場景的一個網格（7 個四邊形：6 個標籤＋1 個大字）。圖集還沒載入完不顯示字。
// 螢幕座標（和漩渦同一個覆蓋層），跟漩渦一起動、一起淡出。貼圖的 R 通道＝字，G 通道＝字外的一圈底色暈（讓字壓在刻線上也看得清楚）。
// 每幀不配置新物件：頂點屬性是預先配好的 Float32Array。尺寸（手機／桌機、DPR）變了才重建貼圖。
import { BufferAttribute, BufferGeometry, CanvasTexture, LinearFilter, Mesh, ShaderMaterial, Vector3 } from 'three';
import { U } from './materials';
import glyphUrl from './vortex-glyphs.png?inline';
import glyphMeta from './vortex-glyphs.json';
import strings from './vortex-strings.json';

export const RING_LABELS: readonly string[] = strings.ringLabels;
export const BIG_LINES: readonly string[] = strings.bigLines;

const N = BIG_LINES.length + RING_LABELS.length; // 貼圖裡的字串數：0..5 標籤，6..11 大字
const QUADS = 7; // 0..5 標籤，6 大字

const VERT = /* glsl */ `
uniform vec2 uRes;
attribute float aA;
attribute float aH;
varying vec2 vUv;
varying float vA;
varying float vH;
void main() {
  vUv = uv;
  vA = aA;
  vH = aH;
  gl_Position = vec4(position.xy / uRes * 2.0 - 1.0, 0.0, 1.0);
}
`;

const FRAG = /* glsl */ `
precision highp float;
uniform sampler2D uTex;
uniform vec3 uInk;
uniform vec3 uLit;
uniform vec3 uHalo;
varying vec2 vUv;
varying float vA;
varying float vH;
void main() {
  vec4 t = texture2D(uTex, vUv);
  float fill = pow(t.r, 0.5); // 明體的細筆畫縮小後覆蓋率偏低，用 gamma 補回對比（不改字形）
  float halo = t.g * 0.95;
  float a0 = max(fill, halo);
  float a = a0 * vA;
  if (a < 0.003) discard;
  vec3 ink = mix(uInk, uLit, vH);
  vec3 col = mix(uHalo, ink, clamp(fill / max(a0, 0.001), 0.0, 1.0));
  gl_FragColor = vec4(col, a);
}
`;

interface Slot {
  /** 貼圖上的位置（px，左上為原點）與大小；字本身在中間，四周留 pad 給暈 */
  x: number;
  y: number;
  w: number;
  h: number;
  /** 字本身的寬（CSS px） */
  textW: number;
}

export class VortexText {
  readonly mesh: Mesh;
  /** 字還在淡入淡出（呼叫端據此讓閒置跳幀的迴圈繼續跑） */
  busy = false;
  /** 每個標籤的字寬（CSS px），給呼叫端排位置用 */
  readonly labelW = new Float32Array(RING_LABELS.length);
  readonly bigW = new Float32Array(BIG_LINES.length);
  /** 目前大字的高（CSS px）與標籤的高 */
  bigH = 0;
  labelH = 0;
  private readonly slots: Slot[] = [];
  private readonly pos = new Float32Array(QUADS * 4 * 3);
  private readonly uv = new Float32Array(QUADS * 4 * 2);
  private readonly aA = new Float32Array(QUADS * 4);
  private readonly aH = new Float32Array(QUADS * 4);
  private readonly mat: ShaderMaterial;
  private tex: CanvasTexture | null = null;
  private kS = 0;
  private kB = 0;
  private kD = 0;
  private glyphs: HTMLImageElement | null = null;
  private pad = 0;
  private atlasW = 1;
  private atlasH = 1;
  private bigShown = -1;
  private bigA = 0;
  private bigDirty = true;
  private readonly inkC = new Vector3();
  private readonly litC = new Vector3();
  private readonly haloC = new Vector3();

  constructor() {
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(this.pos, 3).setUsage(35048));
    geo.setAttribute('uv', new BufferAttribute(this.uv, 2).setUsage(35048));
    geo.setAttribute('aA', new BufferAttribute(this.aA, 1).setUsage(35048));
    geo.setAttribute('aH', new BufferAttribute(this.aH, 1).setUsage(35048));
    const idx = new Uint16Array(QUADS * 6);
    for (let q = 0; q < QUADS; q++) {
      const b = q * 4;
      idx.set([b, b + 1, b + 2, b, b + 2, b + 3], q * 6);
    }
    geo.setIndex(new BufferAttribute(idx, 1));
    this.mat = new ShaderMaterial({
      uniforms: {
        uRes: U.uRes,
        uTex: { value: null },
        uInk: { value: this.inkC },
        uLit: { value: this.litC },
        uHalo: { value: this.haloC },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    this.mesh = new Mesh(geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1.6;
    this.mesh.visible = false;
    this.busy = true; // 圖集載入完要再畫一次，閒置跳幀的迴圈先別睡
    const img = new Image();
    img.onload = () => {
      this.glyphs = img;
      this.kS = 0; // 強制重建貼圖
    };
    img.src = glyphUrl;
  }

  /** 尺寸有變才重建貼圖。smallPx／bigPx：CSS px；dpr：緩衝／CSS */
  setSize(smallPx: number, bigPx: number, dpr: number): void {
    const img = this.glyphs;
    if (!img) return;
    if (smallPx === this.kS && bigPx === this.kB && Math.abs(dpr - this.kD) < 0.0005) return;
    this.kS = smallPx;
    this.kB = bigPx;
    this.kD = dpr;
    this.labelH = smallPx;
    this.bigH = bigPx;
    const pad = Math.ceil(Math.max(smallPx, bigPx) * dpr * 0.2) + 2;
    this.pad = pad;
    const make = (): HTMLCanvasElement => document.createElement('canvas');
    // 各字串縮放後的大小，排成一欄。縮放比 = 要的字高（緩衝 px）／圖集的繪製字高
    const rects = glyphMeta.rects;
    const sc = (i: number): number => ((i < RING_LABELS.length ? smallPx : bigPx) * dpr) / rects[i].px;
    this.slots.length = 0;
    let y = 0;
    let maxW = 1;
    for (let i = 0; i < N; i++) {
      const r = rects[i];
      const w = Math.round(r.w * sc(i)) + pad * 2;
      const h = Math.round(r.h * sc(i)) + pad * 2;
      // 字本身（扣掉圖集裡的邊）的寬，CSS px
      this.slots.push({ x: 0, y, w, h, textW: ((r.w - 8) * sc(i)) / dpr });
      y += h;
      maxW = Math.max(maxW, w);
    }
    for (let i = 0; i < RING_LABELS.length; i++) this.labelW[i] = this.slots[i].textW;
    for (let i = 0; i < BIG_LINES.length; i++) this.bigW[i] = this.slots[RING_LABELS.length + i].textW;
    this.atlasW = maxW;
    this.atlasH = y;
    const fillC = make();
    const haloC = make();
    fillC.width = haloC.width = maxW;
    fillC.height = haloC.height = y;
    const f = fillC.getContext('2d', { willReadFrequently: true })!;
    const h = haloC.getContext('2d', { willReadFrequently: true })!;
    f.imageSmoothingQuality = 'high';
    h.imageSmoothingQuality = 'high';
    for (let i = 0; i < N; i++) {
      const s = this.slots[i];
      const r = rects[i];
      const dw = s.w - pad * 2;
      const dh = s.h - pad * 2;
      f.drawImage(img, r.x, r.y, r.w, r.h, s.x + pad, s.y + pad, dw, dh);
      // 暈：同一張圖在兩圈、各 12 個角度位移各畫一次（半徑 0.15、0.075 個字高）
      const px = (i < RING_LABELS.length ? smallPx : bigPx) * dpr;
      for (const rad of [0.15, 0.075]) {
        for (let a = 0; a < 12; a++) {
          const t = (a / 12) * Math.PI * 2;
          h.drawImage(img, r.x, r.y, r.w, r.h, s.x + pad + Math.cos(t) * rad * px, s.y + pad + Math.sin(t) * rad * px, dw, dh);
        }
      }
      h.drawImage(img, r.x, r.y, r.w, r.h, s.x + pad, s.y + pad, dw, dh);
    }
    const out = make();
    out.width = maxW;
    out.height = y;
    const o = out.getContext('2d')!;
    const A = f.getImageData(0, 0, maxW, y);
    const B = h.getImageData(0, 0, maxW, y);
    const D = o.createImageData(maxW, y);
    for (let i = 0; i < D.data.length; i += 4) {
      D.data[i] = A.data[i + 3];
      D.data[i + 1] = B.data[i + 3];
      D.data[i + 2] = 0;
      D.data[i + 3] = 255;
    }
    o.putImageData(D, 0, 0);
    if (this.tex) this.tex.dispose();
    const tex = new CanvasTexture(out);
    tex.minFilter = LinearFilter;
    tex.magFilter = LinearFilter;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    this.tex = tex;
    this.mat.uniforms.uTex.value = tex;
    this.bigDirty = true;
    // 標籤的 uv 固定
    for (let i = 0; i < RING_LABELS.length; i++) this.setUv(i, i);
  }

  private setUv(quad: number, slot: number): void {
    const s = this.slots[slot];
    const u0 = s.x / this.atlasW;
    const u1 = (s.x + s.w) / this.atlasW;
    const v0 = 1 - (s.y + s.h) / this.atlasH; // 下緣
    const v1 = 1 - s.y / this.atlasH; // 上緣
    const o = quad * 8;
    const u = this.uv;
    u[o] = u0; u[o + 1] = v0;
    u[o + 2] = u1; u[o + 3] = v0;
    u[o + 4] = u1; u[o + 5] = v1;
    u[o + 6] = u0; u[o + 7] = v1;
    (this.mesh.geometry.getAttribute('uv') as BufferAttribute).needsUpdate = true;
  }

  /** 把一個四邊形放在螢幕上：(left, centerY) 是字本身的左緣與垂直中心（CSS px，y 向下）；dpr 換成緩衝 px、對齊整數像素，字才不糊 */
  private place(quad: number, slot: number, left: number, cyDown: number, H: number, dpr: number): void {
    const s = this.slots[slot];
    const x0 = Math.round(left * dpr) - this.pad;
    const yc = Math.round((H - cyDown) * dpr);
    const y0 = yc - Math.floor(s.h / 2);
    const o = quad * 12;
    const p = this.pos;
    p[o] = x0; p[o + 1] = y0; p[o + 2] = 0;
    p[o + 3] = x0 + s.w; p[o + 4] = y0; p[o + 5] = 0;
    p[o + 6] = x0 + s.w; p[o + 7] = y0 + s.h; p[o + 8] = 0;
    p[o + 9] = x0; p[o + 10] = y0 + s.h; p[o + 11] = 0;
  }

  private setA(quad: number, a: number, h: number): void {
    const o = quad * 4;
    for (let i = 0; i < 4; i++) {
      this.aA[o + i] = a;
      this.aH[o + i] = h;
    }
  }

  /**
   * 每幀。labels：第 k 個標籤的位置（left、centerY：CSS px）與亮度；big：大字的目標（-1 無）與位置（中心 x、上緣 y）。
   * fade：整體淡出（漩渦本身的淡出與 coda 收攏）。
   * 回傳有沒有東西要畫。
   */
  frame(
    dt: number,
    H: number,
    dpr: number,
    labelLeft: Float32Array,
    labelY: Float32Array,
    labelA: Float32Array,
    labelHi: Float32Array,
    bigTarget: number,
    bigCx: number,
    bigTop: number,
    fade: number,
    dark: number,
    night: number,
    ink: Vector3,
    lit: Vector3,
  ): boolean {
    if (this.slots.length === 0) {
      // 圖集還沒載入：不顯示字，載入後下一幀會重建貼圖
      this.busy = true;
      this.mesh.visible = false;
      return false;
    }
    // 顏色：暈用「另一個」底色；白天亮色模式的亮橘壓深一點，不然壓在淡黃的天上看不清
    this.inkC.copy(ink);
    const sum = (U.uPaper.value as Vector3).x + (U.uInk.value as Vector3).x;
    this.haloC.set(sum - ink.x, (U.uPaper.value as Vector3).y + (U.uInk.value as Vector3).y - ink.y, (U.uPaper.value as Vector3).z + (U.uInk.value as Vector3).z - ink.z);
    const deepen = 0.5 * (1 - dark) * (1 - night);
    this.litC.set(lit.x + (0.42 - lit.x) * deepen, lit.y + (0.2 - lit.y) * deepen, lit.z + (0.04 - lit.z) * deepen);
    let any = false;
    for (let k = 0; k < RING_LABELS.length; k++) {
      const a = labelA[k] * fade;
      this.setA(k, a, labelHi[k]);
      if (a > 0.003) {
        any = true;
        this.place(k, k, labelLeft[k], labelY[k], H, dpr);
      }
    }
    // 大字：換拍時先淡出舊的、再淡入新的（各 0.2 秒；時間驅動，動態關閉時也是淡入淡出，不是位移）
    if (this.bigShown !== bigTarget) {
      this.bigA -= dt / 0.2;
      if (this.bigA <= 0) {
        this.bigA = 0;
        this.bigShown = bigTarget;
        this.bigDirty = true;
      }
    } else if (this.bigShown >= 0 && this.bigA < 1) {
      this.bigA = Math.min(1, this.bigA + dt / 0.2);
    }
    this.busy = this.bigShown !== bigTarget || (this.bigShown >= 0 && this.bigA < 1);
    if (this.bigShown >= 0) {
      const slot = RING_LABELS.length + this.bigShown;
      if (this.bigDirty) {
        this.setUv(6, slot);
        this.bigDirty = false;
      }
      const w = this.bigW[this.bigShown];
      const a = this.bigA * this.bigA * (3 - 2 * this.bigA) * fade;
      this.setA(6, a, 0);
      if (a > 0.003) {
        any = true;
        this.place(6, slot, bigCx - w / 2, bigTop + this.bigH * 0.55, H, dpr);
      }
    } else {
      this.setA(6, 0, 0);
    }
    const g = this.mesh.geometry;
    (g.getAttribute('position') as BufferAttribute).needsUpdate = true;
    (g.getAttribute('aA') as BufferAttribute).needsUpdate = true;
    (g.getAttribute('aH') as BufferAttribute).needsUpdate = true;
    this.mesh.visible = any;
    return any;
  }

  hide(): void {
    this.mesh.visible = false;
    this.busy = false;
  }

  /** 目前大字的字寬（CSS px），沒有字回 0（給主角包圍盒用） */
  get shownBigW(): number {
    return this.bigShown >= 0 && this.bigA > 0.01 ? this.bigW[this.bigShown] : 0;
  }
}
