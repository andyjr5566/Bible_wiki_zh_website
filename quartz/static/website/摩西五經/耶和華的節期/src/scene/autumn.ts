// 秋季的會幕營地（吹角節、贖罪日）：人物、牲畜、器物與各 cue 的捲動動作。
// 群組原點在院子中心（營地群組座標 CX, CZ），用院子座標：+z 朝營地、會幕在 -z。
// 規則：大祭司只穿細麻布（內袍、褲子、腰帶、冠冕），不畫胸牌、以弗得、金牌；至聖所只用剪影＋香煙。
import { CylinderGeometry, Group, InstancedMesh, Mesh, Shape, ShapeGeometry, SphereGeometry, TorusGeometry, Vector3, type ShaderMaterial } from 'three';
import { SITE } from '../data/site';
import { story } from '../story/state';
import { Court, ARK_Z, LAVER } from './court';
import { animalKind } from './fields';
import { makeFx, type FxSet } from './fx';
import { personGeo } from './geo';
import { basketGeo, jarGeo, mitreGeo, pebbleGeo, scrubGeo } from './geo3';
import { CX, CZ, NX } from './layout';
import { litMat, solid } from './materials';
import { type FrameLite, robeMat, setInst } from './props';
import { aimAt, Bits, faceTo, lerpAng, pulse, Rope } from './rigutil';
import { Animal, PersonCrowd, RigPerson, type Species } from './rig';
import { c, CUT, inAtonement, lp, scapeDist, SCAPE_GATE_Z, SCAPE_TURN_Z } from './tracks';
import { clamp, lerp, mulberry32, smooth, win } from './util';

const PI = Math.PI;
const _w = new Vector3();
const _v1 = new Vector3();
const _v2 = new Vector3();

// 隊伍路線（院子座標）：出院子門，先往 +z 走一小段，再轉向 -x 走進曠野
const GATE_Z = SCAPE_GATE_Z;
const TURN_Z = SCAPE_TURN_Z;
const SEG1 = TURN_Z - GATE_Z;
/** 路徑上離起點 d 公尺處的位置與朝向（yaw：人物前方是 +z） */
function pathAt(d: number, out: { x: number; z: number; yaw: number }, lane = 0): void {
  if (d < SEG1) {
    out.x = lane;
    out.z = GATE_Z + d;
    out.yaw = 0;
  } else {
    out.x = lane - (d - SEG1);
    out.z = TURN_Z + lane * 0.3;
    out.yaw = -PI / 2;
  }
  // 轉角處 2.5 公尺內平順轉向
  const k = smooth(SEG1 - 2.5, SEG1 + 1.5, d);
  out.yaw = lerp(0, -PI / 2, k);
}
const _pa = { x: 0, z: 0, yaw: 0 };

export class Autumn {
  group = new Group();
  court = new Court();
  // ---- 營地的人
  private crowdA: PersonCrowd;
  private crowdB: PersonCrowd;
  private crowdBase: { x: number; z: number; yaw: number; w: boolean }[] = [];
  private fore: RigPerson[] = [];
  private foreYaw: number[] = [];
  private turnK = 0;
  private priests: RigPerson[] = [];
  // ---- 牲畜
  private offering: { animal: Animal; slot: number; start: number; end: number }[] = [];
  private goatA!: Animal;
  private goatB!: Animal;
  private calf!: Animal;
  private stakeMat!: ShaderMaterial;
  private ropeB!: Rope;
  private ropeLead!: Rope;
  // ---- 大祭司（細麻布）
  private hp!: RigPerson;
  private sash!: Mesh;
  private mitre!: Group;
  private censer = new Group();
  private censerGlow!: Mesh;
  private censerFlame!: Mesh;
  private stones: Mesh[] = [];
  // ---- 水滴、血滴
  private water!: Bits;
  private drops!: Bits;
  private marks!: Bits;
  // ---- 出營的人
  private leader!: RigPerson;
  private dustMan!: FxSet;
  private dustGoat!: FxSet;
  // ---- 贖罪日的營地
  private sit!: PersonCrowd;
  private sitRigs: RigPerson[] = [];
  private tools = new Group();
  /** 出營以後的荒地（地面轉色）與乾灌木 */
  private wild = new Group();

