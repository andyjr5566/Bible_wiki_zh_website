// 塗血互動（cue = hyssop）：按住牛膝草 → 進盆蘸血 → 打在門楣／左門柱／右門柱。
// 滑鼠、觸控、鍵盤按鈕（hyssopAction）共用同一組蘸血／打血／落空的函式與事件。
import { Group, PerspectiveCamera, type ShaderMaterial, Vector3 } from 'three';
import { story, type HyssopPart } from '../story/state';
import type { SceneEvent } from './api';
import { hyssopGeo, HYSSOP_LEN } from './geo';
import { FIXED, litMat, solid } from './materials';
import { c, DAY_S, HYSSOP_IDX } from './tracks';
import { clamp, smooth } from './util';

const PLANE_Z = 0.78;
const REST_TIP = new Vector3(1.62, 1.1, 0.28);
const BASIN = new Vector3(-1.35, 0.3, 0.95);
const PARTS: HyssopPart[] = ['lintel', 'left', 'right'];
/** 各處在世界座標的中心與半尺寸（x, y） */
const REGION: Record<HyssopPart, { c: Vector3; hx: number; hy: number }> = {
  lintel: { c: new Vector3(0, 2.45, 0.24), hx: 1.05, hy: 0.2 },
  left: { c: new Vector3(-0.9, 1.3, 0.24), hx: 0.2, hy: 1.3 },
  right: { c: new Vector3(0.9, 1.3, 0.24), hx: 0.2, hy: 1.3 },
};

interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
const newRect = (): Rect => ({ x0: 0, y0: 0, x1: 0, y1: 0 });

interface Step {
  to: Vector3;
  dur: number;
  hold: number;
  fn: () => void;
}

const _p = new Vector3();
const _q = new Vector3();
const _pt = { x: 0, y: 0 };
const _pt2 = { x: 0, y: 0 };

export class HyssopCtl {
  group = new Group();
  private arm: Group;
  private bundleMat: ShaderMaterial;
  /** 動畫進行中 */
  busy = false;
  private cur = REST_TIP.clone();
  private desired = REST_TIP.clone();
  private mode: 'rest' | 'drag' | 'script' = 'rest';
  private grab = 0;
  private red = 0;
  private shake = 0;
  private recoil = 0;
  private inBasin = false;
  private ptrId = -1;
  private px = 0;
  private py = 0;
  private lastT = 0;
  private speed = 0;
  private peak = 0;
  private vx = 0;
  private cool = 0;
  private script: Step[] = [];
  private stepT = 0;
  private stepFired = false;
  private from = new Vector3();
  private cssW = 1;
  private cssH = 1;
  private cam: PerspectiveCamera;
  private cleanup: Array<() => void> = [];
  private rects: Rect[] = [newRect(), newRect(), newRect()];
  private regionRects: Record<HyssopPart, Rect> = { lintel: newRect(), left: newRect(), right: newRect() };

  constructor(private canvas: HTMLCanvasElement, cam: PerspectiveCamera, private emit: (e: SceneEvent) => void) {
    this.cam = cam;
    const g = hyssopGeo();
    this.bundleMat = litMat({ base: FIXED.ochre, parts: ['#8f7d47', '#7a7f45', '#14110e'], angle: 60, space: 4, seed: 21 });
    const armMat = litMat({ base: FIXED.ochre, parts: ['#a88758', '#14110e'], angle: 40, space: 4.4, seed: 22 });
    this.group.add(solid(g.bundle, this.bundleMat, 1.6));
    this.arm = solid(g.arm, armMat, 2.2);
    this.group.add(this.arm);
    this.arm.visible = false;
    this.group.position.copy(REST_TIP);
    this.group.rotation.set(-0.3, 0, 0);

    const down = (e: PointerEvent) => this.onDown(e);
    const move = (e: PointerEvent) => this.onMove(e);
    const up = (e: PointerEvent) => this.onUp(e);
    const tm = (e: TouchEvent) => {
      if (this.mode === 'drag') e.preventDefault();
    };
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('touchmove', tm, { passive: false });
    this.cleanup.push(
      () => canvas.removeEventListener('pointerdown', down),
      () => canvas.removeEventListener('pointermove', move),
      () => canvas.removeEventListener('pointerup', up),
      () => canvas.removeEventListener('pointercancel', up),
      () => canvas.removeEventListener('touchmove', tm),
    );
  }

