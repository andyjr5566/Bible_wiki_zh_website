// 七的節奏章的漩渦：整章共用、一圈圈往外長的刻線圖形（畫在覆蓋層，螢幕座標，跟著捲動長出新的一圈）。
//   1 七日（七盞小燈）→ 2 七個七日（49 格＋第 50 格）→ 3 十二個月（第七個月點亮，旁邊三個小記號：聲波環、煙、棚）
//   → 4 七年（7 格）→ 5 七個七年（49 格）→ 6 第五十年（一圈光擴散）。前面的圈保留但變淡。
// 格數不寫死：7、49、50 一律讀 SITE.sevens（建置檢查 #6 從 raw_scripture 解析的值）。
// 十二個月是曆法本身，不在 SITE.sevens 裡，這裡是唯一寫死的數字。
// coda-night：整個漩渦往中心收攏，收進開場的那一彎月，最後消失（畫面停在開場第一個畫面）。
import { Mesh, PlaneGeometry, ShaderMaterial, Vector2, Vector3 } from 'three';
import { SITE } from '../data/site';
import { U } from './materials';
import { c, CUE_IDX, CUES, CUT, lp } from './tracks';
import { clamp, hexTo, lerp, smooth } from './util';
import { VortexText } from './vortex-text';

const MONTHS = 12;
const RINGS = 6;

const VERT = /* glsl */ `
uniform vec2 uC;
uniform float uHalf;
uniform vec2 uRes;
varying vec2 vP;
void main() {
  vP = position.xy * uHalf;
  vec2 px = uC + vP;
  gl_Position = vec4(px / uRes * 2.0 - 1.0, 0.0, 1.0);
}
`;