  constructor() {
    this.group.position.set(CX, 0, CZ);
    this.group.add(this.court.group);
    const rnd = mulberry32(311);

    // ---- 營地的人（吹角節）：吹角時轉向會幕
    const gA = personGeo({ low: true, belt: true, staff: true, staffSide: 'R' });
    const gB = personGeo({ low: true, belt: true });
    this.crowdA = new PersonCrowd(gA, robeMat('#a88758', 311), 10, 1.7);
    this.crowdB = new PersonCrowd(gB, robeMat('#cdbf9e', 312), 10, 1.7);
    this.group.add(this.crowdA.group, this.crowdB.group);
    for (let i = 0; i < 20; i++) {
      const crowd = i < 10 ? this.crowdA : this.crowdB;
      const it = crowd.items[i % 10];
      const x = -8 + rnd() * 17;
      const z = 15 + rnd() * 16;
      const yaw = rnd() * PI * 2;
      it.x = x;
      it.z = z;
      it.y = 0;
      it.yaw = yaw;
      it.sc = 0.94 + rnd() * 0.12;
      this.crowdBase.push({ x, z, yaw, w: i % 5 === 0 });
    }
    // 近景的幾個人：頭會轉、身體會轉向會幕
    const foreSpecs: { x: number; z: number; robe: string; sc: number; o: ConstructorParameters<typeof RigPerson>[0] }[] = [
      { x: -3.4, z: 25.5, robe: '#a88758', sc: 1.0, o: { staff: true, staffSide: 'R', belt: true, armL: [0.2, 0.14], armR: [0.4, 0.12] } },
      { x: -0.6, z: 27, robe: '#cdbf9e', sc: 0.96, o: { slim: true, belt: true, armL: [0.1, 0.12], armR: [0.5, 0.12] } },
      { x: 2.2, z: 25, robe: '#8f7550', sc: 1.03, o: { belt: true, armL: [0.3, 0.14], armR: [0.15, 0.12] } },
      { x: 4.6, z: 27.5, robe: '#b79a68', sc: 0.62, o: { wrap: true, kid: true, armL: [0.2, 0.2], armR: [0.5, 0.2] } },
    ];
    foreSpecs.forEach((f, i) => {
      const r = new RigPerson({ ...f.o, scale: f.sc, seed: 330 + i }, robeMat(f.robe, 330 + i));
      r.group.position.set(f.x, 0, f.z);
      const yaw = PI + (rnd() - 0.5) * 2.2;
      r.group.rotation.y = yaw;
      this.group.add(r.group);
      this.fore.push(r);
      this.foreYaw.push(yaw);
    });
    // 院子裡的祭司兩位
    for (let i = 0; i < 2; i++) {
      const r = new RigPerson({ slim: true, belt: true, armL: [0.1, 0.12], armR: [0.15, 0.12], seed: 340 + i, outline: 2.2 }, robeMat(i ? '#cdbf9e' : '#a88758', 340 + i));
      r.group.position.set(i ? -2.6 : -1.9, 0, i ? 6.7 : 4.9);
      r.group.rotation.y = i ? 0.6 : -0.8;
      this.group.add(r.group);
      this.priests.push(r);
    }

    // ---- 牲畜
    const mLamb = litMat({ base: 'paper', parts: ['#e9e1cc', '#14110e'], angle: 52, space: 4.4, seed: 12 });
    const mCow = litMat({ base: '#6b5030', parts: ['#6b5030', '#14110e'], angle: 50, space: 4.4, seed: 16 });
    const mSil = litMat({ base: 'silh' });
    this.goatA = new Animal('goat', mLamb, 2.0, 351);
    this.goatB = new Animal('goat', mLamb, 2.0, 352);
    this.calf = new Animal('cow', mCow, 2.0, 353);
    this.calf.baseScale = 0.56;
    this.group.add(this.goatA.group, this.goatB.group, this.calf.group);
    const group = SITE.offerings?.['民29:2-5'];
    const items: { kind: Species; sc: number }[] = [];
    if (group) for (const it of group.items) for (let k = 0; k < it.count; k++) items.push(animalKind(it.animal));
    const N = items.length;
    items.forEach((it, i) => {
      const a = new Animal(it.kind, mSil, 1.8, 360 + i);
      a.baseScale = it.sc;
      a.group.visible = false;
      this.group.add(a.group);
      const slotX = -2.4 - 1.15 * i - (i > 0 && items[i - 1].kind !== it.kind ? 0.4 : 0);
      const len = 10.8 - 3.3 + (1.6 - slotX);
      const fin = 0.3 + (0.66 * (N - 1 - i)) / Math.max(1, N - 1);
      this.offering.push({ animal: a, slot: slotX, start: fin - len / 70, end: fin });
    });
    this.stakeMat = litMat({ base: '#6e5433', angle: 74, space: 4.4, seed: 5 });
    const stake = new Mesh(new CylinderGeometry(0.035, 0.045, 0.5, 5), this.stakeMat);
    stake.position.set(-1.7, 0.25, 3.5);
    this.group.add(stake);
    this.ropeB = new Rope(mSil);
    this.ropeLead = new Rope(mSil);
    this.group.add(this.ropeB.mesh, this.ropeLead.mesh);

    // ---- 大祭司：細麻布內袍、褲子、腰帶、冠冕（白色、樸素）
    const mLinen = robeMat('#eeead9', 371, '#14110e', '#eeead9');
    this.hp = new RigPerson({ linen: true, slim: true, wrap: false, armL: [0.05, 0.12], armR: [0.05, 0.12], seed: 371, outline: 2.4 }, mLinen);
    this.group.add(this.hp.group);
    const mSash = litMat({ base: '#f2eee0', line: '#2b2419', angle: 20, space: 4, seed: 372 });
    this.sash = new Mesh(new TorusGeometry(0.245, 0.034, 5, 14), mSash);
    this.sash.rotation.x = PI / 2;
    this.sash.position.set(0, 0.03, 0);
    this.hp.upper.add(this.sash);
    const mMitre = litMat({ base: '#f2eee0', line: '#2b2419', angle: 60, space: 3.6, seed: 373 });
    this.mitre = solid(mitreGeo(), mMitre, 1.6);
    this.hp.headPivot.add(this.mitre);
    // 香爐：吊在右手上；炭火在爐裡發光
    const mBronze = litMat({ base: '#8a5a2c', line: '#1c1008', angle: 40, space: 4, seed: 374 });
    const chain = new Mesh(new CylinderGeometry(0.008, 0.008, 0.34, 3), mBronze);
    chain.position.set(0, -0.17, 0);
    this.censer.add(chain);
    const bowl = solid(new SphereGeometry(0.1, 8, 5, 0, PI * 2, PI * 0.45, PI * 0.55), mBronze, 1.4);
    bowl.position.set(0, -0.4, 0);
    this.censer.add(bowl);
    const fg = new Mesh(new SphereGeometry(0.075, 7, 5), litMat({ base: '#f08a30', line: '#a23c10', angle: 30, space: 3.4, seed: 375, bias: 0.6 }));
    fg.position.set(0, -0.37, 0);
    fg.scale.set(1, 0.45, 1);
    this.censer.add(fg);
    this.censerGlow = fg;
    this.censerFlame = fg;
    this.hp.handR.add(this.censer);
    // 兩塊小石（鬮）
    const mStone = litMat({ base: '#b7ab92', line: '#2b2419', angle: 50, space: 3.6, seed: 376 });
    for (let i = 0; i < 2; i++) {
      const st = solid(pebbleGeo(), mStone, 1.2);
      st.scale.set(0.045, 0.03, 0.04);
      this.group.add(st);
      this.stones.push(st as unknown as Mesh);
    }
    // 水滴與血滴
    const mWater = litMat({ base: '#c4d6da', line: '#5a7078', angle: 40, space: 3.2, seed: 377, bias: 0.4 });
    this.water = new Bits(new SphereGeometry(1, 5, 4), mWater, 14, 0);
    this.group.add(this.water.mesh);
    const mBlood = litMat({ base: '#a3231b', line: '#3a0c09', angle: 20, space: 3.6, seed: 378, bias: 0.3 });
    const mBlood2 = litMat({ base: '#8a1c14', line: '#2e0907', angle: 20, space: 3.6, seed: 379, bias: 0.3 });
    mBlood.transparent = true;
    mBlood2.transparent = true;
    this.drops = new Bits(new SphereGeometry(1, 6, 4), mBlood, 18, 9);
    this.marks = new Bits(new SphereGeometry(1, 6, 4), mBlood2, 36, 9);
    this.group.add(this.drops.mesh, this.marks.mesh);

    // ---- 出營的人與塵土
    this.leader = new RigPerson({ staff: true, staffSide: 'R', belt: true, armL: [0.2, 0.14], armR: [0.4, 0.12], seed: 380 }, robeMat('#9a7d52', 380));
    this.group.add(this.leader.group);
    const o1: [number, number, number][] = [[TURN_Z * 0 + 0, 0, TURN_Z]];
    this.dustMan = makeFx('dust', [...o1, [0, 0, TURN_Z + 0.2]], 4, 1.0, 381);
    this.dustGoat = makeFx('dust', [[0, 0, TURN_Z - 0.2], [0, 0, TURN_Z + 0.4]], 6, 1.1, 382);
    this.group.add(this.dustMan.mesh, this.dustGoat.mesh);

    // ---- 贖罪日：坐著低頭的人、放下的工具
    this.sit = new PersonCrowd(personGeo({ sit: true, low: true, belt: true }), robeMat('#a88758', 391), 20, 1.6);
    this.group.add(this.sit.group);
    const clusters: [number, number][] = [[-9.5, 20], [-4, 26], [7.5, 21], [2.5, 31], [-13, 30], [12, 28]];
    let si = 0;
    clusters.forEach(([cx, cz]) => {
      for (let k = 0; k < 3 && si < 20; k++) {
        const a = (k / 3) * PI * 2 + rnd() * 0.8;
        const it = this.sit.items[si++];
        it.x = cx + Math.cos(a) * 1.2;
        it.z = cz + Math.sin(a) * 1.0;
        it.y = 0;
        it.yaw = faceTo(it.x, it.z, cx, cz);
        it.sc = 0.96 + rnd() * 0.1;
        it.lean = 0.28 + rnd() * 0.18;
      }
    });
    while (si < 20) {
      const it = this.sit.items[si++];
      it.x = -14 + rnd() * 26;
      it.z = 34 + rnd() * 6;
      it.yaw = rnd() * 6;
      it.sc = 1;
      it.lean = 0.3;
    }
    const sitSpecs: { x: number; z: number; robe: string; sc: number }[] = [
      { x: -2.6, z: 22.5, robe: '#a88758', sc: 1.0 },
      { x: 0.2, z: 24.2, robe: '#cdbf9e', sc: 0.94 },
      { x: 3.2, z: 22.2, robe: '#8f7550', sc: 0.62 },
    ];
    sitSpecs.forEach((f, i) => {
      const r = new RigPerson({ sit: true, belt: true, bow: 0.5, kid: i === 2, scale: f.sc, armL: [0.9, 0.1], armR: [0.8, 0.1], seed: 395 + i }, robeMat(f.robe, 395 + i));
      r.group.position.set(f.x, 0.06, f.z);
      r.group.rotation.y = PI + (i - 1) * 0.5;
      this.group.add(r.group);
      this.sitRigs.push(r);
    });
    this.buildTools(rnd);
    this.group.add(this.tools);
    // 荒地：營地外的地面轉成乾土色（邊緣參差），散著乾灌木
    const sh = new Shape();
    sh.moveTo(-430, -80);
    for (let z = -80; z <= 80; z += 2) sh.lineTo(-38 - 5 * Math.sin(z * 0.37) - 4 * Math.sin(z * 1.1 + 2) - 3 * Math.sin(z * 2.3), -z);
    sh.lineTo(-430, 80);
    const wg = new ShapeGeometry(sh, 4);
    wg.rotateX(-PI / 2);
    const mWild = litMat({ base: '#bfa064', line: '#5a4126', angle: 80, angle2: 80, space: 5, seed: 1300, cross: true, bias: 0.05 });
    const ground = new Mesh(wg, mWild);
    ground.position.y = 0.045;
    this.wild.add(ground);
    const mScrub = litMat({ base: '#6a5a3a', parts: ['#6a5a3a', '#6a5a3a'], angle: 50, space: 4, seed: 1301 });
    const scrub = new InstancedMesh(scrubGeo(), mScrub, 170);
    scrub.frustumCulled = false;
    for (let i = 0; i < 170; i++) setInst(scrub, i, -46 - rnd() * 330, 0.0, -60 + rnd() * 130, rnd() * 6, 1.6 + rnd() * 1.6);
    this.wild.add(scrub);
    this.group.add(this.wild);
    this.group.visible = false;
  }

