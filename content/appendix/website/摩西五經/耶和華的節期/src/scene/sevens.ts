// 第三批（七的節奏）的 3D 場景：每個小地點搭在自己的位置（見 layout.ts），依 cue 顯示／隱藏。
// 只畫經文寫到的：安息日（人放下工）、創造（天上的鳥、海裡的魚、地上的走獸，不畫神的形像）、牛驢歇息、不耕的田、第六年的三堆糧、
// 豁免（交出羊、穀、酒，人走遠）、住棚節宣讀律法、贖罪日的角聲、禧年各歸本家、地是我的。沒寫到的不畫。
// 漩渦（螢幕座標的覆蓋層）在 vortex.ts；回聲拍與其他小地點在 sevens2.ts。
import { BufferGeometry, BufferAttribute, DoubleSide, Group, InstancedMesh, Mesh, PlaneGeometry, type ShaderMaterial, SphereGeometry, BoxGeometry, CylinderGeometry, Object3D, Vector3 } from 'three';
import { barleyGeo, doorFrameGeo, houseBodyGeo, mergeParts, palmFrondsGeo, palmTrunkGeo, personGeo, T, type Part } from './geo';
import { fruitTreeGeo, jarGeo, moundGeo, platformGeo, sackGeo, scrollRodGeo, vineGeo } from './geo3';
import { BoothSet } from './booths';
import { BlowFx } from './blowfx';
import { SVC, SVF, SVH, SVP, SVV } from './layout';
import { FIXED, glowMat, litMat, solid } from './materials';
import { type FrameLite, hillMesh, robeMat, setInst } from './props';
import { Animal, AnimalCrowd, PersonCrowd, RigPerson } from './rig';
import { aimAt, faceTo, lerpAng } from './rigutil';
import { c, lp, releaseDist, releaseWalkP, RELEASE_X0 } from './tracks';
import { clamp, lerp, mulberry32, smooth, win } from './util';
import { cutOf, groundMesh, bigHills } from './sevens-kit';
import { Jer, Land, Liberty, Oath, Rest } from './sevens2';
import { story } from '../story/state';

const PI = Math.PI;
const _o = new Object3D();
const _v = new Vector3();

// ================================================================ 小件幾何
/** 鳥：一個 V 形（兩片翅膀），翅展約 0.9；用 y 方向的縮放表示拍翅 */
function birdGeo(): BufferGeometry {
  const g = new BufferGeometry();
  const pos = new Float32Array([
    0, 0, 0, -0.5, 0.2, -0.02, -0.22, -0.02, 0.1,
    0, 0, 0, 0.22, -0.02, 0.1, 0.5, 0.2, -0.02,
    -0.06, 0, 0.1, 0.06, 0, 0.1, 0, 0.02, -0.16,
  ]);
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}
/** 魚：扁身＋尾，朝 +x */
function fishGeo(): BufferGeometry {
  const parts: Part[] = [
    { g: new SphereGeometry(1, 8, 6), m: T(0, 0, 0, 0, 0, 0, 0.32, 0.12, 0.08) },
    { g: new CylinderGeometry(0.0, 0.14, 0.2, 3), m: T(-0.34, 0, 0, 0, 0, Math.PI / 2, 1, 1, 0.3) },
  ];
  return mergeParts(parts);
}
/** 公羊角（利25:9，shofar）：彎曲的錐形。吹口在原點、朝 +x，往上彎，全長約 0.55；窄端是吹口 */
function hornGeo(): BufferGeometry {
  const parts: Part[] = [];
  const n = 8;
  const R = 0.42;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const a = t * 1.2;
    const r = 0.011 + 0.03 * t * t + 0.012 * t;
    parts.push({ g: new CylinderGeometry(r * 1.15, r, 0.1, 6), m: T(Math.sin(a) * R, (1 - Math.cos(a)) * R, 0, 0, 0, a - Math.PI / 2) });
  }
  return mergeParts(parts);
}

// ================================================================ 一戶人家的院子
export class HomeSite {
  group = new Group();
  private father: RigPerson;
  private fatherSit: RigPerson;
  private kidSt: RigPerson;
  private kidSit: RigPerson;
  private alienSt: RigPerson;
  private alienSit: RigPerson;
  private cow: Animal;
  private donkey: Animal;
  private yoke: Group;
  private master: RigPerson;
  private servant: RigPerson;
  private lamb: Animal;
  private sack: Group;
  private jar: Group;
  private mFrond: ShaderMaterial;
  private treeLeaf: ShaderMaterial;
  private roadMesh: Mesh;

