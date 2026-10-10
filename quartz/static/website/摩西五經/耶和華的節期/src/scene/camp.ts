// 兩處營地：疏割的野地（無酵節 bake、seven-days）與西乃的帳棚營地（二月逾越節）。
import { Color, ConeGeometry, DoubleSide, Group, InstancedMesh, Mesh, type ShaderMaterial, SphereGeometry } from 'three';
import { story } from '../story/state';
import { basinGeo, breadGeo, dishGeo, personGeo } from './geo';
import { clothGeo, fireBaseGeo, flamePlanesGeo, rockGeo, tentGeo } from './geo2';
import { makeFx, type FxSet } from './fx';
import { flameMat, litMat, solid, solidInstanced } from './materials';
import { type FrameLite, hillMesh, poolGlow, poolMesh, robeMat, setInst } from './props';
import { AnimalCrowd, PersonCrowd, RigPerson } from './rig';
import { c, lp, NX, SX } from './tracks';
import { CX, CZ } from './layout';
import { clamp, lerp, mulberry32, smooth } from './util';

type P3 = [number, number, number];

export class Camp {
  succoth = new Group();
  sinai = new Group();
  private dough: Group;
  private doughMat: ShaderMaterial;
  private flameMats: ShaderMaterial[] = [];
  private flames: { m: Mesh; base: number; ph: number; group: 'succoth' | 'sinai' }[] = [];
  private pools: ShaderMaterial[] = [];
  private near = new Group();
  private flameGeo = flamePlanesGeo();
  // 疏割的人與牲畜
  private sit!: PersonCrowd;
  private stand!: PersonCrowd;
  private sheep!: AnimalCrowd;
  private cattle!: AnimalCrowd;
  private tuftMat!: ShaderMaterial;
  private fxS: FxSet[] = [];
  private fxN: FxSet[] = [];
  // 西乃
  private men: RigPerson[] = [];
  private menFrom: [number, number][] = [];
  private menTo: [number, number][] = [];
  private moses!: RigPerson;
  private aaron!: RigPerson;
  private eaters: RigPerson[] = [];
  private walkers!: PersonCrowd;
  private walkLane: number[] = [];
  private breads: Mesh[] = [];
  /** 二月逾越節的那一角（帳棚、布、餅、圍著吃的人）：秋季不要 */
  private second = new Group();
  private big!: Group;
  private tentMain!: InstancedMesh;
  private tentSpots: { x: number; z: number; yaw: number; sc: number }[] = [];
  private tentHidden = false;
  /** 營火的總開關（0..1），目前一律 1 */
  fireK = 1;

  constructor() {
    this.doughMat = litMat({ base: '#dccb9c', angle: 25, space: 4, seed: 52, bake: true });
    this.dough = new Group();
    this.buildSuccoth();
    this.buildSinai();
    this.succoth.visible = false;
    this.sinai.visible = false;
  }

  // ---------------------------------------------------------------- 火
  private addFlames(parent: Group, x: number, z: number, heights: number[], size: number, group: 'succoth' | 'sinai'): void {
    const fm = flameMat();
    this.flameMats.push(fm);
    const fg = this.flameGeo;
    heights.forEach((h, i) => {
      const m = new Mesh(fg, fm);
      m.position.set(x + (i - (heights.length - 1) / 2) * 0.12 * size, 0.06, z + (i % 2 ? 0.05 : -0.05) * size);
      m.scale.set(size * (1.1 - i * 0.12), size * h, size * (1.1 - i * 0.12));
      parent.add(m);
      this.flames.push({ m, base: size * h, ph: i * 1.7 + x, group });
    });
  }
  private addPool(parent: Group, size: number, x: number, z: number): void {
    const pm = poolGlow();
    this.pools.push(pm);
    parent.add(poolMesh(pm, size, x, z));
  }

