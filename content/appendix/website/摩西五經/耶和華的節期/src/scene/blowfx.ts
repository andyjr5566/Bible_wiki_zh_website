// 吹角：不畫角、號，也不畫正在吹的人。只畫從會幕院子門口擴散出去的刻線聲波環（垂直面朝鏡頭＋平放地面），
// 帳棚布面被推動（見 shaders.ts 的 FLAP 與 U.uBlow*）、人影轉向（autumn.ts）、鏡頭震動（world.ts）。
// 讀者觸發的動作：story.blow.level 由介面的長按按鈕寫入，動態關也照常播放。
import { Mesh, PlaneGeometry, type ShaderMaterial } from 'three';
import { ringMat, U } from './materials';
import { GATE_X, GATE_Z } from './layout';

const RINGS = 8;
const SPEED = 14; // 公尺／秒
const MAX_R = 34;
const INTERVAL = 0.35; // 每 0.35 秒一圈

export class BlowFx {
  readonly vert: Mesh;
  readonly flat: Mesh;
  private matV: ShaderMaterial;
  private matF: ShaderMaterial;
  private age = new Float32Array(RINGS).fill(-1);
  private amp = new Float32Array(RINGS);
  private timer = 0;
  /** 有環還在擴散，或按鈕還按著／還沒回落 */
  busy = false;

  /** cx、cz、y：聲波的中心（世界座標；預設是會幕院子門口）；drive：要不要驅動帳棚布面的全域 uniform（一次只讓一個實例驅動） */
  private drive: boolean;
  private cx: number;
  private cz: number;
  constructor(cx = GATE_X, cz = GATE_Z, y = 1.6, drive = true) {
    this.drive = drive;
    this.cx = cx;
    this.cz = cz;
    this.matV = ringMat(true);
    this.matF = ringMat(false);
    this.vert = new Mesh(new PlaneGeometry(90, 70), this.matV);
    this.vert.position.set(cx, 24 + (y - 1.6), cz + 0.5);
    this.vert.renderOrder = 8;
    this.vert.frustumCulled = false;
    this.flat = new Mesh(new PlaneGeometry(90, 90), this.matF);
    this.flat.rotation.x = -Math.PI / 2;
    this.flat.position.set(cx, 0.07 + y - 1.6, cz);
    this.flat.renderOrder = 8;
    this.flat.frustumCulled = false;
    (this.matV.uniforms.uC.value as { set: (x: number, y: number, z: number) => void }).set(cx, y, cz + 0.5);
    (this.matF.uniforms.uC.value as { set: (x: number, y: number, z: number) => void }).set(cx, y - 1.6, cz);
    this.vert.visible = false;
    this.flat.visible = false;
  }

  /** dt：秒（已夾在 0–0.1）；level：story.blow.level；show：現在在不在吹角節的營地 */
  update(dt: number, level: number, show: boolean): void {
    // 帳棚布面被推動：全域 uniform
    if (this.drive) {
      U.uBlowC.value.set(this.cx, this.cz);
      U.uBlowA.value = level;
      U.uBlowT.value += dt;
    }
    if (level > 0.02) {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.timer = INTERVAL;
        // 找一個空位（沒有就換掉最老的）
        let k = -1;
        let oldest = 0;
        for (let i = 0; i < RINGS; i++) {
          if (this.age[i] < 0) {
            k = i;
            break;
          }
          if (this.age[i] > this.age[oldest]) oldest = i;
        }
        if (k < 0) k = oldest;
        this.age[k] = 0;
        // level 越高越亮；環的密度由 level 越高時間隔越短（level 高時加快）
        this.amp[k] = 0.35 + 0.65 * level;
      }
      // level 越高越密：高 level 時下一圈提早
      this.timer -= dt * level * 0.6;
    } else {
      this.timer = 0;
    }
    let alive = false;
    const rr = this.matV.uniforms.uR.value as Float32Array;
    const aa = this.matV.uniforms.uA.value as Float32Array;
    const rf = this.matF.uniforms.uR.value as Float32Array;
    const af = this.matF.uniforms.uA.value as Float32Array;
    for (let i = 0; i < RINGS; i++) {
      if (this.age[i] >= 0) {
        this.age[i] += dt;
        const R = this.age[i] * SPEED;
        if (R > MAX_R) {
          this.age[i] = -1;
        } else {
          alive = true;
        }
      }
      const R = this.age[i] >= 0 ? this.age[i] * SPEED : -1;
      const fade = R < 0 ? 0 : (1 - R / MAX_R) * this.amp[i] * Math.min(1, R / 1.2 + 0.25);
      rr[i] = R;
      aa[i] = fade;
      rf[i] = R;
      af[i] = fade;
    }
    this.busy = alive || level > 0.001;
    this.vert.visible = show && (alive || level > 0.02);
    this.flat.visible = this.vert.visible;
  }
}