  constructor() {
    const g = this.group;
    g.position.set(SVH, 0, 0);
    g.add(groundMesh(1030));
    bigHills(g);
    const mMud = litMat({ base: '#a88758', angle: 86, angle2: 8, space: 4.8, seed: 3, cross: true });
    const mWood = litMat({ base: '#6e5433', angle: 74, angle2: 10, space: 4.4, seed: 5 });
    const frameG = doorFrameGeo();
    const glowM = glowMat({ hatch: 0.75, edge: '#2a1c0a' });
    // 房子：正面（有門的那面）在 z=-6
    const houses: [number, number, number, number, number][] = [[0, 8, 3.4, 5.4, -6], [-13, 7, 3.0, 5, -7.5], [12.5, 7.5, 3.2, 5, -7.5]];
    for (const [x, w, h, d, z] of houses) {
      const hg = new Group();
      hg.position.set(x, 0, z);
      hg.add(solid(houseBodyGeo({ w, h, d, doorX: 0, tunnel: 1.6 }), mMud, 2.4));
      hg.add(solid(frameG, mWood, 1.8));
      if (x === 0) {
        const glow = new Mesh(new PlaneGeometry(1.5, 2.3), glowM);
        glow.position.set(0, 1.15, -1.58);
        hg.add(glow);
      }
      g.add(hg);
    }
    // 果樹（蔭）
    this.treeLeaf = litMat({ base: '#6a5030', parts: ['#6a5030', '#6f8f3c', '#d08a2c'], angle: 50, space: 3.8, seed: 951, sway: true, swayK: 0.5 });
    const tree = solid(fruitTreeGeo(3, 1.7), this.treeLeaf, 1.6);
    tree.position.set(5.4, 0, -0.6);
    tree.scale.setScalar(1.7);
    g.add(tree);
    // 棕樹
    const mTrunk = litMat({ base: '#8f7145', angle: 82, angle2: 10, space: 4.6, seed: 7, cross: true });
    this.mFrond = litMat({ base: '#5c5836', angle: 28, angle2: 28, space: 4.6, seed: 8, side: DoubleSide, sway: true });
    for (const [x, z, k] of [[-18, -12, 0], [20, -13, 1]] as [number, number, number][]) {
      const tr = new Group();
      tr.add(solid(palmTrunkGeo(7 + k, 0.8), mTrunk, 2.2), new Mesh(palmFrondsGeo(7 + k, 0.8, 3 + k * 5), this.mFrond));
      tr.position.set(x, 0, z);
      g.add(tr);
    }
    // 放走人的路（豁免那一拍，往 +x）
    this.roadMesh = new Mesh(new PlaneGeometry(1, 3.2), litMat({ base: '#d8c48a', line: '#7a6030', angle: 2, angle2: 4, space: 5, seed: 1031 }));
    this.roadMesh.rotation.x = -PI / 2;
    this.roadMesh.scale.x = 420;
    this.roadMesh.position.set(210 + 1, 0.04, 2.3);
    g.add(this.roadMesh);

    // ---- 安息日：家主放下工（鋤頭）、坐下
    const robeF = robeMat('#a88758', 1040);
    this.father = new RigPerson({ staff: true, staffSide: 'R', belt: true, armL: [0.2, 0.14], armR: [0.4, 0.12], seed: 1041, outline: 2.4 }, robeF);
    this.father.group.position.set(1.4, 0, 2.6);
    this.father.group.rotation.y = PI - 0.3;
    this.fatherSit = new RigPerson({ sit: true, belt: true, armL: [0.8, 0.1], armR: [0.7, 0.1], seed: 1042, outline: 2.4 }, robeF);
    this.fatherSit.group.position.set(2.6, 0.06, 2.8);
    this.fatherSit.group.rotation.y = PI - 0.5;
    this.fatherSit.group.visible = false;
    const hoe = new Group();
    hoe.add(new Mesh(new CylinderGeometry(0.02, 0.025, 1.7, 6), litMat({ base: '#4e3a22' })));
    const blade = new Mesh(new BoxGeometry(0.28, 0.05, 0.12), litMat({ base: '#4a4a52' }));
    blade.position.set(0, 0.85, 0.05);
    hoe.add(blade);
    hoe.rotation.z = PI / 2;
    hoe.position.set(0.3, 0.05, 3.4);
    hoe.visible = false;
    this.hoeGroup = hoe;
    g.add(hoe, this.father.group, this.fatherSit.group);

    // ---- 牛驢歇息
    const mCow = litMat({ base: '#6b5030', parts: ['#6b5030', '#14110e'], angle: 50, space: 4.4, seed: 16 });
    const mDonkey = litMat({ base: '#8a8478', parts: ['#8a8478', '#14110e'], angle: 50, space: 4.4, seed: 17 });
    this.cow = new Animal('cow', mCow, 2.0, 1051);
    this.cow.group.position.set(-2.4, 0, 1.4);
    this.cow.group.rotation.y = PI / 2 + 0.2;
    this.donkey = new Animal('cow', mDonkey, 2.0, 1052);
    this.donkey.baseScale = 0.72;
    this.donkey.group.position.set(-4.7, 0, 3.0);
    this.donkey.group.rotation.y = PI / 2 - 0.25;
    this.yoke = new Group();
    const mY = litMat({ base: '#6e5433', angle: 74, space: 4.4, seed: 18 });
    this.yoke.add(solid(new BoxGeometry(1.15, 0.08, 0.1), mY, 1.4));
    for (const x of [-0.3, 0.3]) {
      const peg = solid(new BoxGeometry(0.05, 0.4, 0.05), mY, 1.2);
      peg.position.set(x, -0.2, 0);
      this.yoke.add(peg);
    }
    g.add(this.cow.group, this.donkey.group, this.yoke);
    // 婢女的兒子（小孩）與寄居的人：站著 → 坐在蔭下 → 伸展
    const kidO = { wrap: true, kid: true, belt: true, scale: 0.62, armL: [0.2, 0.14] as [number, number], armR: [0.2, 0.14] as [number, number] };
    this.kidSt = new RigPerson({ ...kidO, seed: 1061 }, robeMat('#b79a68', 1061));
    this.kidSit = new RigPerson({ ...kidO, sit: true, armL: [0.8, 0.1], armR: [0.7, 0.1], seed: 1062 }, robeMat('#b79a68', 1062));
    this.alienSt = new RigPerson({ belt: true, staff: true, staffSide: 'L', armL: [0.2, 0.14], armR: [0.2, 0.14], seed: 1063 }, robeMat('#6c5a3d', 1063, '#14110e', '#8a5a3a'));
    this.alienSit = new RigPerson({ sit: true, belt: true, armL: [0.8, 0.1], armR: [0.7, 0.1], seed: 1064 }, robeMat('#6c5a3d', 1064, '#14110e', '#8a5a3a'));
    this.kidSit.group.visible = false;
    this.alienSit.group.visible = false;
    g.add(this.kidSt.group, this.kidSit.group, this.alienSt.group, this.alienSit.group);

    // ---- 豁免：主人把羊、一袋穀、一罈酒交給要離開的人
    this.master = new RigPerson({ staff: true, staffSide: 'R', belt: true, armL: [0.2, 0.14], armR: [0.3, 0.12], seed: 1071, outline: 2.4 }, robeMat('#a88758', 1071));
    this.servant = new RigPerson({ belt: true, slim: true, armL: [0.2, 0.14], armR: [0.2, 0.12], seed: 1072, outline: 2.4 }, robeMat('#cdbf9e', 1072));
    this.lamb = new Animal('lamb', litMat({ base: 'paper', parts: ['#e9e1cc', '#14110e'], angle: 52, space: 4.4, seed: 12 }), 2.2, 1073);
    this.sack = solid(sackGeo(), litMat({ base: '#c9b27a', line: '#4a3a1a', angle: 40, space: 3.8, seed: 1010 }), 1.3);
    this.sack.scale.setScalar(1.5);
    this.jar = solid(jarGeo(), litMat({ base: '#a76a45', line: '#2a1408', angle: 20, space: 4, seed: 1005 }), 1.4);
    this.jar.scale.setScalar(0.62);
    g.add(this.master.group, this.servant.group, this.lamb.group, this.sack, this.jar);
    g.visible = false;
  }
  private hoeGroup: Group;

