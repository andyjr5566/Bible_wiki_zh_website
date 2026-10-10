// meal 分格的室內：一家人站著吃，腰間束帶、手拿杖；桌上有餅和一盤菜。人物一律剪影。
import { BoxGeometry, Mesh, PerspectiveCamera, PlaneGeometry, Scene, SphereGeometry, Vector4 } from 'three';
import { breadGeo, dishGeo, mergeParts, T, tableGeo, type Part } from './geo';
import { RigPerson, type RigOpts } from './rig';
import { smooth, lerp } from './util';
import { FIXED, glowMat, litMat, solid } from './materials';

const RAD = Math.PI / 180;
/** 取景：水平要容納的公尺數（人群含手杖約 3.6m）、垂直要容納的公尺數（地板到頭頂上方）、鏡頭與目標 */
const FIT_W = 4.7;
const FIT_H = 2.75;
const CAM_Y = 1.4;
const TARGET_Y = 1.15;
const TARGET_Z = -1.2;

export class Interior {
  scene = new Scene();
  camera = new PerspectiveCamera(40, 1, 0.1, 100);
  private pt = new Vector4(0.2, 2.3, -0.4, 1.7);
  private people: RigPerson[] = [];
  private baseArm: [number, number][] = [];
  private eatSide: ('L' | 'R')[] = [];
  private lamp: Mesh;

  constructor() {
    const point = (o: Parameters<typeof litMat>[0]) => {
      const m = litMat({ ...o, point: true });
      m.uniforms.uPt.value = this.pt;
      return m;
    };
    const mWall = point({ base: FIXED.ochre, angle: 88, angle2: 10, space: 4.8, seed: 31, cross: true });
    const mFloor = point({ base: '#7a5d3a', angle: 4, angle2: 4, space: 5, seed: 32 });
    const mWood = point({ base: '#6e5433', angle: 74, angle2: 10, space: 4.4, seed: 33 });
    const mBread = point({ base: '#c9b27a', angle: 20, space: 4, seed: 34, bias: 0.1 });
    const mDish = point({ base: '#8a6a45', angle: 30, space: 4, seed: 35 });
    const mHerb = point({ base: '#6e7040', angle: 40, space: 4, seed: 36 });
    const robe = (alt: string) => point({ base: FIXED.ochre, parts: [alt, '#14110e', '#2b2218', '#4e3a22', '#14110e', '#d8cdb4'], angle: 40, space: 4.4, seed: 37 });

    // 房間：後牆、兩側牆、地面
    const back = new Mesh(new BoxGeometry(34, 14, 0.3), mWall);
    back.position.set(0, 7, -2.5);
    const sideL = new Mesh(new BoxGeometry(0.3, 14, 18), mWall);
    sideL.position.set(-8, 7, 5);
    const sideR = sideL.clone();
    sideR.position.x = 8;
    const floor = new Mesh(new PlaneGeometry(36, 26), mFloor);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, 0);
    this.scene.add(back, sideL, sideR, floor);

    // 桌：餅與一盤菜
    const table = solid(tableGeo(), mWood, 2);
    table.position.set(0, 0, -0.55);
    this.scene.add(table);
    const bread = new Mesh(breadGeo(), mBread);
    const bread2 = new Mesh(breadGeo(), mBread);
    bread.position.set(-0.45, 0.68, -0.5);
    bread2.position.set(-0.3, 0.7, -0.62);
    const dish = solid(dishGeo(), mDish, 1.4);
    dish.position.set(0.35, 0.66, -0.5);
    const herbs: Part[] = [];
    for (let i = 0; i < 7; i++) herbs.push({ g: new SphereGeometry(1, 5, 4), m: T(Math.cos(i * 1.9) * 0.08, 0.04 + (i % 3) * 0.015, Math.sin(i * 1.9) * 0.08, i, i * 2, 0, 0.07, 0.025, 0.045) });
    const herb = new Mesh(mergeParts(herbs), mHerb);
    herb.position.set(0.35, 0.7, -0.5);
    this.scene.add(bread, bread2, dish, herb);

