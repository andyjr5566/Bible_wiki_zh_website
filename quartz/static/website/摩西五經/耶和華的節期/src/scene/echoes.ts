// 舊約回聲拍的場景（後來的歷史）：吉甲營地、耶路撒冷聖殿院子、伯利恆的大麥田、水門前的廣場。
// 全部沿用既有模型（帳棚、禾捆、人物、牲畜）；配色走 laterPalette（舊紙色）。
// 只畫經文自己說的：不加飛鳥、狗、光環、天使、文字標籤。
import { BoxGeometry, Color, DoubleSide, Group, InstancedMesh, Mesh, PlaneGeometry, type ShaderMaterial, SphereGeometry, Vector3 } from 'three';
import { fieldGeo, flamePlanesGeo, clothGeo, fireBaseGeo, flatBreadGeo, sheafGeo, sickleGeo, tentGeo } from './geo2';
import { makeFx, type FxSet } from './fx';
import { barleyGeo, palmFrondsGeo, palmTrunkGeo, personGeo } from './geo';
import { altarGeo, courtWallGeo, gateTowerGeo, mannaGeo, platformGeo, scrollRodGeo, templeGeo, wallSegGeo } from './geo3';
import { GTX, GX, JX, RX } from './layout';
import { flameMat, litMat, solid, solidInstanced } from './materials';
import { type FrameLite, hillMesh, poolGlow, poolMesh, robeMat, setInst } from './props';
import { PersonCrowd, RigPerson } from './rig';
import { aimAt, faceTo, lerpAng } from './rigutil';
import { lp } from './tracks';
import { clamp, lerp, mulberry32, smooth, win } from './util';

const PI = Math.PI;
const _w = new Vector3();

/** 田地起伏（比春季的 hf 平緩）：靠近鏡頭平坦 */
function hfSoft(x: number, z: number): number {
  const amp = smooth(-2, -30, z);
  return amp * (0.5 * Math.sin(x * 0.05 + 1.3) * Math.cos(z * 0.06) + 0.35 * Math.sin(z * 0.1 - x * 0.03 + 2));
}

/** 在群組裡擺的一群人：位置在 [起點→終點] 之間依進度時段 [a,b] 走過去 */
interface Mover {
  sx: number;
  sz: number;
  ex: number;
  ez: number;
  a: number;
  b: number;
  endYaw: number;
}

function walkCrowd(crowd: PersonCrowd, idx: number[], mv: Mover[], p: number, extra?: (i: number, k: number, moving: boolean) => void): void {
  for (let n = 0; n < idx.length; n++) {
    const it = crowd.items[idx[n]];
    const m = mv[n];
    const k = smooth(m.a, m.b, p);
    const moving = k > 0.001 && k < 0.999;
    it.x = lerp(m.sx, m.ex, k);
    it.z = lerp(m.sz, m.ez, k);
    const dx = m.ex - m.sx;
    const dz = m.ez - m.sz;
    const head = Math.atan2(dx, dz);
    it.yaw = moving ? head : k >= 0.999 ? lerpAng(head, m.endYaw, smooth(0, 1, (p - m.b) / 0.06)) : head;
    it.y = moving ? Math.abs(Math.sin(k * Math.hypot(dx, dz) / 0.78 + n)) * 0.045 : 0;
    it.visible = k > 0.0005 || p >= m.a;
    if (extra) extra(n, k, moving);
  }
}

// ================================================================ 吉甲
const FIRE = { x: 0, z: -2 };

export class Gilgal {
  group = new Group();
  private people: RigPerson[] = [];
  private ears: Group[] = [];
  private flames: Mesh[] = [];
  private flameBase: number[] = [];
  private flameMats: ShaderMaterial[] = [];
  private pool: ShaderMaterial;
  private fxS: FxSet;
  private fxSm: FxSet;
  private manna: InstancedMesh;
  private mannaPos: { x: number; z: number; r: number; sc: number; th: number }[] = [];
  private mFrond: ShaderMaterial;