const FRAG = /* glsl */ `
precision highp float;
varying vec2 vP;
uniform float uR;
uniform float uN[6];
uniform float uG[6];
uniform float uL[6];
uniform float uA;
uniform float uPtr;     // 十二個月：目前轉到第幾個（連續）
uniform float uMarks;   // 三個小記號依序亮起 0..3
uniform vec3 uInk;
uniform vec3 uLit;
uniform float uDpr;
uniform float uAnim;
uniform vec2 uDir[6];   // 各圈標籤的引線方向（單位向量，y 向上）
uniform float uLab[6];  // 標籤（引線）的可見度
uniform float uHi[6];   // 標籤亮起的程度
uniform float uEnd;     // 引線外端（RAD 單位）
const float PI = 3.14159265;
const float TAU = 6.2831853;
float RAD[6]; // 各圈的半徑（漩渦半徑的比例）

float hatch(vec2 p, float k) {
  return step(0.5, fract((p.x + p.y) * k));
}
// 圓角方塊的距離
float box(vec2 q, vec2 h) {
  vec2 d = abs(q) - h;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

void main() {
  RAD[0] = 0.14; RAD[1] = 0.30; RAD[2] = 0.50; RAD[3] = 0.66; RAD[4] = 0.81; RAD[5] = 0.95;
  vec2 p = vP / uR;
  float aa = 1.4 / uR * uDpr;
  float r = length(p);
  float ang0 = atan(p.x, p.y) / TAU;
  float ink = 0.0;   // 墨線覆蓋
  float lit = 0.0;   // 亮色覆蓋
  float halo = 0.0;  // 暈光

  for (int k = 0; k < 6; k++) {
    float g = uG[k];
    if (g <= 0.001) continue;
    float rk = RAD[k];
    float N = uN[k];
    // 慢慢旋轉（動態關時 uAnim 不前進）：相鄰兩圈方向相反
    float rot = uAnim * 0.02 * (mod(float(k), 2.0) < 0.5 ? 1.0 : -1.0);
    float ang = fract(ang0 - rot);
    if (k == 0) {
      // 七盞小燈：圓圈＋亮的填色＋暈光
      float u = ang * N;
      float i = floor(u);
      float a0 = (i + 0.5) / N * TAU + rot * TAU;
      vec2 ctr = rk * vec2(sin(a0), cos(a0));
      float d = length(p - ctr) - 0.058;
      float on = smoothstep(i + 0.0, i + 0.9, uL[0]);
      lit += (1.0 - smoothstep(-aa, aa, d)) * on * g;
      ink += (1.0 - smoothstep(aa * 0.4, aa * 1.4, abs(d))) * g * 0.95;
      halo += exp(-pow(max(d, 0.0) / 0.1, 2.0)) * on * g * 0.55;
    } else if (k == 2) {
      // 十二個月相
      float u = ang * N;
      float i = floor(u);
      float a0 = (i + 0.5) / N * TAU + rot * TAU;
      vec2 ctr = rk * vec2(sin(a0), cos(a0));
      vec2 q = (p - ctr) / 0.085;
      float d = (length(q) - 1.0) * 0.085;
      float inside = 1.0 - smoothstep(-aa, aa, d);
      float seen = smoothstep(i - 0.2, i + 0.6, uPtr + 0.3);
      float cur = 1.0 - smoothstep(0.0, 0.9, abs(uPtr - i));
      // 月相：第 i 個月的相位 = i / 12；亮面朝右
      float m = cos(i / N * TAU);
      float litSide = step(m * sqrt(max(0.0, 1.0 - q.y * q.y)), q.x);
      float moon = inside * litSide;
      float dark = inside * (1.0 - litSide) * hatch(p, 0.5 * uR / 2.6);
      lit += moon * seen * g * (0.55 + 0.45 * cur);
      ink += dark * seen * g * 0.5;
      ink += (1.0 - smoothstep(aa * 0.4, aa * 1.4, abs(d))) * g * (0.35 + 0.6 * seen);
      halo += exp(-pow(max(d, 0.0) / 0.1, 2.0)) * cur * g * 0.5;
      // 第七個月的三個小記號（外側）：聲波環、煙、棚
      if (abs(i - 6.0) < 0.5 && uMarks > 0.0) {
        float fadeM = 1.0 - 0.8 * uG[3];
        vec2 e = vec2(sin(a0), cos(a0));
        for (int m2 = 0; m2 < 3; m2++) {
          float on2 = clamp(uMarks - float(m2), 0.0, 1.0) * fadeM;
          if (on2 <= 0.0) continue;
          vec2 c2 = ctr + e * (0.17 + 0.105 * float(m2)) + vec2(0.0, 0.0);
          vec2 w = (p - c2) / 0.04;
          float v = 0.0;
          if (m2 == 0) {
            // 聲波環：三道同心弧
            float rr = length(w);
            v = (1.0 - smoothstep(0.0, 0.18, abs(rr - 0.35))) + (1.0 - smoothstep(0.0, 0.18, abs(rr - 0.7))) + (1.0 - smoothstep(0.0, 0.18, abs(rr - 1.05)));
            v *= step(w.x, 0.2);
          } else if (m2 == 1) {
            // 煙：往上彎曲的一道線
            float sx = 0.3 * sin(w.y * 3.2);
            v = (1.0 - smoothstep(0.0, 0.2, abs(w.x - sx))) * step(abs(w.y), 1.0);
          } else {
            // 棚：小三角＋兩根柱
            float roof = 1.0 - smoothstep(0.0, 0.2, abs(w.y - (0.9 - abs(w.x) * 0.9)));
            v = roof * step(abs(w.x), 1.0) + (1.0 - smoothstep(0.0, 0.18, abs(abs(w.x) - 0.8))) * step(w.y, 0.9) * step(-0.9, w.y);
          }
          ink += clamp(v, 0.0, 1.0) * on2 * g;
          lit += clamp(v, 0.0, 1.0) * on2 * g * 0.55;
        }
      }
    } else if (k == 5) {
      // 第五十年：一圈光擴散
      float Lx = uL[5];
      float R5 = rk + 0.55 * Lx;
      float d = abs(r - R5);
      float fade = (1.0 - Lx * 0.75) * g;
      lit += (1.0 - smoothstep(0.0, 0.035 + 0.03 * Lx, d)) * fade;
      ink += (1.0 - smoothstep(aa * 0.4, aa * 1.4, abs(d - 0.045))) * fade * 0.7;
      halo += exp(-pow(d / (0.12 + 0.1 * Lx), 2.0)) * fade * 0.7;
      halo += exp(-pow(r / 0.5, 2.0)) * 0.15 * g * (1.0 - Lx);
    } else {
      // 格子：一圈 N 格，亮的填色；最後一格（第 50 格）特別亮
      float u = ang * N;
      float i = floor(u);
      float f = fract(u) - 0.5;
      float cl = TAU * rk / N;
      float hw = k == 1 ? 0.034 : 0.03;
      float d = box(vec2(r - rk, f * cl), vec2(hw, cl * 0.4));
      float last = (k == 1 && i > N - 1.5) ? 1.0 : 0.0;
      float on = smoothstep(i + 0.0, i + 0.8, uL[k]);
      float inside = 1.0 - smoothstep(-aa, aa, d);
      float hz = hatch(p, 0.5 * uR / 2.4);
      lit += inside * on * g * (last > 0.5 ? 1.0 : (0.55 + 0.35 * hz));
      halo += last * on * exp(-pow(max(d, 0.0) / 0.08, 2.0)) * g * 0.8;
      ink += (1.0 - smoothstep(aa * 0.4, aa * 1.5, abs(d))) * g * (0.3 + 0.65 * on) * (last > 0.5 ? 1.25 : 1.0);
    }
  }
  // 標籤的引線：從該圈往外一條細線到標籤；目前那圈的線與圓點亮橘色
  float lw = 0.85 * uDpr / uR;
  float lfeather = 0.8 * uDpr / uR;
  for (int k = 0; k < 6; k++) {
    float v = uLab[k];
    if (v <= 0.001) continue;
    vec2 dr = uDir[k];
    float t = dot(p, dr);
    float dp = abs(p.x * dr.y - p.y * dr.x);
    float a0 = RAD[k] + 0.032;
    float seg = smoothstep(a0 - lfeather, a0, t) * (1.0 - smoothstep(uEnd - lfeather, uEnd, t));
    float ln = (1.0 - smoothstep(lw, lw + lfeather, dp)) * seg;
    float dot0 = 1.0 - smoothstep(0.016 - aa * 0.6, 0.016 + aa * 0.6, length(p - dr * RAD[k]));
    ink += ln * v * 0.7;
    lit += (ln * 0.9 + dot0) * v * uHi[k];
  }
  halo *= 0.86 + 0.14 * sin(uAnim * 2.2);
  float a = clamp(ink * 0.92 + lit * 0.95 + halo, 0.0, 1.0) * uA;
  if (a < 0.003) discard;
  vec3 col = uInk;
  col = mix(col, uLit, clamp(lit + halo * 0.8, 0.0, 1.0) * 0.92);
  col = mix(col, uInk, clamp(ink, 0.0, 1.0) * 0.45 * (1.0 - clamp(halo, 0.0, 1.0)));
  gl_FragColor = vec4(col, a);
}
`;