  // ---------------------------------------------------------------- 疏割
  private buildSuccoth(): void {
    const g = this.succoth;
    g.position.set(SX, 0, 0);
    const rnd = mulberry32(61);
    const mHill = litMat({ base: 'paper', angle: 4, angle2: 0, space: 5.0, seed: 6, bias: -0.3 });
    g.add(hillMesh(mHill, -110, -160, 100, 14, 55), hillMesh(mHill, 130, -190, 120, 18, 60), hillMesh(mHill, 10, -250, 180, 11, 50), hillMesh(mHill, -240, -80, 90, 12, 70));

    // 近景：石頭、生麵團、火、麵盆、布
    const mRock = litMat({ base: '#a69a82', angle: 50, space: 4.4, seed: 51, cross: true });
    const rock = solid(rockGeo(2), mRock, 2.2);
    rock.scale.set(0.56, 0.22, 0.46);
    rock.position.set(0, 0.17, 0);
    g.add(rock);
    const dg = new SphereGeometry(1, 20, 12);
    this.dough = solid(dg, this.doughMat, 2.0);
    g.add(this.dough);

    const mFire = litMat({ base: '#6f6a5e', parts: ['#7d7667', '#2a1d12'], angle: 30, space: 4, seed: 53 });
    const fire = solid(fireBaseGeo(), mFire, 1.6);
    fire.position.set(1.1, 0, -0.55);
    g.add(fire);
    this.addFlames(g, 1.1, -0.55, [1.0, 0.78, 0.6], 0.85, 'succoth');
    this.addPool(g, 4.4, 1.1, -0.55);

    const bs = basinGeo();
    const mBowl = litMat({ base: '#7b5a39', angle: 20, space: 4.4, seed: 13 });
    const bowl = solid(bs.bowl, mBowl, 2.2);
    bowl.scale.setScalar(1.35);
    bowl.position.set(-1.0, 0, -0.1);
    g.add(bowl);
    const mCloth = litMat({ base: '#e6dec9', angle: 10, space: 4.4, seed: 54, side: DoubleSide, bias: 0.18 });
    const cloth = solid(clothGeo(0.8, 0.6), mCloth, 1.6);
    cloth.position.set(-1.35, 0, 0.75);
    cloth.rotation.y = 0.5;
    g.add(cloth);

    // 遠處：各家散開，各有一處小火、坐著的人與牲畜
    const clusters: [number, number][] = [[-9, -8], [6.5, -12], [-17, -17], [14, -22], [-4, -30], [23, -9], [-26, -27], [-33, -9], [32, -30]];
    this.sit = new PersonCrowd(personGeo({ sit: true, low: true, belt: true }), robeMat('#a88758', 14), clusters.length * 4, 1.6);
    this.stand = new PersonCrowd(personGeo({ low: true, belt: true, staff: true, staffSide: 'R' }), robeMat('#b59a68', 15), 14, 1.6);
    this.sheep = new AnimalCrowd('lamb', litMat({ base: 'paper', parts: ['#e9e1cc', '#14110e'], angle: 50, space: 4.4, seed: 15 }), 22, 1.4);
    this.cattle = new AnimalCrowd('cow', litMat({ base: '#6b5030', parts: ['#6b5030', '#14110e'], angle: 50, space: 4.4, seed: 16 }), 5, 1.4);
    g.add(this.sit.group, this.stand.group, this.sheep.group, this.cattle.group);
    let si = 0;
    let sti = 0;
    let shi = 0;
    const far: P3[] = [];
    clusters.forEach(([cx, cz]) => {
      this.addFlames(g, cx, cz, [1.0], 1.9, 'succoth');
      this.addPool(g, 8, cx, cz);
      far.push([cx, 0.5, cz]);
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2 + rnd();
        const r = 1.8 + rnd() * 0.6;
        const it = this.sit.items[si++];
        it.x = cx + Math.cos(a) * r;
        it.z = cz + Math.sin(a) * r;
        it.y = 0;
        it.yaw = Math.atan2(-Math.cos(a), -Math.sin(a));
        it.sc = 1.0 + rnd() * 0.1;
      }
      if (sti < 14) {
        const it = this.stand.items[sti++];
        it.x = cx + 3 + rnd() * 2;
        it.z = cz + 1 + rnd() * 2;
        it.y = 0;
        it.yaw = rnd() * 6.28;
        it.sc = 0.96 + rnd() * 0.1;
      }
      for (let k = 0; k < 2 && shi < 22; k++) {
        const it = this.sheep.items[shi++];
        it.x = cx - 3.5 + rnd() * 2;
        it.z = cz + rnd() * 3;
        it.y = 0;
        it.yaw = rnd() * 6.28;
        it.sc = 0.9 + rnd() * 0.2;
      }
    });
    for (let k = 0; k < 5; k++) {
      const it = this.cattle.items[k];
      it.x = -22 + rnd() * 52;
      it.z = -14 - rnd() * 18;
      it.y = 0;
      it.yaw = rnd() * 6.28;
      it.sc = 1;
    }
    while (shi < 22) {
      const it = this.sheep.items[shi++];
      it.x = -30 + rnd() * 60;
      it.z = -6 - rnd() * 24;
      it.y = 0;
      it.yaw = rnd() * 6.28;
      it.sc = 1;
    }
    while (sti < 14) {
      const it = this.stand.items[sti++];
      it.x = -30 + rnd() * 60;
      it.z = -14 - rnd() * 18;
      it.y = 0;
      it.yaw = rnd() * 6.28;
      it.sc = 1;
    }

