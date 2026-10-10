// 會幕院子（曠野的會幕營地，吹角節與贖罪日）：帷幕圍牆、會幕（聖所＋至聖所）、銅祭壇、洗濯盆。
// 群組原點在院子中心（營地群組座標 CX, CZ），+z 是院子門（朝營地），會幕在後面、門朝 +z。
// 至聖所只用剪影＋香煙：約櫃與施恩座是低調的刻線剪影，基路伯只是翅膀的大輪廓，不畫臉與細節。
import { DoubleSide, Group, Mesh, type PlaneGeometry, PlaneGeometry as PG, type ShaderMaterial, Vector3, Vector4 } from 'three';
import { fenceGeo, incenseAltarGeo, lampstandGeo, laverGeo, showbreadTableGeo, tabernacleGeo, veilGeo, wingGeo, altarGeo, arkGeo } from './geo3';
import { flamePlanesGeo } from './geo2';
import { makeFx, type FxSet } from './fx';
import { flameMat, glowMat, litMat, solid } from './materials';
import { poolGlow, poolMesh, type FrameLite } from './props';
import { COURT_D, COURT_W } from './layout';
import { smooth } from './util';

export const DOOR_Z = 2.5;
export const TENT_Z = -3.0; // 會幕中心
export const TENT_L = 11;
export const TENT_W = 3;
export const TENT_H = 3;
export const VEIL_Z = -3.5;
export const ARK_Z = -7.0;
export const ALTAR: [number, number] = [0, 5.8];
export const LAVER: [number, number] = [3.0, 3.9];

export class Court {
  group = new Group();
  /** 會幕本體（含內部）：scale 用不到，visible 由外面依 s 控制 */
  tent = new Group();
  private veil!: Mesh;
  private veilG!: PlaneGeometry;
  private veilBase!: Float32Array;
  private lampFlames: Mesh[] = [];
  private lampBase: number[] = [];
  private altarFlames: Mesh[] = [];
  private altarBase: number[] = [];
  private flameMats: ShaderMaterial[] = [];
  private pools: ShaderMaterial[] = [];
  private fxAltarS!: FxSet;
  private fxAltarSm!: FxSet;
  /** 香的煙雲：由 uP 驅動 */
  cloud!: FxSet;
  /** 至聖所用點光（香爐的炭火）的材質：每幀更新光源位置與強度 */
  private ptMats: ShaderMaterial[] = [];
  private _pt = new Vector4();
  /** 炭火的光池（至聖所地面） */
  private coalPool!: ShaderMaterial;

  constructor() {
    const g = this.group;
    g.position.set(0, 0, 0);
    const flameGeo = flamePlanesGeo();

    // ---- 帷幕圍牆
    const mFence = litMat({ base: '#e6dec9', line: '#2b2419', angle: 86, angle2: 8, space: 4.8, seed: 61, bias: 0.12 });
    g.add(solid(fenceGeo(COURT_W, COURT_D, 6, 1.5), mFence, 1.6));

    // ---- 會幕外殼
    const { shell, roof } = tabernacleGeo(TENT_W, TENT_L, TENT_H, 1.7, 2.6);
    const mTent = litMat({ base: '#3d3024', line: '#120e0a', angle: 72, space: 4.4, seed: 62, cross: true });
    const mRoof = litMat({ base: '#4a3a2a', line: '#150f0a', angle: 6, angle2: 6, space: 4.6, seed: 63, cross: true });
    this.tent.position.set(0, 0, TENT_Z);
    this.tent.add(solid(shell, mTent, 2.2), solid(roof, mRoof, 2.2));

    // ---- 會幕內部：內襯、地毯、天花板（雙面平面）
    const mInner = litMat({ base: '#b88c3c', line: '#3c260c', angle: 88, angle2: 88, space: 4.4, seed: 64, side: DoubleSide, cross: true, bias: 0.3 });
    const mRug = litMat({ base: '#4a2a22', line: '#150a08', angle: 4, angle2: 4, space: 4.6, seed: 65, side: DoubleSide });
    const mCeil = litMat({ base: '#2c3a5c', line: '#0a0e1c', angle: 4, angle2: 4, space: 4.8, seed: 66, side: DoubleSide });
    const hw = TENT_W / 2 - 0.1;
    const inner = new Group();
    const wallL = new Mesh(new PG(TENT_L - 0.3, TENT_H - 0.1), mInner);
    wallL.rotation.y = Math.PI / 2;
    wallL.position.set(-hw, (TENT_H - 0.1) / 2 + 0.02, 0);
    const wallR = wallL.clone();
    wallR.position.x = hw;
    const wallB = new Mesh(new PG(TENT_W - 0.2, TENT_H - 0.1), mInner);
    wallB.position.set(0, (TENT_H - 0.1) / 2 + 0.02, -TENT_L / 2 + 0.12);
    const floor = new Mesh(new PG(TENT_W - 0.2, TENT_L - 0.3), mRug);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0.03, 0);
    const ceil = new Mesh(new PG(TENT_W - 0.2, TENT_L - 0.3), mCeil);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(0, TENT_H - 0.12, 0);
    inner.add(wallL, wallR, wallB, floor, ceil);
    this.tent.add(inner);

