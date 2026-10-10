// 住棚節：那地的村子（秋天，收藏了出產以後）與耶路撒冷的房頂（尼8:16 的回聲）。
// 棚子由枝葉「落下，自己搭成」（捲動帶動，往回捲就拆回去）：先立四角的枝幹、再架橫枝、最後鋪葉。
// 只畫經文自己說的：四種植物（果子、棕枝、茂密樹枝、柳枝）、棚、人、牲畜；不加飛鳥、狗、光環、天使、文字標籤。
import { DoubleSide, Euler, Group, InstancedMesh, Matrix4, Mesh, PlaneGeometry, type ShaderMaterial, SphereGeometry, Quaternion, Vector3 } from 'three';
import { SITE } from '../data/site';
import { makeFx, type FxSet } from './fx';
import { doorFrameGeo, houseBodyGeo, palmFrondsGeo, palmTrunkGeo, personGeo } from './geo';
import { flamePlanesGeo } from './geo2';
import {
  altarGeo,
  boothBeamGeo,
  boothLeafGeo,
  boothPostGeo,
  fruitBranchGeo,
  gateTowerGeo,
  jarGeo,
  jarLidGeo,
  leafyBranchGeo,
  moundGeo,
  palmFrondBranchGeo,
  sackGeo,
  vineGeo,
  wallSegGeo,
  willowBranchGeo,
} from './geo3';
import { BLX, JRX } from './layout';
import { flameMat, litMat, solid } from './materials';
import { type FrameLite, hillMesh, poolGlow, poolMesh, robeMat } from './props';
import { AnimalCrowd, PersonCrowd, RigPerson } from './rig';
import { faceTo, lerpAng } from './rigutil';
import { c, lp } from './tracks';
import { hexTo, lerp, mulberry32, smooth, win } from './util';

const PI = Math.PI;
const _m = new Matrix4();
const _q = new Quaternion();
const _qy = new Quaternion();
const _qt = new Quaternion();
const _e = new Euler();
const _p = new Vector3();
const _s = new Vector3();
const _t = new Vector3();

// ================================================================ 棚子
export interface BoothSpec {
  x: number;
  y: number;
  z: number;
  yaw: number;
  w: number;
  d: number;
  h: number;
}

interface El {
  booth: number;
  kind: 0 | 1 | 2; // 0 立柱 1 橫枝 2 葉
  idx: number;
  lx: number;
  ly: number;
  lz: number;
  q: Quaternion;
  sx: number;
  sy: number;
  sz: number;
  t0: number;
  t1: number;
  tum: Vector3;
  drop: number;
}

export class BoothSet {
  group = new Group();
  posts: InstancedMesh;
  beams: InstancedMesh;
  leaves: InstancedMesh;
  leafMat: ShaderMaterial;
  private specs: BoothSpec[];
  private els: El[] = [];
  private asm: number[];
  private last: number[];
  private dry = 0;
  private lastDry = -1;
  private green = hexTo('#6f8f3c', new Vector3());
  private dried = hexTo('#b5994a', new Vector3());
  private nP = 0;
  private nB = 0;
  private nL = 0;

