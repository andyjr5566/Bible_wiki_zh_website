// 兩片田：初熟的大麥田（BX）與七七節的小麥田（WX）。
import { type BufferGeometry, Color, DoubleSide, Group, InstancedMesh, Mesh, type Object3D, type ShaderMaterial, Vector3 } from 'three';
import { SITE } from '../data/site';
import { story } from '../story/state';
import { barleyGeo, personGeo } from './geo';
import { clothGeo, fieldGeo, griddleGeo, loafGeo, rockGeo, sheafGeo, sickleGeo } from './geo2';
import { litMat, solid } from './materials';
import { type FrameLite, hillMesh, robeMat, setInst } from './props';
import { Animal, ArmProp, PersonCrowd, RigPerson, type Species } from './rig';
import { BX, CUT, WX, c, lp } from './tracks';
import { Summer } from './summer';
import { clamp, hexTo, lerp, mulberry32, smooth } from './util';

/** 田地起伏：靠近鏡頭（z≥-2）平坦，越遠越有起伏 */
export function hf(x: number, z: number): number {
  const amp = smooth(-2, -30, z);
  const far = smooth(-45, -160, z) * 9;
  return amp * (1.5 * Math.sin(x * 0.045 + 1.3) * Math.cos(z * 0.06) + 0.95 * Math.sin(z * 0.1 - x * 0.03 + 2) + 0.5 * Math.sin(x * 0.13 + z * 0.09)) + far;
}

const _c1 = new Vector3();
const _c2 = new Vector3();
const _s1 = new Vector3();
const _s2 = new Vector3();
function mix3(out: Vector3, a: string, b: string, t: number): Vector3 {
  hexTo(a, _c1);
  hexTo(b, _c2);
  return out.lerpVectors(_c1, _c2, clamp(t));
}

/** 供應量的名稱 → 剪影種類 */
export function animalKind(name: string): { kind: Species; sc: number } {
  if (name.includes('牛')) return { kind: 'cow', sc: 0.78 };
  if (name.includes('山羊')) return { kind: 'goat', sc: 1.05 };
  if (name.includes('綿羊羔')) return { kind: 'lamb', sc: 1.12 };
  if (name.includes('羔')) return { kind: 'lamb', sc: 1.0 };
  return { kind: 'ram', sc: 1.2 };
}

/** 割麥的人：收割線（x）隨進度往 -x 走 */
const REAP_X0 = 1.3;
const REAP_X1 = -2.6;
const reapX = (p: number): number => lerp(REAP_X0, REAP_X1, p);
const STROKES = 10;

interface Slot {
  animal: Animal;
  x: number;
  z: number;
  start: number;
  end: number;
}

export class Fields {
  barley = new Group();
  wheat = new Group();
  private wheatMat!: ShaderMaterial;
  private wheatInst!: InstancedMesh;
  private wheatTotal = 0;
  private wheatGround!: ShaderMaterial;
  private barleyMat!: ShaderMaterial;
  private cutSheaves = new Group();
  // 大麥田
  private reaper!: RigPerson;
  private bunch!: Group;
  private fallen!: InstancedMesh;
  private bent!: PersonCrowd;
  private bentBase: { x: number; z: number; yaw: number }[] = [];
  private lamb!: Animal;
  private passers: RigPerson[] = [];
  // 小麥田
  private gleaner!: RigPerson;
  private ears!: InstancedMesh;
  private earPos: { x: number; z: number; r: number }[] = [];
  private farReapers!: PersonCrowd;
  private folks: RigPerson[] = [];
  private kids: RigPerson[] = [];
  private slots: Slot[] = [];
  private loaves: Group[] = [];
  private loafBase: Vector3[] = [];
  private hands: ArmProp[] = [];
  /** 夏日過場：田收完，田邊的葡萄與果樹 */
  summer = new Summer();
  /** 夏日過場要收起來的東西：靜態的（每幀依 s 設）與自己每幀設可見度的（過場時強制收起） */
  private summerStatic: Object3D[] = [];
  private summerForce: Object3D[] = [];

  constructor() {
    this.buildBarley();
    this.buildWheat();
    this.barley.visible = false;
    this.wheat.visible = false;
    this.wheat.add(this.summer.group);
  }