  /** 放下的工具：鋤、籃、罈子（沒有人做工） */
  private buildTools(rnd: () => number): void {
    const mWood = litMat({ base: '#6e5433', angle: 74, space: 4.4, seed: 5 });
    const mIron = litMat({ base: '#7d7a72', angle: 30, space: 3.8, seed: 398 });
    const mBask = litMat({ base: '#a68a52', parts: ['#a68a52', '#6e5433'], angle: 30, space: 3.6, seed: 399 });
    const mJar = litMat({ base: '#a76a45', angle: 20, space: 4, seed: 400 });
    const spots: [number, number][] = [[-6.2, 21], [-1.2, 28.5], [5.4, 19.5], [8.6, 27], [-11, 26], [0.5, 19]];
    spots.forEach(([x, z], i) => {
      const hoe = new Group();
      const h = new Mesh(new CylinderGeometry(0.02, 0.025, 1.4, 5), mWood);
      h.rotation.z = PI / 2;
      hoe.add(h);
      const bl = new Mesh(new CylinderGeometry(0.1, 0.07, 0.04, 4), mIron);
      bl.position.set(0.72, -0.03, 0);
      bl.rotation.z = 1.2;
      hoe.add(bl);
      hoe.position.set(x, 0.05, z);
      hoe.rotation.y = rnd() * PI;
      this.tools.add(hoe);
      const b = solid(basketGeo(), mBask, 1.3);
      b.position.set(x + 0.7 + (i % 2) * 0.2, 0, z + 0.4);
      b.scale.setScalar(1.5);
      this.tools.add(b);
      if (i % 2 === 0) {
        const j = solid(jarGeo(), mJar, 1.5);
        j.position.set(x - 0.8, 0, z - 0.5);
        j.scale.setScalar(0.7);
        this.tools.add(j);
      }
    });
  }