  update(fr: FrameLite, s: number): void {
    const t = fr.time;
    const mo = !fr.motionOff;
    const sab = s < cutOf('sv-creation') && s >= cutOf('sv-sabbath');
    const oxish = s >= cutOf('sv-ox') && s < cutOf('sv-fallow');
    const rel = s >= cutOf('sv-release') && s < cutOf('sv-egypt');
    this.roadMesh.visible = rel;
    const grid = (v: boolean, ...gs: Group[]) => gs.forEach((x) => (x.visible = v));
    // ---------------- 安息日
    const ps = win(lp(s, 'sv-sabbath'), 0.08, 0.86);
    if (sab) {
      const down = smooth(0.18, 0.5, ps); // 彎腰放下鋤頭
      const sit = ps > 0.6;
      this.father.group.visible = !sit;
      this.fatherSit.group.visible = sit;
      this.hoeGroup.visible = ps > 0.4;
      this.father.bow = 0.75 * down * (1 - smooth(0.5, 0.58, ps));
      this.father.swingR = lerp(0.4, 0.9, down);
      if (this.father.staff) this.father.staff.visible = ps < 0.4;
      this.father.group.position.set(1.4, 0, 2.6);
      this.fatherSit.update(t, mo);
      this.father.update(t, mo);
      this.hoeGroup.position.set(0.5, 0.06, 3.5);
      grid(false, this.kidSt.group, this.kidSit.group, this.alienSt.group, this.alienSit.group, this.cow.group, this.donkey.group, this.yoke);
    }
    // ---------------- 牛驢歇息（ox，也留到 weeks／month7 的夜）
    if (oxish) {
      const night = s >= c('sv-weeks');
      const po = night ? 1 : win(lp(s, 'sv-ox'), 0.08, 0.86);
      const lie = smooth(0.14, 0.5, po);
      for (const a of [this.cow, this.donkey]) {
        a.group.visible = true;
        a.group.position.y = -0.4 * lie;
        a.headPitch = 0.35 * lie;
        a.graze = lie < 0.5;
        a.update(t, mo);
      }
      this.cow.group.position.set(-2.4, -0.4 * lie, 1.4);
      this.donkey.group.position.set(-4.7, -0.34 * lie, 3.0);
      // 軛：從牛頸上落到地上
      const fall = smooth(0.04, 0.32, po);
      this.yoke.visible = true;
      this.yoke.position.set(lerp(-2.4, -0.7, fall), lerp(1.45, 0.07, fall), lerp(1.4, 0.5, fall));
      this.yoke.rotation.set(0, 0, lerp(0, 0.1, fall));
      // 兩個人：站著走到蔭下 → 坐下 → 伸展
      const kid = this.kidSt;
      const al = this.alienSt;
      const kx = lerp(9.4, 4.0, smooth(0.1, 0.42, po));
      const ax = lerp(11.4, 6.2, smooth(0.14, 0.46, po));
      const seated = po > 0.5;
      kid.group.visible = !seated;
      this.kidSit.group.visible = seated;
      al.group.visible = !seated;
      this.alienSit.group.visible = seated;
      const walkK = smooth(0.1, 0.42, po);
      kid.group.position.set(kx, walkK > 0 && walkK < 1 ? kid.gait(kx * 3, 1) : 0, 1.0);
      kid.group.rotation.y = -PI / 2 + 0.3;
      al.group.position.set(ax, walkK > 0 && walkK < 1 ? al.gait(ax * 3, 1) : 0, 1.9);
      al.group.rotation.y = -PI / 2 + 0.2;
      this.kidSit.group.position.set(4.0, 0.06, 1.0);
      this.kidSit.group.rotation.y = -0.4;
      this.alienSit.group.position.set(6.2, 0.06, 2.0);
      this.alienSit.group.rotation.y = -0.2;
      const stretch = smooth(0.62, 0.8, po) * (1 - smooth(0.9, 1, po) * 0.3);
      for (const sit of [this.kidSit, this.alienSit]) {
        sit.swingL = lerp(0.8, 2.8, stretch);
        sit.swingR = lerp(0.7, 2.8, stretch);
        sit.splayL = lerp(0.1, 0.35, stretch);
        sit.splayR = lerp(0.1, 0.35, stretch);
        sit.lean = -0.08 * stretch;
      }
      if (seated) {
        this.kidSit.update(t, mo);
        this.alienSit.update(t, mo);
      } else {
        kid.update(t, mo);
        al.update(t, mo);
      }
      // 夜裡（weeks、month7）：家主還坐著
      this.father.group.visible = false;
      this.fatherSit.group.visible = true;
      this.fatherSit.group.position.set(2.6, 0.06, 2.8);
      this.fatherSit.update(t, mo);
      this.hoeGroup.visible = true;
      grid(false, this.master.group, this.servant.group, this.lamb.group, this.sack, this.jar);
    }
    // ---------------- 豁免
    if (rel) {
      const p = lp(s, 'sv-release');
      grid(false, this.father.group, this.fatherSit.group, this.hoeGroup, this.kidSt.group, this.kidSit.group, this.alienSt.group, this.alienSit.group, this.cow.group, this.donkey.group, this.yoke);
      const m = this.master;
      const sv = this.servant;
      const dist = releaseDist(p);
      const w = releaseWalkP(p);
      const walking = w > 0 && w < 1;
      const sx = RELEASE_X0 + dist;
      m.group.visible = true;
      sv.group.visible = true;
      m.group.position.set(-0.4, 0, 2.5);
      m.group.rotation.y = lerpAng(PI / 2 - 0.2, PI / 2 + 0.1, smooth(0.5, 0.62, p));
      sv.group.position.set(sx, walking ? sv.gait(dist / 0.75, 1) : 0, 2.3);
      sv.group.rotation.y = lerpAng(-PI / 2 + 0.15, PI / 2, smooth(0.52, 0.6, p));
      // 東西一件件交到他手上
      const e1 = smooth(0.1, 0.28, p);
      const e2 = smooth(0.3, 0.46, p);
      const e3 = smooth(0.48, 0.6, p);
      // 羊：從主人旁邊走到他身後（跟著走）
      this.lamb.group.visible = true;
      this.lamb.group.rotation.y = lerpAng(PI / 2, PI / 2, 0);
      const lx0 = -1.6;
      const lz0 = 3.1;
      const lamX = lerp(lx0, sx - 1.6, e1);
      const lamZ = lerp(lz0, 2.6, e1);
      this.lamb.group.position.set(lamX, 0, lamZ);
      this.lamb.graze = e1 < 0.01 || (e1 >= 1 && !walking);
      this.lamb.update(t, mo);
      // 穀袋：主人腳邊 → 他的肩上
      this.sack.visible = true;
      const sackA = _v.set(-0.8, 0.2, 3.3);
      const sackB = { x: sx - 0.05, y: 1.32, z: 2.3 };
      this.sack.position.set(lerp(sackA.x, sackB.x, e2), lerp(sackA.y, sackB.y, e2) + 0.4 * Math.sin(e2 * PI), lerp(sackA.z, sackB.z, e2));
      this.sack.rotation.z = lerp(0, 0.5, e2);
      // 酒罈：主人腳邊 → 他手上（腰邊）
      this.jar.visible = true;
      const jarA = { x: -1.1, y: 0, z: 3.0 };
      const jarB = { x: sx + 0.34, y: 0.55, z: 2.0 };
      this.jar.position.set(lerp(jarA.x, jarB.x, e3), lerp(jarA.y, jarB.y, e3) + 0.45 * Math.sin(e3 * PI), lerp(jarA.z, jarB.z, e3));
      // 手勢：主人伸手遞，人接
      const give = Math.max(smooth(0.1, 0.18, p) * (1 - smooth(0.26, 0.3, p)), smooth(0.3, 0.36, p) * (1 - smooth(0.44, 0.48, p)), smooth(0.48, 0.54, p) * (1 - smooth(0.58, 0.62, p)));
      m.swingR = lerp(0.3, 1.2, give);
      m.swingL = lerp(0.2, 0.9, give);
      sv.swingL = walking ? sv.swingL : lerp(0.2, 1.0, give);
      sv.swingR = walking ? sv.swingR : lerp(0.2, 1.0, give);
      m.update(t, mo);
      sv.update(t, mo);
    } else {
      this.master.group.visible = false;
      this.servant.group.visible = false;
      this.lamb.group.visible = false;
      this.sack.visible = false;
      this.jar.visible = false;
    }
    void faceTo;
  }
}

// ================================================================ 天、地、海
export class CreationSite {
  group = new Group();
  private sea: Mesh;
  private land: Mesh;
  private hills: Mesh[] = [];
  private birds: InstancedMesh;
  private fish: InstancedMesh;
  private sheep: AnimalCrowd;
  private cattle: AnimalCrowd;
  private goats: AnimalCrowd;
  private palms: Group[] = [];
  private bpos: { x: number; y: number; z: number; sp: number; ph: number }[] = [];
  private fpos: { x: number; z: number; ph: number; a: number }[] = [];
  private apos: { x: number; z: number; yaw: number }[] = [];
  private mFrond: ShaderMaterial;
  private nSheep = 9;
  private nCattle = 4;
  private nGoat = 5;