  constructor(specs: BoothSpec[], seed = 1) {
    this.specs = specs;
    this.asm = specs.map(() => 0);
    this.last = specs.map(() => -1);
    const rnd = mulberry32(seed);
    const mWood = litMat({ base: '#6e5433', angle: 74, angle2: 10, space: 4.4, seed: 5 });
    this.leafMat = litMat({ base: '#6f8f3c', line: '#1e2a10', angle: 40, space: 3.8, seed: 7, side: DoubleSide, sway: true, swayK: 0.3, bias: 0.05 });
    const roofN = 54;
    const backN = 26;
    const sideN = 16;
    specs.forEach((sp, bi) => {
      const hw = sp.w / 2;
      const hd = sp.d / 2;
      const qi = new Quaternion();
      // 四根立柱
      const corners: [number, number][] = [[-hw, -hd], [hw, -hd], [-hw, hd], [hw, hd]];
      corners.forEach(([x, z], i) => {
        this.els.push({ booth: bi, kind: 0, idx: this.nP++, lx: x, ly: 0, lz: z, q: qi, sx: 1, sy: sp.h, sz: 1, t0: i * 0.06, t1: i * 0.06 + 0.2, tum: new Vector3(), drop: 0 });
      });
      // 橫枝：頂上一圈四根＋三根橫跨屋頂
      const addBeam = (x: number, y: number, z: number, ry: number, len: number, k: number) => {
        _e.set(0, ry, 0);
        this.els.push({ booth: bi, kind: 1, idx: this.nB++, lx: x, ly: y, lz: z, q: new Quaternion().setFromEuler(_e), sx: len, sy: 1, sz: 1, t0: 0.3 + k * 0.03, t1: 0.3 + k * 0.03 + 0.2, tum: new Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5), drop: 2.6 });
      };
      addBeam(0, sp.h, -hd, 0, sp.w + 0.2, 0);
      addBeam(0, sp.h, hd, 0, sp.w + 0.2, 1);
      addBeam(-hw, sp.h, 0, PI / 2, sp.d + 0.2, 2);
      addBeam(hw, sp.h, 0, PI / 2, sp.d + 0.2, 3);
      for (let i = 0; i < 3; i++) addBeam(-hw * 0.5 + i * hw * 0.5, sp.h + 0.05, 0, PI / 2, sp.d + 0.4, 4 + i);
      // 葉：屋頂、後牆、左右牆
      const leaf = (x: number, y: number, z: number, rx: number, ry: number, rz: number, sc: number) => {
        _e.set(rx, ry, rz);
        this.els.push({ booth: bi, kind: 2, idx: this.nL++, lx: x, ly: y, lz: z, q: new Quaternion().setFromEuler(_e), sx: sc, sy: sc, sz: sc, t0: 0.5 + rnd() * 0.42, t1: 0, tum: new Vector3(rnd() * 3, rnd() * 3, rnd() * 3), drop: 2.2 + rnd() * 1.4 });
        const el = this.els[this.els.length - 1];
        el.t1 = el.t0 + 0.12;
      };
      for (let i = 0; i < roofN; i++) leaf((rnd() - 0.5) * (sp.w + 0.3), sp.h + 0.1 + rnd() * 0.06, (rnd() - 0.5) * (sp.d + 0.3), (rnd() - 0.5) * 0.3, rnd() * PI, (rnd() - 0.5) * 0.3, 1.1 + rnd() * 0.6);
      for (let i = 0; i < backN; i++) leaf((rnd() - 0.5) * sp.w, 0.15 + rnd() * (sp.h - 0.1), -hd + 0.05, PI / 2, rnd() * PI, (rnd() - 0.5) * 0.3, 1.1 + rnd() * 0.6);
      for (let i = 0; i < sideN; i++) leaf(-hw + 0.04, 0.15 + rnd() * (sp.h - 0.1), (rnd() - 0.5) * sp.d, PI / 2, rnd() * PI, PI / 2, 1.0 + rnd() * 0.5);
      for (let i = 0; i < sideN; i++) leaf(hw - 0.04, 0.15 + rnd() * (sp.h - 0.1), (rnd() - 0.5) * sp.d, PI / 2, rnd() * PI, PI / 2, 1.0 + rnd() * 0.5);
    });
    this.posts = new InstancedMesh(boothPostGeo(), mWood, Math.max(1, this.nP));
    this.beams = new InstancedMesh(boothBeamGeo(), mWood, Math.max(1, this.nB));
    this.leaves = new InstancedMesh(boothLeafGeo(), this.leafMat, Math.max(1, this.nL));
    for (const m of [this.posts, this.beams, this.leaves]) {
      m.frustumCulled = false;
      this.group.add(m);
    }
  }

  /** 第 i 座棚的搭建進度 0..1（往回捲就拆回去） */
  setAssembly(i: number, a: number): void {
    this.asm[i] = a;
  }
  setDry(k: number): void {
    this.dry = k;
  }
  /** 風吹葉子的幅度倍率（第八日：風吹動空棚上的乾葉） */
  setSway(k: number): void {
    this.leafMat.uniforms.uSwayK.value = k;
  }
  /** 最後一座棚的世界位置，給人物走進去用 */
  spec(i: number): BoothSpec {
    return this.specs[i];
  }

  update(): void {
    if (this.dry !== this.lastDry) {
      this.lastDry = this.dry;
      (this.leafMat.uniforms.uBase.value as Vector3).lerpVectors(this.green, this.dried, this.dry);
    }
    let dirty = false;
    for (let i = 0; i < this.asm.length; i++) if (this.asm[i] !== this.last[i]) dirty = true;
    if (!dirty) return;
    for (const el of this.els) {
      const a = this.asm[el.booth];
      const sp = this.specs[el.booth];
      const e = smooth(el.t0, el.t1, a);
      _qy.setFromAxisAngle(_t.set(0, 1, 0), sp.yaw);
      const cs = Math.cos(sp.yaw);
      const sn = Math.sin(sp.yaw);
      let wx = sp.x + el.lx * cs + el.lz * sn;
      let wy = sp.y + el.ly;
      let wz = sp.z - el.lx * sn + el.lz * cs;
      let sc = 1;
      _q.copy(_qy).multiply(el.q);
      if (el.kind === 0) {
        // 立柱：從地上長起來
        _s.set(1, Math.max(0.0001, el.sy * e), 1);
        _p.set(wx, wy, wz);
      } else {
        // 橫枝與葉子：從上面落下，邊落邊轉
        const fall = (1 - e) * el.drop;
        wy += fall;
        wx += (1 - e) * el.tum.x * 0.8;
        wz += (1 - e) * el.tum.z * 0.8;
        _e.set(el.tum.x * (1 - e) * 2.2, el.tum.y * (1 - e) * 2.2, el.tum.z * (1 - e) * 2.2);
        _qt.setFromEuler(_e);
        _q.multiply(_qt);
        sc = e > 0.001 ? 1 : 0.0001;
        _s.set(el.sx * (el.kind === 1 ? 1 : sc), el.kind === 1 ? sc : el.sy * sc, el.kind === 1 ? sc : el.sz * sc);
        _p.set(wx, wy, wz);
      }
      _m.compose(_p, _q, _s);
      (el.kind === 0 ? this.posts : el.kind === 1 ? this.beams : this.leaves).setMatrixAt(el.idx, _m);
    }
    this.posts.instanceMatrix.needsUpdate = true;
    this.beams.instanceMatrix.needsUpdate = true;
    this.leaves.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < this.asm.length; i++) this.last[i] = this.asm[i];
  }
}

// ================================================================ 共用小東西：四種枝子、穀袋
function branchMats(): ShaderMaterial[] {
  return [
    litMat({ base: '#6a5030', parts: ['#6a5030', '#6f8f3c', '#d08a2c'], angle: 50, space: 3.8, seed: 951 }),
    litMat({ base: '#7a8a3a', parts: ['#8a9a46', '#6f9a3a'], angle: 50, space: 3.8, seed: 952, side: DoubleSide }),
    litMat({ base: '#5a4630', parts: ['#5a4630', '#4f7a34'], angle: 50, space: 3.8, seed: 953 }),
    litMat({ base: '#8a7a4a', parts: ['#8a7a4a', '#9ab062'], angle: 50, space: 3.8, seed: 954 }),
  ];
}
function branchGeos() {
  return [fruitBranchGeo(), palmFrondBranchGeo(), leafyBranchGeo(), willowBranchGeo()];
}

/** 住棚節七天各日的公牛數：取 SITE.offerings 各日那一組裡以「公牛」開頭的數目（不寫死數字） */
export function bullDayCounts(): number[] {
  const bars = SITE.chapters.find((ch) => ch.id === 'booths')?.beats.find((b) => b.cue === 'bulls')?.bars ?? [];
  return bars.map((b) => {
    const grp = SITE.offerings?.[b.ref];
    let n = 0;
    if (grp) for (const it of grp.items) if (it.animal.startsWith('公牛')) n += it.count;
    return n;
  });
}