  // ---------------------------------------------------------------- 每幀
  /** dayK：白天程度 0..1（火光與光池依此淡出）；返回「現在在不在秋季營地」 */
  update(fr: FrameLite, s: number, dayK: number): void {
    const t = fr.time;
    const mo = !fr.motionOff;
    const dt = fr.dt;
    const inTr = s >= CUT['seventh-moon'] && s < CUT['echo-water-gate'];
    const inAt = inAtonement(s);
    const on = inTr || inAt;
    this.group.visible = on;
    this.court.group.visible = on;
    if (!on) return;

    const pSeven = lp(s, 'seventh-moon');
    const pOff = win(lp(s, 'trumpet-offerings'), 0.05, 0.76);
    const pLinen = lp(s, 'linen');
    const pLots = win(lp(s, 'lots'), 0, 0.76);
    const pInc = lp(s, 'incense');
    const pSpr = win(lp(s, 'sprinkle'), 0.1, 0.78);
    const pCon = lp(s, 'confess');
    const pScape = lp(s, 'scapegoat');
    const atonePhase = s >= CUT['veil']; // 贖罪日

    // 營火照舊；afflict 用「什麼工都不可做」（利16:29）表現：人放下工具、坐著，手上沒有活
    const fireOn = 1;

    // ---------------- 營地的人（吹角節）：吹角時轉向會幕
    const crowdOn = inTr;
    this.crowdA.group.visible = crowdOn;
    this.crowdB.group.visible = crowdOn;
    const lvl = story.blow.level;
    const rate = lvl > this.turnK ? 7 : 0.7;
    this.turnK += (Math.sqrt(clamp(lvl)) - this.turnK) * (1 - Math.exp(-dt * rate));
    if (Math.abs(this.turnK) < 1e-4) this.turnK = 0;
    if (crowdOn) {
      // seventh-moon 的捲動動作：幾個人在營地裡慢慢走過（隨捲動）
      const walk = smooth(0, 0.9, pSeven);
      for (let i = 0; i < 20; i++) {
        const crowd = i < 10 ? this.crowdA : this.crowdB;
        const it = crowd.items[i % 10];
        const b = this.crowdBase[i];
        it.visible = true;
        it.x = b.x;
        it.z = b.z;
        it.y = 0;
        let yaw = b.yaw;
        if (b.w) {
          // 走一段：沿 x 方向平移 6 公尺（來回各一半的人）
          const dir = i % 10 < 5 ? 1 : -1;
          const moving = walk > 0.001 && walk < 0.999;
          it.x = b.x + dir * 6 * walk - dir * 3;
          it.y = moving ? Math.abs(Math.sin((walk * 6 * 5) + i)) * 0.045 : 0;
          if (moving) yaw = dir > 0 ? PI / 2 : -PI / 2;
          else yaw = lerpAng(dir > 0 ? PI / 2 : -PI / 2, b.yaw, smooth(0.9, 1, pSeven) * 0.0 + (pSeven >= 1 ? 1 : 0));
        }
        const face = faceTo(it.x, it.z, 0, 9.5);
        it.yaw = lerpAng(yaw, face, this.turnK);
      }
      this.crowdA.update(t, mo);
      this.crowdB.update(t, mo);
      for (let i = 0; i < this.fore.length; i++) {
        const r = this.fore[i];
        const face = faceTo(r.group.position.x, r.group.position.z, 0, 9.5);
        r.group.rotation.y = lerpAng(this.foreYaw[i], face, this.turnK);
        r.update(t, mo);
      }
    }
    for (const r of this.fore) r.group.visible = crowdOn;
    for (const r of this.priests) {
      r.group.visible = inTr;
      if (inTr) r.update(t, mo);
    }

    // ---------------- trumpet-offerings：祭牲一隻一隻走進隊列
    for (const o of this.offering) {
      const a = o.animal;
      if (!inTr) {
        a.group.visible = false;
        continue;
      }
      const k = s < c('trumpet-offerings') ? 0 : clamp((pOff - o.start) / (o.end - o.start));
      const arrived = k >= 1;
      a.group.visible = s >= c('trumpet-offerings') - 0.1 && (k > 0 || arrived);
      const L1 = 10.8 - 3.3;
      const L2 = 1.6 - o.slot;
      const d = k * (L1 + L2);
      if (d < L1) {
        a.group.position.set(1.6, 0, 10.8 - d);
        a.group.rotation.y = PI;
      } else {
        a.group.position.set(1.6 - (d - L1), 0, 3.3);
        a.group.rotation.y = lerpAng(PI, -PI / 2, smooth(L1 - 0.4, L1 + 0.8, d));
      }
      a.group.position.y = !arrived && k > 0 ? Math.abs(Math.sin(d * 2.2)) * 0.04 : 0;
      a.graze = arrived;
      a.update(t, mo);
    }

    // ---------------- 贖罪日的牲畜
    const goatsOn = atonePhase;
    this.goatB.baseScale = 1;
    const goatVis = goatsOn && ((s >= c('lots') && s < CUT['incense']) || (s >= CUT['confess'] && s < c('afflict') - 0.2));
    this.goatA.group.visible = goatVis;
    this.goatB.group.visible = goatVis;
    this.calf.group.visible = goatsOn && ((s >= c('lots') && s < CUT['incense']) || (s >= CUT['confess'] && s < c('confess', 0.5)));
    this.ropeB.mesh.visible = false;
    this.ropeLead.mesh.visible = false;
    for (const st of this.stones) st.visible = false;
    this.water.hideAll();
    this.drops.hideAll();

    // 大祭司：依 cue 的位置與動作
    const hp = this.hp;
    let hpVis = false;
    let censOn = 0;
    let cloudP = 0;
    let cloudA = 1;
    const cens = _w.set(0.3, 0.9, ARK_Z + 1.2);
    let sashK = 1;

    // 贖罪日各 cue 的狀態
    if (s >= c('linen') && s < CUT['incense']) {
      hpVis = true;
      if (s < c('lots')) this.doLinen(pLinen, t, mo);
      else this.doLots(pLots, t, mo);
      if (s < c('lots')) {
        sashK = smooth(0.74, 0.84, pLinen);
      }
    } else if (s >= CUT['incense'] && s < CUT['confess']) {
      hpVis = true;
      censOn = 1;
      this.doHoly(s, pInc, pSpr, t, mo);
      cloudP = s < c('sprinkle') ? clamp(pInc / 0.7) : 1;
      cloudA = s < c('sprinkle') ? 1 : 0.8;
      cens.copy(this.censerWorldCourt());
    } else if (s >= CUT['confess'] && s < c('scapegoat')) {
      hpVis = true;
      this.doConfess(pCon, t, mo);
    }
    hp.group.visible = hpVis;
    this.sash.visible = sashK > 0.02;
    this.sash.scale.set(sashK, 0.74 * sashK, sashK);
    // 冠冕：linen 的最後才戴上
    const mk = s < c('lots') ? smooth(0.86, 0.96, pLinen) : 1;
    this.mitre.visible = mk > 0.01;
    if (mk > 0.01) this.mitre.position.y = lerp(0.9, 0, smooth(0, 1, mk));
    if (hpVis) hp.update(t, mo);
    // 香爐
    this.censer.visible = s >= CUT['incense'] && s < CUT['confess'];
    this.censerGlow.visible = this.censer.visible;
    this.censerFlame.visible = this.censer.visible;

    // 逃出營地的羊（scapegoat）：長距離走路
    this.wild.visible = s >= c('confess') && s < CUT['ingathering'];
    const scapeOn = s >= c('scapegoat') && s < c('afflict');
    this.leader.group.visible = scapeOn;
    this.dustMan.mesh.visible = scapeOn;
    this.dustGoat.mesh.visible = scapeOn;
    if (scapeOn) this.doScape(pScape, t, mo);
    else if (s >= c('afflict')) {
      this.goatB.group.visible = false;
      this.goatA.group.visible = false;
    }

    // 贖罪日末拍：沒有人做工，坐著低頭
    const affOn = s >= c('afflict') && s < CUT['ingathering'];
    this.sit.group.visible = affOn;
    this.tools.visible = affOn;
    for (const r of this.sitRigs) r.group.visible = affOn;
    if (affOn) {
      this.sit.update(t, mo);
      for (const r of this.sitRigs) {
        r.headPitch = 0.45;
        r.update(t, mo);
      }
    }
    // 祭牲與營地人物只在吹角節；贖罪日的羊（goatA／B）更新
    if (goatVis) {
      this.goatA.update(t, mo);
      this.goatB.update(t, mo);
      this.calf.update(t, mo);
    }

    // 會幕院子本體：火苗、幔子、點光、香煙
    const camp = fireOn;
    this.court.tent.visible = true;
    this.court.update(fr, s, dayK, cens, censOn, cloudP, camp);
    (this.court.cloud.mat.uniforms.uOn as { value: number }).value = cloudP > 0 ? cloudA : 0;
    this.fireK = 1;
    // 水滴／血滴矩陣
    this.water.mesh.instanceMatrix.needsUpdate = true;
    this.drops.mesh.instanceMatrix.needsUpdate = true;
    this.marks.mesh.instanceMatrix.needsUpdate = true;
  }
  /** 營火的總開關（world 讀取後交給 camp.fireK） */
  fireK = 1;