  constructor() {
    const g = this.group;
    g.position.set(SVC, 0, 0);
    // 紙：先是空白，海與地一層層「畫」上去
    const paper = new Mesh(new PlaneGeometry(900, 700), litMat({ base: 'paper', angle: 2, angle2: 4, space: 5.4, seed: 2, bias: -0.26 }));
    paper.rotation.x = -PI / 2;
    paper.position.set(0, 0.01, -150);
    g.add(paper);
    // 海（左）：以海岸線為軸往外鋪開
    const seaG = new PlaneGeometry(1, 700);
    seaG.translate(-0.5, 0, 0);
    this.sea = new Mesh(seaG, litMat({ base: '#4f7391', line: '#1c2c3c', angle: 0, angle2: 3, space: 4.4, seed: 1301 }));
    this.sea.rotation.x = -PI / 2;
    this.sea.scale.x = 400;
    this.sea.position.set(-1.5, 0.03, -150);
    g.add(this.sea);
    // 地（右）
    const landG = new PlaneGeometry(1, 700);
    landG.translate(0.5, 0, 0);
    this.land = new Mesh(landG, litMat({ base: '#a9b070', line: '#4a5a2a', angle: 84, angle2: 80, space: 5, seed: 1302, cross: true }));
    this.land.rotation.x = -PI / 2;
    this.land.scale.x = 400;
    this.land.position.set(1.5, 0.03, -150);
    g.add(this.land);
    // 山（地上）
    const mHill = litMat({ base: '#9aa064', line: '#3a4a22', angle: 4, space: 5, seed: 1303, bias: -0.2 });
    this.hills = [hillMesh(mHill, 40, -120, 60, 10, 40), hillMesh(mHill, 110, -150, 90, 16, 50), hillMesh(mHill, 20, -200, 120, 9, 40)];
    this.hills.forEach((h) => g.add(h));
    // 樹（地上）
    const mTrunk = litMat({ base: '#8f7145', angle: 82, angle2: 10, space: 4.6, seed: 7, cross: true });
    this.mFrond = litMat({ base: '#5c6a36', angle: 28, angle2: 28, space: 4.6, seed: 8, side: DoubleSide, sway: true });
    for (const [x, z, k] of [[22, -14, 0], [29, -24, 1], [14, -30, 2]] as [number, number, number][]) {
      const tr = new Group();
      tr.add(solid(palmTrunkGeo(7 + k, 0.8), mTrunk, 2.2), new Mesh(palmFrondsGeo(7 + k, 0.8, 3 + k * 5), this.mFrond));
      tr.position.set(x, 0, z);
      g.add(tr);
      this.palms.push(tr);
    }
    // 鳥（天空）
    const nB = 16;
    this.birds = new InstancedMesh(birdGeo(), litMat({ base: 'silh', side: DoubleSide }), nB);
    this.birds.frustumCulled = false;
    const rnd = mulberry32(1310);
    for (let i = 0; i < nB; i++) this.bpos.push({ x: (rnd() - 0.5) * 30, y: 6 + rnd() * 7, z: -10 - rnd() * 16, sp: 1.2 + rnd() * 1.6, ph: rnd() * 6.28 });
    g.add(this.birds);
    // 魚（海裡）：躍出水面的弧
    const nF = 10;
    this.fish = new InstancedMesh(fishGeo(), litMat({ base: 'silh' }), nF);
    this.fish.frustumCulled = false;
    for (let i = 0; i < nF; i++) this.fpos.push({ x: -3 - rnd() * 8, z: -4 - rnd() * 14, ph: rnd(), a: 1.6 + rnd() * 1.2 });
    g.add(this.fish);
    // 走獸（地上）
    const mSheep = litMat({ base: 'paper', parts: ['#e9e1cc', '#14110e'], angle: 50, space: 4.4, seed: 15 });
    const mCow = litMat({ base: '#6b5030', parts: ['#6b5030', '#14110e'], angle: 50, space: 4.4, seed: 16 });
    const mGoat = litMat({ base: '#8a7a5c', parts: ['#8a7a5c', '#14110e'], angle: 50, space: 4.4, seed: 17 });
    this.sheep = new AnimalCrowd('lamb', mSheep, this.nSheep, 1.5);
    this.cattle = new AnimalCrowd('cow', mCow, this.nCattle, 1.5);
    this.goats = new AnimalCrowd('goat', mGoat, this.nGoat, 1.5);
    g.add(this.sheep.group, this.cattle.group, this.goats.group);
    const n = this.nSheep + this.nCattle + this.nGoat;
    for (let i = 0; i < n; i++) this.apos.push({ x: 2.5 + rnd() * 10, z: -1 - rnd() * 16, yaw: (rnd() - 0.5) * 2.4 + PI / 2 });
    g.visible = false;
  }

  update(fr: FrameLite, s: number): void {
    const t = fr.time;
    const mo = !fr.motionOff;
    const p = win(lp(s, 'sv-creation'), 0.08, 0.9);
    // 依序畫出：天（鳥）→ 海（魚）→ 地（走獸）
    const eSea = smooth(0.3, 0.52, p);
    const eLand = smooth(0.56, 0.78, p);
    this.sea.scale.x = Math.max(0.001, 400 * eSea);
    this.sea.visible = eSea > 0.001;
    this.land.scale.x = Math.max(0.001, 400 * eLand);
    this.land.visible = eLand > 0.001;
    this.hills.forEach((h, i) => {
      const k = smooth(0.62 + i * 0.04, 0.8 + i * 0.04, p);
      h.visible = k > 0.001;
      h.scale.y = Math.max(0.001, k) * [10, 16, 9][i];
    });
    this.palms.forEach((tr, i) => {
      const k = smooth(0.66 + i * 0.04, 0.82 + i * 0.04, p);
      tr.visible = k > 0.001;
      tr.scale.setScalar(Math.max(0.001, k));
    });
    const still = smooth(0.9, 0.98, p);
    const amb = mo ? 1 - still : 0;
    // 鳥：依序出現、飛過去（天的活物）
    const nB = this.bpos.length;
    for (let i = 0; i < nB; i++) {
      const b = this.bpos[i];
      const k = smooth(0.06 + i * 0.012, 0.2 + i * 0.012, p);
      const x = b.x + Math.sin(t * 0.2 * b.sp + b.ph) * 4 * amb + (p - 0.5) * 14 * b.sp;
      const flap = 0.55 + 0.45 * Math.sin(t * 7 + b.ph) * amb + 0.45 * (1 - amb);
      _o.position.set(x, b.y + Math.sin(t * 0.7 + b.ph) * 0.3 * amb, b.z);
      _o.rotation.set(0, Math.sin(t * 0.2 * b.sp + b.ph) * 0.4 * amb, 0);
      _o.scale.set(2.2 * k, 2.2 * k * flap, 2.2 * k);
      _o.updateMatrix();
      this.birds.setMatrixAt(i, _o.matrix);
    }
    this.birds.instanceMatrix.needsUpdate = true;
    // 魚：躍出水面的弧
    const nF = this.fpos.length;
    for (let i = 0; i < nF; i++) {
      const f = this.fpos[i];
      const k = smooth(0.46 + i * 0.012, 0.58 + i * 0.012, p);
      const u = (((p * 2.4 + f.ph + t * 0.22 * amb) % 1) + 1) % 1;
      const jump = u < 0.55 ? u / 0.55 : -1;
      const y = jump >= 0 ? 4 * jump * (1 - jump) * f.a : -5;
      const dy = jump >= 0 ? 4 * (1 - 2 * jump) * f.a : 0;
      const x = f.x + (jump >= 0 ? jump * 2.4 : 0);
      _o.position.set(x, y, f.z);
      _o.rotation.set(0, 0, Math.atan2(dy, 2.4 / 0.55 * 0.55) * 0.9);
      const sc = 1.7 * k;
      _o.scale.set(sc, sc, sc);
      _o.updateMatrix();
      this.fish.setMatrixAt(i, _o.matrix);
    }
    this.fish.instanceMatrix.needsUpdate = true;
    // 走獸：一隻一隻出現
    const place = (crowd: AnimalCrowd, n: number, off: number, base: number, wide: number) => {
      for (let i = 0; i < n; i++) {
        const a = this.apos[off + i];
        const it = crowd.items[i];
        const k = smooth(0.7 + (off + i) * 0.012, 0.8 + (off + i) * 0.012, p);
        it.x = a.x + Math.sin(t * 0.1 + i) * 0.5 * amb;
        it.z = a.z;
        it.y = 0;
        it.yaw = a.yaw;
        it.sc = Math.max(0.001, base * k * (wide + (i % 3) * 0.05));
        it.walking = false;
      }
      crowd.update(t, mo, amb);
    };
    place(this.sheep, this.nSheep, 0, 1.0, 0.95);
    place(this.cattle, this.nCattle, this.nSheep, 1.1, 1.0);
    place(this.goats, this.nGoat, this.nSheep + this.nCattle, 1.0, 0.95);
  }
}