// ================================================================ 那地的村子
const BULL_Z = 4.5;
const ALT_X = -14;
const ALT_Z = -2;

export class Village {
  group = new Group();
  booths: BoothSet;
  private walkers: RigPerson[] = [];
  private sacks: Group[] = [];
  private carried: Group[][] = [];
  private lids: Mesh[] = [];
  private jarPos: [number, number][] = [];
  private family: RigPerson[] = [];
  private famSit: RigPerson[] = [];
  private folks: RigPerson[] = [];
  private kids: RigPerson[] = [];
  private bundles: Group[] = [];
  private bulls: AnimalCrowd;
  private bullBase: { x: number; z: number }[] = [];
  private bullDays: number[] = []; // 每隻公牛在第幾日離開（D_k）
  private bullTotal = 0;
  private bullCounts: number[] = [];
  private altar = new Group();
  private flames: Mesh[] = [];
  private flameBase: number[] = [];
  private flameMat: ShaderMaterial;
  private pool: ShaderMaterial;
  private fxS: FxSet;
  private fxSm: FxSet;
  private crowd: PersonCrowd;
  private crowdBase: { x: number; z: number; sx: number; sz: number; a: number; b: number }[] = [];
  private dryLeaves: ShaderMaterial[] = [];
  private mFrond: ShaderMaterial;