interface Place {
  /** 螢幕位置（畫面寬高的比例，y 由上往下）與半徑（桌機：畫面高度的比例；手機：CSS px） */
  x: number;
  y: number;
  r: number;
  a: number;
}

// 各拍漩渦的位置：big＝以漩渦為主角的拍（weeks、month7、49）；其餘縮在一角。dx＝桌機的左右（跟 DX3 的主體推移同方向）
const BIG = new Set(['sv-weeks', 'sv-month7', 'sv-49']);
const SIDE_X: Record<string, number> = { 'sv-weeks': -0.22, 'sv-month7': 0.2, 'sv-49': 0.2 };
const DESK_X: Record<string, number> = {
  'sv-sabbath': 0.2, 'sv-creation': -0.22, 'sv-ox': 0.2, 'sv-fallow': -0.22, 'sv-sixth': 0.2, 'sv-release': -0.22, 'sv-egypt': 0.2, 'sv-reading': -0.22,
  'sv-horn': -0.22, 'sv-liberty': 0.2, 'sv-land': -0.22, 'echo-zedekiah': 0.2, 'echo-land-rest': -0.22, 'echo-oath': 0.2,
};

// 大字（太陽正下方一行）：各拍對應 BIG_LINES 的第幾行；沒列的拍（回聲拍、coda）不顯示
const BIG_OF: Record<string, number> = {
  'sv-sabbath': 0, 'sv-creation': 0, 'sv-ox': 0,
  'sv-weeks': 1,
  'sv-month7': 2,
  'sv-fallow': 3, 'sv-sixth': 3, 'sv-release': 3, 'sv-egypt': 3, 'sv-reading': 3,
  'sv-49': 4,
  'sv-horn': 5, 'sv-liberty': 5, 'sv-land': 5,
};
// 各圈標籤的引線角度（從三點鐘方向往上為正）：內圈在上、外圈在下，標籤在漩渦右側排成一欄
const PHI = [55, 33, 11, -11, -33, -55].map((d) => (d * Math.PI) / 180);