// ================================================================ 不耕的田、第六年的三堆糧
export class FieldSite {
  group = new Group();
  private grain: InstancedMesh;
  private vines: Group[] = [];
  private poor: PersonCrowd;
  private beasts: AnimalCrowd;
  private cattle: AnimalCrowd;
  private goats: AnimalCrowd;
  private poorEdge: { sx: number; sz: number; ex: number; ez: number; a: number }[] = [];
  private beastEdge: { sx: number; sz: number; ex: number; ez: number; a: number }[] = [];
  private nPoor = 9;
  private nBeast = 6;
  private nCow = 2;
  private nGoat = 4;
  private mounds: Group[] = [];
  private mound4: Group;
  private floor: Mesh;
  private sacks: Group[] = [];
  private mGrainWind: ShaderMaterial;

  constructor() {
    const g = this.group;
    g.position.set(SVF, 0, 0);
    g.add(groundMesh(1040));
    bigHills(g);
    const rnd = mulberry32(1400);
    // 自長的莊稼：高低不齊、沒人整理
    this.mGrainWind = litMat({ base: FIXED.ochre, parts: ['#a07f4f', '#c6a96c'], partAlt: '#7e6b3d', angle: 80, space: 5, wind: true, seed: 9 });
    const n = 1800;
    this.grain = new InstancedMesh(barleyGeo({ leafLen: 0.9 }), this.mGrainWind, n);
    this.grain.frustumCulled = false;
    for (let i = 0; i < n; i++) {
      const x = (rnd() - 0.5) * 66;
      const z = -34 + rnd() * 40;
      setInst(this.grain, i, x, 0, z, rnd() * 6.28, 0.9 + rnd() * 0.8, 0.6 + rnd() * 0.9, (rnd() - 0.5) * 0.25, (rnd() - 0.5) * 0.25);
    }
    g.add(this.grain);
    // 沒修剪的葡萄樹：長得高、歪
    const mVine = litMat({ base: '#6a5a3a', parts: ['#6a5a3a', '#6f8f3c', '#7a3a58'], angle: 62, space: 4.2, seed: 1007 });
    for (let i = 0; i < 7; i++) {
      const v = solid(vineGeo(60 + i), mVine, 1.3);
      v.position.set(-22 + i * 7.2 + (rnd() - 0.5) * 2, 0, -9 - (i % 2) * 5);
      v.rotation.set((rnd() - 0.5) * 0.25, rnd() * 0.5 - 0.25, (rnd() - 0.5) * 0.3);
      v.scale.set(1.6, 1.8 + rnd() * 0.5, 1.4);
      g.add(v);
      this.vines.push(v);
    }
    const mTree = litMat({ base: '#6a5030', parts: ['#6a5030', '#6f8f3c', '#d08a2c'], angle: 50, space: 3.8, seed: 951, sway: true, swayK: 0.5 });
    for (const [x, z] of [[-30, -18], [31, -16]] as [number, number][]) {
      const tr = solid(fruitTreeGeo(7, 1.9), mTree, 1.6);
      tr.position.set(x, 0, z);
      tr.scale.setScalar(1.9);
      g.add(tr);
    }
    // 進田來吃的：窮人、牲畜、走獸
    this.poor = new PersonCrowd(personGeo({ low: true, belt: true, staff: false }), robeMat('#b79a68', 1410), this.nPoor, 1.7);
    g.add(this.poor.group);
    for (let i = 0; i < this.nPoor; i++) {
      const left = i % 2 === 0;
      this.poorEdge.push({ sx: left ? -42 : 42, sz: 4 + rnd() * 6, ex: -14 + rnd() * 28, ez: -8 + rnd() * 12, a: 0.28 + i * 0.045 });
      this.poor.items[i].sc = 0.92 + rnd() * 0.12;
    }
    this.beasts = new AnimalCrowd('lamb', litMat({ base: 'paper', parts: ['#e9e1cc', '#14110e'], angle: 50, space: 4.4, seed: 15 }), this.nBeast, 1.5);
    this.cattle = new AnimalCrowd('cow', litMat({ base: '#6b5030', parts: ['#6b5030', '#14110e'], angle: 50, space: 4.4, seed: 16 }), this.nCow, 1.5);
    this.goats = new AnimalCrowd('goat', litMat({ base: '#8a7a5c', parts: ['#8a7a5c', '#14110e'], angle: 50, space: 4.4, seed: 17 }), this.nGoat, 1.5);
    g.add(this.beasts.group, this.cattle.group, this.goats.group);
    for (let i = 0; i < this.nBeast + this.nCow + this.nGoat; i++) {
      const left = i % 2 === 1;
      this.beastEdge.push({ sx: left ? -46 : 46, sz: -4 + rnd() * 10, ex: -16 + rnd() * 32, ez: -12 + rnd() * 14, a: 0.34 + i * 0.04 });
    }
    // ---- 第六年的收成：三堆糧（在田旁的禾場，x+90）
    const X = 90;
    const house = solid(houseBodyGeo({ w: 11, h: 3.4, d: 5.6, doorX: 0, tunnel: 1.6 }), litMat({ base: '#a88758', angle: 86, angle2: 8, space: 4.8, seed: 3, cross: true }), 2.4);
    house.position.set(X - 2, 0, -9);
    g.add(house);
    const mFloor = litMat({ base: '#dcc88c', line: '#7a6030', angle: 8, angle2: 8, space: 5, seed: 1003 });
    this.floor = new Mesh(new SphereGeometry(1, 20, 4, 0, PI * 2, 0, 0.12), mFloor);
    this.floor.scale.set(11, 3, 11);
    this.floor.position.set(X, -0.05, 1.2);
    g.add(this.floor);
    const mMound = litMat({ base: '#d9b858', line: '#6a4f1a', angle: 60, space: 3.8, seed: 1004, cross: true });
    const mg = moundGeo();
    for (let i = 0; i < 4; i++) {
      const m = solid(mg, mMound, 1.6);
      m.position.set(X + (i < 3 ? -3.6 + i * 3.4 : 7.4), 0, i < 3 ? 1.6 + (i % 2) * 0.5 : 2.6);
      m.visible = false;
      g.add(m);
      this.mounds.push(m);
    }
    this.mound4 = this.mounds[3];
    const mSack = litMat({ base: '#c9b27a', line: '#4a3a1a', angle: 40, space: 3.8, seed: 1010 });
    for (let i = 0; i < 3; i++) {
      const sk = solid(sackGeo(), mSack, 1.3);
      sk.scale.setScalar(2);
      sk.position.set(X - 6.2 + i * 0.7, 0, -2.4 + (i % 2) * 0.5);
      g.add(sk);
      this.sacks.push(sk);
    }
    g.visible = false;
  }

