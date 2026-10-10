// 搖禾捆互動（cue = wave）：祭司雙手舉著禾捆；讀者按住禾捆來回甩，每甩一下（方向反轉且速度夠快）＝一次 wave-swing，
// 大麥田起一陣從近往遠推開的風浪；三下 wave-done。滑鼠、觸控、按鈕（waveAction）共用同一個 swing()。
import { Group, type PerspectiveCamera, type ShaderMaterial, Vector3, Quaternion } from 'three';
import { story } from '../story/state';
import type { SceneEvent } from './api';
import { RigPerson } from './rig';
import { handGeo, limbGeo, sheafGeo } from './geo2';
import { U, litMat, solid } from './materials';
import { BX, WAVE_IDX, worldAt } from './tracks';
import { robeMat } from './props';
import { clamp, smooth } from './util';

/** 祭司站的位置（世界座標） */
const PX = BX + 9;
const PZ = 0.2;
/** 禾捆靜止時的位置（原點在禾捆底部） */
const REST = new Vector3(PX, 1.6, PZ + 0.45);
const RANGE_X = 0.85;
const GAIN = 1.5;

interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface Step {
  to: Vector3;
  dur: number;
  hold: number;
  fire: boolean;
}

const _a = new Vector3();
const _b = new Vector3();
const _q = new Quaternion();
const _d = new Vector3();
const UP = new Vector3(0, -1, 0);
const _pt = { x: 0, y: 0 };

export class WaveCtl {
  group = new Group();
  /** 動畫進行中（減少動態時用來判斷要不要繼續畫） */
  busy = false;
  private priest: RigPerson;
  private sheaf: Group;
  private limbs: Group[] = [];
  private hands: Group[] = [];
  private cur = REST.clone();
  private desired = REST.clone();
  private vel = new Vector3();
  private mode: 'rest' | 'drag' | 'script' = 'rest';
  private ptrId = -1;
  private px = 0;
  private lastT = 0;
  private speed = 0;
  private dir = 0;
  private stroke = 0;
  private peak = 0;
  private cool = 0;
  private grabOff = new Vector3();
  private hit0 = new Vector3();
  private script: Step[] = [];
  private stepT = 0;
  private stepFired = false;
  private from = new Vector3();
  private cssW = 1;
  private cssH = 1;
  private cleanup: Array<() => void> = [];
  private rect: Rect = { x0: 0, y0: 0, x1: 0, y1: 0 };
  private armMat: ShaderMaterial;

  constructor(private canvas: HTMLCanvasElement, private cam: PerspectiveCamera, private emit: (e: SceneEvent) => void) {
    // 祭司：長袍、頭巾，不畫胸牌、以弗得等經文這裡沒提的服飾；手臂另外裝
    this.priest = new RigPerson({ noArms: true, wrap: true, belt: false, seed: 23, outline: 2.4 }, robeMat('#e4dac0', 23, '#14110e', '#cfc4a6'));
    this.priest.group.position.set(PX, 0, PZ);
    this.group.add(this.priest.group);

    const mSheaf = litMat({ base: '#c6a35a', parts: ['#b79a55', '#d9b861', '#6a4a26'], angle: 70, space: 4, seed: 71 });
    this.sheaf = solid(sheafGeo(7), mSheaf, 1.6);
    this.group.add(this.sheaf);

    this.armMat = litMat({ base: '#c9bd9c', line: '#14110e', angle: 40, space: 4.4, seed: 24 });
    const mHand = litMat({ base: 'silh' });
    for (let i = 0; i < 2; i++) {
      const l = solid(limbGeo(), this.armMat, 2.0);
      const h = solid(handGeo(), mHand, 1.6);
      this.group.add(l, h);
      this.limbs.push(l);
      this.hands.push(h);
    }

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
    this.layout(0);
  }

  setSize(w: number, h: number): void {
    this.cssW = w;
    this.cssH = h;
  }

  private get active(): boolean {
    return story.cue === 'wave' && !story.wave.done;
  }

  // ---------------------------------------------------------------- 投影
  private proj(v: Vector3, out: { x: number; y: number }): void {
    _a.copy(v).project(this.cam);
    out.x = (_a.x * 0.5 + 0.5) * this.cssW;
    out.y = (-_a.y * 0.5 + 0.5) * this.cssH;
  }