  setSize(w: number, h: number): void {
    this.cssW = w;
    this.cssH = h;
  }

  private get active(): boolean {
    return story.cue === 'hyssop' && !story.hyssop.done;
  }

  // ---------------------------------------------------------------- 投影
  private proj(v: Vector3, out: { x: number; y: number }): void {
    _q.copy(v).project(this.cam);
    out.x = (_q.x * 0.5 + 0.5) * this.cssW;
    out.y = (-_q.y * 0.5 + 0.5) * this.cssH;
  }

  private boxRect(cx: number, cy: number, cz: number, hx: number, hy: number, hz: number, out: Rect, pad: number): void {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    const pt = _pt2;
    for (let i = 0; i < 8; i++) {
      _p.set(cx + (i & 1 ? hx : -hx), cy + (i & 2 ? hy : -hy), cz + (i & 4 ? hz : -hz));
      this.proj(_p, pt);
      if (pt.x < x0) x0 = pt.x;
      if (pt.x > x1) x1 = pt.x;
      if (pt.y < y0) y0 = pt.y;
      if (pt.y > y1) y1 = pt.y;
    }
    out.x0 = x0 - pad;
    out.y0 = y0 - pad;
    out.x1 = x1 + pad;
    out.y1 = y1 + pad;
  }

  private refreshRects(): void {
    // 牛膝草束：草尖到草底
    const pt = _pt;
    this.proj(this.cur, pt);
    const tipX = pt.x;
    const tipY = pt.y;
    _p.set(0, -HYSSOP_LEN, 0).applyEuler(this.group.rotation).add(this.cur);
    this.proj(_p, pt);
    const r = this.rects[0];
    r.x0 = Math.min(tipX, pt.x) - 30;
    r.x1 = Math.max(tipX, pt.x) + 30;
    r.y0 = Math.min(tipY, pt.y) - 30;
    r.y1 = Math.max(tipY, pt.y) + 30;
    this.boxRect(BASIN.x, 0.15, BASIN.z, 0.42, 0.18, 0.42, this.rects[1], 16);
    this.boxRect(0, 1.3, 0.24, 1.05, 1.3, 0.1, this.rects[2], 18);
    for (const k of PARTS) {
      const rg = REGION[k];
      this.boxRect(rg.c.x, rg.c.y, rg.c.z, rg.hx, rg.hy, 0.05, this.regionRects[k], k === 'lintel' ? 26 : 34);
    }
  }

  private inRect(r: Rect, x: number, y: number): boolean {
    return x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;
  }

  /** 指標所在的門框部位（沒有就回傳 null）；重疊時取離中心最近者 */
  private partAt(x: number, y: number): HyssopPart | null {
    let best: HyssopPart | null = null;
    let bd = Infinity;
    for (const k of PARTS) {
      const r = this.regionRects[k];
      if (!this.inRect(r, x, y)) continue;
      const cx = (r.x0 + r.x1) / 2;
      const cy = (r.y0 + r.y1) / 2;
      const d = Math.hypot((x - cx) / ((r.x1 - r.x0) / 2), (y - cy) / ((r.y1 - r.y0) / 2));
      if (d < bd) {
        bd = d;
        best = k;
      }
    }
    return best;
  }

  interactiveRects(): DOMRect[] {
    if (story.cue !== 'hyssop' || story.hyssop.done) return [];
    this.refreshRects();
    const cr = this.canvas.getBoundingClientRect();
    return this.rects.map((r) => new DOMRect(cr.left + r.x0, cr.top + r.y0, r.x1 - r.x0, r.y1 - r.y0));
  }

  // ---------------------------------------------------------------- 動作（拖曳與按鈕共用）
  private dip(): void {
    this.red = 1;
    story.hyssop.dipped = true;
    this.emit({ type: 'hyssop-dip' });
  }