  update(fr: FrameLite, s: number): void {
    const t = fr.time;
    const mo = !fr.motionOff;
    const fallow = s >= cutOf('sv-fallow') && s < cutOf('sv-sixth');
    const sixth = s >= cutOf('sv-sixth') && s < cutOf('sv-release');
    this.grain.visible = fallow;
    this.vines.forEach((v) => (v.visible = fallow));
    this.poor.group.visible = fallow;
    this.beasts.group.visible = fallow;
    this.cattle.group.visible = fallow;
    this.goats.group.visible = fallow;
    if (fallow) {
      const p = win(lp(s, 'sv-fallow'), 0.08, 0.9);
      for (let i = 0; i < this.nPoor; i++) {
        const e = this.poorEdge[i];
        const k = smooth(e.a, e.a + 0.3, p);
        const it = this.poor.items[i];
        const moving = k > 0.001 && k < 0.999;
        it.x = lerp(e.sx, e.ex, k);
        it.z = lerp(e.sz, e.ez, k);
        it.y = moving ? Math.abs(Math.sin(k * 40 + i)) * 0.045 : 0;
        it.yaw = moving ? faceTo(e.sx, e.sz, e.ex, e.ez) : lerpAng(faceTo(e.sx, e.sz, e.ex, e.ez), PI, smooth(0.9, 1, k));
        it.lean = !moving && k >= 0.999 ? 0.45 + 0.1 * Math.sin(t * 1.3 * (mo ? 1 : 0) + i) : 0;
        it.visible = k > 0.002;
      }
      this.poor.update(t, mo);
      const put = (crowd: AnimalCrowd, n: number, off: number, base: number) => {
        for (let i = 0; i < n; i++) {
          const e = this.beastEdge[off + i];
          const k = smooth(e.a, e.a + 0.32, p);
          const it = crowd.items[i];
          const moving = k > 0.001 && k < 0.999;
          it.x = lerp(e.sx, e.ex, k);
          it.z = lerp(e.sz, e.ez, k);
          it.y = moving ? Math.abs(Math.sin(k * 50 + i)) * 0.03 : 0;
          it.yaw = faceTo(e.sx, e.sz, e.ex, e.ez);
          it.sc = k > 0.002 ? base : 0.001;
          it.walking = moving;
        }
        crowd.update(t, mo, 1);
      };
      put(this.beasts, this.nBeast, 0, 1);
      put(this.cattle, this.nCow, this.nBeast, 1.1);
      put(this.goats, this.nGoat, this.nBeast + this.nCow, 1);
    }
    this.mounds.forEach((m) => (m.visible = sixth));
    this.sacks.forEach((m) => (m.visible = sixth));
    this.floor.visible = sixth;
    if (sixth) {
      const p = win(lp(s, 'sv-sixth'), 0.08, 0.9);
      // 前段：三堆糧一堆一堆長出來；後段：第七、第八年各吃掉一堆；第九年新的收成出來，還剩一些
      const grow = [smooth(0.06, 0.24, p), smooth(0.16, 0.34, p), smooth(0.26, 0.44, p)];
      const eat1 = smooth(0.48, 0.6, p);
      const eat2 = smooth(0.62, 0.74, p);
      const sc = [grow[0] * (1 - 0.9 * eat1), grow[1] * (1 - 0.9 * eat2), grow[2] * (1 - 0.45 * smooth(0.82, 0.96, p))];
      for (let i = 0; i < 3; i++) {
        const k = Math.max(0.0001, sc[i]);
        this.mounds[i].scale.set(3.1 * k, 3.1 * k * 0.95, 3.1 * k);
      }
      const k4 = smooth(0.8, 0.96, p);
      this.mound4.visible = k4 > 0.001;
      this.mound4.scale.setScalar(Math.max(0.0001, 3.1 * k4));
    }
  }
}

// ================================================================ 住棚節的村子：宣讀律法（也留到 sv-49 的黃昏）
export class VillageSite {
  group = new Group();
  private booths: BoothSet;
  private men: PersonCrowd;
  private women: PersonCrowd;
  private kids: PersonCrowd;
  private aliens: PersonCrowd;
  private reader: RigPerson;
  private sheet: Mesh;
  private rods: Mesh[] = [];
  private scroll: Group;
  private home: { x: number; z: number; ph: number; sx: number; sz: number }[] = [];
  private nM = 20;
  private nW = 16;
  private nK = 12;
  private nA = 8;
  private tree: ShaderMaterial;

  constructor() {
    const g = this.group;
    g.position.set(SVV, 0, 0);
    g.add(groundMesh(1500));
    bigHills(g);
    const mMud = litMat({ base: '#a88758', angle: 86, angle2: 8, space: 4.8, seed: 3, cross: true });
    const mWood = litMat({ base: '#6e5433', angle: 74, angle2: 10, space: 4.4, seed: 5 });
    const frameG = doorFrameGeo();
    for (const [x, w, h, d] of [[-34, 9, 3.2, 6], [-18, 8, 3.5, 6], [20, 8.5, 3.6, 6], [36, 9, 3.1, 6]] as [number, number, number, number][]) {
      const hg = new Group();
      hg.position.set(x, 0, -16);
      hg.add(solid(houseBodyGeo({ w, h, d, doorX: 0, tunnel: 1.6 }), mMud, 2.4));
      hg.add(solid(frameG, mWood, 1.8));
      g.add(hg);
    }
    this.tree = litMat({ base: '#5c5836', angle: 28, angle2: 28, space: 4.6, seed: 8, side: DoubleSide, sway: true });
    for (const [x, z, k] of [[-44, -22, 0], [46, -23, 1]] as [number, number, number][]) {
      const tr = new Group();
      tr.add(solid(palmTrunkGeo(7 + k, 0.8), litMat({ base: '#8f7145', angle: 82, angle2: 10, space: 4.6, seed: 7, cross: true }), 2.2), new Mesh(palmFrondsGeo(7 + k, 0.8, 3 + k * 5), this.tree));
      tr.position.set(x, 0, z);
      g.add(tr);
    }
    // 棚子（四座，已經搭好）
    this.booths = new BoothSet(
      [
        { x: -15, y: 0, z: -7, yaw: 0, w: 4.4, d: 3.4, h: 2.4 },
        { x: -8.5, y: 0, z: -8.2, yaw: 0, w: 3.8, d: 3.0, h: 2.2 },
        { x: 9, y: 0, z: -8.2, yaw: 0, w: 3.8, d: 3.0, h: 2.2 },
        { x: 15.5, y: 0, z: -7, yaw: 0, w: 4.4, d: 3.4, h: 2.4 },
      ],
      41,
    );
    for (let i = 0; i < 4; i++) this.booths.setAssembly(i, 1);
    this.booths.setDry(0);
    this.booths.update();
    g.add(this.booths.group);
    // 宣讀的人與書卷（站在一個不高的木臺上）
    const mPlat = litMat({ base: '#7a5a32', parts: ['#7a5a32', '#9a7a48'], line: '#241808', angle: 74, space: 4.4, seed: 904 });
    const plat = solid(platformGeo(3.6, 2.4, 0.7), mPlat, 1.9);
    plat.position.set(0, 0, -4.4);
    g.add(plat);
    this.reader = new RigPerson({ slim: true, belt: true, wrap: true, armL: [0.3, 0.12], armR: [0.3, 0.12], seed: 1510, outline: 2.4 }, robeMat('#e4dac0', 1510, '#14110e', '#e4dac0'));
    this.reader.group.position.set(0, 0.7, -3.9);
    g.add(this.reader.group);
    const mPaper = litMat({ base: '#efe6cc', line: '#3a2e18', angle: 4, space: 3.6, seed: 911, side: DoubleSide, bias: 0.3 });
    const mRod = litMat({ base: '#6e5433', angle: 74, space: 4, seed: 912 });
    this.scroll = new Group();
    this.sheet = new Mesh(new PlaneGeometry(1, 0.5), mPaper);
    this.sheet.position.set(0.5, 0, 0);
    const rodGeo = scrollRodGeo();
    const r1 = new Mesh(rodGeo, mRod);
    const r2 = new Mesh(rodGeo, mRod);
    this.scroll.add(this.sheet, r1, r2);
    this.rods = [r1, r2];
    g.add(this.scroll);
    // 一大群人：男、女、孩子、寄居的
    this.men = new PersonCrowd(personGeo({ low: true, belt: true, staff: true, staffSide: 'R' }), robeMat('#b79a68', 1520), this.nM, 1.7);
    this.women = new PersonCrowd(personGeo({ low: true, belt: true, veil: true }), robeMat('#d8cdb4', 1521, '#14110e', '#8a5a3a'), this.nW, 1.7);
    this.kids = new PersonCrowd(personGeo({ low: true, belt: true }), robeMat('#cdbf9e', 1522), this.nK, 1.6);
    this.aliens = new PersonCrowd(personGeo({ low: true, belt: true, staff: true, staffSide: 'L' }), robeMat('#6c5a3d', 1523, '#14110e', '#8a5a3a'), this.nA, 1.7);
    g.add(this.men.group, this.women.group, this.kids.group, this.aliens.group);
    const rnd = mulberry32(1530);
    const total = this.nM + this.nW + this.nK + this.nA;
    for (let i = 0; i < total; i++) {
      const row = Math.floor(i / 11);
      const x = -15 + ((i % 11) + (row % 2) * 0.5) * 2.9 + (rnd() - 0.5) * 0.9;
      const z = 0.6 + row * 2.2 + (rnd() - 0.5) * 0.7;
      const side = i % 2 === 0 ? -1 : 1;
      this.home.push({ x, z, ph: rnd(), sx: side * (30 + rnd() * 22), sz: 6 + rnd() * 18 });
    }
    // 孩子排在前面
    g.visible = false;
  }