  private refreshRect(): void {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    const hx = 0.34;
    const hy = 0.55;
    for (let i = 0; i < 8; i++) {
      _b.set(this.cur.x + (i & 1 ? hx : -hx), this.cur.y + 0.45 + (i & 2 ? hy : -hy), this.cur.z + (i & 4 ? 0.2 : -0.2));
      this.proj(_b, _pt);
      x0 = Math.min(x0, _pt.x);
      x1 = Math.max(x1, _pt.x);
      y0 = Math.min(y0, _pt.y);
      y1 = Math.max(y1, _pt.y);
    }
    const pad = 14;
    this.rect.x0 = x0 - pad;
    this.rect.y0 = y0 - pad;
    this.rect.x1 = x1 + pad;
    this.rect.y1 = y1 + pad;
  }

  interactiveRects(): DOMRect[] {
    if (!this.active) return [];
    this.refreshRect();
    const cr = this.canvas.getBoundingClientRect();
    const r = this.rect;
    return [new DOMRect(cr.left + r.x0, cr.top + r.y0, r.x1 - r.x0, r.y1 - r.y0)];
  }

  // ---------------------------------------------------------------- 動作（拖曳與按鈕共用）
  /** 甩一下：計數、起風浪、事件 */
  private swing(): void {
    if (story.wave.done) return;
    story.wave.swings += 1;
    this.startGust();
    this.emit({ type: 'wave-swing' });
    if (story.wave.swings >= 3) {
      story.wave.done = true;
      story.wave.auto = false;
      this.emit({ type: 'wave-done', auto: false });
    }
  }

  private startGust(): void {
    const t = U.uGustT.value;
    let k = -1;
    for (let i = 0; i < 4; i++) {
      if (t[i] < 0) {
        k = i;
        break;
      }
    }
    if (k < 0) {
      // 全滿：換掉最老的
      let oldest = 0;
      for (let i = 1; i < 4; i++) if (t[i] > t[oldest]) oldest = i;
      k = oldest;
    }
    t[k] = 0;
    U.uGustP.value.set(PZ + 8.5, 16);
  }

  waveAction(): void {
    if (!this.active || this.mode !== 'rest') return;
    const r = REST;
    this.from.copy(this.cur);
    this.script = [
      { to: new Vector3(r.x + 0.6, r.y + 0.2, r.z), dur: 0.26, hold: 0, fire: true },
      { to: new Vector3(r.x - 0.6, r.y + 0.05, r.z), dur: 0.3, hold: 0, fire: false },
      { to: new Vector3(r.x, r.y, r.z), dur: 0.3, hold: 0.1, fire: false },
    ];
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
    _a.set((x / this.cssW) * 2 - 1, -(y / this.cssH) * 2 + 1, 0.5).unproject(this.cam);
    _a.sub(this.cam.position).normalize();
    const t = (REST.z - this.cam.position.z) / _a.z;
    out.copy(this.cam.position).addScaledVector(_a, t);
  }