  constructor() {
    const g = this.group;
    g.position.set(BLX, 0, 0);
    const rnd = mulberry32(1001);
    // 地面（秋天的地）與遠山
    const mGround = litMat({ base: '#c8ad72', line: '#6a4f22', angle: 84, angle2: 80, space: 5, seed: 1002, cross: true });
    const ground = new Mesh(new PlaneGeometry(900, 700), mGround);
    ground.rotation.x = -PI / 2;
    ground.position.set(0, 0.02, -150);
    g.add(ground);
    const mHill = litMat({ base: '#b9985a', line: '#5d4623', angle: 4, space: 5, seed: 6, bias: -0.2 });
    g.add(hillMesh(mHill, -80, -190, 120, 13, 50), hillMesh(mHill, 100, -210, 150, 17, 60), hillMesh(mHill, 10, -290, 200, 12, 50));
    // 村子：一排泥磚平頂房，門朝 +z
    const mMud = litMat({ base: '#a88758', angle: 86, angle2: 8, space: 4.8, seed: 3, cross: true });
    const mWood = litMat({ base: '#6e5433', angle: 74, angle2: 10, space: 4.4, seed: 5 });
    const frameG = doorFrameGeo();
    const houses: [number, number, number, number][] = [[-30, 9, 3.2, 6], [-15, 8, 3.5, 6], [0, 10, 3.3, 6.4], [15, 8.5, 3.6, 6], [30, 9, 3.1, 6]];
    for (const [x, w, h, d] of houses) {
      const hg = new Group();
      hg.position.set(x, 0, -12);
      hg.add(solid(houseBodyGeo({ w, h, d, doorX: 0, tunnel: 1.6 }), mMud, 2.4));
      hg.add(solid(frameG, mWood, 1.8));
      g.add(hg);
    }
    // 禾場：圓形場地與幾堆穀
    const mFloor = litMat({ base: '#dcc88c', line: '#7a6030', angle: 8, angle2: 8, space: 5, seed: 1003 });
    const floor = new Mesh(new SphereGeometry(1, 20, 4, 0, PI * 2, 0, 0.12), mFloor);
    floor.scale.set(7, 7, 7);
    floor.position.set(-17, -0.05, 4);
    floor.scale.y = 3;
    g.add(floor);
    const mMound = litMat({ base: '#d9b858', line: '#6a4f1a', angle: 60, space: 3.8, seed: 1004, cross: true });
    const mg = moundGeo();
    for (const [x, z, sc] of [[-20, 3, 2.4], [-15.5, 1.5, 2.0], [-13.5, 5.5, 2.6], [-18, 7.2, 1.8]] as [number, number, number][]) {
      const m = solid(mg, mMound, 1.6);
      m.position.set(x, 0, z);
      m.scale.set(sc, sc * 0.9, sc);
      g.add(m);
    }
    // 屋旁一排酒罈與蓋罈的布
    const mJar = litMat({ base: '#a76a45', line: '#2a1408', angle: 20, space: 4, seed: 1005 });
    const mLid = litMat({ base: '#e6dec9', line: '#3a3220', angle: 10, space: 3.6, seed: 1006 });
    for (let i = 0; i < 7; i++) {
      const x = 12 + i * 1.15;
      const z = -8.4 + (i % 2) * 0.35;
      const j = solid(jarGeo(), mJar, 1.5);
      j.position.set(x, 0, z);
      j.scale.setScalar(0.95 + (i % 3) * 0.05);
      g.add(j);
      const lid = new Mesh(jarLidGeo(), mLid);
      lid.visible = false;
      lid.position.set(x, 0.95, z);
      g.add(lid);
      this.lids.push(lid);
      this.jarPos.push([x, z]);
    }
    // 摘完的葡萄園：幾排光禿的葡萄架
    const mVine = litMat({ base: '#6a5a3a', parts: ['#6a5a3a', '#b0993f', '#b0993f'], angle: 62, space: 4.2, seed: 1007 });
    for (let i = 0; i < 6; i++) {
      const v = solid(vineGeo(50 + i), mVine, 1.3);
      v.position.set(20 + (i % 3) * 2.6, 0, -4 + Math.floor(i / 3) * 2.6);
      g.add(v);
    }
    // 棕樹
    const mTrunk = litMat({ base: '#8f7145', angle: 82, angle2: 10, space: 4.6, seed: 7, cross: true });
    this.mFrond = litMat({ base: '#5c5836', angle: 28, angle2: 28, space: 4.6, seed: 8, side: DoubleSide, sway: true });
    for (const [x, z, k] of [[-38, -16, 0], [38, -15, 1], [-6, -19, 2], [23, -20, 0]] as [number, number, number][]) {
      const t = new Group();
      t.add(solid(palmTrunkGeo(7 + k, 0.8), mTrunk, 2.2), new Mesh(palmFrondsGeo(7 + k, 0.8, 3 + k * 5), this.mFrond));
      t.position.set(x, 0, z);
      g.add(t);
    }
    // 棚子：院子、房頂
    this.booths = new BoothSet(
      [
        { x: -13, y: 0, z: -4.5, yaw: 0, w: 4.4, d: 3.4, h: 2.4 },
        { x: 1.5, y: 3.5, z: -13.5, yaw: 0, w: 3.6, d: 3.0, h: 2.0 },
        { x: 15, y: 0, z: -4.8, yaw: 0, w: 4.4, d: 3.4, h: 2.4 },
      ],
      17,
    );
    g.add(this.booths.group);
    this.dryLeaves.push(this.booths.leafMat);

    // 人物：扛穀袋／扛枝子的人
    const robes = ['#a88758', '#8f7550', '#b59a68', '#cdbf9e', '#9a7d52', '#b79a68'];
    const mSack = litMat({ base: '#c9b27a', line: '#4a3a1a', angle: 40, space: 3.8, seed: 1010 });
    const mats = branchMats();
    const geos = branchGeos();
    for (let i = 0; i < 6; i++) {
      const r = new RigPerson({ belt: true, slim: i % 2 === 0, staff: false, armL: [0.3, 0.14], armR: [0.3, 0.12], seed: 1020 + i }, robeMat(robes[i], 1020 + i));
      g.add(r.group);
      this.walkers.push(r);
      const sack = solid(sackGeo(), mSack, 1.3);
      sack.position.set(-0.1, 0.52, -0.1);
      sack.rotation.z = 0.5;
      sack.scale.setScalar(1.6);
      r.upper.add(sack);
      this.sacks.push(sack);
      const set: Group[] = [];
      for (let k = 0; k < 2; k++) {
        const kind = (i + k * 2) % 4;
        const b = solid(geos[kind], mats[kind], 1.2);
        b.position.set(0.12 + k * 0.1, 0.35, 0.05);
        b.rotation.set(0.2 * k, 0, -0.55 + k * 0.3);
        b.scale.setScalar(0.9);
        r.upper.add(b);
        set.push(b);
      }
      this.carried.push(set);
    }
    // 一家人：走進棚裡坐下
    const fam: { robe: string; sc: number; o: ConstructorParameters<typeof RigPerson>[0] }[] = [
      { robe: '#a88758', sc: 1.0, o: { belt: true, staff: true, staffSide: 'R', armL: [0.2, 0.14], armR: [0.3, 0.12] } },
      { robe: '#cdbf9e', sc: 0.95, o: { slim: true, veil: true, belt: true, armL: [0.2, 0.14], armR: [0.2, 0.12] } },
      { robe: '#b79a68', sc: 0.6, o: { wrap: true, kid: true, armL: [0.3, 0.2], armR: [0.3, 0.2] } },
      { robe: '#d8cdb4', sc: 0.5, o: { wrap: true, kid: true, armL: [0.3, 0.2], armR: [0.3, 0.2] } },
    ];
    fam.forEach((f, i) => {
      const r = new RigPerson({ ...f.o, scale: f.sc, seed: 1040 + i }, robeMat(f.robe, 1040 + i));
      g.add(r.group);
      this.family.push(r);
      const sit = new RigPerson({ sit: true, belt: true, scale: f.sc, kid: f.sc < 0.7, armL: [0.8, 0.1], armR: [0.7, 0.1], seed: 1050 + i, veil: i === 1, wrap: true }, robeMat(f.robe, 1050 + i));
      sit.group.visible = false;
      g.add(sit.group);
      this.famSit.push(sit);
    });
    // booths-rejoice：申16:14 列出的人（一家人、僕婢、利未人、寄居的、孤兒寡婦）十來個不同高矮的剪影
    const folks: { dx: number; dz: number; sc: number; robe: string; o: ConstructorParameters<typeof RigPerson>[0] }[] = [
      { dx: -3.2, dz: 3.0, sc: 1.02, robe: '#a88758', o: { belt: true, staff: true, staffSide: 'R' } },
      { dx: -2.2, dz: 1.7, sc: 0.93, robe: '#cdbf9e', o: { slim: true, veil: true, belt: true } },
      { dx: -1.4, dz: 3.2, sc: 0.74, robe: '#b79a68', o: { belt: true } },
      { dx: -0.6, dz: 1.9, sc: 0.64, robe: '#d8cdb4', o: { veil: true } },
      { dx: 0.2, dz: 3.1, sc: 0.99, robe: '#8f7550', o: { slim: true, belt: true } },
      { dx: 1.0, dz: 1.8, sc: 0.92, robe: '#c9b27a', o: { slim: true, veil: true, belt: true } },
      { dx: 1.8, dz: 3.3, sc: 1.04, robe: '#e9e1cc', o: { belt: false } },
      { dx: 2.6, dz: 2.0, sc: 1.0, robe: '#6c5a3d', o: { slim: true, belt: true, staff: true, staffSide: 'L' } },
      { dx: 3.4, dz: 3.1, sc: 0.56, robe: '#b79a68', o: {} },
      { dx: 4.2, dz: 1.9, sc: 0.62, robe: '#cdbf9e', o: { veil: true } },
      { dx: 5.0, dz: 3.2, sc: 0.9, robe: '#8a7a5c', o: { slim: true, veil: true, belt: true } },
      { dx: 5.8, dz: 1.8, sc: 0.97, robe: '#a88758', o: { belt: true, staff: true, staffSide: 'L' } },
    ];
    folks.forEach((f, i) => {
      const r = new RigPerson({ ...f.o, scale: f.sc, seed: 1060 + i, kid: f.sc < 0.7, armL: [0.3, 0.2], armR: [0.3, 0.15] }, robeMat(f.robe, 1060 + i));
      r.group.position.set(-1.0 + f.dx * 1.3, 0, 2.5 + f.dz);
      r.group.rotation.y = (i % 2 ? 0.3 : -0.3) + (rnd() - 0.5) * 0.5;
      g.add(r.group);
      this.folks.push(r);
    });
    for (let i = 0; i < 3; i++) {
      const r = new RigPerson({ scale: 0.5, wrap: true, kid: true, seed: 1090 + i, armL: [0.3, 0.3], armR: [0.3, 0.3] }, robeMat(['#d8cdb4', '#b79a68', '#cdbf9e'][i], 1090 + i));
      g.add(r.group);
      this.kids.push(r);
    }
    // branches：近景四種植物的枝子（利23:40）
    for (let k = 0; k < 4; k++) {
      const bg = new Group();
      for (let i = 0; i < 3; i++) {
        const b = solid(geos[k], mats[k], 1.4);
        b.position.set((i - 1) * 0.28, 0, (i % 2) * 0.15);
        b.rotation.set(0.1 * (i - 1), i * 0.9, 0.22 * (i - 1) + (i === 1 ? 0 : 0.05));
        b.scale.setScalar(1.15 + i * 0.08);
        bg.add(b);
      }
      bg.position.set(-3.9 + k * 2.6, 0, 3.4);
      g.add(bg);
      this.bundles.push(bg);
    }
    // bulls：祭壇與冒煙，一排公牛剪影（數目讀 SITE.offerings，不寫死）
    const mAltar = litMat({ base: '#8a5a2c', parts: ['#8a5a2c', '#6a4220'], line: '#1c1008', angle: 40, space: 4.2, seed: 76, cross: true });
    const altar = solid(altarGeo(), mAltar, 2.0);
    altar.scale.setScalar(2.6);
    this.altar.add(altar);
    this.flameMat = flameMat('#ffd070', '#d2511a');
    const fg = flamePlanesGeo();
    for (let i = 0; i < 4; i++) {
      const f = new Mesh(fg, this.flameMat);
      const h = [0.95, 0.7, 0.8, 0.6][i];
      f.position.set((i % 2 ? 0.8 : -0.8), 2.5, (i < 2 ? 0.55 : -0.55));
      f.scale.set(1.4 * (1.1 - i * 0.1), 2.2 * h, 1.4 * (1.1 - i * 0.1));
      this.altar.add(f);
      this.flames.push(f);
      this.flameBase.push(2.2 * h);
    }
    this.pool = poolGlow();
    this.altar.add(poolMesh(this.pool, 16, 0, 1.5));
    this.altar.position.set(ALT_X, 0, ALT_Z);
    g.add(this.altar);
    this.fxS = makeFx('spark', [[ALT_X, 3.0, ALT_Z]], 16, 0.13, 1101);
    this.fxSm = makeFx('smoke', [[ALT_X, 3.2, ALT_Z]], 7, 2.0, 1102);
    g.add(this.fxS.mesh, this.fxSm.mesh);
    // 公牛：每日的數目取自 SITE（那一組裡以「公牛」開頭的數目）
    this.bullCounts = bullDayCounts();
    this.bullTotal = Math.max(0, ...this.bullCounts);
    const mCow = litMat({ base: 'silh' });
    this.bulls = new AnimalCrowd('cow', mCow, Math.max(1, this.bullTotal), 1.6);
    g.add(this.bulls.group);
    for (let k = 0; k < this.bullTotal; k++) {
      const row = k % 2;
      const col = Math.floor(k / 2);
      this.bullBase.push({ x: -8 + col * 3.0 + row * 1.5, z: BULL_Z + row * 3.4 });
      // 這隻公牛在 D_k 日之前都在：第 d 日的數目 > k
      this.bullDays.push(this.bullCounts.filter((n) => n > k).length);
    }
    // eighth-day：人們從各處往同一個地方匯聚
    this.crowd = new PersonCrowd(personGeo({ low: true, belt: true, staff: true, staffSide: 'R' }), robeMat('#b79a68', 1110), 40, 1.7);
    g.add(this.crowd.group);
    for (let i = 0; i < 40; i++) {
      const a = rnd() * PI * 2;
      const R = 32 + rnd() * 18;
      const ex = Math.sin(i * 2.4) * 5 + (rnd() - 0.5) * 4;
      const ez = 7 + Math.cos(i * 1.9) * 3 + (rnd() - 0.5) * 3;
      this.crowdBase.push({ sx: Math.sin(a) * R, sz: 4 + Math.cos(a) * R * 0.6, x: ex, z: ez, a: rnd() * 0.25, b: 0.45 + rnd() * 0.4 });
      const it = this.crowd.items[i];
      it.sc = 0.94 + rnd() * 0.14;
    }
    g.visible = false;
  }