  update(fr: FrameLite, s: number): void {
    const t = fr.time;
    const mo = !fr.motionOff;
    const reading = s >= cutOf('sv-reading') && s < c('sv-49');
    const p = s >= c('sv-49') ? 1 : win(lp(s, 'sv-reading'), 0.08, 0.9);
    this.booths.setSway(1);
    this.booths.update();
    // 書卷展開（0.08–0.3）
    const open = smooth(0.08, 0.3, p);
    const e = this.reader;
    this.sheet.scale.x = Math.max(0.02, open * 0.9);
    this.scroll.position.set(-0.45 * open, 0.7 + 1.18, -3.62);
    this.rods[0].position.set(0, 0, 0);
    this.rods[1].position.set(Math.max(0.02, open * 0.9), 0, 0);
    aimAt(e, 'L', 0.38 * open - 0.1, 1.88, -3.62);
    aimAt(e, 'R', -0.4 * open + 0.05, 1.88, -3.62);
    e.headPitch = 0.28 * open;
    e.update(t, mo);
    // 人群：聚攏（0.1–0.45）→ 坐下（0.45–0.6）→ 抬頭聽（0.62–0.8）
    const gather = smooth(0.1, 0.46, p);
    const sit = smooth(0.46, 0.6, p);
    const listen = smooth(0.62, 0.8, p);
    const all = this.nM + this.nW + this.nK + this.nA;
    const crowds = [this.men, this.women, this.kids, this.aliens];
    const sizes = [this.nM, this.nW, this.nK, this.nA];
    let gi = 0;
    for (let ci = 0; ci < 4; ci++) {
      const crowd = crowds[ci];
      for (let j = 0; j < sizes[ci]; j++, gi++) {
        // 孩子排前面、寄居的排兩側：把序號對到座位
        const slot = ci === 2 ? j : ci === 3 ? this.nK + j : this.nK + this.nA + (ci === 0 ? j : this.nM + j);
        const h = this.home[slot % all];
        const it = crowd.items[j];
        const di = clamp(gather * 1.35 - h.ph * 0.35);
        const k = smooth(0, 1, di);
        const moving = k > 0.001 && k < 0.999;
        it.x = lerp(h.sx, h.x, k);
        it.z = lerp(h.sz, h.z, k);
        it.y = moving ? Math.abs(Math.sin(k * 60 + gi)) * 0.045 : 0;
        const head = Math.atan2(h.x - h.sx, h.z - h.sz);
        it.yaw = moving ? head : lerpAng(head, PI + (h.ph - 0.5) * 0.2, smooth(0, 1, (gather - 0.9) / 0.1));
        const sc = ci === 2 ? 0.62 : 0.94 + h.ph * 0.12;
        it.sc = sc;
        it.sy = lerp(1, 0.6, sit) * (1 + (mo ? 0.01 : 0) * Math.sin(t + gi));
        it.lean = (0.22 * sit - 0.2 * listen * sit) * (k > 0.99 ? 1 : 0);
        it.visible = true;
      }
      crowd.update(t, mo);
    }
    this.group.visible = this.group.visible && (reading || s >= c('sv-49'));
  }
}

// ================================================================ 禧年的角聲（贖罪日）
export class HornSite {
  group = new Group();
  private people: RigPerson[] = [];
  private horns: Group[] = [];
  private pBase: { x: number; z: number; y: number; yaw: number }[] = [];
  private far: PersonCrowd;
  private sheep: AnimalCrowd;
  blowfx: BlowFx[] = [];
  private raise = 0;
  busy = false;
  private hillY: (x: number, z: number) => number;