  private strike(part: HyssopPart): void {
    if (story.hyssop.marks[part]) return;
    story.hyssop.marks[part] = true;
    this.red = Math.max(0.45, this.red - 0.2);
    this.recoil = 1;
    this.emit({ type: 'hyssop-strike', part });
    if (PARTS.every((k) => story.hyssop.marks[k])) {
      story.hyssop.done = true;
      story.hyssop.auto = false;
      this.emit({ type: 'hyssop-done', auto: false });
    }
  }

  private miss(): void {
    this.shake = 1;
    this.emit({ type: 'hyssop-miss' });
  }

  private hit(part: HyssopPart): void {
    if (story.hyssop.marks[part]) return;
    if (story.hyssop.dipped) this.strike(part);
    else this.miss();
  }

  hyssopAction(a: 'dip' | HyssopPart): void {
    if (!this.active || this.mode === 'drag') return;
    const to = a === 'dip' ? new Vector3(BASIN.x, BASIN.y, BASIN.z) : new Vector3(REGION[a].c.x, REGION[a].c.y, PLANE_Z);
    this.from.copy(this.cur);
    this.script = [{ to, dur: 0.5, hold: 0.22, fn: () => (a === 'dip' ? this.dip() : this.hit(a)) }];
    this.stepT = 0;
    this.stepFired = false;
    this.mode = 'script';
  }

  // ---------------------------------------------------------------- 指標
  private local(e: PointerEvent): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private ray(x: number, y: number, out: Vector3): void {
    _q.set((x / this.cssW) * 2 - 1, -(y / this.cssH) * 2 + 1, 0.5).unproject(this.cam);
    _q.sub(this.cam.position).normalize();
    const t = (PLANE_Z - this.cam.position.z) / _q.z;
    out.copy(this.cam.position).addScaledVector(_q, t);
  }

  private onDown(e: PointerEvent): void {
    if (!this.active || this.mode === 'script') return;
    const { x, y } = this.local(e);
    this.refreshRects();
    if (this.inRect(this.rects[0], x, y)) {
      this.mode = 'drag';
      this.ptrId = e.pointerId;
      this.px = x;
      this.py = y;
      this.lastT = e.timeStamp;
      this.speed = 0;
      this.peak = 0;
      this.vx = 0;
      try {
        this.canvas.setPointerCapture(e.pointerId);
      } catch {
        /* 某些環境不支援 */
      }
      this.ray(x, y, this.desired);
      e.preventDefault();
      return;
    }
    if (this.inRect(this.rects[1], x, y)) {
      this.hyssopAction('dip');
      e.preventDefault();
      return;
    }
    const part = this.partAt(x, y);
    if (part) {
      this.hyssopAction(part);
      e.preventDefault();
    }
  }

  private onMove(e: PointerEvent): void {
    if (this.mode !== 'drag' || e.pointerId !== this.ptrId) return;
    const { x, y } = this.local(e);
    const dt = Math.max((e.timeStamp - this.lastT) / 1000, 0.004);
    const sp = Math.hypot(x - this.px, y - this.py) / dt;
    this.speed = this.speed * 0.5 + sp * 0.5;
    this.vx = this.vx * 0.6 + ((x - this.px) / dt) * 0.4;
    this.px = x;
    this.py = y;
    this.lastT = e.timeStamp;
    this.ray(x, y, this.desired);
    this.refreshRects();
    // 進盆
    const inB = this.inRect(this.rects[1], x, y);
    if (inB && !this.inBasin && !story.hyssop.done) this.dip();
    this.inBasin = inB;
    // 甩動後在門框上減速或停住 → 打（放開時在區域內由 onUp 處理）
    const th = this.strikeSpeed();
    this.peak = Math.max(this.peak * 0.9, this.speed);
    const part = this.partAt(x, y);
    if (part && this.peak > th && this.speed < this.peak * 0.4 && this.cool <= 0 && !story.hyssop.marks[part]) {
      this.cool = 0.28;
      this.peak = 0;
      this.hit(part);
    }
    e.preventDefault();
  }

  private strikeSpeed(): number {
    return clamp(0.4 * Math.min(this.cssW, this.cssH), 150, 450);
  }