  private censerWorldCourt(): Vector3 {
    this.censer.getWorldPosition(_v1);
    _v1.x -= NX + CX;
    _v1.z -= CZ;
    return _v1;
  }

  // ---------------------------------------------------------------- linen：洗手、洗腳、繫腰帶、戴冠冕
  private doLinen(p: number, _t: number, _mo: boolean): void {
    const hp = this.hp;
    const bx = LAVER[0] - 0.75;
    hp.group.position.set(bx, 0, LAVER[1]);
    hp.group.rotation.y = PI / 2;
    hp.baseScale = 1;
    hp.twist = 0;
    hp.lean = 0;
    hp.crouch = 0;
    hp.bow = 0.12;
    hp.headYaw = 0;
    hp.headPitch = 0.15;
    const feet = smooth(0.42, 0.52, p) * (1 - smooth(0.62, 0.7, p));
    const dress = smooth(0.72, 0.78, p);
    const ph = p * 40;
    // 洗手：兩手伸進盆裡搓動
    const hy = 1.0 + 0.04 * Math.sin(ph);
    const rub = 0.06 * Math.sin(ph * 1.3);
    aimAt(hp, 'L', LAVER[0] - 0.22, hy, LAVER[1] - 0.18 + rub);
    aimAt(hp, 'R', LAVER[0] - 0.22, hy, LAVER[1] + 0.18 - rub);
    // 之後舉起雙手，水滴下來
    const lift = smooth(0.2, 0.28, p) * (1 - smooth(0.32, 0.38, p));
    if (lift > 0) {
      aimAt(hp, 'L', LAVER[0] - 0.38, 1.28, LAVER[1] - 0.3);
      aimAt(hp, 'R', LAVER[0] - 0.38, 1.28, LAVER[1] + 0.3);
      const a1 = hp.swingL;
      const a2 = hp.splayL;
      const b1 = hp.swingR;
      const b2 = hp.splayR;
      aimAt(hp, 'L', LAVER[0] - 0.22, hy, LAVER[1] - 0.18 + rub);
      aimAt(hp, 'R', LAVER[0] - 0.22, hy, LAVER[1] + 0.18 - rub);
      hp.swingL = lerp(hp.swingL, a1, lift);
      hp.splayL = lerp(hp.splayL, a2, lift);
      hp.swingR = lerp(hp.swingR, b1, lift);
      hp.splayR = lerp(hp.splayR, b2, lift);
    }
    // 洗腳：蹲低、彎腰，兩手擺到腳邊
    if (feet > 0) {
      hp.crouch = feet * 0.9;
      hp.bow = 0.12 + 0.75 * feet;
      const sL = hp.swingL;
      const spL = hp.splayL;
      const sR = hp.swingR;
      const spR = hp.splayR;
      hp.swingL = lerp(sL, 0.55 + 0.25 * Math.sin(ph * 1.4), feet);
      hp.splayL = lerp(spL, 0.2, feet);
      hp.swingR = lerp(sR, 0.55 + 0.25 * Math.sin(ph * 1.4 + 2), feet);
      hp.splayR = lerp(spR, 0.2, feet);
    }
    // 站起來、手放下（繫腰帶：兩手到腰側移動）
    if (dress > 0) {
      const belt = smooth(0.72, 0.8, p) * (1 - smooth(0.88, 0.92, p));
      const sL = hp.swingL;
      const spL = hp.splayL;
      const sR = hp.swingR;
      const spR = hp.splayR;
      const wob = 0.12 * Math.sin(ph * 0.9);
      hp.aim('L', -0.18, -0.38, 0.2 + wob);
      const wl = [hp.swingL, hp.splayL];
      hp.aim('R', 0.18, -0.38, 0.2 - wob);
      hp.swingL = lerp(0.1, wl[0], belt);
      hp.splayL = lerp(0.12, wl[1], belt);
      hp.swingR = lerp(0.1, hp.swingR, belt);
      hp.splayR = lerp(0.12, hp.splayR, belt);
      hp.swingL = lerp(sL, hp.swingL, dress);
      hp.splayL = lerp(spL, hp.splayL, dress);
      hp.swingR = lerp(sR, hp.swingR, dress);
      hp.splayR = lerp(spR, hp.splayR, dress);
      // 戴冠冕：兩手舉到頭頂
      const crown = smooth(0.86, 0.9, p) * (1 - smooth(0.95, 0.99, p));
      if (crown > 0) {
        const a = [hp.swingL, hp.splayL, hp.swingR, hp.splayR];
        hp.aim('L', -0.1, 0.4, 0.05);
        const l1 = hp.swingL;
        const l2 = hp.splayL;
        hp.aim('R', 0.1, 0.4, 0.05);
        hp.swingL = lerp(a[0], l1, crown);
        hp.splayL = lerp(a[1], l2, crown);
        hp.swingR = lerp(a[2], hp.swingR, crown);
        hp.splayR = lerp(a[3], hp.splayR, crown);
      }
    }
    if (p > 0.45) hp.headPitch = 0.15 + 0.3 * feet;
    // 水滴：洗手後舉起的手滴下、洗腳時從腳邊滴下
    const dripOn = (smooth(0.08, 0.16, p) * (1 - smooth(0.4, 0.44, p))) + feet;
    if (dripOn > 0.05) {
      for (let i = 0; i < 12; i++) {
        const f = (p * 14 + i / 12) % 1;
        const hand = i % 2;
        const x0 = LAVER[0] - 0.4 + (hand ? 0.04 : -0.04) * 0 + (i % 3) * 0.04;
        const z0 = LAVER[1] + (hand ? 0.2 : -0.2);
        const feetMode = feet > 0.5;
        const y0 = feetMode ? 0.5 : 1.12 + 0.18 * lift;
        const xx = feetMode ? bx + 0.1 : x0;
        const zz = feetMode ? LAVER[1] + (hand ? 0.17 : -0.17) : z0;
        const y = y0 - f * f * (y0 - 0.1);
        if (f < 0.92) this.water.put(i, xx, y, zz, 0.022, 0.03, 0.022);
      }
    }
  }