  constructor() {
    const g = this.group;
    g.position.set(SVP, 0, 0);
    g.add(groundMesh(1600));
    const mHill = litMat({ base: '#b9985a', line: '#5d4623', angle: 4, space: 5, seed: 6, bias: -0.2 });
    // 遍地的村莊山頭：幾座山，山上有一小群一小群的房子
    const hills: [number, number, number, number, number][] = [
      [-46, -46, 40, 9, 32], [10, -66, 62, 13, 38], [58, -50, 44, 10, 30], [-6, -22, 30, 4.2, 18], [-96, -92, 70, 15, 40], [112, -96, 80, 16, 44],
    ];
    for (const h of hills) g.add(hillMesh(mHill, h[0], h[1], h[2], h[3], h[4]));
    this.hillY = (x: number, z: number): number => {
      let y = 0;
      for (const h of hills) {
        const v = 1 - ((x - h[0]) / h[2]) ** 2 - ((z - h[1]) / h[4]) ** 2;
        if (v > 0) y = Math.max(y, h[3] * Math.sqrt(v));
      }
      return y;
    };
    const mMud = litMat({ base: '#a88758', angle: 86, angle2: 8, space: 4.8, seed: 3, cross: true });
    const frameG = doorFrameGeo();
    // 山坡上的房子
    const rnd = mulberry32(1600);
    for (let i = 0; i < 26; i++) {
      const hh = hills[i % 5];
      const x = hh[0] + (rnd() - 0.5) * hh[2] * 1.2;
      const z = hh[1] + 4 + rnd() * hh[4] * 0.5;
      const y = this.hillY(x, z);
      if (y < 0.6) continue;
      const hg = new Group();
      hg.position.set(x, y - 0.5, z);
      const w = 4 + rnd() * 2;
      hg.add(solid(houseBodyGeo({ w, h: 2.6 + rnd() * 0.8, d: 3.6, doorX: 0, tunnel: 1.2 }), mMud, 2.0));
      hg.add(solid(frameG, mMud, 1.4));
      hg.scale.setScalar(1.0);
      hg.rotation.y = (rnd() - 0.5) * 0.7;
      g.add(hg);
    }
    // 吹角的人：前面一座矮坡上的八個人（舉公羊角吹），遠處山頭幾十個小小的人
    const hg = hornGeo();
    const mHorn = litMat({ base: '#5a4a38', line: '#1a120a', angle: 40, space: 3.6, seed: 1601 });
    const spots: [number, number, number][] = [
      [-9.5, -9.6, 0.5], [-6.2, -11.4, 0.2], [-2.6, -10.2, 0.4], [1.8, -11.6, 0.1], [5.4, -10.4, 0.3], [9.2, -11.8, 0.5], [-12.6, -13.2, 0.2], [12.6, -13.6, 0.4],
    ];
    spots.forEach(([x, z, yaw], i) => {
      const r = new RigPerson({ belt: true, slim: i % 2 === 0, staff: false, armL: [0.2, 0.14], armR: [0.2, 0.14], seed: 1610 + i, outline: 2.0 }, robeMat(['#a88758', '#8f7550', '#b59a68', '#cdbf9e'][i % 4], 1610 + i));
      const y = this.hillY(x, z);
      r.group.position.set(x, y, z);
      r.group.rotation.y = yaw * 0.6;
      g.add(r.group);
      this.people.push(r);
      this.pBase.push({ x, z, y, yaw: yaw * 0.6 });
      const horn = solid(hg, mHorn, 1.2);
      horn.scale.setScalar(1.0);
      r.group.add(horn);
      this.horns.push(horn);
    });
    this.far = new PersonCrowd(personGeo({ low: true, belt: true }), robeMat('#b79a68', 1620), 30, 1.4);
    g.add(this.far.group);
    for (let i = 0; i < 30; i++) {
      const hh = hills[1 + (i % 5)];
      const x = hh[0] + (rnd() - 0.5) * hh[2] * 0.9;
      const z = hh[1] + 6 + rnd() * hh[4] * 0.6;
      const it = this.far.items[i];
      it.x = x;
      it.z = z;
      it.y = this.hillY(x, z);
      it.yaw = (rnd() - 0.5) * 1.2;
      it.sc = 1.1 + rnd() * 0.3;
    }
    this.sheep = new AnimalCrowd('lamb', litMat({ base: 'paper', parts: ['#e9e1cc', '#14110e'], angle: 50, space: 4.4, seed: 15 }), 10, 1.4);
    g.add(this.sheep.group);
    for (let i = 0; i < 10; i++) {
      const it = this.sheep.items[i];
      it.x = -26 + rnd() * 52;
      it.z = -18 + rnd() * 6;
      it.y = this.hillY(it.x, it.z);
      it.yaw = rnd() * 6.28;
      it.sc = 1;
    }
    // 聲波：從幾個山頭同時擴散
    const centers: [number, number, number][] = [[-6, -11, 1.6], [34, -50, 6], [-52, -52, 5], [14, -86, 12]];
    centers.forEach(([x, z, y]) => {
      const b = new BlowFx(SVP + x, z, y, false);
      this.blowfx.push(b);
    });
    g.visible = false;
  }

  /** 聲波要放在世界場景裡（不隨 group 隱藏），由呼叫端加進 scene */
  update(fr: FrameLite, _s: number, show: boolean): void {
    const t = fr.time;
    const mo = !fr.motionOff;
    const dt = fr.dt;
    const level = story.blow.level;
    // 舉角：level 一開始就舉到嘴邊，放開後放下
    const target = level > 0.04 ? 1 : 0;
    this.raise += (target - this.raise) * (1 - Math.exp(-dt * 12));
    for (let i = 0; i < this.people.length; i++) {
      const r = this.people[i];
      const b = this.pBase[i];
      const k = this.raise;
      r.group.position.set(b.x, b.y, b.z);
      // 右手把角舉到嘴邊（人物座標：嘴在身前 0.2、高 1.45）；角的窄端（吹口）在嘴上，往前上方彎出去
      const yaw = r.group.rotation.y;
      const mx = b.x + Math.sin(yaw) * 0.22;
      const mz = b.z + Math.cos(yaw) * 0.22;
      aimAt(r, 'R', mx, b.y + 1.38, mz);
      r.swingR = lerp(0.3, r.swingR, k);
      r.splayR = lerp(0.12, r.splayR, k);
      r.swingL = 0.2;
      r.headPitch = -0.12 * k;
      r.lean = 0.02 * Math.sin(t * 6 + i) * level;
      r.update(t, mo);
      // 角跟著右手：放下時垂在身側，舉起時在嘴邊
      const hr = this.horns[i];
      hr.position.set(lerp(-0.3, 0, k), lerp(0.55, 1.4, k), lerp(0.12, 0.2, k));
      hr.rotation.set(0, -PI / 2, lerp(-1.25, 0.1, k));
    }
    this.far.update(t, mo);
    this.sheep.update(t, mo, 1);
    this.busy = false;
    for (const b of this.blowfx) {
      b.update(dt, level, show);
      if (b.busy) this.busy = true;
    }
  }
}


// ================================================================ 全部小地點
export class Sevens {
  group = new Group();
  readonly home = new HomeSite();
  readonly creation = new CreationSite();
  readonly field = new FieldSite();
  readonly village = new VillageSite();
  readonly horn = new HornSite();
  readonly liberty = new Liberty();
  readonly land = new Land();
  readonly jer = new Jer();
  readonly rest = new Rest();
  readonly oath = new Oath();
  /** 有讀者觸發的動畫正在播放（聲波還在擴散） */
  busy = false;

  constructor() {
    this.group.add(this.home.group, this.creation.group, this.field.group, this.village.group, this.horn.group, this.liberty.group, this.land.group, this.jer.group, this.rest.group, this.oath.group);
    for (const b of this.horn.blowfx) this.group.add(b.vert, b.flat);
  }

  update(fr: FrameLite, s: number): void {
    const w = (a: string, b: string): boolean => s >= cutOf(a) && s < cutOf(b);
    const homeOn = w('sv-sabbath', 'sv-creation') || w('sv-ox', 'sv-fallow') || w('sv-release', 'sv-egypt');
    const creOn = w('sv-creation', 'sv-ox');
    const fieldOn = w('sv-fallow', 'sv-release');
    const vilOn = w('sv-reading', 'sv-horn');
    const hornOn = w('sv-horn', 'sv-liberty');
    const libOn = w('sv-liberty', 'sv-land');
    const landOn = w('sv-land', 'echo-zedekiah');
    const jerOn = w('echo-zedekiah', 'echo-land-rest');
    const restOn = w('echo-land-rest', 'echo-oath');
    const oathOn = w('echo-oath', 'coda-night');
    this.home.group.visible = homeOn;
    this.creation.group.visible = creOn;
    this.field.group.visible = fieldOn;
    this.village.group.visible = vilOn;
    this.horn.group.visible = hornOn;
    this.liberty.group.visible = libOn;
    this.land.group.visible = landOn;
    this.jer.group.visible = jerOn;
    this.rest.group.visible = restOn;
    this.oath.group.visible = oathOn;
    if (homeOn) this.home.update(fr, s);
    if (creOn) this.creation.update(fr, s);
    if (fieldOn) this.field.update(fr, s);
    if (vilOn) this.village.update(fr, s);
    // 聲波要在離開那一拍後繼續收尾，所以每幀都更新
    if (hornOn || this.horn.busy) this.horn.update(fr, s, hornOn);
    this.busy = this.horn.busy;
    if (libOn) this.liberty.update(fr, s);
    if (landOn) this.land.update(fr, s);
    if (jerOn) this.jer.update(fr, s);
    if (restOn) this.rest.update(fr, s);
    if (oathOn) this.oath.update(fr, s);
  }
}