  constructor() {
    const g = this.group;
    g.position.set(GX, 0, 0);
    const rnd = mulberry32(601);
    const mGround = litMat({ base: '#c9b27c', line: '#6a5026', angle: 84, angle2: 80, space: 5, seed: 601, cross: true });
    const ground = new Mesh(fieldGeo(600, 560, 40, hfSoft, 50, -250), mGround);
    ground.position.y = 0.02;
    g.add(ground);
    const mHill = litMat({ base: '#bfa670', line: '#5d4623', angle: 4, space: 5, seed: 6, bias: -0.2 });
    g.add(hillMesh(mHill, -70, -170, 110, 11, 50), hillMesh(mHill, 95, -190, 130, 15, 60), hillMesh(mHill, 10, -260, 190, 10, 50));
    // 耶利哥是棕樹城：遠處幾棵棕樹（葉子慢搖）
    const mTrunk = litMat({ base: '#8f7145', angle: 82, angle2: 10, space: 4.6, seed: 7, cross: true });
    this.mFrond = litMat({ base: '#5c5836', angle: 28, angle2: 28, space: 4.6, seed: 8, side: DoubleSide, sway: true });
    const palmAt = (x: number, z: number, kind: number, yaw: number, sc: number) => {
      const t = new Group();
      t.add(solid(palmTrunkGeo(7 + kind, 0.8), mTrunk, 2.2));
      t.add(new Mesh(palmFrondsGeo(7 + kind, 0.8, 3 + kind * 5), this.mFrond));
      t.position.set(x, 0, z);
      t.rotation.y = yaw;
      t.scale.setScalar(sc);
      g.add(t);
    };
    palmAt(-26, -34, 0, 0.3, 1);
    palmAt(-20, -42, 1, 1.1, 1.1);
    palmAt(24, -38, 2, 2.0, 1);
    palmAt(31, -30, 0, 0.7, 0.9);
    palmAt(-34, -20, 2, 2.4, 1);
    palmAt(38, -22, 1, 1.5, 1.05);
    // 帳棚：圍著營火的一圈，門朝中央（布面隨風）
    const tg = tentGeo();
    const mTent = litMat({ base: '#4a3a2a', parts: ['#4f3f2e', '#e7b55a'], partAlt: '#5c4a34', angle: 70, space: 4.4, seed: 61, cross: true, flap: true });
    const n = 11;
    const tents = solidInstanced(tg, mTent, n, 1.6);
    g.add(tents.group);
    for (let i = 0; i < n; i++) {
      const a = -PI * 0.92 + (i / (n - 1)) * PI * 1.84 + (rnd() - 0.5) * 0.12;
      const r = 17 + rnd() * 7;
      const x = FIRE.x + Math.cos(a - PI / 2) * r * 1.35;
      const z = FIRE.z - 3 - Math.abs(Math.sin(a - PI / 2)) * r * 0.9 - 4;
      setInst(tents.main, i, x, 0, z, faceTo(x, z, FIRE.x, FIRE.z) + (rnd() - 0.5) * 0.4, 1.1 + rnd() * 0.5);
      tents.main.setColorAt(i, new Color(rnd(), 0, 0));
    }
    tents.main.instanceMatrix.needsUpdate = true;
    if (tents.main.instanceColor) tents.main.instanceColor.needsUpdate = true;
    // 營火：石圈、柴、火焰、光池、火星與煙
    const mFire = litMat({ base: '#6f6a5e', parts: ['#7d7667', '#2a1d12'], angle: 30, space: 4, seed: 53 });
    const fire = solid(fireBaseGeo(), mFire, 1.6);
    fire.position.set(FIRE.x, 0, FIRE.z);
    fire.scale.setScalar(1.5);
    g.add(fire);
    const fm = flameMat();
    this.flameMats.push(fm);
    const fg = flamePlanesGeo();
    [1.0, 0.78, 0.62].forEach((h, i) => {
      const f = new Mesh(fg, fm);
      f.position.set(FIRE.x + (i - 1) * 0.18, 0.1, FIRE.z + (i % 2 ? 0.08 : -0.08));
      f.scale.set(0.8 * (1.1 - i * 0.12), 0.9 * h, 0.8 * (1.1 - i * 0.12));
      g.add(f);
      this.flames.push(f);
      this.flameBase.push(0.9 * h);
    });
    this.pool = poolGlow();
    g.add(poolMesh(this.pool, 6, FIRE.x, FIRE.z));
    this.fxS = makeFx('spark', [[FIRE.x, 0.7, FIRE.z]], 14, 0.05, 611);
    this.fxSm = makeFx('smoke', [[FIRE.x, 0.8, FIRE.z]], 6, 0.6, 612);
    g.add(this.fxS.mesh, this.fxSm.mesh);
    // 布上薄薄的無酵餅
    const mCloth = litMat({ base: '#e0d6bf', angle: 10, space: 4.4, seed: 54, side: DoubleSide });
    const cloth = solid(clothGeo(1.5, 1.0), mCloth, 1.4);
    cloth.position.set(FIRE.x + 3.0, 0.02, FIRE.z + 1.8);
    cloth.rotation.y = 0.4;
    g.add(cloth);
    const mBread = litMat({ base: '#d9c690', angle: 20, space: 3.8, seed: 34, bias: 0.12 });
    for (let i = 0; i < 3; i++) {
      const b = solid(flatBreadGeo(3 - (i % 2), 0.19), mBread, 1.2);
      b.position.set(FIRE.x + 2.65 + i * 0.36, 0.04, FIRE.z + 1.7 + (i % 2) * 0.28);
      b.rotation.y = i * 0.9;
      g.add(b);
    }
    // 圍著火的人（把烘好的穗子從火上取下，分給旁人）
    const spec: { a: number; robe: string; sc: number; o: ConstructorParameters<typeof RigPerson>[0] }[] = [
      { a: -2.5, robe: '#a88758', sc: 1.0, o: { belt: true, staff: true, staffSide: 'L', armL: [0.2, 0.14], armR: [0.3, 0.12] } },
      { a: -1.45, robe: '#cdbf9e', sc: 0.96, o: { slim: true, belt: true, armL: [0.2, 0.14], armR: [0.2, 0.12] } },
      { a: -0.4, robe: '#8f7550', sc: 1.03, o: { belt: true, armL: [0.2, 0.14], armR: [0.25, 0.12] } },
      { a: 0.65, robe: '#b79a68', sc: 0.97, o: { slim: true, belt: true, armL: [0.2, 0.14], armR: [0.2, 0.12] } },
      { a: 1.6, robe: '#d8cdb4', sc: 0.6, o: { wrap: true, kid: true, armL: [0.2, 0.2], armR: [0.2, 0.2] } },
    ];
    spec.forEach((f, i) => {
      const r = new RigPerson({ ...f.o, scale: f.sc, seed: 620 + i }, robeMat(f.robe, 620 + i));
      const x = FIRE.x + Math.sin(f.a) * 2.35;
      const z = FIRE.z + Math.cos(f.a) * 2.35;
      r.group.position.set(x, 0, z);
      r.group.rotation.y = faceTo(x, z, FIRE.x, FIRE.z);
      g.add(r.group);
      this.people.push(r);
    });
    // 烘穗子：穗子（小禾捆）掛在火上的木杆上，之後一支一支被取下遞出去
    const mEar = litMat({ base: '#c6a35a', parts: ['#b79a55', '#d9b861', '#6a4a26'], angle: 70, space: 4, seed: 71 });
    const mStick = litMat({ base: '#6e5433', angle: 74, space: 4.4, seed: 5 });
    for (let i = 0; i < 3; i++) {
      const e = solid(sheafGeo(5 + i, 14, 0.6), mEar, 1.2);
      e.scale.setScalar(0.55);
      g.add(e);
      this.ears.push(e);
      const a = -0.5 + i * 0.5;
      const st = new Mesh(new BoxGeometry(0.03, 1.5, 0.03), mStick);
      st.position.set(FIRE.x + Math.sin(a) * 0.55, 0.62, FIRE.z - Math.cos(a) * 0.4 - 0.2);
      st.rotation.set(0.9, 0, a * 0.3 + 0.3);
      g.add(st);
    }
    // 嗎哪：地上白色的薄片，後段越來越少，最後地面是空的
    const mManna = litMat({ base: '#f6f1e2', line: '#8a7a5a', angle: 20, space: 3.4, seed: 631, bias: 0.4 });
    this.manna = new InstancedMesh(mannaGeo(), mManna, 340);
    this.manna.frustumCulled = false;
    for (let i = 0; i < 340; i++) {
      let x = 0;
      let z = 0;
      for (let t = 0; t < 6; t++) {
        x = (rnd() - 0.5) * 30;
        z = -9 + rnd() * 24;
        if (Math.hypot(x - FIRE.x, z - FIRE.z) > 2.2) break;
      }
      this.mannaPos.push({ x, z, r: rnd() * 6, sc: 0.08 + rnd() * 0.07, th: rnd() });
    }
    g.add(this.manna);
    g.visible = false;
  }