  private onDown(e: PointerEvent): void {
    if (!this.active || this.mode !== 'rest') return;
    const { x, y } = this.local(e);
    this.refreshRect();
    const r = this.rect;
    if (x < r.x0 || x > r.x1 || y < r.y0 || y > r.y1) return;
    this.mode = 'drag';
    this.ptrId = e.pointerId;
    this.px = x;
    this.lastT = e.timeStamp;
    this.speed = 0;
    this.dir = 0;
    this.stroke = 0;
    this.peak = 0;
    this.ray(x, y, this.hit0);
    this.grabOff.copy(this.cur).sub(this.hit0);
    this.desired.copy(this.cur);
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      /* 某些環境不支援 */
    }
    e.preventDefault();
  }

  private minStroke(): number {
    return clamp(0.07 * Math.min(this.cssW, this.cssH), 28, 64);
  }

  private swingSpeed(): number {
    return clamp(0.22 * Math.min(this.cssW, this.cssH), 110, 320);
  }

  private onMove(e: PointerEvent): void {
    if (this.mode !== 'drag' || e.pointerId !== this.ptrId) return;
    const { x, y } = this.local(e);
    const dt = Math.max((e.timeStamp - this.lastT) / 1000, 0.004);
    const dx = x - this.px;
    const inst = Math.abs(dx) / dt;
    this.speed = this.speed * 0.5 + inst * 0.5;
    this.px = x;
    this.lastT = e.timeStamp;
    // 禾捆跟著指標（水平增益大一點，甩起來看得出來）
    this.ray(x, y, _b);
    this.desired.set(this.hit0.x + this.grabOff.x + (_b.x - this.hit0.x) * GAIN, this.hit0.y + this.grabOff.y + (_b.y - this.hit0.y) * 0.8, REST.z);
    // 方向反轉偵測
    if (Math.abs(dx) >= 1.5) {
      const sg = dx > 0 ? 1 : -1;
      if (this.dir === 0 || sg === this.dir) {
        this.dir = sg;
        this.stroke += Math.abs(dx);
        this.peak = Math.max(this.peak, this.speed * 0.5 + inst * 0.5);
      } else {
        if (this.stroke >= this.minStroke() && this.peak >= this.swingSpeed() && this.cool <= 0) {
          this.cool = 0.16;
          this.swing();
        }
        this.dir = sg;
        this.stroke = Math.abs(dx);
        this.peak = this.speed * 0.5 + inst * 0.5;
      }
    }
    e.preventDefault();
  }

  private onUp(e: PointerEvent): void {
    if (this.mode !== 'drag' || e.pointerId !== this.ptrId) return;
    this.mode = 'rest';
    this.ptrId = -1;
    try {
      this.canvas.releasePointerCapture(e.pointerId);
    } catch {
      /* 已釋放 */
    }
  }

  // ---------------------------------------------------------------- 每幀
  /** 手臂與身體：祭司的身子跟著禾捆微微側移，兩隻手臂從肩膀伸到禾捆 */
  private layout(tilt: number): void {
    const sx = clamp(this.cur.x - REST.x, -RANGE_X, RANGE_X);
    const bodyX = PX + sx * 0.3;
    this.priest.group.position.x = bodyX;
    this.priest.lean = -sx * 0.1;
    this.sheaf.position.copy(this.cur);
    this.sheaf.rotation.set(0, 0, tilt);
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? 1 : -1;
      // 肩（考慮身體的側傾）
      _a.set(bodyX + side * 0.235, 1.38, PZ + 0.02);
      // 手握在禾捆腰間兩側
      const cs = Math.cos(tilt);
      const sn = Math.sin(tilt);
      _b.set(this.cur.x + side * 0.09 * cs - 0.28 * sn, this.cur.y + 0.28 * cs + side * 0.09 * sn, this.cur.z + 0.03);
      const d = _d.subVectors(_b, _a);
      const len = d.length();
      const limb = this.limbs[i];
      limb.position.copy(_a);
      _q.setFromUnitVectors(UP, d.normalize());
      limb.quaternion.copy(_q);
      limb.scale.set(1, len, 1);
      this.hands[i].position.copy(_b);
    }
  }

  update(dt: number, s: number, idx: number, t = 0, mo = false): void {
    // 讀者沒做完就捲走：自動補完
    if (idx > WAVE_IDX && !story.wave.done) {
      story.wave.swings = 3;
      story.wave.done = true;
      story.wave.auto = true;
      this.mode = 'rest';
      this.script = [];
      this.emit({ type: 'wave-done', auto: true });
    }
    if (story.cue !== 'wave' && this.mode !== 'rest') {
      this.mode = 'rest';
      this.script = [];
    }
    this.cool = Math.max(0, this.cool - dt);

    // 風浪年齡
    const gt = U.uGustT.value;
    let gustOn = false;
    for (let i = 0; i < 4; i++) {
      if (gt[i] >= 0) {
        gt[i] += dt;
        if (gt[i] > 4) gt[i] = -1;
        else gustOn = true;
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
        if (st.fire) this.swing();
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

    const want = this.mode === 'rest' ? REST : this.desired;
    const rate = this.mode === 'rest' ? 8 : 26;
    const a = 1 - Math.exp(-dt * rate);
    const px = this.cur.x;
    const py = this.cur.y;
    this.cur.lerp(want, a);
    this.cur.x = clamp(this.cur.x, REST.x - RANGE_X, REST.x + RANGE_X);
    this.cur.y = clamp(this.cur.y, REST.y - 0.3, REST.y + 0.35);
    if (dt > 1e-4) this.vel.set((this.cur.x - px) / dt, (this.cur.y - py) / dt, 0);
    const tilt = clamp(-this.vel.x * 0.16, -0.55, 0.55);
    this.layout(tilt);
    this.priest.update(t, mo);

    this.group.visible = worldAt(s) === 'barley';
    this.busy = this.mode !== 'rest' || gustOn || this.cur.distanceToSquared(REST) > 1e-5;
  }

  dispose(): void {
    this.cleanup.forEach((f) => f());
    this.cleanup = [];
  }
}