  // ---------------------------------------------------------------- lots：兩隻公山羊、拈鬮
  private doLots(p: number, _t: number, _mo: boolean): void {
    const hp = this.hp;
    const A = this.goatA;
    const B = this.goatB;
    // 兩隻羊在會幕門口並排；遠處祭壇旁一隻公牛犢
    const ax0 = 0.85;
    const bx0 = -0.85;
    const go = smooth(0.52, 0.86, p);
    const aTo = [1.55, 5.35];
    A.group.position.set(lerp(ax0, aTo[0], go), 0, lerp(3.9, aTo[1], go));
    A.group.rotation.y = lerpAng(0, faceTo(ax0, 3.9, aTo[0], aTo[1]), smooth(0.48, 0.6, p)) * (1 - smooth(0.84, 0.95, p)) + lerpAng(0, 0.9, smooth(0.84, 0.95, p)) * smooth(0.84, 0.95, p);
    A.group.position.y = go > 0 && go < 1 ? Math.abs(Math.sin(go * 20)) * 0.03 : 0;
    A.graze = go <= 0 || go >= 1;
    B.group.position.set(bx0, 0, 3.9);
    B.group.rotation.y = 0.12;
    B.graze = true;
    this.calf.group.position.set(-2.1, 0, 6.2);
    this.calf.group.rotation.y = PI / 2 - 0.3;
    this.ropeB.set(_w.set(-1.7, 0.45, 3.5), _v2.set(bx0 - 0.15, 0.55, 4.25));
    this.ropeB.mesh.visible = true;
    // 大祭司在兩隻羊後面，兩手各拿一塊石頭，放在羊前面的地上
    const px = lerp(0, 0.3, smooth(0.5, 0.85, p));
    const pz = lerp(2.85, 3.5, smooth(0.5, 0.85, p));
    hp.group.position.set(px, 0, pz);
    hp.group.rotation.y = lerpAng(0, faceTo(px, pz, aTo[0], aTo[1]), smooth(0.5, 0.62, p));
    hp.twist = 0;
    hp.bow = 0.05;
    hp.crouch = 0;
    hp.headPitch = 0.1;
    const dropL = smooth(0.12, 0.28, p); // 左手那塊（落在 A 前）
    const dropR = smooth(0.3, 0.46, p); // 右手那塊（落在 B 前）
    // 手舉到前面再放下
    const reachL = smooth(0.08, 0.14, p) * (1 - smooth(0.3, 0.38, p));
    const reachR = smooth(0.26, 0.32, p) * (1 - smooth(0.46, 0.54, p));
    const tL = _v1.set(ax0, 0.06, 4.7);
    const tR = _w.set(bx0, 0.06, 4.7);
    // 手的位置：小石從手高處落到地上
    const lh = this.stonePos(0, p, dropL, tL);
    const rh = this.stonePos(1, p, dropR, tR);
    aimAt(hp, 'L', lh.x, lh.y + 0.1, lh.z);
    aimAt(hp, 'R', rh.x, rh.y + 0.1, rh.z);
    hp.swingL = lerp(0.1, hp.swingL, Math.max(reachL, dropL > 0 && dropL < 1 ? 1 : 0));
    hp.swingR = lerp(0.1, hp.swingR, Math.max(reachR, dropR > 0 && dropR < 1 ? 1 : 0));
    hp.splayL = lerp(0.12, hp.splayL, Math.max(reachL, dropL > 0 && dropL < 1 ? 1 : 0));
    hp.splayR = lerp(0.12, hp.splayR, Math.max(reachR, dropR > 0 && dropR < 1 ? 1 : 0));
    for (const st of this.stones) st.visible = true;
  }
  private stonePos(i: number, _p: number, drop: number, target: Vector3): { x: number; y: number; z: number } {
    const hp = this.hp;
    // 手中位置（人物前方 0.45、高 0.95）
    const yaw = hp.group.rotation.y;
    const side = i === 0 ? 1 : -1;
    const hx = hp.group.position.x + Math.sin(yaw) * 0.45 + Math.cos(yaw) * 0.22 * side;
    const hz = hp.group.position.z + Math.cos(yaw) * 0.45 - Math.sin(yaw) * 0.22 * side;
    const hy = 0.95;
    const k = drop;
    const x = lerp(hx, target.x, k);
    const z = lerp(hz, target.z, k);
    const y = lerp(hy, 0.07, k * k);
    const st = this.stones[i];
    st.position.set(x, y, z);
    return { x, y, z };
  }