  // ---------------------------------------------------------------- 大麥田
  private buildBarley(): void {
    const g = this.barley;
    g.position.set(BX, 0, 0);
    const rnd = mulberry32(91);
    // 地面
    const mGround = litMat({ base: '#c7a65e', line: '#6a4f22', angle: 84, angle2: 80, space: 5, seed: 81, cross: true });
    const ground = new Mesh(fieldGeo(600, 560, 72, hf, 50, -250), mGround);
    ground.position.y = 0.03;
    g.add(ground);
    const mHill = litMat({ base: '#b9985a', line: '#5d4623', angle: 4, space: 5, seed: 6, bias: -0.2 });
    g.add(hillMesh(mHill, -70, -190, 110, 12, 50), hillMesh(mHill, 90, -210, 140, 16, 60), hillMesh(mHill, 10, -280, 190, 11, 50));

    // 大麥：成熟（土黃）；隨風起伏，禾捆搖動時再帶起一陣風浪；收割線以右只剩殘茬
    const bg = barleyGeo({ stem: 1.8, earW: 0.034 });
    this.barleyMat = litMat({ base: '#c6a96c', parts: ['#b99d5a', '#dab95f'], partAlt: '#8e7640', angle: 80, space: 5, wind: true, gust: true, cutx: true, seed: 9, bias: 0.22 });
    const total = 7000;
    const barley = new InstancedMesh(bg, this.barleyMat, total);
    barley.frustumCulled = false;
    const col = new Color();
    let n = 0;
    while (n < total) {
      const x = -16 + rnd() * 56;
      const z = 3.5 - Math.pow(rnd(), 1.7) * 47;
      if (z > -0.9 && x > 1.5) continue; // 田邊的小路：祭司、羊羔、禾捆堆都站在這裡
      if (z > 3.2) continue;
      setInst(barley, n, x, hf(x, z), z, rnd() * Math.PI * 2, 1.1 + rnd() * 0.6, 0.78 + rnd() * 0.26, (rnd() - 0.5) * 0.12, (rnd() - 0.5) * 0.12);
      col.setRGB(rnd(), 0, 0);
      barley.setColorAt(n, col);
      n++;
    }
    g.add(barley);

    // 禾捆與割麥的人
    const mSheaf = litMat({ base: '#c6a35a', parts: ['#b79a55', '#d9b861', '#6a4a26'], angle: 70, space: 4, seed: 71 });
    const sg = sheafGeo(3);
    const sheaf1 = solid(sg, mSheaf, 1.6);
    sheaf1.position.set(1.7, 0, 0.9);
    sheaf1.rotation.set(0.04, 0.5, -0.05);
    g.add(sheaf1);
    this.sheafLying(g, mSheaf, sg, 2.7, 0.14, 1.6, 0.3, 1.3);
    this.sheafLying(g, mSheaf, sg, 3.1, 0.14, 0.2, 0.5, -0.4);

    this.reaper = new RigPerson({ bow: 0.85, belt: true, armL: [1.05, 0.08], armR: [1.0, 0.16], seed: 71, outline: 2.4 }, robeMat('#a88758', 17));
    this.reaper.group.rotation.y = -Math.PI / 2;
    g.add(this.reaper.group);
    const mSick = litMat({ base: '#9a9890', parts: ['#a8a8a0', '#6e5433'], angle: 30, space: 3.6, seed: 72 });
    const sick = solid(sickleGeo(), mSick, 1.4);
    sick.rotation.set(Math.PI / 2 + 0.2, 0.2, 0);
    this.reaper.handR.add(sick);
    // 左手抓著的一把麥子：隨捲動漸漸變成一捆
    this.bunch = solid(sheafGeo(5, 20, 1), mSheaf, 1.2);
    this.bunch.rotation.set(Math.PI / 2 + 0.3, 0, 0);
    this.reaper.handL.add(this.bunch);
    // 一刀一刀割下的麥子倒下（十把）
    const fall = new InstancedMesh(bg, litMat({ base: '#c6a96c', parts: ['#b99d5a', '#dab95f'], partAlt: '#8e7640', angle: 80, space: 5, seed: 9, bias: 0.22 }), STROKES);
    fall.frustumCulled = false;
    for (let i = 0; i < STROKES; i++) fall.setColorAt(i, col.setRGB(rnd(), 0, 0));
    this.fallen = fall;
    g.add(fall);

    // 遠一些的割麥人（彎腰的剪影）與散放的禾捆
    this.bent = new PersonCrowd(personGeo({ bow: 0.9, belt: true, low: true, armL: [1.0, 0.1], armR: [1.0, 0.1] }), robeMat('#b59a68', 19), 6, 1.6);
    g.add(this.bent.group);
    const spots: [number, number][] = [[-5, -5], [-8.5, -9], [-3.5, -13], [-11, -15], [-6.5, -19], [-2, -22]];
    spots.forEach(([x, z], i) => {
      const it = this.bent.items[i];
      it.x = x;
      it.z = z;
      it.y = hf(x, z);
      it.yaw = -Math.PI / 2 + (rnd() - 0.5) * 0.4;
      it.sc = 1 + rnd() * 0.06;
      this.bentBase.push({ x, z, yaw: it.yaw });
    });
    for (const [x, z] of [[-3, -6], [-6, -10.5], [-1.5, -14], [-8, -16.5]]) {
      const s = solid(sg, mSheaf, 1.2);
      s.position.set(x, hf(x, z), z);
      s.rotation.set(0.05, rnd() * 6, 0);
      g.add(s);
    }

    // 羊羔（lamb-offering）：一歲的公綿羊羔，朝鏡頭走幾步、轉頭
    const lmat = litMat({ base: 'paper', parts: ['#e9e1cc', '#14110e'], angle: 52, space: 4.4, seed: 12 });
    this.lamb = new Animal('lamb', lmat, 2.2, 5);
    this.lamb.baseScale = 1.25;
    this.lamb.group.position.set(17, 0, 0.6);
    g.add(this.lamb.group);

    // not-yet：收好的禾捆整齊堆在田邊，旁邊一個空的烘烤盤
    const layers: [number, number[]][] = [[0.15, [-0.66, 0, 0.66]], [0.44, [-0.33, 0.33]], [0.73, [0]]];
    const stackGeo = sheafGeo(9, 18, 1.7);
    const stack = new Group();
    layers.forEach(([y, zs], li) => {
      for (const z of zs) {
        for (const xo of [-0.5, 0.5]) {
          // 躺著的禾捆：沿 x 軸放，底（切口）在 +x 端
          const o = solid(stackGeo, mSheaf, 1.3);
          o.position.set(25 + xo + (li % 2 ? 0.2 : 0) + 0.48 + (rnd() - 0.5) * 0.06, y, 0.3 + z);
          o.rotation.set(0, (rnd() - 0.5) * 0.1, Math.PI / 2);
          stack.add(o);
        }
      }
    });
    g.add(stack);
    const mClay = litMat({ base: '#5b4630', angle: 25, space: 4, seed: 73 });
    const gr = solid(griddleGeo(), mClay, 1.8);
    gr.position.set(27.6, 0.18, 1.1);
    gr.scale.setScalar(1.1);
    g.add(gr);
    const mRock = litMat({ base: '#a69a82', angle: 50, space: 4.4, seed: 51, cross: true });
    for (const [x, z] of [[-0.22, 0.15], [0.2, 0.2], [0, -0.22]]) {
      const r = solid(rockGeo(5), mRock, 1.4);
      r.scale.set(0.12, 0.1, 0.12);
      r.position.set(27.6 + x * 1.1, 0.07, 1.1 + z * 1.1);
      g.add(r);
    }
    // 兩三個人從禾捆堆旁走過，沒有停下拿取
    const robes = ['#a88758', '#8f7550', '#b59a68'];
    for (let i = 0; i < 3; i++) {
      const r = new RigPerson({ belt: true, slim: i !== 1, staff: i === 0, staffSide: 'R', seed: 80 + i, armL: [0.1, 0.12], armR: [0.1, 0.12] }, robeMat(robes[i], 60 + i));
      r.group.rotation.y = Math.PI / 2;
      g.add(r.group);
      this.passers.push(r);
    }
  }