  update(fr: FrameLite, s: number): void {
    const t = fr.time;
    const mo = !fr.motionOff;
    const p = win(lp(s, 'echo-gilgal'));
    const fl = mo ? 1 : 0;
    for (const m of this.flameMats) m.uniforms.uFlick.value = fl;
    for (let i = 0; i < this.flames.length; i++) {
      const w = mo ? 1 + 0.16 * Math.sin(t * 8.7 + i * 1.7) + 0.09 * Math.sin(t * 14.3 + i * 2.7) : 1;
      this.flames[i].scale.y = this.flameBase[i] * w;
    }
    this.pool.uniforms.uOn.value = 0.55;
    this.fxS.mat.uniforms.uOn.value = mo ? 1 : 0;
    this.fxSm.mat.uniforms.uOn.value = mo ? 1 : 0;
    // 前段：人們從火上取下烘好的穗子，分給旁人（三次）
    const ev: { taker: number; recv: number; t0: number; t1: number; t2: number }[] = [
      { taker: 2, recv: 1, t0: 0.06, t1: 0.17, t2: 0.28 },
      { taker: 2, recv: 3, t0: 0.24, t1: 0.35, t2: 0.46 },
      { taker: 0, recv: 4, t0: 0.4, t1: 0.5, t2: 0.6 },
    ];
    for (const r of this.people) {
      r.swingL = 0.2;
      r.splayL = 0.14;
      r.swingR = 0.2;
      r.splayR = 0.12;
      r.bow = 0;
    }
    for (let i = 0; i < ev.length; i++) {
      const e = ev[i];
      const taker = this.people[e.taker];
      const recv = this.people[e.recv];
      const ear = this.ears[i];
      const fire = _w.set(FIRE.x + Math.sin(-0.5 + i * 0.5) * 0.45, 1.0, FIRE.z - 0.25);
      const fx = fire.x;
      const fy = fire.y;
      const fz = fire.z;
      const tp = taker.group.position;
      const rp = recv.group.position;
      const mx = (tp.x + rp.x) / 2 + (FIRE.x - (tp.x + rp.x) / 2) * 0.12;
      const mz = (tp.z + rp.z) / 2 + (FIRE.z - (tp.z + rp.z) / 2) * 0.12;
      const k1 = smooth(e.t0, e.t1, p);
      const k2 = smooth(e.t1, e.t2, p);
      // 穗子的位置：火上 → 取的人手中（在火邊）→ 遞給旁人
      let ex = lerp(fx, mx, k2);
      let ey = lerp(fy, 1.05, k2);
      let ez = lerp(fz, mz, k2);
      if (k1 < 1) {
        ex = fx;
        ey = fy;
        ez = fz;
      }
      ear.position.set(ex, ey, ez);
      ear.rotation.set(0.2, 0.6 + i, PI / 2 - 0.2);
      // 取的人：手伸到火上，拿到後轉向旁人遞出；接的人：手伸出來接
      const reach = smooth(e.t0 - 0.04, e.t0 + 0.04, p) * (1 - smooth(e.t1 - 0.03, e.t1 + 0.01, p));
      const give = smooth(e.t1 - 0.02, e.t1 + 0.03, p) * (1 - smooth(e.t2, e.t2 + 0.05, p));
      const take = Math.max(reach, give);
      if (take > 0) {
        const tx = lerp(fx, mx, k2);
        const tz = lerp(fz, mz, k2);
        const tyy = lerp(fy - 0.02, 1.05, k2);
        const a1 = taker.swingR;
        const a2 = taker.splayR;
        aimAt(taker, 'R', tx, tyy, tz);
        taker.swingR = lerp(a1, taker.swingR, take);
        taker.splayR = lerp(a2, taker.splayR, take);
        taker.group.rotation.y = lerpAng(faceTo(tp.x, tp.z, FIRE.x, FIRE.z), faceTo(tp.x, tp.z, rp.x, rp.z), k2 * give);
      }
      const rcv = smooth(e.t1 - 0.02, e.t1 + 0.03, p);
      if (rcv > 0) {
        const hold = 1 - smooth(e.t2 + 0.1, e.t2 + 0.2, p);
        const b1 = recv.swingL;
        const b2 = recv.splayL;
        aimAt(recv, 'L', mx, 1.05 + 0.06 * hold - 0.06 * (1 - hold), mz);
        recv.swingL = lerp(b1, recv.swingL, rcv * Math.max(hold, 0.4));
        recv.splayL = lerp(b2, recv.splayL, rcv * Math.max(hold, 0.4));
        // 接過去之後跟著人走：穗子放在接的人手中
        if (k2 >= 1) {
          const hx = rp.x + Math.sin(recv.group.rotation.y) * 0.45;
          const hz = rp.z + Math.cos(recv.group.rotation.y) * 0.45;
          ear.position.set(lerp(mx, hx, smooth(0, 1, (p - e.t2) / 0.1)), 1.0, lerp(mz, hz, smooth(0, 1, (p - e.t2) / 0.1)));
        }
      }
      ear.visible = p > e.t0 - 0.05;
    }
    for (const r of this.people) r.update(t, mo);
    // 後段：清晨，嗎哪越來越少，最後地面是空的
    const gone = smooth(0.55, 0.96, p);
    for (let i = 0; i < this.mannaPos.length; i++) {
      const m = this.mannaPos[i];
      const vis = m.th >= gone;
      if (vis) setInst(this.manna, i, m.x, 0.04, m.z, m.r, m.sc, m.sc);
      else setInst(this.manna, i, m.x, -50, m.z, 0, 0.0001);
    }
    this.manna.instanceMatrix.needsUpdate = true;
    this.group.visible = true;
  }
}