    // 聖所：燈臺（左）、陳設餅的桌子（右）、香壇（幔子前）
    const lz = DOOR_Z - TENT_Z; // 門在會幕座標的 z
    void lz;
    const mGold = litMat({ base: '#d0a23c', parts: ['#d0a23c', '#f2c85a'], line: '#4a3210', angle: 40, space: 4.2, seed: 67 });
    const lamp = solid(lampstandGeo(), mGold, 1.6);
    lamp.position.set(-0.75, 0, VEIL_Z - TENT_Z + 2.2);
    this.tent.add(lamp);
    const mWoodG = litMat({ base: '#7a5a30', parts: ['#7a5a30', '#d9c58a'], line: '#241808', angle: 70, space: 4.2, seed: 68 });
    const tbl = solid(showbreadTableGeo(), mWoodG, 1.6);
    tbl.position.set(0.8, 0, VEIL_Z - TENT_Z + 2.3);
    this.tent.add(tbl);
    const ia = solid(incenseAltarGeo(), mGold, 1.6);
    ia.position.set(0, 0, VEIL_Z - TENT_Z + 0.8);
    this.tent.add(ia);
    // 燈臺的七個火苗
    const fm = flameMat('#ffd37a', '#d2511a');
    this.flameMats.push(fm);
    const cups: [number, number][] = [[0, 1.42]];
    for (const sx of [-1, 1]) for (let k = 1; k <= 3; k++) cups.push([sx * (0.1 + k * 0.1) * 2, 1.4]);
    for (const [cx, cy] of cups) {
      const f = new Mesh(flameGeo, fm);
      f.position.set(-0.75 + cx, cy + 0.04, VEIL_Z - TENT_Z + 2.2);
      f.scale.set(0.1, 0.2, 0.1);
      this.tent.add(f);
      this.lampFlames.push(f);
      this.lampBase.push(0.2);
    }
    // 聖所地面的光池
    const pl = poolGlow();
    this.pools.push(pl);
    const pm = poolMesh(pl, 3.2, -0.55, VEIL_Z - TENT_Z + 2.2);
    pm.position.y = 0.05;
    this.tent.add(pm);

    // ---- 幔子（隔聖所與至聖所）：下緣隨氣流微動
    const mVeil = litMat({ base: '#4a2c5e', line: '#12081a', angle: 90, angle2: 90, space: 4.2, seed: 69, side: DoubleSide, bias: 0.05 });
    this.veilG = veilGeo(TENT_W - 0.2, TENT_H - 0.18);
    this.veil = new Mesh(this.veilG, mVeil);
    this.veil.position.set(0, 0.05, VEIL_Z - TENT_Z);
    this.tent.add(this.veil);
    this.veilBase = new Float32Array(this.veilG.attributes.position.array);