  private sheafLying(g: Group, mat: ShaderMaterial, geo: BufferGeometry, x: number, y: number, z: number, ry: number, rz: number): void {
    const s = solid(geo, mat, 1.4);
    s.position.set(x, y, z);
    s.rotation.set(0, ry, Math.PI / 2 + rz * 0.05);
    g.add(s);
  }

  // ---------------------------------------------------------------- 小麥田
  private buildWheat(): void {
    const g = this.wheat;
    g.position.set(WX, 0, 0);
    const rnd = mulberry32(131);
    this.wheatGround = litMat({ base: '#c2a763', line: '#5a4420', angle: 84, angle2: 80, space: 5, seed: 82, cross: true });
    const ground = new Mesh(fieldGeo(600, 560, 72, hf, 50, -250), this.wheatGround);
    ground.position.y = 0.03;
    g.add(ground);
    const mHill = litMat({ base: '#b9985a', line: '#5d4623', angle: 4, space: 5, seed: 6, bias: -0.2 });
    g.add(hillMesh(mHill, -70, -190, 110, 12, 50), hillMesh(mHill, 90, -210, 140, 16, 60), hillMesh(mHill, 10, -280, 190, 11, 50));

    this.wheatMat = litMat({ base: '#c6a96c', parts: ['#7d9244', '#97a94f'], partAlt: '#6a7c38', angle: 80, space: 5, wind: true, crop: true, seed: 10, bias: 0.22 });
    const wg = barleyGeo({ earW: 0.03, earTop: 1.12, leafLen: 1.15, stem: 1.6 });
    const total = 6600;
    const wheat = new InstancedMesh(wg, this.wheatMat, total);
    wheat.frustumCulled = false;
    const col = new Color();
    const RX0 = -16;
    const RX1 = 64;
    const RZ1 = -0.7;
    const RZ0 = -40;
    const CORNER = 8;
    let n = 0;
    while (n < total) {
      let x = RX0 + rnd() * (RX1 - RX0);
      let z = RZ1 - Math.pow(rnd(), 1.6) * (RZ1 - RZ0);
      if (rnd() < 0.12) {
        // 鏡頭前（count 那一拍）田往前多伸一塊
        x = RX0 + rnd() * 19;
        z = RZ1 + rnd() * 5.2;
      }
      const cx = x < RX0 + CORNER || x > RX1 - CORNER;
      const cz = z > RZ1 - CORNER || z < RZ0 + CORNER;
      const zone = cx && cz ? 1 : 0;
      setInst(wheat, n, x, hf(x, z), z, rnd() * Math.PI * 2, 1.1 + rnd() * 0.6, 0.8 + rnd() * 0.25, (rnd() - 0.5) * 0.12, (rnd() - 0.5) * 0.12);
      col.setRGB(rnd(), zone, 0);
      wheat.setColorAt(n, col);
      n++;
    }
    g.add(wheat);
    this.wheatInst = wheat;
    this.wheatTotal = total;

    // 收完的田：散放的禾捆
    const mSheaf = litMat({ base: '#d2b05a', parts: ['#cdac55', '#e6c25f', '#6a4a26'], angle: 70, space: 4, seed: 74 });
    const sg = sheafGeo(5);
    for (let i = 0; i < 9; i++) {
      const x = 4 + rnd() * 30;
      const z = -3 - rnd() * 14;
      const s = solid(sg, mSheaf, 1.2);
      s.position.set(x, hf(x, z), z);
      s.rotation.set(0.05, rnd() * 6, 0);
      this.cutSheaves.add(s);
    }
    this.cutSheaves.visible = false;
    g.add(this.cutSheaves);

    // two-loaves：布上兩個發起來的餅，旁邊一束小麥；後段一雙手把兩個餅舉起來搖
    const mCloth = litMat({ base: '#e0d6bf', angle: 10, space: 4.4, seed: 54, side: DoubleSide });
    const cloth = solid(clothGeo(1.6, 1.1), mCloth, 1.6);
    cloth.position.set(6.3, 0.04, 0.95);
    cloth.rotation.y = -0.1;
    g.add(cloth);
    this.summerStatic.push(cloth);
    const mLoaf = litMat({ base: '#c58a45', parts: ['#c9904a', '#6b3f1a'], angle: 28, space: 3.8, seed: 75 });
    const lg = loafGeo();
    const lb: [number, number, number, number][] = [[5.65, 0.14, 0.82, 0.18], [6.4, 0.14, 1.0, -0.22]];
    for (const [x, y, z, ry] of lb) {
      const l = solid(lg, mLoaf, 1.8);
      l.position.set(x, y, z);
      l.rotation.y = ry;
      l.scale.setScalar(1.1);
      g.add(l);
      this.summerStatic.push(l);
      this.loaves.push(l);
      this.loafBase.push(new Vector3(x, y, z));
    }
    const sw = solid(sg, mSheaf, 1.4);
    sw.position.set(7.35, 0.11, 0.7);
    sw.rotation.set(0, 0.5, Math.PI / 2 - 0.1);
    sw.scale.setScalar(0.85);
    g.add(sw);
    this.summerStatic.push(sw);
    const armMat = litMat({ base: '#a88758', line: '#14110e', angle: 40, space: 4.4, seed: 24 });
    const handMat = litMat({ base: 'silh' });
    for (let i = 0; i < 2; i++) {
      const a = new ArmProp(armMat, handMat);
      a.group.visible = false;
      g.add(a.group);
      this.summerForce.push(a.group);
      this.hands.push(a);
    }

    // weeks-offerings：祭牲一隻一隻走進隊列，數量讀 SITE.offerings['利23:18-19']
    const group = SITE.offerings?.['利23:18-19'];
    const items: { kind: Species; sc: number }[] = [];
    if (group) for (const it of group.items) for (let k = 0; k < it.count; k++) items.push(animalKind(it.animal));
    const mSil = litMat({ base: 'silh' });
    let ax = 12.5;
    const xs: number[] = [];
    items.forEach((it, i) => {
      xs.push(ax);
      const next = items[i + 1];
      ax += next && next.kind !== it.kind ? 1.55 : 1.1;
      void it;
    });
    items.forEach((it, i) => {
      const a = new Animal(it.kind, mSil, 1.8, 60 + i);
      a.baseScale = it.sc;
      a.group.rotation.y = Math.PI / 2 - 0.08;
      g.add(a.group);
      this.summerForce.push(a.group);
      const rank = items.length - 1 - i; // 最右邊的先到位
      const fin = 0.3 + (0.66 * rank) / Math.max(1, items.length - 1);
      const dur = (xs[i] - 2) / 80;
      this.slots.push({ animal: a, x: xs[i], z: 1.6 + (i % 2) * 0.15, start: fin - dur, end: fin });
    });

    // rejoice：申16:11 列出的人，用不同高矮的剪影表現
    const folks: { x: number; z: number; sc: number; robe: string; wrap: string; o: Parameters<typeof personGeo>[0] }[] = [
      { x: 42.4, z: 2.5, sc: 1.02, robe: '#a88758', wrap: '#2b2218', o: { belt: true, staff: true, staffSide: 'R', armL: [0.4, 0.2], armR: [0.3, 0.15] } },
      { x: 43.05, z: 1.25, sc: 0.93, robe: '#cdbf9e', wrap: '#6b5a3a', o: { slim: true, veil: true, belt: true, armL: [0.5, 0.15], armR: [0.5, 0.15] } },
      { x: 43.7, z: 2.5, sc: 0.74, robe: '#b79a68', wrap: '#2b2218', o: { belt: true, armL: [0.6, 0.2], armR: [0.2, 0.15] } },
      { x: 44.35, z: 1.25, sc: 0.64, robe: '#d8cdb4', wrap: '#7a5a3a', o: { veil: true, armL: [0.2, 0.15], armR: [0.7, 0.2] } },
      { x: 45.0, z: 2.5, sc: 0.99, robe: '#8f7550', wrap: '#2b2218', o: { slim: true, belt: true, armL: [0.8, 0.2], armR: [0.3, 0.15] } },
      { x: 45.65, z: 1.25, sc: 0.92, robe: '#c9b27a', wrap: '#8a5a3a', o: { slim: true, veil: true, belt: true, armL: [0.3, 0.15], armR: [0.6, 0.2] } },
      { x: 46.3, z: 2.5, sc: 1.04, robe: '#e9e1cc', wrap: '#2b2218', o: { belt: false, armL: [0.2, 0.15], armR: [0.5, 0.2] } },
      { x: 46.95, z: 1.25, sc: 1.0, robe: '#6c5a3d', wrap: '#b79a68', o: { slim: true, belt: true, staff: true, staffSide: 'L', armL: [0.3, 0.2], armR: [0.4, 0.15] } },
      { x: 47.6, z: 2.5, sc: 0.56, robe: '#b79a68', wrap: '#2b2218', o: { armL: [0.5, 0.2], armR: [0.4, 0.2] } },
      { x: 48.25, z: 1.25, sc: 0.62, robe: '#cdbf9e', wrap: '#6b5a3a', o: { veil: true, armL: [0.3, 0.2], armR: [0.6, 0.2] } },
      { x: 48.9, z: 2.5, sc: 0.9, robe: '#8a7a5c', wrap: '#4a3a2a', o: { slim: true, veil: true, belt: true, staff: true, staffSide: 'R', armL: [0.3, 0.15], armR: [0.4, 0.2] } },
      { x: 49.55, z: 1.25, sc: 0.97, robe: '#a88758', wrap: '#2b2218', o: { belt: true, bow: 0.1, staff: true, staffSide: 'L', armL: [0.35, 0.2], armR: [0.3, 0.15] } },
    ];
    folks.forEach((f, i) => {
      const r = new RigPerson({ ...f.o, scale: f.sc, seed: 40 + i, kid: f.sc < 0.7 }, robeMat(f.robe, 40 + i, '#14110e', f.wrap));
      r.group.position.set(f.x, 0, f.z);
      r.group.rotation.y = (46 - f.x) * 0.05 + (i % 2 ? 0.08 : -0.08);
      g.add(r.group);
      this.summerStatic.push(r.group);
      this.folks.push(r);
    });
    // 兩三個孩子在大人之間繞著跑
    for (let i = 0; i < 3; i++) {
      const r = new RigPerson({ scale: 0.5, wrap: true, kid: true, seed: 140 + i, armL: [0.3, 0.3], armR: [0.3, 0.3] }, robeMat(['#d8cdb4', '#b79a68', '#cdbf9e'][i], 140 + i));
      g.add(r.group);
      this.summerForce.push(r.group);
      this.kids.push(r);
    }

    // corners：彎腰拾取遺落穗子的人；地上散著幾穗，撿一穗少一穗
    this.gleaner = new RigPerson({ bow: 1.05, belt: true, armL: [1.35, 0.1], armR: [0.7, 0.12], seed: 150, outline: 2.4 }, robeMat('#9a8058', 50));
    this.gleaner.group.position.set(54.8, 0, -2.4);
    this.gleaner.group.rotation.y = Math.PI / 2 + 0.3;
    g.add(this.gleaner.group);
    this.summerForce.push(this.gleaner.group);
    const earGeo = sheafGeo(11, 4, 0.6);
    const mEar = litMat({ base: '#d2b05a', parts: ['#cdac55', '#e6c25f', '#6a4a26'], angle: 70, space: 4, seed: 76 });
    this.ears = new InstancedMesh(earGeo, mEar, 9);
    this.ears.frustumCulled = false;
    g.add(this.ears);
    this.summerStatic.push(this.ears);
    for (let i = 0; i < 9; i++) this.earPos.push({ x: 56.4 - i * 0.38, z: -2.0 - (i % 3) * 0.35, r: rnd() * 6 });
    // 遠處有人在割
    this.farReapers = new PersonCrowd(personGeo({ bow: 0.9, belt: true, low: true, armL: [1.0, 0.1], armR: [1.0, 0.1] }), robeMat('#b59a68', 19), 4, 1.5);
    g.add(this.farReapers.group);
    this.summerStatic.push(this.farReapers.group);
    const fr: [number, number][] = [[28, -12], [33.5, -15.5], [39, -11], [44, -17]];
    fr.forEach(([x, z], i) => {
      const it = this.farReapers.items[i];
      it.x = x;
      it.z = z;
      it.y = hf(x, z);
      it.yaw = Math.PI / 2 - 0.3 + i * 0.2;
      it.sc = 1;
    });
  }