    // 火星與煙：近景一處、遠處九處
    const nearFx: P3[] = [[1.1, 0.5, -0.55]];
    this.fxS = [makeFx('spark', nearFx, 14, 0.05, 3), makeFx('spark', far, 12, 0.22, 4)];
    this.fxN = [makeFx('smoke', nearFx, 6, 0.55, 5), makeFx('smoke', far, 5, 1.5, 6)];
    for (const f of [...this.fxS, ...this.fxN]) g.add(f.mesh);

    // 草叢：幾簇小草增加地面層次（隨風擺）
    this.tuftMat = litMat({ base: '#8a8a52', angle: 80, space: 4, seed: 55, wind: true });
    const tuft = new InstancedMesh(new ConeGeometry(0.05, 0.4, 3), this.tuftMat, 140);
    tuft.frustumCulled = false;
    for (let i = 0; i < 140; i++) setInst(tuft, i, (rnd() - 0.5) * 70, 0.18, 2 - rnd() * 40, rnd() * 6, 0.7 + rnd() * 0.8, 0.7 + rnd());
    g.add(tuft);
  }

  // ---------------------------------------------------------------- 西乃
  private buildSinai(): void {
    const g = this.sinai;
    g.position.set(NX, 0, 0);
    const rnd = mulberry32(71);
    // 遠方低矮的山影（兩層）
    const mHill = litMat({ base: 'paper', angle: 4, angle2: 0, space: 5.0, seed: 6, bias: -0.3 });
    const mRidge = litMat({ base: 'paper', angle: 8, angle2: 10, space: 4.6, seed: 19, bias: -0.18, cross: true });
    const ridgeGeo = new ConeGeometry(1, 1, 7, 1);
    const ridges: [number, number, number, number][] = [
      [-260, -330, 140, 30], [-130, -310, 120, 22], [20, -340, 170, 34], [170, -320, 130, 24], [300, -340, 150, 30], [-380, -300, 110, 20],
      [-60, -420, 220, 46], [220, -430, 200, 40],
    ];
    for (const [x, z, w, h] of ridges) {
      const m = new Mesh(ridgeGeo, mRidge);
      m.position.set(x, h / 2 - 1, z);
      m.scale.set(w, h, w * 0.55);
      m.rotation.y = rnd() * 3;
      g.add(m);
    }
    g.add(hillMesh(mHill, -80, -150, 110, 8, 40), hillMesh(mHill, 110, -170, 120, 9, 40));

    // 帳棚：人字形低面數帳棚，門朝向中央；布面隨風波動
    const tg = tentGeo();
    const mTent = litMat({ base: '#3b2e22', parts: ['#403328', '#e7b55a'], partAlt: '#56422e', angle: 70, space: 4.4, seed: 61, cross: true, flap: true });
    const spots: { x: number; z: number; yaw: number; sc: number; a: number }[] = [];
    for (let x = -62; x <= 46; x += 6.8) {
      for (let z = -78; z <= -3; z += 6.4) {
        const px = x + (rnd() - 0.5) * 2.4;
        const pz = z + (rnd() - 0.5) * 2.4;
        if (Math.abs(px - CX) < 13 && Math.abs(pz - CZ) < 12) continue;
        if (Math.abs(px + 5) < 9 && pz > -26) continue; // 通往中央帳棚的空地：近景留空，讓人與營地隔著一點距離
        if (pz > -12 && px > -1 && px < 32) continue;
        spots.push({ x: px, z: pz, yaw: Math.atan2(CX - px, CZ - pz) + (rnd() - 0.5) * 0.5 + (rnd() < 0.45 ? Math.PI / 2 : 0), sc: 1.0 + rnd() * 0.45, a: rnd() });
      }
    }
    const tents = solidInstanced(tg, mTent, spots.length, 1.5);
    g.add(tents.group);
    this.tentMain = tents.main;
    this.tentSpots = spots;
    spots.forEach((p, i) => {
      setInst(tents.main, i, p.x, 0, p.z, p.yaw, p.sc);
      tents.main.setColorAt(i, new Color(p.a, 0, 0));
    });
    tents.main.instanceMatrix.needsUpdate = true;
    if (tents.main.instanceColor) tents.main.instanceColor.needsUpdate = true;

    // 中央較大的帳棚
    const bigMat = litMat({ base: '#4d3d2c', parts: ['#5a4934', '#f0c46a'], angle: 70, space: 4.4, seed: 62, cross: true, flap: true });
    const big = solid(tg, bigMat, 2.0);
    big.position.set(CX, 0, CZ);
    big.scale.set(2.5, 2.3, 2.5);
    g.add(big);
    this.big = big;
    // 營火的光點：帳棚之間幾處小火
    const fires: [number, number][] = [[-30, -30], [14, -26], [-20, -58], [24, -52], [-4, -62], [30, -68], [-40, -18], [8, -14]];
    const fxp: P3[] = [];
    for (const [fx, fz] of fires) {
      this.addFlames(g, fx, fz, [1.0], 1.4, 'sinai');
      this.addPool(g, 6, fx, fz);
      fxp.push([fx, 0.5, fz]);
    }
    const sp = makeFx('spark', fxp, 10, 0.2, 7);
    const sm = makeFx('smoke', fxp, 4, 1.3, 8);
    g.add(sp.mesh, sm.mesh);
    this.fxS.push(sp);
    this.fxN.push(sm);

    // 帳棚之間走動的人（隨捲動）
    this.walkers = new PersonCrowd(personGeo({ low: true, belt: true, staff: true, staffSide: 'R' }), robeMat('#b59a68', 16), 8, 1.4);
    g.add(this.walkers.group);
    for (let i = 0; i < 8; i++) this.walkLane.push(-14 - i * 7.5);

    // 近景：帳棚前站著的人、摩西與亞倫（剪影，不畫五官、不加光環）
    g.add(this.near);
    const t1 = solid(tg, mTent, 1.8);
    t1.position.set(4.6, 0, 0.2);
    t1.scale.setScalar(1.25);
    this.near.add(t1);
    const men: { x: number; z: number; sc: number; robe: string; o: Parameters<typeof personGeo>[0] }[] = [
      { x: 2.6, z: 5.6, sc: 1.0, robe: '#a88758', o: { slim: true, belt: true, armL: [1.25, 0.35], armR: [0.1, 0.12] } },
      { x: 3.5, z: 6.2, sc: 0.95, robe: '#cdbf9e', o: { slim: true, belt: true, armL: [0.1, 0.12], armR: [0.7, 0.2] } },
      { x: 4.4, z: 5.5, sc: 1.03, robe: '#8f7550', o: { slim: true, belt: true, staff: true, staffSide: 'R', armL: [0.6, 0.2], armR: [0.3, 0.15] } },
      { x: 5.3, z: 6.2, sc: 0.92, robe: '#b79a68', o: { slim: true, belt: true, armL: [0.9, 0.25], armR: [0.1, 0.12] } },
    ];
    men.forEach((m, i) => {
      const r = new RigPerson({ ...m.o, scale: m.sc, seed: 20 + i }, robeMat(m.robe, 20 + i));
      r.group.position.set(m.x, 0, m.z);
      this.near.add(r.group);
      this.men.push(r);
      this.menTo.push([m.x, m.z]);
      this.menFrom.push([4.2 + (i - 1.5) * 0.75, 3.2]);
    });
    const mSil = litMat({ base: 'silh' });
    this.moses = new RigPerson({ slim: true, belt: false, armL: [0.15, 0.14], armR: [0.35, 0.18], scale: 1.06, seed: 41 }, mSil);
    this.moses.group.position.set(7.2, 0, 5.7);
    this.moses.group.rotation.y = -Math.PI / 2 + 0.15;
    this.near.add(this.moses.group);
    this.aaron = new RigPerson({ slim: true, belt: false, armL: [0.4, 0.16], armR: [0.12, 0.14], scale: 0.98, seed: 42 }, mSil);
    this.aaron.group.position.set(8.0, 0, 6.6);
    this.aaron.group.rotation.y = -Math.PI / 2 - 0.1;
    this.near.add(this.aaron.group);

    // second-month：一個營帳前，幾個人圍著站著吃（戶外）
    g.add(this.second);
    const t2 = solid(tg, mTent, 1.8);
    t2.position.set(22, 0, -2.6);
    t2.scale.setScalar(1.3);
    this.second.add(t2);
    const mCl = litMat({ base: '#d8cdb4', angle: 8, space: 4.4, seed: 63, side: DoubleSide });
    const mat = solid(clothGeo(1.5, 1.0), mCl, 1.4);
    mat.position.set(22, 0, 3.6);
    this.second.add(mat);
    const mBread = litMat({ base: '#c9b27a', angle: 20, space: 4, seed: 34, bias: 0.1 });
    for (const [bx, bz] of [[-0.35, 2.55], [-0.15, 2.8]]) {
      const b = new Mesh(breadGeo(), mBread);
      b.position.set(22 + bx, 0.03, bz + 0.9);
      this.second.add(b);
    }
    const dish = solid(dishGeo(), litMat({ base: '#8a6a45', angle: 30, space: 4, seed: 35 }), 1.4);
    dish.position.set(22.35, 0.02, 3.55);
    this.second.add(dish);
    const eaters: { a: number; r: number; robe: string; o: Parameters<typeof personGeo>[0]; sc: number }[] = [
      { a: -2.6, r: 1.5, robe: '#a88758', o: { staff: true, staffSide: 'R', belt: true, armL: [0.8, 0.1], armR: [0.4, 0.2] }, sc: 1 },
      { a: -1.95, r: 1.45, robe: '#cdbf9e', o: { belt: true, armL: [0.9, 0.1], armR: [0.5, 0.12] }, sc: 0.94 },
      { a: -1.2, r: 1.45, robe: '#8f7550', o: { staff: true, staffSide: 'L', belt: true, armL: [0.4, 0.2], armR: [0.85, 0.1] }, sc: 0.98 },
      { a: -0.55, r: 1.5, robe: '#b79a68', o: { belt: true, armL: [0.85, 0.12], armR: [0.4, 0.2] }, sc: 0.62 },
    ];
    eaters.forEach((e, i) => {
      const px = 22 + Math.cos(e.a) * e.r;
      const pz = 3.6 + Math.sin(e.a) * e.r * 0.8;
      const r = new RigPerson({ ...e.o, scale: e.sc, seed: 30 + i, kid: i === 3 }, robeMat(e.robe, 30 + i));
      r.group.position.set(px, 0, pz);
      r.group.rotation.y = Math.atan2(22.1 - px, 3.6 - pz) + (i % 2 ? 0.15 : -0.12);
      this.second.add(r.group);
      this.eaters.push(r);
      const b = new Mesh(breadGeo(), mBread);
      b.scale.setScalar(0.7);
      r.handL.add(b);
      this.breads.push(b);
    });
  }

  /** 秋季的營地（吹角節、贖罪日）：拿掉春天的近景與大帳棚，會幕院子範圍內的帳棚收起來（hw、hd＝院子半寬半深，含餘裕） */
  setAutumn(on: boolean, hw: number, hd: number): void {
    if (on === this.tentHidden) return;
    this.tentHidden = on;
    for (let i = 0; i < this.tentSpots.length; i++) {
      const p = this.tentSpots[i];
      const hide = on && Math.abs(p.x - CX) < hw && Math.abs(p.z - CZ) < hd;
      setInst(this.tentMain, i, p.x, 0, p.z, p.yaw, hide ? 0.0001 : p.sc);
    }
    this.tentMain.instanceMatrix.needsUpdate = true;
  }

  // ---------------------------------------------------------------- 每幀
  update(fr: FrameLite, s: number): void {
    const t = fr.time;
    const mo = !fr.motionOff;
    const inSuccoth = this.succoth.visible;
    const inSinai = this.sinai.visible;
    this.near.visible = s >= c('unclean') && !this.tentHidden;
    this.second.visible = !this.tentHidden;
    this.big.visible = !this.tentHidden;
    // 火：形狀抖動、伸縮；seven-days 一夜一夜明暗交替
    const k7 = clamp(story.day - 15, 0, 6);
    const night = s >= c('seven-days') ? 0.7 + 0.3 * (0.5 + 0.5 * Math.cos(Math.PI * 2 * k7)) : 1;
    const fl = mo ? 1 : 0;
    const fk = this.fireK;
    for (const m of this.flameMats) m.uniforms.uFlick.value = fl;
    for (const f of this.flames) {
      if ((f.group === 'succoth') !== inSuccoth && (f.group === 'sinai') !== inSinai) continue;
      const w = mo ? 1 + 0.14 * Math.sin(t * 8.7 + f.ph) + 0.08 * Math.sin(t * 14.3 + f.ph * 2) : 1;
      f.m.scale.y = Math.max(0.0001, f.base * w * (f.group === 'succoth' ? night : 1) * fk);
    }
    for (const pm of this.pools) pm.uniforms.uOn.value = (inSuccoth ? night : 1) * fk;
    const fxOn = mo ? 1 : 0;
    for (const f of this.fxS) f.mat.uniforms.uOn.value = fxOn * (inSuccoth ? night : 1) * fk;
    for (const f of this.fxN) f.mat.uniforms.uOn.value = fxOn * fk;

    if (inSuccoth) {
      const p = clamp(story.bake.progress);
      const k = smooth(0, 1, p);
      const sx = lerp(0.36, 0.52, k);
      const sy = lerp(0.2, 0.05, k);
      this.dough.scale.set(sx, sy, sx * 0.92);
      this.dough.position.set(0, 0.38 + sy * 0.82, 0);
      this.doughMat.uniforms.uBake.value = k;
      // bake：其他營火旁的人蹲下、起身、遞東西（隨捲動）
      const pb = lp(s, 'bake');
      for (let i = 0; i < this.stand.items.length; i++) {
        const it = this.stand.items[i];
        it.sy = 1 - 0.2 * Math.max(0, Math.sin(pb * 11 + it.ph * 2)) ** 1.5;
        it.lean = 0.14 * Math.max(0, Math.sin(pb * 11 + it.ph * 2 - 0.9));
      }
      for (let i = 0; i < this.sit.items.length; i++) {
        const it = this.sit.items[i];
        it.lean = 0.13 * Math.sin(pb * 9 + it.ph * 3) * (0.5 + 0.5 * Math.sin(it.ph));
      }
      this.sit.update(t, mo);
      this.stand.update(t, mo);
      this.sheep.update(t, mo);
      this.cattle.update(t, mo);
    }

    if (inSinai) {
      // 帳棚之間走動的人（隨捲動：走一段路）
      for (let i = 0; i < this.walkers.items.length; i++) {
        const it = this.walkers.items[i];
        const dir = i % 2 ? -1 : 1;
        const run = (s * 16 + i * 31) % 90;
        it.x = dir * (run - 45);
        it.z = this.walkLane[i];
        it.y = Math.abs(Math.sin(run / 0.8)) * 0.04;
        it.yaw = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        it.sc = this.tentHidden && Math.abs(this.walkLane[i] - CZ) < 10 ? 0.0001 : 1.0 + (i % 3) * 0.04;
      }
      this.walkers.update(t, mo);
      // unclean：那幾個人隨捲動走向摩西、亞倫，停在一段距離外
      const pu = lp(s, 'unclean');
      const walk = smooth(0.08, 0.7, pu);
      for (let i = 0; i < this.men.length; i++) {
        const r = this.men[i];
        const fx = lerp(this.menFrom[i][0], this.menTo[i][0], walk);
        const fz = lerp(this.menFrom[i][1], this.menTo[i][1], walk);
        const moving = walk > 0.001 && walk < 0.999;
        const dyaw = Math.atan2(this.menTo[i][0] - this.menFrom[i][0], this.menTo[i][1] - this.menFrom[i][1]);
        r.group.rotation.y = s < c('unclean') + 0.7 ? lerp(dyaw, Math.PI / 2 - 0.1 + i * 0.05, smooth(0.62, 0.78, pu)) : Math.PI / 2 - 0.1 + i * 0.05;
        const bob = moving ? r.gait(walk * 24 + i, 1) : 0;
        if (!moving) {
          r.swingL = 0.2;
          r.swingR = 0.2;
          r.twist = 0;
        }
        r.group.position.set(fx, bob, fz);
      }
      // wait：摩西轉身走進大帳棚，其餘人留在原地
      const pw = lp(s, 'wait');
      const turn = smooth(0.08, 0.24, pw);
      const go = smooth(0.24, 0.97, pw);
      const mx = lerp(7.2, -6, go);
      const mz = lerp(5.7, -31.2, go);
      const yawTo = Math.atan2(-6 - 7.2, -31.2 - 5.7);
      this.moses.group.rotation.y = lerp(-Math.PI / 2 + 0.15, yawTo, turn);
      const mb = go > 0 && go < 1 ? this.moses.gait(go * 60, 1) : 0;
      if (!(go > 0 && go < 1)) {
        this.moses.swingL = 0.15;
        this.moses.swingR = 0.35;
        this.moses.twist = 0;
      }
      this.moses.group.position.set(mx, mb, mz);
      this.moses.group.visible = !(s >= c('wait') && pw > 0.965) && !(s > c('second-month', -0.01));
      // second-month：圍著吃的人舉餅、遞給旁人
      const pm = lp(s, 'second-month');
      for (let i = 0; i < this.eaters.length; i++) {
        const r = this.eaters[i];
        const w0 = 0.06 + 0.17 * i;
        const up = smooth(w0, w0 + 0.05, pm) * (1 - smooth(w0 + 0.12, w0 + 0.17, pm));
        // 吃：左手舉到嘴邊
        r.aim('L', -0.3, 0.42, 0.5);
        const sl = r.swingL;
        const pl = r.splayL;
        r.swingL = lerp(0.85, sl, up);
        r.splayL = lerp(0.12, pl, up);
        // 遞給旁人：後段右手向旁邊伸出
        const hand = smooth(0.62 + 0.04 * i, 0.68 + 0.04 * i, pm) * (1 - smooth(0.74 + 0.04 * i, 0.8 + 0.04 * i, pm));
        r.swingR = lerp(0.4, 0.9, hand);
        r.splayR = lerp(0.2, 0.75, hand);
        r.headPitch = 0.12 * up;
      }
    }
    for (const r of this.men) r.update(t, mo);
    this.moses.update(t, mo);
    this.aaron.update(t, mo);
    for (const r of this.eaters) r.update(t, mo);
    void this.tuftMat;
  }
}