    // ---- 至聖所（幔子後面）：約櫃與施恩座（剪影）、兩對翅膀的大輪廓；點光讓它們從黑暗裡浮出來
    const mkPt = (o: Parameters<typeof litMat>[0]): ShaderMaterial => {
      const m = litMat({ ...o, point: true });
      this.ptMats.push(m);
      return m;
    };
    const mArk = mkPt({ base: '#8a6a34', parts: ['#8a6a34', '#d0a23c', '#a8843c'], line: '#1a1008', angle: 38, space: 4.2, seed: 71, bias: 0.05 });
    const ark = solid(arkGeo(), mArk, 1.4);
    ark.position.set(0, 0, ARK_Z - TENT_Z);
    this.tent.add(ark);
    // 基路伯只畫翅膀的大輪廓：深色剪影，刻線是金色的
    const mWing = litMat({ base: '#241a0e', line: '#c9a040', angle: 52, space: 3.8, seed: 72, side: DoubleSide, bias: -0.1 });
    const wg = wingGeo();
    // 兩個基路伯面對面，翅膀向上展開、翼尖在施恩座上方相觸：每個兩片翅膀（一前一後略錯開），只畫大輪廓
    for (const sx of [-1, 1]) {
      for (const dz of [-0.07, 0.07]) {
        const w = new Mesh(wg, mWing);
        w.position.set(sx * 0.5, 0.64, ARK_Z - TENT_Z + dz);
        w.scale.set(sx * 0.82, 0.82, 1);
        w.rotation.z = sx * -0.02;
        this.tent.add(w);
      }
    }
    const mHolyWall = mkPt({ base: '#8a6a34', line: '#150e06', angle: 88, angle2: 88, space: 4.4, seed: 73, side: DoubleSide, cross: true, bias: -0.08 });
    const mHolyFloor = mkPt({ base: '#3a2a22', line: '#0a0605', angle: 4, angle2: 4, space: 4.6, seed: 74, side: DoubleSide, bias: -0.05 });
    const hz0 = VEIL_Z - TENT_Z;
    const hz1 = -TENT_L / 2 + 0.12;
    const hl = hz0 - hz1;
    const hwL = new Mesh(new PG(hl, TENT_H - 0.1), mHolyWall);
    hwL.rotation.y = Math.PI / 2;
    hwL.position.set(-hw, (TENT_H - 0.1) / 2 + 0.02, (hz0 + hz1) / 2);
    const hwR = hwL.clone();
    hwR.position.x = hw;
    const hwB = new Mesh(new PG(TENT_W - 0.2, TENT_H - 0.1), mHolyWall);
    hwB.position.set(0, (TENT_H - 0.1) / 2 + 0.02, hz1 + 0.03);
    const hf = new Mesh(new PG(TENT_W - 0.2, hl), mHolyFloor);
    hf.rotation.x = -Math.PI / 2;
    hf.position.set(0, 0.06, (hz0 + hz1) / 2);
    const hc = new Mesh(new PG(TENT_W - 0.2, hl), mkPt({ base: '#202a44', line: '#080b16', angle: 4, angle2: 4, space: 4.8, seed: 75, side: DoubleSide }));
    hc.rotation.x = Math.PI / 2;
    hc.position.set(0, TENT_H - 0.14, (hz0 + hz1) / 2);
    this.tent.add(hwL, hwR, hwB, hf, hc);
    // 炭火的光池（香爐在至聖所前段，位置由 Autumn 每幀寫入）
    this.coalPool = glowMat({ pool: true, on: '#f08a30', flick: 0.3 });
    const cpm = poolMesh(this.coalPool, 3.0, 0, ARK_Z - TENT_Z + 1.4);
    cpm.position.y = 0.09;
    this.tent.add(cpm);
    this.coalMesh = cpm;
    g.add(this.tent);

    // ---- 銅祭壇與火、洗濯盆
    const mAltar = litMat({ base: '#8a5a2c', parts: ['#8a5a2c', '#6a4220'], line: '#1c1008', angle: 40, space: 4.2, seed: 76, cross: true });
    const altar = solid(altarGeo(), mAltar, 1.8);
    altar.position.set(ALTAR[0], 0, ALTAR[1]);
    g.add(altar);
    const af = flameMat('#ffd070', '#d2511a');
    this.flameMats.push(af);
    for (let i = 0; i < 4; i++) {
      const m = new Mesh(flameGeo, af);
      const s0 = [0.95, 0.7, 0.8, 0.6][i];
      m.position.set(ALTAR[0] + (i % 2 ? 0.3 : -0.3), 0.92, ALTAR[1] + (i < 2 ? 0.25 : -0.25));
      m.scale.set(0.5 * (1.1 - i * 0.1), s0 * 0.62, 0.5 * (1.1 - i * 0.1));
      g.add(m);
      this.altarFlames.push(m);
      this.altarBase.push(s0 * 0.62);
    }
    const apool = poolGlow();
    this.pools.push(apool);
    g.add(poolMesh(apool, 7, ALTAR[0], ALTAR[1] + 0.6));
    const org: [number, number, number][] = [[ALTAR[0], 1.15, ALTAR[1]]];
    this.fxAltarS = makeFx('spark', org, 14, 0.07, 81);
    this.fxAltarSm = makeFx('smoke', org, 7, 0.9, 82);
    g.add(this.fxAltarS.mesh, this.fxAltarSm.mesh);

    const mLaver = litMat({ base: '#8a5a2c', parts: ['#8a5a2c', '#14110e'], line: '#1c1008', angle: 40, space: 4.2, seed: 77 });
    const laver = solid(laverGeo(), mLaver, 1.8);
    laver.position.set(LAVER[0], 0, LAVER[1]);
    g.add(laver);