// ================================================================ 聖殿院子
const ALT = { x: 0, z: -8 };

export class Temple {
  group = new Group();
  private crowdA: PersonCrowd;
  private crowdB: PersonCrowd;
  private moversA: Mover[] = [];
  private moversB: Mover[] = [];
  private king: RigPerson;
  private priests: RigPerson[] = [];
  private flames: Mesh[] = [];
  private flameBase: number[] = [];
  private flameMats: ShaderMaterial[] = [];
  private pool: ShaderMaterial;
  private fxS: FxSet;
  private fxSm: FxSet;

  constructor() {
    const g = this.group;
    g.position.set(JX, 0, 0);
    const rnd = mulberry32(701);
    const mStone = litMat({ base: 'paper', angle: 2, angle2: 2, space: 5.2, seed: 701, bias: -0.18 });
    const floor = new Mesh(new PlaneGeometry(130, 90), mStone);
    floor.rotation.x = -PI / 2;
    floor.position.set(0, 0.02, -12);
    g.add(floor);
    // 院牆：左右與後面，左邊牆上留一個缺口（人群從北邊——畫面左側——進來）
    const mWall = litMat({ base: '#c9b88e', line: '#3a2e18', angle: 88, angle2: 8, space: 4.8, seed: 702, cross: true });
    const wallA = solid(courtWallGeo(32, 3.2), mWall, 2.0);
    wallA.rotation.y = PI / 2;
    wallA.position.set(-44, 0, -20);
    const wallB = solid(courtWallGeo(14, 3.2), mWall, 2.0);
    wallB.rotation.y = PI / 2;
    wallB.position.set(-44, 0, 4);
    const wallC = solid(courtWallGeo(48, 3.2), mWall, 2.0);
    wallC.rotation.y = PI / 2;
    wallC.position.set(44, 0, -8);
    const wallD = solid(courtWallGeo(88, 3.2), mWall, 2.0);
    wallD.position.set(0, 0, -36);
    g.add(wallA, wallB, wallC, wallD);
    // 聖殿：台基、殿身、前廊的柱子
    const mTemple = litMat({ base: '#d8c9a0', parts: ['#d8c9a0', '#b9a678'], line: '#3a2e18', angle: 88, angle2: 8, space: 4.6, seed: 703, cross: true });
    const temple = solid(templeGeo(), mTemple, 2.2);
    temple.position.set(0, 0, -27);
    temple.scale.setScalar(1.1);
    g.add(temple);
    // 祭壇：大的方壇，冒煙
    const mAltar = litMat({ base: '#8a5a2c', parts: ['#8a5a2c', '#6a4220'], line: '#1c1008', angle: 40, space: 4.2, seed: 76, cross: true });
    const altar = solid(altarGeo(), mAltar, 2.0);
    altar.position.set(ALT.x, 0, ALT.z);
    altar.scale.setScalar(2.4);
    g.add(altar);
    const fm = flameMat('#ffd070', '#d2511a');
    this.flameMats.push(fm);
    const fg = flamePlanesGeo();
    for (let i = 0; i < 4; i++) {
      const f = new Mesh(fg, fm);
      const h = [0.95, 0.7, 0.8, 0.6][i];
      f.position.set(ALT.x + (i % 2 ? 0.7 : -0.7), 2.2, ALT.z + (i < 2 ? 0.5 : -0.5));
      f.scale.set(1.3 * (1.1 - i * 0.1), 2.0 * h, 1.3 * (1.1 - i * 0.1));
      g.add(f);
      this.flames.push(f);
      this.flameBase.push(2.0 * h);
    }
    this.pool = poolGlow();
    g.add(poolMesh(this.pool, 14, ALT.x, ALT.z + 1.2));
    this.fxS = makeFx('spark', [[ALT.x, 2.6, ALT.z]], 16, 0.12, 711);
    this.fxSm = makeFx('smoke', [[ALT.x, 2.8, ALT.z]], 7, 1.8, 712);
    g.add(this.fxS.mesh, this.fxSm.mesh);
    // 遠處的棕樹
    const mTrunk = litMat({ base: '#8f7145', angle: 82, angle2: 10, space: 4.6, seed: 7, cross: true });
    const mFrond = litMat({ base: '#5c5836', angle: 28, angle2: 28, space: 4.6, seed: 8, side: DoubleSide, sway: true });
    for (const [x, z, k] of [[-30, -33, 0], [31, -33, 1], [-12, -33.5, 2]] as [number, number, number][]) {
      const t = new Group();
      t.add(solid(palmTrunkGeo(6.5 + k, 0.7), mTrunk, 2.0), new Mesh(palmFrondsGeo(6.5 + k, 0.7, 4 + k * 4), mFrond));
      t.position.set(x, 0, z);
      g.add(t);
    }
    // 國王：站在祭壇前一座矮臺上，後段舉起雙手禱告（長袍，不畫冠冕細節）
    const dais = solid(new BoxGeometry(2.6, 0.5, 1.8), mStone, 1.6);
    dais.position.set(0, 0.25, -3.4);
    g.add(dais);
    this.king = new RigPerson({ slim: true, belt: true, wrap: true, armL: [0.1, 0.12], armR: [0.1, 0.12], seed: 721, outline: 2.4 }, robeMat('#7a3a4a', 721, '#14110e', '#e4dac0'));
    this.king.group.position.set(0, 0.5, -3.4);
    this.king.group.rotation.y = PI;
    g.add(this.king.group);
    for (let i = 0; i < 3; i++) {
      const r = new RigPerson({ slim: true, belt: true, armL: [0.1, 0.12], armR: [0.1, 0.12], seed: 730 + i }, robeMat(['#e4dac0', '#cdbf9e', '#d8cdb4'][i], 730 + i, '#14110e', '#e4dac0'));
      r.group.position.set(-3.4 + i * 3.4 - (i === 1 ? 0 : 0), 0, -4.6 - (i % 2) * 0.6);
      r.group.rotation.y = i === 1 ? 0 : faceTo(-3.4 + i * 3.4, -4.6, ALT.x, ALT.z);
      g.add(r.group);
      this.priests.push(r);
    }
    // 人群：從北邊（畫面左側的缺口）陸續進來，圍成半圈
    const gA = personGeo({ low: true, belt: true, staff: true, staffSide: 'R' });
    const gB = personGeo({ low: true, belt: true, veil: true });
    this.crowdA = new PersonCrowd(gA, robeMat('#b79a68', 741), 32, 1.7);
    this.crowdB = new PersonCrowd(gB, robeMat('#d8cdb4', 742, '#14110e', '#8a5a3a'), 28, 1.7);
    g.add(this.crowdA.group, this.crowdB.group);
    const place = (crowd: PersonCrowd, list: Mover[], n: number, off: number) => {
      for (let i = 0; i < n; i++) {
        const row = Math.floor(rnd() * 5);
        const ang = (rnd() - 0.5) * 2.1;
        const rad = 8.5 + row * 3.2 + rnd() * 1.2;
        const ex = ALT.x + Math.sin(ang) * rad * 1.5;
        const ez = ALT.z + 3.0 + Math.cos(ang) * rad * 0.9;
        const gate = -1 + (rnd() - 0.5) * 3;
        list.push({ sx: -52 - rnd() * 22, sz: gate + (rnd() - 0.5) * 2, ex, ez: Math.max(ez, -2.2), a: 0.02 + rnd() * 0.5 + off, b: 0.2 + rnd() * 0.5 + off, endYaw: faceTo(ex, Math.max(ez, -2.2), ALT.x, ALT.z) + (rnd() - 0.5) * 0.3 });
        const it = crowd.items[i];
        it.sc = 0.94 + rnd() * 0.14;
        it.y = 0;
        it.x = list[i].sx;
        it.z = list[i].sz;
      }
    };
    place(this.crowdA, this.moversA, 32, 0);
    place(this.crowdB, this.moversB, 28, 0.04);
    g.visible = false;
  }