  update(fr: FrameLite, s: number): void {
    const t = fr.time;
    const mo = !fr.motionOff;
    const pIn = lp(s, 'ingathering');
    const pBr = lp(s, 'branches');
    const pBo = lp(s, 'booth');
    const pBu = lp(s, 'bulls');
    const pRe = lp(s, 'booths-rejoice');
    const pEi = win(lp(s, 'eighth-day'), 0, 0.74);
    const cIn = s >= c('ingathering') && s < c('branches');
    const cBr = s >= c('branches') && s < c('booth');
    const cBu = s >= c('bulls') && s < c('booths-rejoice');
    const cRe = s >= c('booths-rejoice') && s < c('eighth-day');
    const cEi = s >= c('eighth-day') && s < c('echo-roofs');

    // ---- 棚子：booth 那一拍搭起來；之後一直在；eighth-day 葉子變乾
    const asm = [smooth(0.04, 0.5, pBo), smooth(0.2, 0.66, pBo), smooth(0.34, 0.82, pBo)];
    const before = s < c('booth');
    for (let i = 0; i < 3; i++) this.booths.setAssembly(i, before ? 0 : s >= c('bulls') ? 1 : asm[i]);
    this.booths.setDry(s >= c('eighth-day') ? smooth(0, 0.7, pEi) : 0);
    this.booths.setSway(s >= c('eighth-day') ? 0.3 + 0.9 * smooth(0, 0.5, pEi) : 0.3);
    this.booths.update();

    // ---- 火與祭壇（只在 bulls）
    this.altar.visible = cBu;
    this.fxS.mesh.visible = cBu;
    this.fxSm.mesh.visible = cBu;
    if (cBu) {
      this.flameMat.uniforms.uFlick.value = mo ? 1 : 0;
      for (let i = 0; i < this.flames.length; i++) {
        const w = mo ? 1 + 0.15 * Math.sin(t * 7.9 + i * 1.7) + 0.08 * Math.sin(t * 13.1 + i * 2.7) : 1;
        this.flames[i].scale.y = this.flameBase[i] * w;
      }
      this.pool.uniforms.uOn.value = 0.9;
      this.fxS.mat.uniforms.uOn.value = mo ? 1 : 0;
      this.fxSm.mat.uniforms.uOn.value = mo ? 1 : 0;
    }

    // ---- ingathering：最後幾個人把穀袋扛進屋、蓋上酒罈
    const w0 = this.walkers;
    for (let i = 0; i < w0.length; i++) {
      const r = w0[i];
      const on = cIn || cBr;
      r.group.visible = on;
      if (!on) continue;
      const carrySack = cIn;
      this.sacks[i].visible = carrySack && i < 4;
      for (let k = 0; k < 2; k++) this.carried[i][k].visible = cBr;
      if (cIn) {
        if (i < 4) {
          // 從禾場走到房子的門口，放下（隨捲動）
          const a = 0.05 + i * 0.12;
          const k = smooth(a, a + 0.5, pIn);
          const sx = -15 + i * 0.7;
          const sz = 4 + i * 0.9;
          const doorX = i % 2 ? -15 : 0;
          const x = lerp(sx, doorX, k);
          const z = lerp(sz, -11.2, k);
          const moving = k > 0 && k < 1;
          r.group.position.set(x, moving ? r.gait(k * 40 + i, 1) : 0, z);
          r.group.rotation.y = moving ? faceTo(sx, sz, doorX, -11.2) : lerpAng(faceTo(sx, sz, doorX, -11.2), 0, 0);
          if (!moving) {
            r.swingL = 0.2;
            r.swingR = 0.2;
            r.twist = 0;
          } else {
            r.swingR = 0.6;
          }
          this.sacks[i].visible = k < 0.97;
          r.group.visible = k < 0.99 || pIn < 0.1;
        } else {
          // 蓋罈子的人：站在罈子旁，彎腰把布蓋上去
          const j = i - 4;
          const jx = this.jarPos[j * 3 + 1][0];
          const jz = this.jarPos[j * 3 + 1][1];
          r.group.position.set(jx, 0, jz + 1.4);
          r.group.rotation.y = PI;
          const cov = smooth(0.15 + j * 0.2, 0.3 + j * 0.2, pIn);
          r.bow = 0.5 * Math.sin(Math.PI * cov) * (cov > 0 && cov < 1 ? 1 : 0);
          r.swingL = 0.7 * (cov > 0 && cov < 1 ? 1 : 0.2);
          r.swingR = 0.7 * (cov > 0 && cov < 1 ? 1 : 0.2);
        }
      } else {
        // branches：人們折下枝子、扛著往村裡走（從畫面右邊進來往左走）
        const a = i * 0.08;
        const k = smooth(a, a + 0.8, pBr);
        const x = lerp(28 - i * 3.5, -12 - i * 1.6, k);
        const z = 5.5 + (i % 3) * 1.2;
        const moving = k > 0 && k < 1;
        r.group.position.set(x, moving ? r.gait(k * 60 + i, 1) : 0, z);
        r.group.rotation.y = -PI / 2 + 0.1;
        if (!moving) {
          r.swingL = 0.2;
          r.swingR = 0.2;
          r.twist = 0;
        }
        r.swingR = 0.85;
      }
      r.update(t, mo);
    }
    // 酒罈的布：蓋上
    for (let j = 0; j < this.lids.length; j++) {
      const person = Math.floor(j / 3);
      const cov = smooth(0.15 + Math.min(1, person) * 0.2 + 0.0, 0.3 + person * 0.2, pIn);
      const lid = this.lids[j];
      lid.visible = s >= c('ingathering') && (cIn ? j < Math.floor(cov * this.lids.length + (s > c('ingathering', 0.9) ? 99 : 0)) : s >= c('branches'));
    }

    // ---- branches：近景四種植物（微微晃動）
    for (let k = 0; k < 4; k++) {
      this.bundles[k].visible = cBr;
      if (cBr) this.bundles[k].rotation.z = mo ? 0.015 * Math.sin(t * 1.1 + k * 1.7) : 0;
    }

    // ---- booth：一家人走進棚裡坐下
    const showFam = s >= c('booth') && s < c('booths-rejoice');
    for (let i = 0; i < 4; i++) {
      const stand = this.family[i];
      const sit = this.famSit[i];
      const sp = this.booths.spec(0);
      const a = 0.58 + i * 0.05;
      const k = smooth(a, a + 0.22, pBo);
      const fromX = sp.x + 7 - i * 0.7;
      const fromZ = sp.z + 6 + i * 0.5;
      const toX = sp.x - 0.9 + i * 0.7;
      const toZ = sp.z + 0.2 + (i % 2) * 0.5;
      const arrived = s >= c('bulls') || k >= 1;
      const walking = k > 0 && k < 1;
      stand.group.visible = showFam && !arrived;
      sit.group.visible = showFam && arrived;
      stand.group.position.set(lerp(fromX, toX, k), walking ? stand.gait(k * 36 + i, 1) : 0, lerp(fromZ, toZ, k));
      stand.group.rotation.y = faceTo(fromX, fromZ, toX, toZ);
      if (!walking) {
        stand.swingL = 0.2;
        stand.swingR = 0.2;
        stand.twist = 0;
      }
      sit.group.position.set(toX, 0.06, toZ);
      sit.group.rotation.y = 0.2 * (i - 1.5);
      if (stand.group.visible) stand.update(t, mo);
      if (sit.group.visible) sit.update(t, mo);
    }

    // ---- bulls：公牛的數目逐日減少（每 1/7 進度少一隻）
    this.bulls.group.visible = cBu;
    if (cBu) {
      for (let k = 0; k < this.bullTotal; k++) {
        const it = this.bulls.items[k];
        const base = this.bullBase[k];
        const leave = this.bullDays[k] / 7; // 這隻在這個進度離開
        const e = smooth(leave, leave + 0.05, pBu);
        // 走向祭壇，漸漸縮小消失
        it.x = lerp(base.x, ALT_X + 2.2, e);
        it.z = lerp(base.z, ALT_Z + 1.8, e);
        it.y = e > 0 && e < 1 ? Math.abs(Math.sin(e * 14)) * 0.04 : 0;
        it.walking = e > 0 && e < 1;
        // 排隊等著的公牛會挪身子、低頭（動態開時）
        it.yaw = -PI / 2 + (mo && !it.walking ? 0.22 * Math.sin(t * 0.8 + k * 1.9) : 0);
        it.sc = e >= 1 ? 0.0001 : 0.72 * (1 - 0.9 * smooth(0.7, 1, e));
      }
      this.bulls.update(t, mo, 0.8);
    }

    // ---- booths-rejoice：棚子之間的人群，人群小幅擺動，孩子在棚子間跑
    for (let i = 0; i < this.folks.length; i++) {
      this.folks[i].group.visible = cRe;
      if (cRe) this.folks[i].update(t, mo);
    }
    for (let i = 0; i < this.kids.length; i++) {
      const kd = this.kids[i];
      kd.group.visible = cRe;
      if (!cRe) continue;
      const a = pRe * (2.6 + i * 0.3) * PI * 2 + i * 2.1;
      const x = 1.5 + 9 * Math.sin(a);
      const z = 4.6 + 0.9 * Math.cos(a * 1.5 + i);
      const dx = 9 * Math.cos(a);
      kd.group.position.set(x, kd.gait(a * 6, 1.4), z);
      kd.group.rotation.y = Math.atan2(dx, -0.9 * Math.sin(a * 1.5 + i) * 1.5);
      kd.update(t, mo);
    }

    // ---- eighth-day：棚子空著，人們從各處往同一個聚集的地方走
    this.crowd.group.visible = cEi;
    if (cEi) {
      for (let i = 0; i < 40; i++) {
        const b = this.crowdBase[i];
        const it = this.crowd.items[i];
        const k = smooth(b.a, b.b, pEi);
        const moving = k > 0.001 && k < 0.999;
        it.x = lerp(b.sx, b.x, k);
        it.z = lerp(b.sz, b.z, k);
        it.y = moving ? Math.abs(Math.sin(k * Math.hypot(b.x - b.sx, b.z - b.sz) / 0.78 + i)) * 0.045 : 0;
        const head = Math.atan2(b.x - b.sx, b.z - b.sz);
        it.yaw = moving ? head : lerpAng(head, PI + Math.sin(i) * 0.5, smooth(b.b, b.b + 0.12, pEi));
        it.visible = true;
      }
      this.crowd.update(t, mo);
    }
  }
}