export class Vortex {
  mesh: Mesh;
  /** 漩渦上的字（標籤＋大字）的網格；要和 mesh 一起加進覆蓋層 */
  labels: Mesh;
  private text = new VortexText();
  private raw = new Float32Array(RINGS);
  private dirs = new Float32Array(RINGS * 2);
  private labV = new Float32Array(RINGS);
  private labHi = new Float32Array(RINGS);
  private labLeft = new Float32Array(RINGS);
  private labY = new Float32Array(RINGS);
  private labA = new Float32Array(RINGS);
  /** 字還在淡入淡出（閒置跳幀的迴圈要繼續跑） */
  get busy(): boolean {
    return this.text.busy;
  }
  private mat: ShaderMaterial;
  private n = new Float32Array(RINGS);
  private g = new Float32Array(RINGS);
  private l = new Float32Array(RINGS);
  private ink = new Vector3();
  private lit = new Vector3();
  private pl: Place = { x: 0, y: 0, r: 0, a: 0 };
  private pa: Place = { x: 0, y: 0, r: 0, a: 0 };
  private pb: Place = { x: 0, y: 0, r: 0, a: 0 };
  /** 最近一次畫的位置與外圈半徑（CSS px）；tools/check-subject-box.mjs 把漩渦也算進主角 */
  last = { x: 0, y: 0, r: 0, on: false, rects: new Float32Array(7 * 5) };
  /** 十二個月 */
  readonly cells: { days: number; weeks49: number; fifty: number; months: number };