  // ---------------------------------------------------------------- 每幀
  update(fr: FrameLite, s: number): void {
    const t = fr.time;
    const mo = !fr.motionOff;
    if (this.barley.visible) this.updateBarley(t, mo, s);
    if (this.wheat.visible) {
      this.updateWheat(t, mo, s);
      // 夏日過場：田收完，只剩麥茬；七七節那些人與器物全部收起來
      const sm = s >= CUT['summer'];
      for (const o of this.summerStatic) o.visible = !sm;
      if (sm) for (const o of this.summerForce) o.visible = false;
      (this.wheatMat.uniforms.uCutAll as { value: number }).value = sm ? 1 : 0;
      // 麥茬不需要那麼多株：少畫一些（三角形數）
      const want = sm ? Math.floor(this.wheatTotal * 0.4) : this.wheatTotal;
      if (this.wheatInst.count !== want) this.wheatInst.count = want;
      this.summer.update(fr, s);
    }
  }

  private updateBarley(t: number, mo: boolean, s: number): void {
    // ---- barley-ripe：割麥的人跟著捲動一刀一刀割（約每 0.1 進度一刀）
    const p = smooth(0.02, 0.97, lp(s, 'barley-ripe'));
    const rx = reapX(p);
    this.barleyMat.uniforms.uCutX.value = BX + reapX(p) + 0.45;
    const ph = p * STROKES;
    const stroke = ph - Math.floor(ph);
    const sw = Math.sin(stroke * Math.PI * 2 - 0.4);
    const r = this.reaper;
    const walking = p > 0 && p < 1;
    r.group.position.set(rx, 0, -0.3);
    r.bow = 0.85 + 0.1 * Math.max(0, sw);
    r.swingR = 1.0 + 0.5 * sw;
    r.splayR = 0.16 + 0.12 * Math.max(0, -sw);
    r.swingL = 1.05 + 0.1 * sw;
    r.twist = 0.12 * sw;
    const bk = 0.15 + 0.85 * p;
    this.bunch.scale.setScalar(bk * 0.7);
    this.bunch.visible = true;
    void walking;
    // 割下的麥子倒下
    for (let i = 0; i < STROKES; i++) {
      const pk = (i + 1) / STROKES - 0.04;
      const k = smooth(pk, pk + 0.05, p);
      const px = reapX(pk) - 0.28;
      const pz = -0.35 + ((i % 3) - 1) * 0.2;
      if (p < pk) setInst(this.fallen, i, 0, -50, 0, 0, 0.001);
      else setInst(this.fallen, i, px + k * 0.15, hf(px, pz) + 0.05, pz, i * 1.9, 1.4, 0.95, 0, -k * 1.45);
    }
    this.fallen.instanceMatrix.needsUpdate = true;
    // 遠處的割麥人
    for (let i = 0; i < this.bent.items.length; i++) {
      const it = this.bent.items[i];
      it.sy = 1 - 0.05 * Math.max(0, Math.sin(p * 30 + i * 1.9));
      it.lean = 0.12 * Math.sin(p * 30 + i * 1.9);
    }
    this.bent.update(t, mo);

    // ---- lamb-offering：羊羔朝鏡頭走幾步、轉頭
    const pl = lp(s, 'lamb-offering');
    const e = smooth(0.12, 0.62, pl);
    const L = this.lamb;
    const walking2 = pl > 0.12 && pl < 0.62;
    L.group.position.set(17, walking2 ? Math.abs(Math.sin(e * 22)) * 0.03 : 0, lerp(-2.8, 0.7, e));
    L.group.rotation.y = lerp(0.2, Math.PI / 2 - 0.35, smooth(0.66, 0.95, pl));
    L.headYaw = 0.55 * smooth(0.62, 0.74, pl) * (1 - smooth(0.8, 0.92, pl));
    L.graze = !walking2 && pl > 0.95;

    // ---- not-yet：兩三個人從禾捆堆旁走過，沒有停下
    const pn = lp(s, 'not-yet');
    for (let i = 0; i < this.passers.length; i++) {
      const a = 0.04 + 0.26 * i;
      const k = smooth(a, a + 0.56, pn);
      const x = lerp(14 - i * 1.5, 38 + i, k);
      const moving = k > 0 && k < 1;
      const pr = this.passers[i];
      pr.group.visible = moving || (k > 0 && k < 1.001 && false);
      const b = moving ? pr.gait(x / 0.8 + i, 1) : 0;
      pr.group.position.set(x, b, 3.3 + i * 0.3);
    }
    for (const pr of this.passers) pr.update(t, mo);
    this.reaper.update(t, mo);
    this.lamb.update(t, mo);
  }