// ================================================================ 耶路撒冷的房頂（尼8:16）
export class Jerusalem {
  group = new Group();
  booths: BoothSet;
  private walkers: RigPerson[] = [];
  private carried: Group[][] = [];
  private fam: RigPerson[] = [];
  private famSit: RigPerson[] = [];
  private mFrond: ShaderMaterial;

  constructor() {
    const g = this.group;
    g.position.set(JRX, 0, 0);
    const mMud = litMat({ base: '#c9b88e', angle: 86, angle2: 8, space: 4.8, seed: 1202, cross: true });
    const mWood = litMat({ base: '#6e5433', angle: 74, angle2: 10, space: 4.4, seed: 5 });
    const frameG = doorFrameGeo();
    // 平頂的房子：左右各幾間，高低不同
    const houses: [number, number, number, number, number][] = [
      [-30, 9, 4.6, 6.5, -10], [-17, 8, 3.6, 6, -9], [-4, 8.5, 5.4, 7, -12],
      [12, 9, 3.9, 6.5, -10], [26, 9, 4.9, 6.5, -11], [-44, 9, 3.6, 6, -9],
    ];
    for (const [x, w, h, d, z] of houses) {
      const hg = new Group();
      hg.position.set(x, 0, z);
      hg.add(solid(houseBodyGeo({ w, h, d, doorX: 0, tunnel: 1.6 }), mMud, 2.4));
      hg.add(solid(frameG, mWood, 1.8));
      g.add(hg);
    }
    // 院子的矮牆（院內）與城牆城門（門前的廣場）
    const mWall = litMat({ base: '#cdbb90', line: '#3a2e18', angle: 88, angle2: 8, space: 4.8, seed: 902, cross: true });
    const wl = solid(wallSegGeo(34, 5.5, 2), mWall, 2.0);
    wl.position.set(-30, 0, -34);
    const wr = solid(wallSegGeo(34, 5.5, 2), mWall, 2.0);
    wr.position.set(30, 0, -34);
    const gt = solid(gateTowerGeo(5.2, 4.4, 8.2), mWall, 2.0);
    gt.position.set(0, 0, -34);
    g.add(wl, wr, gt);
    const yard = solid(wallSegGeo(12, 1.5, 0.5), mWall, 1.6);
    yard.position.set(4, 0, -4.5);
    g.add(yard);
    // 棕樹
    const mTrunk = litMat({ base: '#8f7145', angle: 82, angle2: 10, space: 4.6, seed: 7, cross: true });
    this.mFrond = litMat({ base: '#5c5836', angle: 28, angle2: 28, space: 4.6, seed: 8, side: DoubleSide, sway: true });
    for (const [x, z, k] of [[-38, -26, 0], [37, -26, 1], [-9, -26, 2]] as [number, number, number][]) {
      const tr = new Group();
      tr.add(solid(palmTrunkGeo(7 + k, 0.8), mTrunk, 2.2), new Mesh(palmFrondsGeo(7 + k, 0.8, 3 + k * 5), this.mFrond));
      tr.position.set(x, 0, z);
      g.add(tr);
    }
    // 棚子：房頂上、院子裡、廣場上
    this.booths = new BoothSet(
      [
        { x: -30, y: 4.8, z: -10, yaw: 0, w: 3.6, d: 3.0, h: 2.0 },
        { x: -4, y: 5.6, z: -12, yaw: 0, w: 3.6, d: 3.0, h: 2.0 },
        { x: 26, y: 5.1, z: -11, yaw: 0, w: 3.6, d: 3.0, h: 2.0 },
        { x: 4, y: 0, z: -9, yaw: 0, w: 4.0, d: 3.2, h: 2.3 },
        { x: -12, y: 0, z: 4, yaw: 0, w: 4.4, d: 3.4, h: 2.4 },
        { x: 10, y: 0, z: 5, yaw: 0, w: 4.4, d: 3.4, h: 2.4 },
        { x: -1, y: 0, z: 12, yaw: 0, w: 4.4, d: 3.4, h: 2.4 },
      ],
      27,
    );
    g.add(this.booths.group);
    // 人們扛著橄欖樹、棕樹等枝子，從城門往各處走
    const mats = branchMats();
    const geos = branchGeos();
    const robes = ['#a88758', '#8f7550', '#b59a68', '#cdbf9e', '#9a7d52', '#b79a68'];
    for (let i = 0; i < 6; i++) {
      const r = new RigPerson({ belt: true, slim: i % 2 === 0, armL: [0.3, 0.14], armR: [0.5, 0.12], seed: 1220 + i }, robeMat(robes[i], 1220 + i));
      g.add(r.group);
      this.walkers.push(r);
      const set: Group[] = [];
      for (let k = 0; k < 2; k++) {
        const kind = (i + k) % 2 === 0 ? 0 : 1;
        const b = solid(geos[kind], mats[kind], 1.2);
        b.position.set(0.12 + k * 0.1, 0.35, 0.05);
        b.rotation.set(0.2 * k, 0, -0.55 + k * 0.3);
        b.scale.setScalar(0.9);
        r.upper.add(b);
        set.push(b);
      }
      this.carried.push(set);
    }
    for (let i = 0; i < 3; i++) {
      const r = new RigPerson({ belt: true, scale: i === 2 ? 0.6 : 1, kid: i === 2, armL: [0.2, 0.14], armR: [0.2, 0.12], seed: 1240 + i }, robeMat(robes[i + 1], 1240 + i));
      g.add(r.group);
      this.fam.push(r);
      const s2 = new RigPerson({ sit: true, belt: true, scale: i === 2 ? 0.6 : 1, kid: i === 2, armL: [0.8, 0.1], armR: [0.7, 0.1], seed: 1250 + i }, robeMat(robes[i + 1], 1250 + i));
      s2.group.visible = false;
      g.add(s2.group);
      this.famSit.push(s2);
    }
    g.visible = false;
  }