  update(fr: FrameLite, s: number): void {
    const t = fr.time;
    const mo = !fr.motionOff;
    const p = win(lp(s, 'echo-hezekiah'));
    const fl = mo ? 1 : 0;
    for (const m of this.flameMats) m.uniforms.uFlick.value = fl;
    for (let i = 0; i < this.flames.length; i++) {
      const w = mo ? 1 + 0.15 * Math.sin(t * 7.9 + i * 1.7) + 0.08 * Math.sin(t * 13.1 + i * 2.7) : 1;
      this.flames[i].scale.y = this.flameBase[i] * w;
    }
    this.pool.uniforms.uOn.value = 0.45;
    this.fxS.mat.uniforms.uOn.value = mo ? 1 : 0;
    this.fxSm.mat.uniforms.uOn.value = mo ? 1 : 0;
    // 人群進院子（隨捲動）
    const idxA = this.crowdA.items.map((_, i) => i);
    const idxB = this.crowdB.items.map((_, i) => i);
    walkCrowd(this.crowdA, idxA, this.moversA, p);
    walkCrowd(this.crowdB, idxB, this.moversB, p);
    this.crowdA.update(t, mo);
    this.crowdB.update(t, mo);
    // 國王：舉起雙手禱告
    const up = smooth(0.55, 0.78, p);
    const k = this.king;
    k.swingL = lerp(0.1, 2.75, up);
    k.swingR = lerp(0.1, 2.75, up);
    k.splayL = lerp(0.12, 0.28, up);
    k.splayR = lerp(0.12, 0.28, up);
    k.headPitch = -0.25 * up;
    k.update(t, mo);
    for (const r of this.priests) r.update(t, mo);
    this.group.visible = true;
  }
}

// ================================================================ 伯利恆的大麥田
const STROKES = 9;
export class Ruth {
  group = new Group();
  private barleyMat: ShaderMaterial;
  private reapers: RigPerson[] = [];
  private gleaner: RigPerson;
  private sheaves: Group[] = [];
  private bundles: Group[] = [];
  private sheafPos: { x: number; z: number }[] = [];