  private updateWheat(t: number, mo: boolean, s: number): void {
    // 小麥：依 story.count 由殘茬長成、轉金；corners 時割掉田心
    const count = clamp(story.count, 0, 50);
    const m = this.wheatMat;
    m.uniforms.uGrow.value = lerp(0.2, 1, smooth(2, 26, count));
    m.uniforms.uCut.value = smooth(c('corners', 0.0), c('corners', 0.4), s);
    this.cutSheaves.visible = m.uniforms.uCut.value > 0.6;
    const cols = m.uniforms.uPartCol.value as Vector3[];
    const green = smooth(2, 18, count);
    const gold = smooth(28, 50, count);
    const stem = mix3(cols[0], '#b8a266', '#7d9244', green);
    stem.lerp(hexTo('#cfae56', _c2), gold);
    const ear = mix3(cols[1], '#c2ac6c', '#97a94f', green);
    ear.lerp(hexTo('#e6c25f', _c2), gold);
    (m.uniforms.uPartAlt.value as Vector3).copy(stem).multiplyScalar(0.82);
    const gb = mix3(this.wheatGround.uniforms.uBase.value as Vector3, '#c2a763', '#97a458', green);
    gb.lerp(hexTo('#cdae66', _c2), gold);

    // ---- two-loaves：後段一雙手把兩個餅舉起來前後搖（搖祭）
    const p2 = lp(s, 'two-loaves');
    const lift = smooth(0.42, 0.58, p2);
    const wave = Math.sin((p2 - 0.58) * 34) * 0.3 * smooth(0.58, 0.66, p2);
    const vis = p2 > 0.3;
    for (let i = 0; i < 2; i++) {
      const b = this.loafBase[i];
      const hx = b.x + (i === 0 ? -0.02 : 0.02);
      const lz = b.z + wave * (i === 0 ? 1 : -1) * 0.8;
      this.loaves[i].position.set(b.x, b.y + lift * 0.8, lz);
      this.loaves[i].rotation.z = wave * 0.3 * (i === 0 ? 1 : -1);
      const h = this.hands[i];
      h.group.visible = vis;
      const appear = smooth(0.3, 0.44, p2);
      _s2.set(hx, lerp(-0.4, b.y - 0.09 + lift * 0.8, appear), lz + 0.04);
      _s1.set(hx + (i === 0 ? -0.1 : 0.1), _s2.y - 0.08, lz + 3.7);
      h.set(_s1, _s2);
    }

    // ---- weeks-offerings：祭牲一隻一隻走進隊列
    const pw = lp(s, 'weeks-offerings');
    const pre = s < c('weeks-offerings');
    for (let i = 0; i < this.slots.length; i++) {
      const sl = this.slots[i];
      const k = pre ? 0 : clamp((pw - sl.start) / (sl.end - sl.start));
      const a = sl.animal;
      const arrived = k >= 1;
      a.group.visible = s >= c('weeks-offerings', -0.2) && (k > 0 || arrived);
      const x = lerp(2, sl.x, k);
      const z = lerp(3.4, sl.z, smooth(0.8, 1, k));
      a.group.position.set(x, 0, z);
      a.group.position.y = !arrived && k > 0 ? Math.abs(Math.sin(x * 2.2)) * 0.04 : 0;
      a.graze = arrived;
      a.update(t, mo);
    }

    // ---- rejoice：人群小幅擺動，兩三個孩子在大人之間繞著跑
    const pr = lp(s, 'rejoice');
    for (const f of this.folks) f.update(t, mo);
    for (let i = 0; i < this.kids.length; i++) {
      const k = this.kids[i];
      const a = pr * (2.4 + i * 0.3) * Math.PI * 2 + i * 2.1;
      const x = 46.8 + 6.5 * Math.sin(a);
      const z = 3.7 + 0.5 * Math.cos(a * 1.5 + i);
      const dx = 6.5 * Math.cos(a);
      k.group.position.set(x, k.gait(a * 6, 1.4), z);
      k.group.rotation.y = Math.atan2(dx, -0.5 * Math.sin(a * 1.5 + i) * 1.5);
      k.group.visible = s >= c('rejoice', -0.1) && s < c('corners', 0.3);
      k.update(t, mo);
    }

    // ---- corners：拾穗的人一次次彎腰撿起穗子放進衣兜；遠處有人在割
    const pc = lp(s, 'corners');
    const G = this.gleaner;
    G.group.visible = s >= c('corners', -0.15);
    const cyc = pc * 9;
    const f = cyc - Math.floor(cyc);
    const down = smooth(0.1, 0.35, f) * (1 - smooth(0.55, 0.72, f));
    G.bow = 0.35 + 0.8 * down;
    G.swingL = 0.5 + 0.9 * down;
    G.splayL = 0.1;
    // 撿起後把手舉到腰前放進衣兜
    G.swingR = 0.5 + 0.5 * smooth(0.6, 0.78, f) * (1 - smooth(0.9, 1, f));
    G.group.position.x = 55.4 - 3.1 * pc;
    for (let i = 0; i < 9; i++) {
      const e = this.earPos[i];
      const picked = pc * 9 > i + 0.62;
      if (picked) setInst(this.ears, i, 0, -50, 0, 0, 0.001);
      else setInst(this.ears, i, e.x, hf(e.x, e.z) + 0.04, e.z, e.r, 0.5, 0.5, 0, Math.PI / 2);
    }
    this.ears.instanceMatrix.needsUpdate = true;
    G.update(t, mo);
    for (let i = 0; i < this.farReapers.items.length; i++) {
      const it = this.farReapers.items[i];
      it.sy = 1 - 0.06 * Math.max(0, Math.sin(pc * 34 + i * 1.7));
      it.lean = 0.14 * Math.sin(pc * 34 + i * 1.7);
    }
    this.farReapers.update(t, mo);
  }
}