  constructor() {
    const sv = SITE.sevens;
    this.cells = { days: sv.days, weeks49: sv.weeks49, fifty: sv.fifty, months: MONTHS };
    this.n[0] = sv.days;
    this.n[1] = sv.fifty;
    this.n[2] = MONTHS;
    this.n[3] = sv.days;
    this.n[4] = sv.weeks49;
    this.n[5] = 1;
    hexTo('#e6902f', this.lit);
    this.mat = new ShaderMaterial({
      uniforms: {
        uC: { value: new Vector2() },
        uHalf: { value: 100 },
        uRes: U.uRes,
        uR: { value: 100 },
        uN: { value: this.n },
        uG: { value: this.g },
        uL: { value: this.l },
        uA: { value: 0 },
        uPtr: { value: 0 },
        uMarks: { value: 0 },
        uInk: { value: this.ink },
        uLit: { value: this.lit },
        uDpr: U.uDpr,
        uAnim: U.uAnim,
        uDir: { value: this.dirs },
        uLab: { value: this.labV },
        uHi: { value: this.labHi },
        uEnd: { value: 1 },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    this.mesh = new Mesh(new PlaneGeometry(2, 2), this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1.5;
    this.mesh.visible = false;
    this.labels = this.text.mesh;
  }

  /** 某個 cue 的位置（W、H：CSS px） */
  private placeOf(cue: string, H: number, mobile: boolean, out: Place): void {
    const big = BIG.has(cue);
    const echo = cue.startsWith('echo-');
    if (mobile) {
      // sv-month7：說明框最高時上緣在 279，大字要放得進漩渦下緣與說明框之間，所以這一拍縮小一點
      const m7 = cue === 'sv-month7';
      // 小的拍：整個漩渦要落在月份列（下緣約 y=115）與說明框（上緣最高 279）之間，右側留給標籤欄與大字
      out.x = big ? 0.5 : 0.25;
      out.y = (m7 ? 180 : big ? 198 : 190) / H;
      out.r = m7 ? 56 : big ? 76 : 53;
    } else {
      const dx = (big ? SIDE_X[cue] : DESK_X[cue]) ?? 0;
      out.x = 0.5 + dx;
      out.y = big ? 0.4 : 0.2;
      out.r = (big ? 0.27 : 0.115) * H;
    }
    out.a = echo ? 0.4 : 1;
  }

  /**
   * 每幀。s：時間軸；W、H：CSS px；dpr：緩衝／CSS；dark：暗色程度；night：夜（0..1）；moonScreen：月亮在畫面上的位置（CSS px，coda 用）。
   * dt：這一幀的秒數（字的淡入淡出用）。回傳漩渦現在有沒有畫。
   */
  update(s: number, W: number, H: number, dpr: number, mobile: boolean, dark: number, night: number, moonX: number, moonY: number, dt: number): boolean {
    const i0 = CUE_IDX['sv-sabbath'];
    const inCoda = s >= CUT['coda-night'];
    if (s < CUT['sv-sabbath'] - 0.05) {
      this.mesh.visible = false;
      this.text.hide();
      return false;
    }
    const days = this.cells.days;
    const w49 = this.cells.weeks49;
    const fifty = this.cells.fifty;
    const L = (name: string) => lp(s, name);
    // ---- 各圈長出的進度與點亮的格數
    const sab = L('sv-sabbath');
    this.g[0] = smooth(0.02, 0.2, sab + (s >= c('sv-creation') ? 1 : 0));
    this.l[0] = days * smooth(0.14, 0.9, sab);
    const cre = L('sv-creation');
    if (s >= c('sv-creation')) this.l[0] = days + 0.5 * smooth(0.8, 1, cre); // 最後那一圈完整發亮
    this.g[1] = smooth(0, 0.22, L('sv-weeks'));
    this.l[1] = fifty * smooth(0.14, 0.88, L('sv-weeks'));
    this.g[2] = smooth(0, 0.22, L('sv-month7'));
    const m7 = L('sv-month7');
    this.l[2] = 0;
    // 月相依序轉過，停在第七個月（指標 0 → 6）
    const ptrTarget = days - 1;
    const ptr = ptrTarget * smooth(0.12, 0.66, m7);
    this.g[3] = smooth(0, 0.22, L('sv-fallow'));
    this.l[3] = days * smooth(0.12, 0.82, L('sv-fallow'));
    this.g[4] = smooth(0, 0.22, L('sv-49'));
    this.l[4] = w49 * smooth(0.14, 0.88, L('sv-49'));
    this.g[5] = smooth(0, 0.18, L('sv-liberty'));
    this.l[5] = smooth(0.2, 1, L('sv-liberty'));
    // 最外圈的半徑：還沒長出後面的圈時，把漩渦放大到填滿框（不然只有一圈小燈縮在中間）
    this.raw.set(this.g);
    const RADS = [0.14, 0.3, 0.5, 0.66, 0.81, 0.95];
    let outer = RADS[0];
    for (let k = 1; k < RINGS; k++) outer += this.g[k] * (RADS[k] - RADS[k - 1]);
    let rScale = Math.min(3.0, 0.97 / outer);
    // 前面的圈：下一圈長出來以後變淡
    for (let k = 0; k < RINGS - 1; k++) this.g[k] *= 1 - 0.42 * this.g[k + 1];
    const marks = 3 * smooth(0.62, 0.95, m7);
    // ---- 位置
    const idx = Math.min(CUES.length - 1, Math.floor(s));
    const cur = CUES[idx];
    const prev = CUES[Math.max(0, idx - 1)];
    this.placeOf(cur, H, mobile, this.pa);
    this.placeOf(prev, H, mobile, this.pb);
    const tt = smooth(0, 0.3, s - idx);
    const pl = this.pl;
    pl.x = lerp(this.pb.x, this.pa.x, tt);
    pl.y = lerp(this.pb.y, this.pa.y, tt);
    pl.r = lerp(this.pb.r, this.pa.r, tt);
    pl.a = lerp(this.pb.a, this.pa.a, tt);
    if (s < c('sv-sabbath') + 0.02) pl.a = 0; // 進場前還沒有
    // 進入第一拍的瞬間：不等 prev 的位置（prev 不是漩渦的拍）
    if (idx === i0) {
      this.placeOf(cur, H, mobile, pl);
      pl.a = 1;
    }
    let cx = pl.x * W;
    let cy = pl.y * H;
    let R = pl.r;
    let alpha = pl.a;
    if (inCoda) {
      // 往中心收攏，收進開場的那一彎月，最後消失
      const k = smooth(0.12, 0.82, lp(s, 'coda-night'));
      this.placeOf('echo-oath', H, mobile, this.pa);
      const sx = this.pa.x * W;
      const sy = this.pa.y * H;
      const sr = this.pa.r;
      cx = lerp(sx, moonX, k);
      cy = lerp(sy, moonY, k);
      R = lerp(sr, 2, k);
      alpha = 1 - smooth(0.8, 0.96, lp(s, 'coda-night'));
      // 收攏時每一圈都亮著
      for (let q = 0; q < RINGS; q++) this.g[q] = 1 - 0.3 * (q < RINGS - 1 ? 1 : 0);
      this.g[5] = 0.6;
      this.l[5] = 0.0;
      for (let q = 0; q < RINGS - 1; q++) this.l[q] = this.n[q] + 1;
      this.l[0] = days + 0.5;
      rScale = 1;
    }
    // 第七個月以後，月相都已轉完
    const ptrOut = inCoda || s >= c('sv-fallow') ? days - 1 : ptr;
    const marksOut = inCoda || s >= c('sv-fallow') ? 3 : marks;
    // ---- 顏色：夜裡（亮色模式）用紙色當線，其餘用墨色
    const u = this.mat.uniforms;
    const light = 1 - dark;
    const useInk = 1 - night * light; // 夜＋亮色模式：線用紙色（淺）
    this.ink.lerpVectors(U.uPaper.value as Vector3, U.uInk.value as Vector3, clamp(useInk));
    // 暗色模式 uInk 本身就是淺色
    if (dark > 0.5) this.ink.copy(U.uInk.value as Vector3);
    (u.uC.value as Vector2).set(cx * dpr, (H - cy) * dpr);
    u.uR.value = R * rScale * dpr;
    u.uHalf.value = R * dpr * 1.75;
    u.uA.value = clamp(alpha);
    u.uPtr.value = ptrOut;
    u.uMarks.value = marksOut;
    this.mesh.visible = alpha > 0.01 && R > 1;
    // ---- 字：每圈一個標籤（右側一欄，放不下就換到左側）、太陽正下方一行大字
    const vis = this.mesh.visible;
    const sc = R * rScale;
    const endN = outer + 0.06;
    const endPx = endN * sc;
    const codaF = inCoda ? 1 - smooth(0.04, 0.3, lp(s, 'coda-night')) : 1;
    const smallPx = mobile ? 13 : clamp(Math.round(H * 0.0185), 14, 19);
    const bigPx = mobile ? 18 : clamp(Math.round(H * 0.035), 24, 33);
    this.text.setSize(smallPx, bigPx, dpr);
    const rowMode = mobile && !BIG.has(cur);
    const rowGap = Math.min(18, (0.9 * endPx) / 2.5);
    for (let k = 0; k < RINGS; k++) {
      let dx = Math.cos(PHI[k]);
      let dy = Math.sin(PHI[k]);
      if (rowMode) {
        // 手機的小漩渦：標籤排成等距的一欄（行距 18px，放不下才縮），引線的角度由行的高度反推
        dy = clamp(((2.5 - k) * rowGap) / endPx, -0.92, 0.92);
        dx = Math.sqrt(1 - dy * dy);
      }
      const tw = this.text.labelW[k];
      // 預設在右側；手機上漩渦在正中間的拍（右上角有章名牌）改在左側；放不下就換邊
      if (mobile && cx > W * 0.4) dx = -dx;
      // 字的內側邊角離漩渦中心至少 endPx（上下兩端的行，字會往外推一點，才不壓到最外圈）
      const ay = Math.max(0, Math.abs(dy * endPx) - smallPx * 0.6);
      const reach = rowMode ? Math.sqrt(Math.max(0, endPx * endPx - ay * ay)) : Math.abs(dx) * endPx;
      let left = dx > 0 ? cx + reach + 4 : cx - reach - 4 - tw;
      if (left + tw > W - 6 || left < 6) {
        dx = -dx;
        left = dx > 0 ? cx + reach + 4 : cx - reach - 4 - tw;
      }
      this.labLeft[k] = left;
      this.labY[k] = cy - dy * endPx;
      this.dirs[k * 2] = dx;
      this.dirs[k * 2 + 1] = dy;
      this.labV[k] = this.g[k] * codaF;
      this.labA[k] = this.raw[k] * (1 - 0.22 * (k < RINGS - 1 ? this.raw[k + 1] : 0));
      this.labHi[k] = inCoda ? 0 : this.raw[k] * (1 - (k < RINGS - 1 ? this.raw[k + 1] : 0));
    }
    u.uEnd.value = endN;
    const bigTarget = inCoda ? -1 : (BIG_OF[cur] ?? -1);
    const bigGap = mobile ? 7 : 10;
    if (vis) {
      this.text.frame(dt, H, dpr, this.labLeft, this.labY, this.labA, this.labHi, bigTarget, cx, cy + endPx + bigGap, alpha * codaF, dark, night, this.ink, this.lit);
    } else {
      this.text.hide();
    }
    // 字的螢幕矩形（x0, y0, x1, y1, 不透明度；CSS px），給驗收腳本量有沒有被說明框蓋住
    const rc = this.last.rects;
    for (let k = 0; k < RINGS; k++) {
      const tw = this.text.labelW[k];
      rc[k * 5] = this.labLeft[k];
      rc[k * 5 + 1] = this.labY[k] - smallPx * 0.6;
      rc[k * 5 + 2] = this.labLeft[k] + tw;
      rc[k * 5 + 3] = this.labY[k] + smallPx * 0.6;
      rc[k * 5 + 4] = vis ? this.labA[k] * alpha * codaF : 0;
    }
    const bw = this.text.shownBigW;
    rc[30] = cx - bw / 2;
    rc[31] = cy + endPx + bigGap;
    rc[32] = cx + bw / 2;
    rc[33] = cy + endPx + bigGap + bigPx * 1.1;
    rc[34] = vis && bw > 0 && bigTarget >= 0 ? alpha * codaF : 0;
    this.last.x = cx;
    this.last.y = cy;
    // 主角包圍盒：外圈；大字顯示時把大字的下緣也算進來
    let lr = R * rScale * Math.min(outer, 0.97);
    if (vis && this.text.shownBigW > 0) lr = Math.max(lr, endPx + bigGap + bigPx * 1.15);
    this.last.r = lr;
    this.last.on = vis;
    return vis;
  }
}