  // ---------------------------------------------------------------- incense／sprinkle：至聖所
  private doHoly(s: number, pInc: number, pSpr: number, t: number, mo: boolean): void {
    const hp = this.hp;
    hp.group.position.set(0.25, 0, ARK_Z + 1.5);
    hp.group.rotation.y = PI + 0.12;
    hp.baseScale = 1;
    hp.bow = 0.06;
    hp.crouch = 0;
    hp.twist = 0;
    hp.lean = 0;
    hp.headPitch = 0.1;
    const inc = s < CUT['incense'] + 1;
    if (inc) {
      // 右手提香爐往前，左手抓一把香放到炭火上
      hp.swingR = 0.95;
      hp.splayR = 0.1;
      const grab = smooth(0.08, 0.2, pInc) * (1 - smooth(0.28, 0.4, pInc));
      const put = smooth(0.4, 0.5, pInc) * (1 - smooth(0.58, 0.66, pInc));
      hp.aim('L', -0.1, -0.2 + 0.1 * grab, 0.4 + 0.1 * put);
      hp.swingL = lerp(0.12, hp.swingL, Math.max(grab, put));
      hp.splayL = lerp(0.12, hp.splayL, Math.max(grab, put));
    } else {
      // 彈血：右手食指一次次彈向施恩座
      hp.swingR = 0.9;
      hp.splayR = 0.1;
      hp.swingL = 0.2;
      hp.splayL = 0.12;
      this.doSprinkle(pSpr, t, mo);
    }
    // 香爐搖擺（A：小動；C：隨走動）
    const sw = mo ? 0.1 * Math.sin(t * 1.9) + 0.04 * Math.sin(t * 3.1) : 0;
    this.censer.rotation.set(0, 0, sw + 0.0);
  }