    // 全家人：站在桌後，面向鏡頭
    const spec: Array<{ x: number; opts: RigOpts; mat: ReturnType<typeof robe>; yaw: number }> = [
      { x: -1.35, opts: { staff: true, staffSide: 'R', belt: true, armL: [0.55, 0.1], armR: [0.4, 0.2] }, mat: robe('#a88758'), yaw: 0.25 },
      { x: -0.5, opts: { belt: true, armL: [0.7, 0.1], armR: [0.5, 0.12], scale: 0.94 }, mat: robe('#cdbf9e'), yaw: 0.1 },
      { x: 0.55, opts: { belt: true, scale: 0.6, armL: [0.8, 0.12], armR: [0.4, 0.2] }, mat: robe('#b79a68'), yaw: -0.1 },
      { x: 1.3, opts: { staff: true, staffSide: 'L', belt: true, armL: [0.4, 0.2], armR: [0.6, 0.1], scale: 0.9 }, mat: robe('#8f7550'), yaw: -0.3 },
    ];
    spec.forEach((p, i) => {
      const r = new RigPerson({ ...p.opts, seed: 90 + i }, p.mat);
      r.group.position.set(p.x, 0, -1.35 + (i % 2) * 0.15);
      r.group.rotation.y = p.yaw;
      this.scene.add(r.group);
      this.people.push(r);
      const side: 'L' | 'R' = p.opts.staff && p.opts.staffSide === 'L' ? 'R' : 'L';
      this.eatSide.push(side);
      this.baseArm.push(side === 'L' ? [p.opts.armL?.[0] ?? 0.05, p.opts.armL?.[1] ?? 0.12] : [p.opts.armR?.[0] ?? 0.05, p.opts.armR?.[1] ?? 0.12]);
      const b = new Mesh(breadGeo(), mBread);
      b.scale.setScalar(0.8);
      b.rotation.x = 0.3;
      (side === 'L' ? r.handL : r.handR).add(b);
    });

    // 燈
    this.lamp = new Mesh(new PlaneGeometry(0.55, 0.55), glowMat({ hatch: 0.9, edge: '#a8741f', flick: 0.15 }));
    this.lamp.position.set(0.2, 2.5, -2.3);
    this.scene.add(this.lamp);
  }

  dispose(): void {
    this.scene.traverse((o) => {
      const m = o as Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as { dispose?: () => void } | undefined;
      mat?.dispose?.();
    });
  }

  /**
   * 依分格的寬高比取景：寬度要容納一家人（含手杖），高度要從地板到頭頂上方都在框裡。
   * 兩個限制取較遠者，所以很扁的橫框也不會切到頭。
   */
  update(time: number, motionOff: boolean, aspect: number, p = 0): void {
    const t = motionOff ? 0 : time;
    this.pt.w = 1.7 * (1 + Math.sin(t * 7.3) * 0.035 + Math.sin(t * 3.1) * 0.03);
    // meal：輪流把餅舉到嘴邊；拿杖的手換握（隨捲動）
    for (let k = 0; k < this.people.length; k++) {
      const r = this.people[k];
      const w0 = 0.08 + 0.2 * k;
      const up = smooth(w0, w0 + 0.07, p) * (1 - smooth(w0 + 0.13, w0 + 0.2, p));
      const side = this.eatSide[k];
      const base = this.baseArm[k];
      const bite = 0.04 * Math.sin(p * 90 + k) * up;
      if (side === 'L') {
        r.aim('L', -0.28, 0.5, 0.7);
        r.swingL = lerp(base[0], r.swingL + bite, up);
        r.splayL = lerp(base[1], r.splayL, up);
      } else {
        r.aim('R', 0.28, 0.5, 0.7);
        r.swingR = lerp(base[0], r.swingR + bite, up);
        r.splayR = lerp(base[1], r.splayR, up);
      }
      r.headPitch = 0.14 * up;
      if (k === 0) r.staffMix = smooth(0.44, 0.58, p);
      r.update(time, !motionOff);
    }
    const cam = this.camera;
    const fov = 40;
    const tanH = Math.tan(fov * 0.5 * RAD);
    const needW = FIT_W / 2 / (tanH * Math.max(aspect, 0.3));
    const needH = FIT_H / 2 / tanH;
    const dist = Math.max(needW, needH);
    cam.fov = fov;
    cam.aspect = aspect;
    cam.position.set(0, CAM_Y, TARGET_Z + dist);
    cam.lookAt(0, TARGET_Y, TARGET_Z);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
  }
}