  update(fr: FrameLite, s: number): void {
    const t = fr.time;
    const mo = !fr.motionOff;
    const p = win(lp(s, 'echo-roofs'), 0.1, 1);
    // 棚子陸續搭起來（房頂上、院子裡、廣場上）
    const n = 7;
    for (let i = 0; i < n; i++) {
      const a = 0.06 + i * 0.075;
      this.booths.setAssembly(i, smooth(a, a + 0.3, p));
    }
    this.booths.setDry(0);
    this.booths.update();
    // 人們扛著枝子往各處走（隨捲動）
    const dest: [number, number][] = [[-30, -6.5], [-4, -8.5], [26, -7.5], [4, -6], [-12, 8], [10, 9]];
    for (let i = 0; i < this.walkers.length; i++) {
      const r = this.walkers[i];
      const a = i * 0.07;
      const k = smooth(a, a + 0.5, p);
      const sx = i % 2 ? 6 : -6;
      const sz = -26;
      const x = lerp(sx, dest[i][0], k);
      const z = lerp(sz, dest[i][1], k);
      const moving = k > 0.001 && k < 0.999;
      r.group.position.set(x, moving ? r.gait(k * 50 + i, 1) : 0, z);
      r.group.rotation.y = moving ? faceTo(sx, sz, dest[i][0], dest[i][1]) : PI;
      r.group.visible = p > a - 0.02 && k < 0.999 && !(i < 3 && k > 0.6);
      if (!moving) {
        r.swingL = 0.2;
        r.swingR = 0.2;
        r.twist = 0;
      }
      r.swingR = 0.85;
      if (r.group.visible) r.update(t, mo);
    }
    // 一家人走進院子裡的棚坐下
    for (let i = 0; i < 3; i++) {
      const st = this.fam[i];
      const sit = this.famSit[i];
      const a = 0.62 + i * 0.05;
      const k = smooth(a, a + 0.22, p);
      const fx = 12 - i * 0.6;
      const fz = 12;
      const tx = -12.4 + i * 0.8;
      const tz = 4.2;
      const arrived = k >= 1;
      const walking = k > 0 && k < 1;
      st.group.visible = p > 0.6 && !arrived;
      sit.group.visible = arrived;
      st.group.position.set(lerp(fx, tx, k), walking ? st.gait(k * 36 + i, 1) : 0, lerp(fz, tz, k));
      st.group.rotation.y = faceTo(fx, fz, tx, tz);
      sit.group.position.set(tx, 0.06, tz);
      sit.group.rotation.y = 0.2 * (i - 1);
      if (st.group.visible) st.update(t, mo);
      if (sit.group.visible) sit.update(t, mo);
    }
  }
}