  /** 彈血：先一滴彈向施恩座東面（前面），再七滴落在施恩座前的地上；後段換公山羊的血，同樣再彈一輪。
   *  每一輪佔進度的一半，每輪八滴（1 + 7），每 1/8 輪進度一滴。 */
  private doSprinkle(p: number, _t: number, _mo: boolean): void {
    const hp = this.hp;
    hp.handR.getWorldPosition(_w);
    _w.x -= NX + CX;
    _w.z -= CZ;
    const hx = _w.x;
    const hy = _w.y;
    const hz = _w.z;
    let flick = 0;
    for (let round = 0; round < 2; round++) {
      for (let k = 0; k < 8; k++) {
        const tk = round * 0.5 + ((k + 0.5) / 8) * 0.5;
        const age = (p - tk) / 0.04;
        const idx = round * 8 + k;
        const east = k === 0;
        const tx = east ? 0.05 * (round ? 1 : -1) : -0.66 + (k - 1) * 0.22;
        const ty = east ? 0.52 + 0.06 * round : 0.05;
        const tz = east ? ARK_Z + 0.37 : ARK_Z + 1.0 + round * 0.22;
        flick = Math.max(flick, pulse(p, tk, 0.02));
        if (age < 0) continue;
        if (age < 1) {
          // 飛行：從指尖到目標，帶一點弧
          const u = age;
          const x = lerp(hx, tx, u);
          const z = lerp(hz, tz, u);
          const y = lerp(hy, ty, u) + 0.22 * Math.sin(PI * u);
          this.drops.put(idx, x, y, z, 0.03, 0.04, 0.03);
        } else {
          // 落下之後留下血跡（可數）
          const m = round * 8 + k;
          if (east) this.marks.put(m, tx, ty, tz - 0.02, 0.045, 0.06, 0.012);
          else this.marks.put(m, tx, 0.045, tz, 0.055, 0.012, 0.045);
        }
      }
    }
    hp.swingR = 0.9 + 0.5 * flick;
    hp.splayR = 0.1 + 0.15 * flick;
    // 還沒彈的血跡先收起來
    for (let i = 0; i < 16; i++) {
      const round = Math.floor(i / 8);
      const k = i % 8;
      const tk = round * 0.5 + ((k + 0.5) / 8) * 0.5;
      if (p < tk + 0.04) this.marks.put(i, 0, -50, 0, 0.0001, 0.0001, 0.0001);
    }
    this.marks.mesh.instanceMatrix.needsUpdate = true;
  }

  // ---------------------------------------------------------------- confess：雙手按在活羊頭上
  private doConfess(p: number, _t: number, _mo: boolean): void {
    const hp = this.hp;
    const B = this.goatB;
    const A = this.goatA;
    A.group.visible = false;
    B.group.position.set(-0.85, 0, 3.9);
    B.group.rotation.y = 0.0;
    const px = lerp(0.9, -0.35, smooth(0.0, 0.25, p));
    hp.group.position.set(px, 0, 4.25);
    hp.group.rotation.y = lerpAng(-PI / 2 + 0.3, -PI / 2, smooth(0.1, 0.3, p));
    hp.baseScale = 1;
    hp.bow = 0.05;
    hp.crouch = 0;
    hp.twist = 0;
    hp.headPitch = 0.2;
    hp.lean = 0;
    // 雙手抬起 → 按下 → 停住；羊低頭
    const up = smooth(0.25, 0.42, p) * (1 - smooth(0.46, 0.58, p));
    const down = smooth(0.46, 0.6, p);
    const hy = lerp(1.05, 0.72, down);
    const lift = lerp(0.0, 0.5, up);
    const walking = p < 0.25;
    if (walking) {
      hp.gait(p * 26, 1);
      hp.group.position.y = Math.abs(Math.cos(p * 26)) * 0.03;
    } else {
      hp.group.position.y = 0;
      aimAt(hp, 'L', -0.78, hy + lift * 0.7, 4.38);
      aimAt(hp, 'R', -0.78, hy + lift * 0.7, 4.14);
      const rest = 1 - smooth(0.25, 0.35, p);
      hp.swingL = lerp(hp.swingL, 0.1, rest);
      hp.swingR = lerp(hp.swingR, 0.1, rest);
    }
    B.graze = false;
    B.headPitch = 0.5 * down;
    this.ropeB.set(_w.set(-1.7, 0.45, 3.5), _v2.set(-1.0, 0.55, 4.25));
    this.ropeB.mesh.visible = true;
  }

  // ---------------------------------------------------------------- scapegoat：長距離走路
  private doScape(p: number, t: number, mo: boolean): void {
    // 長距離走路：起步與到達用常速（各約 12 公尺），中段高速
    const D = scapeDist(p);
    const man = this.leader;
    const goat = this.goatB;
    // 起點：院子門口，man 與羊並排
    const releaseD = 80;
    const dMan = D <= releaseD ? D : releaseD - 0.35 * (D - releaseD);
    const dGoat = D;
    pathAt(dGoat, _pa, 0.9);
    goat.group.position.set(_pa.x, Math.abs(Math.sin(dGoat / 0.5)) * 0.03, _pa.z);
    goat.group.rotation.y = _pa.yaw;
    goat.group.visible = true;
    goat.graze = false;
    // 走遠了的羊放大一點，才看得出是一隻羊獨自走向地平線
    goat.baseScale = 1 + 1.6 * smooth(0.6, 1, p);
    this.goatA.group.visible = false;
    pathAt(Math.max(0, dMan), _pa, -0.1);
    const returning = D > releaseD + 4;
    man.group.position.set(_pa.x, 0, _pa.z);
    // 放開羊以後轉身回營
    const turn = smooth(releaseD, releaseD + 6, D);
    man.group.rotation.y = lerpAng(_pa.yaw, _pa.yaw + PI, turn);
    const stepping = p > 0 && p < 1;
    man.group.position.y = stepping ? man.gait(dMan / 0.78, 1) : 0;
    if (!stepping) {
      man.swingL = 0.2;
      man.swingR = 0.35;
      man.twist = 0;
    }
    if (!returning) {
      // 牽著繩：右手向前
      man.swingR = 0.85;
      man.splayR = 0.05;
    }
    man.update(t, mo);
    // 繩
    this.ropeLead.mesh.visible = D < releaseD + 5;
    if (this.ropeLead.mesh.visible) {
      man.handR.getWorldPosition(_w);
      goat.group.getWorldPosition(_v2);
      _v2.y += 0.55;
      _w.x -= NX + CX;
      _w.z -= CZ;
      _v2.x -= NX + CX;
      _v2.z -= CZ;
      this.ropeLead.set(_w, _v2);
    }
    // 塵土：走過的距離決定位置
    this.dustMan.mat.uniforms.uDist.value = Math.max(0, dMan - SEG1) * (returning ? 1 : 1);
    this.dustGoat.mat.uniforms.uDist.value = Math.max(0, dGoat - SEG1);
    this.dustMan.mat.uniforms.uOn.value = D > 1 ? 1 : 0;
    this.dustGoat.mat.uniforms.uOn.value = D > 1 ? 1 : 0;
    goat.update(t, mo);
  }
}