  constructor() {
    const g = this.group;
    g.position.set(RX, 0, 0);
    const rnd = mulberry32(801);
    const mGround = litMat({ base: '#c7a65e', line: '#6a4f22', angle: 84, angle2: 80, space: 5, seed: 81, cross: true });
    const ground = new Mesh(fieldGeo(600, 560, 60, hfSoft, 50, -250), mGround);
    ground.position.y = 0.03;
    g.add(ground);
    const mHill = litMat({ base: '#b9985a', line: '#5d4623', angle: 4, space: 5, seed: 6, bias: -0.2 });
    g.add(hillMesh(mHill, -70, -190, 110, 12, 50), hillMesh(mHill, 90, -210, 140, 16, 60), hillMesh(mHill, 10, -280, 190, 11, 50));
    // 大麥：成熟；收割線沿 x 走，線以左已割成殘茬
    this.barleyMat = litMat({ base: '#c6a96c', parts: ['#b99d5a', '#dab95f'], partAlt: '#8e7640', angle: 80, space: 5, wind: true, reap: true, seed: 9, bias: 0.22 });
    const bg = barleyGeo({ stem: 1.8, earW: 0.034 });
    const total = 5200;
    const barley = new InstancedMesh(bg, this.barleyMat, total);
    barley.frustumCulled = false;
    let n = 0;
    while (n < total) {
      const x = -14 + rnd() * 44;
      const z = 3.6 - Math.pow(rnd(), 1.7) * 40;
      setInst(barley, n, x, hfSoft(x, z), z, rnd() * PI * 2, 1.1 + rnd() * 0.6, 0.78 + rnd() * 0.26, (rnd() - 0.5) * 0.12, (rnd() - 0.5) * 0.12);
      barley.setColorAt(n, new Color(rnd(), 0, 0));
      n++;
    }
    g.add(barley);
    // 收割的人（在前）與捆好的禾捆；一個女子在後面拾穗
    const mSheaf = litMat({ base: '#c6a35a', parts: ['#b79a55', '#d9b861', '#6a4a26'], angle: 70, space: 4, seed: 71 });
    const mSick = litMat({ base: '#9a9890', parts: ['#a8a8a0', '#6e5433'], angle: 30, space: 3.6, seed: 72 });
    const sg = sheafGeo(3);
    for (let i = 0; i < 3; i++) {
      const r = new RigPerson({ bow: 0.85, belt: true, armL: [1.05, 0.08], armR: [1.0, 0.16], seed: 810 + i, outline: 2.4 }, robeMat(['#a88758', '#8f7550', '#b59a68'][i], 810 + i));
      r.group.rotation.y = PI / 2;
      g.add(r.group);
      const sick = solid(sickleGeo(), mSick, 1.4);
      sick.rotation.set(PI / 2 + 0.2, 0.2, 0);
      r.handR.add(sick);
      this.reapers.push(r);
    }
    for (let i = 0; i < 8; i++) {
      const x = -4 + i * 3.1 + rnd() * 0.6;
      const z = -0.2 - (i % 3) * 1.3 - 1.3;
      const s = solid(sg, mSheaf, 1.3);
      s.position.set(x, hfSoft(x, z), z);
      s.rotation.set(0.04, rnd() * 6, 0);
      g.add(s);
      this.sheaves.push(s);
      this.sheafPos.push({ x, z });
    }
    // 從捆裡抽出放在地上的一把（三次）
    for (let i = 0; i < 3; i++) {
      const b = solid(sheafGeo(20 + i, 10, 0.6), mSheaf, 1.1);
      b.scale.setScalar(0.5);
      g.add(b);
      this.bundles.push(b);
    }
    this.gleaner = new RigPerson({ bow: 1.0, slim: true, veil: true, belt: true, armL: [1.3, 0.1], armR: [0.7, 0.12], seed: 830, outline: 2.4 }, robeMat('#9a8058', 830, '#14110e', '#6b5a3a'));
    this.gleaner.group.rotation.y = PI / 2 + 0.2;
    g.add(this.gleaner.group);
    g.visible = false;
  }

  update(fr: FrameLite, s: number): void {
    const t = fr.time;
    const mo = !fr.motionOff;
    const p = win(lp(s, 'echo-ruth'));
    const X0 = -6;
    const X1 = 17;
    const line = lerp(X0, X1, smooth(0.04, 0.96, p));
    this.barleyMat.uniforms.uReap.value = RX + line;
    // 割麥的人沿著收割線一刀一刀地割（約每 0.1 進度一刀）
    const ph = p * (STROKES + 1) * 1.0;
    const stroke = ph - Math.floor(ph);
    for (let i = 0; i < this.reapers.length; i++) {
      const r = this.reapers[i];
      const z = -1.2 - i * 1.5;
      r.group.position.set(line + 0.4 - i * 0.25, hfSoft(line, z), z);
      const off = i * 0.37;
      const sw2 = Math.sin(stroke * PI * 2 - 0.4 + off);
      r.bow = 0.85 + 0.1 * Math.max(0, sw2);
      r.swingR = 1.0 + 0.5 * sw2;
      r.splayR = 0.16 + 0.12 * Math.max(0, -sw2);
      r.swingL = 1.05 + 0.1 * sw2;
      r.twist = 0.12 * sw2;
      r.update(t, mo);
    }
    // 女子在收割的人身後拾穗：一次次彎腰
    const G = this.gleaner;
    const gx = line - 3.6;
    G.group.position.set(gx, hfSoft(gx, -1.0), -1.0);
    // 三次：收割的人從捆裡抽出一把放在地上，女子彎腰拾起，放進衣兜
    const ev = [0.2, 0.46, 0.72];
    let bendUp = 0;
    for (let i = 0; i < 3; i++) {
      const b = this.bundles[i];
      const t0 = ev[i];
      const sh = this.sheafPos[Math.min(7, Math.round(((RX + line) - RX - -4) / 3.1))];
      const fromX = sh ? sh.x : line;
      const fromZ = sh ? sh.z : -1.2;
      const lay = smooth(t0, t0 + 0.05, p);
      const pick = smooth(t0 + 0.09, t0 + 0.15, p);
      // 抽出：捆邊 → 地上（在女子前面）；拾起：地上 → 女子手 → 衣兜
      const landX = line - 2.1 - i * 0.35;
      const landZ = -1.0 - 0.1 * i;
      const x = lerp(lerp(fromX, landX, lay), gx, pick);
      const z = lerp(lerp(fromZ, landZ, lay), -1.0, pick);
      const y = lerp(lerp(0.9, 0.06, lay), 0.7, pick) + 0.2 * Math.sin(PI * lay) * (1 - lay);
      b.position.set(x, y + hfSoft(x, z), z);
      b.rotation.set(0, i, PI / 2);
      b.visible = p > t0 && pick < 0.999;
      // 彎腰
      bendUp = Math.max(bendUp, smooth(t0 + 0.06, t0 + 0.1, p) * (1 - smooth(t0 + 0.12, t0 + 0.17, p)));
    }
    G.bow = 0.45 + 0.7 * bendUp;
    G.swingL = 0.6 + 0.8 * bendUp;
    G.swingR = 0.5;
    G.update(t, mo);
  }
}