  private onUp(e: PointerEvent): void {
    if (this.mode !== 'drag' || e.pointerId !== this.ptrId) return;
    const { x, y } = this.local(e);
    this.refreshRects();
    const part = this.partAt(x, y);
    if (part && this.cool <= 0 && !story.hyssop.marks[part]) this.hit(part);
    this.mode = 'rest';
    this.ptrId = -1;
    this.inBasin = false;
    try {
      this.canvas.releasePointerCapture(e.pointerId);
    } catch {
      /* 已釋放 */
    }
  }

  // ---------------------------------------------------------------- 每幀
  update(dt: number, s: number, idx: number): void {
    // 讀者沒做完就捲走：自動補完三處血跡
    if (idx > HYSSOP_IDX && !story.hyssop.done) {
      for (const k of PARTS) story.hyssop.marks[k] = true;
      story.hyssop.dipped = true;
      story.hyssop.done = true;
      story.hyssop.auto = true;
      this.mode = 'rest';
      this.script = [];
      this.emit({ type: 'hyssop-done', auto: true });
    }
    // 離開 hyssop cue 就放開
    if (story.cue !== 'hyssop' && this.mode !== 'rest') {
      this.mode = 'rest';
      this.script = [];
    }
    this.cool = Math.max(0, this.cool - dt);
    if (this.mode === 'drag' && this.cool <= 0 && this.peak > this.strikeSpeed() && performance.now() - this.lastT > 90) {
      const part = this.partAt(this.px, this.py);
      if (part && !story.hyssop.marks[part]) {
        this.cool = 0.28;
        this.peak = 0;
        this.hit(part);
      }
    }

    // 腳本
    if (this.mode === 'script' && this.script.length) {
      const st = this.script[0];
      this.stepT += dt;
      const k = clamp(this.stepT / st.dur);
      this.desired.lerpVectors(this.from, st.to, smooth(0, 1, k));
      if (k >= 1 && !this.stepFired) {
        this.stepFired = true;
        st.fn();
      }
      if (this.stepT >= st.dur + st.hold) {
        this.script.shift();
        this.stepT = 0;
        this.stepFired = false;
        this.from.copy(this.desired);
        if (!this.script.length) this.mode = 'rest';
      }
    } else if (this.mode === 'script') {
      this.mode = 'rest';
    }

    // 目標位置：拖曳時進盆會被吸向盆中
    let want = this.mode === 'rest' ? REST_TIP : this.desired;
    if (this.mode === 'drag' && this.inBasin) {
      _p.copy(this.desired).lerp(BASIN, 0.75);
      want = _p;
    }
    const rate = this.mode === 'rest' ? 9 : 24;
    const a = 1 - Math.exp(-dt * rate);
    this.cur.lerp(want, a);
    const holding = this.mode !== 'rest';
    this.grab += ((holding ? 1 : 0) - this.grab) * (1 - Math.exp(-dt * 12));

    // 姿態：靜置＝倚牆；拿起＝草尖朝上、前臂從右下伸入
    const g = smooth(0, 1, this.grab);
    this.recoil = Math.max(0, this.recoil - dt * 5);
    this.shake = Math.max(0, this.shake - dt * 3.5);
    const sh = Math.sin(this.shake * 30) * this.shake * 0.05;
    const rec = Math.sin(this.recoil * Math.PI) * 0.18;
    this.group.position.set(this.cur.x + sh, this.cur.y, this.cur.z + rec * 0.4);
    this.group.rotation.set(-0.3 + 0.62 * g, 0, 0.5 * g + clamp(this.vx / 3000, -0.35, 0.35) * g + rec * 0.4);
    this.arm.visible = this.grab > 0.12;

    // 葉尖顏色：蘸血變紅
    const cols = (this.bundleMat.uniforms.uPartCol.value as Vector3[])[1];
    const t = clamp(this.red);
    cols.set(0.48 + (0.64 - 0.48) * t, 0.5 + (0.14 - 0.5) * t, 0.27 + (0.1 - 0.27) * t);

    this.busy = this.mode !== 'rest' || this.grab > 0.01 || this.shake > 0 || this.recoil > 0 || this.cur.distanceToSquared(REST_TIP) > 1e-5;

    // 只在塗血那段時間之後到逃離前才顯示
    this.group.visible = s >= c('day-14', 0.9) && s < DAY_S;
  }

  dispose(): void {
    this.cleanup.forEach((f) => f());
    this.cleanup = [];
  }
}