    // ---- 香的煙雲（至聖所）：出口在香爐上方，往外漫開
    const co: [number, number, number][] = [];
    for (let i = 0; i < 12; i++) co.push([((i % 4) - 1.5) * 0.4, 0.5 + (i % 3) * 0.4, ARK_Z - 0.3 + (i % 5) * 0.32]);
    this.cloud = makeFx('cloud', co, 14, 1.5, 91);
    this.cloud.mesh.renderOrder = 7;
    this.tent.add(this.cloud.mesh);
    this.cloud.mesh.position.set(0, 0, -TENT_Z); // 煙的原點是院子座標，換成會幕座標
    g.visible = false;
    void Vector3;
  }

  coalMesh!: Mesh;

  /** 每幀：火苗、幔子、點光、炭火。cens：香爐的位置（院子座標）；censOn：炭火亮度 0..1；cloudP：香煙進度 0..1 */
  update(fr: FrameLite, _s: number, dayK: number, cens: Vector3, censOn: number, cloudP: number, fireOn: number): void {
    const t = fr.time;
    const mo = !fr.motionOff;
    // 火：形狀抖動；白天火光淡
    const fl = mo ? 1 : 0;
    for (const m of this.flameMats) m.uniforms.uFlick.value = fl;
    for (let i = 0; i < this.lampFlames.length; i++) {
      const w = mo ? 1 + 0.18 * Math.sin(t * 9.1 + i * 1.9) + 0.1 * Math.sin(t * 15.7 + i * 3.1) : 1;
      this.lampFlames[i].scale.y = this.lampBase[i] * w;
    }
    for (let i = 0; i < this.altarFlames.length; i++) {
      const w = mo ? 1 + 0.15 * Math.sin(t * 8.3 + i * 2.2) + 0.08 * Math.sin(t * 14.1 + i) : 1;
      this.altarFlames[i].scale.y = this.altarBase[i] * w;
      this.altarFlames[i].visible = fireOn > 0.01;
    }
    const night = 1 - dayK * 0.6;
    for (const p of this.pools) p.uniforms.uOn.value = fireOn * night;
    const on = mo ? fireOn : 0;
    this.fxAltarS.mat.uniforms.uOn.value = on;
    this.fxAltarSm.mat.uniforms.uOn.value = on * (0.55 + 0.45 * (1 - dayK));
    this.fxAltarS.mesh.visible = fireOn > 0.01;
    this.fxAltarSm.mesh.visible = fireOn > 0.01;
    // 幔子下緣隨氣流微動
    if (this.tent.visible && this.veil.visible) {
      const pos = this.veilG.attributes.position;
      const base = this.veilBase;
      const H = TENT_H - 0.18;
      for (let i = 0; i < pos.count; i++) {
        const x = base[i * 3];
        const y = base[i * 3 + 1];
        const k = (1 - y / H) * (1 - y / H);
        const sway = mo ? (Math.sin(t * 1.15 + x * 2.6 + y * 0.8) * 0.045 + Math.sin(t * 2.3 + x * 4.1) * 0.02) * k : 0;
        pos.setZ(i, base[i * 3 + 2] + sway + 0.015 * Math.sin(x * 9 + 1) * (1 - k * 0.3));
      }
      pos.needsUpdate = true;
    }
    // 至聖所的點光（香爐的炭火）：位置在院子座標，材質要的是世界座標；院子群組在世界裡的位置固定
    const pw = this.group.parent ? this.group.parent.position : null;
    const wx = (pw ? pw.x : 0) + this.group.position.x + cens.x;
    const wy = cens.y;
    const wz = (pw ? pw.z : 0) + this.group.position.z + cens.z;
    const flick = mo ? 1 + 0.12 * Math.sin(t * 11 + 1) + 0.07 * Math.sin(t * 23) : 1;
    this._pt.set(wx, wy + 0.1, wz, 9 * censOn * flick);
    for (const m of this.ptMats) (m.uniforms.uPt.value as Vector4).copy(this._pt);
    this.coalPool.uniforms.uOn.value = censOn * (0.55 + 0.45 * smooth(0, 0.3, cloudP));
    this.coalMesh.position.x = cens.x;
    this.coalMesh.position.z = cens.z - TENT_Z;
    this.cloud.mat.uniforms.uP.value = cloudP;
    this.cloud.mat.uniforms.uOn.value = cloudP > 0.001 ? 1 : 0;
    this.cloud.mesh.visible = cloudP > 0.001;
  }
}