// ================================================================ 水門前的廣場
export class Gate {
  group = new Group();
  private ezra: RigPerson;
  private scroll: Group;
  private sheet: Mesh;
  private plat: PersonCrowd;
  private crowdA: PersonCrowd;
  private crowdB: PersonCrowd;
  private home: { x: number; z: number; ph: number }[] = [];
  private groupsTo: { x: number; z: number; yaw: number }[] = [];
  private carrier: RigPerson;
  private receiver: RigPerson;
  private basket: Mesh;
  private nA = 44;
  private nB = 40;
  private ezraBase = 3.34;

  constructor() {
    const g = this.group;
    g.position.set(GTX, 0, 0);
    const rnd = mulberry32(901);
    // 城牆與城門（水門）
    const mWall = litMat({ base: '#cdbb90', line: '#3a2e18', angle: 88, angle2: 8, space: 4.8, seed: 902, cross: true });
    const wl = solid(wallSegGeo(44, 7.5, 2.4), mWall, 2.2);
    wl.position.set(-28, 0, -30);
    const wr = solid(wallSegGeo(44, 7.5, 2.4), mWall, 2.2);
    wr.position.set(28, 0, -30);
    g.add(wl, wr);
    const gate = solid(gateTowerGeo(5.6, 4.6, 10), mWall, 2.2);
    gate.position.set(0, 0, -30);
    g.add(gate);
    // 城裡的屋子（牆後的輪廓）
    const mHouse = litMat({ base: '#c7b58a', line: '#3a2e18', angle: 84, angle2: 6, space: 4.8, seed: 903, cross: true });
    for (let i = 0; i < 16; i++) {
      const w = 5 + rnd() * 4;
      const h = 5 + rnd() * 8;
      const x = -46 + i * 6 + (rnd() - 0.5) * 3;
      const b = solid(new BoxGeometry(w, h, 5 + rnd() * 3), mHouse, 1.6);
      b.position.set(x, h / 2, -36 - rnd() * 8);
      g.add(b);
    }
    // 木臺（尼8:4）：高架，上面站著以斯拉與左右十三人
    const mWood = litMat({ base: '#7a5a32', parts: ['#7a5a32', '#9a7a48'], line: '#241808', angle: 74, space: 4.4, seed: 904 });
    const plat = solid(platformGeo(8.6, 3.6, 3.2), mWood, 1.9);
    plat.position.set(0, 0, -9);
    g.add(plat);
    // 以斯拉與書卷
    this.ezra = new RigPerson({ slim: true, belt: true, wrap: true, armL: [0.3, 0.12], armR: [0.3, 0.12], seed: 910, outline: 2.4 }, robeMat('#e4dac0', 910, '#14110e', '#e4dac0'));
    this.ezra.group.position.set(0, this.ezraBase, -8.2);
    g.add(this.ezra.group);
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
    // 臺上左右各站六、七人
    const gp = personGeo({ low: true, belt: true });
    this.plat = new PersonCrowd(gp, robeMat('#cdbf9e', 913, '#14110e', '#e4dac0'), 13, 1.7);
    g.add(this.plat.group);
    const sides: [number, number][] = [];
    for (let i = 0; i < 6; i++) sides.push([-1.1 - (i % 3) * 0.85, -7.5 - Math.floor(i / 3) * 0.95]);
    for (let i = 0; i < 7; i++) sides.push([1.1 + (i % 4) * 0.85, -7.5 - Math.floor(i / 4) * 0.95]);
    sides.forEach(([x, z], i) => {
      const it = this.plat.items[i];
      it.x = x;
      it.z = z;
      it.y = this.ezraBase;
      it.yaw = (rnd() - 0.5) * 0.3;
      it.sc = 0.96 + rnd() * 0.1;
    });
    // 臺下站滿男女（男的拿杖；女的有頭巾）
    this.crowdA = new PersonCrowd(personGeo({ low: true, belt: true, staff: true, staffSide: 'R' }), robeMat('#b79a68', 920), this.nA, 1.7);
    this.crowdB = new PersonCrowd(personGeo({ low: true, belt: true, veil: true }), robeMat('#d8cdb4', 921, '#14110e', '#8a5a3a'), this.nB, 1.7);
    g.add(this.crowdA.group, this.crowdB.group);
    const total = this.nA + this.nB;
    for (let i = 0; i < total; i++) {
      const row = Math.floor(i / 12);
      const x = -17 + ((i % 12) + (row % 2) * 0.5) * 3.0 + (rnd() - 0.5) * 1.1;
      const z = -3.0 + row * 2.3 + (rnd() - 0.5) * 0.9;
      this.home.push({ x, z, ph: rnd() });
      (i < this.nA ? this.crowdA : this.crowdB).items[i < this.nA ? i : i - this.nA].sc = 0.94 + rnd() * 0.12;
      // 散開後三三兩兩站成一群
      const gi = Math.floor(i / 3);
      const cx = -16 + ((gi * 7) % 33) + (rnd() - 0.5) * 2;
      const cz = -2 + ((gi * 5) % 16) + (rnd() - 0.5) * 2;
      const a = (i % 3) * 2.1 + rnd();
      const gx = cx + Math.cos(a) * 1.1;
      const gz = cz + Math.sin(a) * 0.9;
      this.groupsTo.push({ x: gx, z: gz, yaw: faceTo(gx, gz, cx, cz) });
    }
    // 有人提著籃子走向別人
    this.carrier = new RigPerson({ slim: true, belt: true, veil: true, armL: [0.9, 0.1], armR: [0.2, 0.12], seed: 930 }, robeMat('#cdbf9e', 930, '#14110e', '#8a5a3a'));
    this.receiver = new RigPerson({ belt: true, armL: [0.2, 0.12], armR: [0.2, 0.12], seed: 931 }, robeMat('#a88758', 931));
    g.add(this.carrier.group, this.receiver.group);
    const mBask = litMat({ base: '#a68a52', line: '#4a3a1a', angle: 30, space: 3.6, seed: 932 });
    this.basket = new Mesh(new SphereGeometry(0.17, 8, 5, 0, PI * 2, PI * 0.5, PI * 0.5), mBask);
    this.carrier.handL.add(this.basket);
    this.basket.position.set(0, 0.04, 0.1);
    g.visible = false;
  }
  private rods: Mesh[] = [];

  update(fr: FrameLite, s: number): void {
    const t = fr.time;
    const mo = !fr.motionOff;
    const p = win(lp(s, 'echo-water-gate'));
    // 書卷：展開（0.04–0.22）
    const open = smooth(0.04, 0.22, p);
    const e = this.ezra;
    e.group.position.y = this.ezraBase;
    this.sheet.scale.x = Math.max(0.02, open * 0.9);
    this.scroll.position.set(-0.45 * open, this.ezraBase + 1.18, -7.62);
    this.rods[0].position.set(0, 0, 0);
    this.rods[1].position.set(Math.max(0.02, open * 0.9), 0, 0);
    e.group.rotation.y = 0;
    aimAt(e, 'L', 0.38 * open - 0.1, this.ezraBase + 1.18, -7.62);
    aimAt(e, 'R', -0.4 * open + 0.05, this.ezraBase + 1.18, -7.62);
    // 讀的時候手輕輕移動
    e.headPitch = 0.28 * open;
    // 臺上的人：書卷展開時一起站直，後段俯伏
    const bowT = smooth(0.46, 0.58, p) * (1 - smooth(0.7, 0.78, p));
    for (let i = 0; i < this.plat.items.length; i++) {
      const it = this.plat.items[i];
      it.lean = 0.7 * bowT;
      it.sy = 1 - 0.1 * bowT;
    }
    e.bow = 0.3 * bowT;
    // 臺下的人：書卷展開時從坐著站起來，之後低頭俯伏，最後三三兩兩散開
    const stand = smooth(0.22, 0.38, p);
    const bow = smooth(0.46, 0.6, p) * (1 - smooth(0.7, 0.8, p));
    const disperse = smooth(0.76, 0.98, p);
    const all = this.nA + this.nB;
    for (let i = 0; i < all; i++) {
      const crowd = i < this.nA ? this.crowdA : this.crowdB;
      const it = crowd.items[i < this.nA ? i : i - this.nA];
      const h = this.home[i];
      const gt = this.groupsTo[i];
      const di = smooth(0.0, 1.0, clamp((disperse * 1.25 - h.ph * 0.25)));
      const moving = di > 0.001 && di < 0.999;
      it.x = lerp(h.x, gt.x, di);
      it.z = lerp(h.z, gt.z, di);
      it.y = moving ? Math.abs(Math.sin(di * 40 + i)) * 0.04 : 0;
      const head = Math.atan2(gt.x - h.x, gt.z - h.z);
      it.yaw = moving ? head : lerpAng(PI + (h.ph - 0.5) * 0.2, gt.yaw, di);
      const st = clamp(stand * 1.3 - h.ph * 0.3);
      const sy = lerp(0.62, 1, smooth(0, 1, st));
      it.sy = sy * (1 - 0.14 * bow);
      it.lean = 0.75 * bow * (1 - di);
      it.visible = true;
    }
    this.plat.update(t, mo);
    this.crowdA.update(t, mo);
    this.crowdB.update(t, mo);
    e.update(t, mo);
    // 提籃子的人走向另一個人
    const w = smooth(0.8, 0.98, p);
    const c0 = { x: -9.5, z: 8.5 };
    const c1 = { x: 5.5, z: 7.2 };
    const car = this.carrier;
    car.group.position.set(lerp(c0.x, c1.x - 1.0, w), w > 0 && w < 1 ? car.gait(w * 46, 1) : 0, lerp(c0.z, c1.z, w));
    car.group.rotation.y = faceTo(c0.x, c0.z, c1.x, c1.z);
    car.group.visible = p > 0.74;
    this.receiver.group.position.set(c1.x, 0, c1.z);
    this.receiver.group.rotation.y = lerpAng(PI, faceTo(c1.x, c1.z, c1.x - 1, c1.z), w);
    this.receiver.group.visible = p > 0.74;
    if (!(w > 0 && w < 1)) {
      car.swingL = 0.9;
      car.swingR = 0.2;
    } else car.swingL = 0.9;
    car.update(t, mo);
    this.receiver.update(t, mo);
    this.group.visible = true;
  }
}
