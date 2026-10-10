// 第三批的其餘小地點：第五十年（各歸本家）、地是我的、三個回聲拍（西底家、荒涼的田、歸回的人起誓）。
import { BoxGeometry, DoubleSide, Group, InstancedMesh, Mesh, PlaneGeometry, type ShaderMaterial } from 'three';
import { barleyGeo, doorFrameGeo, houseBodyGeo, personGeo } from './geo';
import { scrubGeo, wallSegGeo, gateTowerGeo, fruitTreeGeo } from './geo3';
import { rockGeo, tentGeo } from './geo2';
import { SVJ, SVL, SVO, SVR, SVW } from './layout';
import { FIXED, litMat, solid, solidInstanced } from './materials';
import { type FrameLite, robeMat, setInst } from './props';
import { AnimalCrowd, PersonCrowd, RigPerson } from './rig';
import { faceTo, lerpAng } from './rigutil';
import { lp, scapeDist } from './tracks';
import { bigHills, cutOf, groundMesh } from './sevens-kit';
import { clamp, lerp, mulberry32, smooth, win } from './util';
import { Color } from 'three';

const PI = Math.PI;
/** 長距離走路：起步與到達常速，中段高速（同 scapegoat／release 的規則）；w 0..1 → 走過的比例 0..1 */
const walkK = (w: number): number => scapeDist(clamp(w)) / 200;

// ================================================================ 第五十年：各歸本家
export class Liberty {
  group = new Group();
  private fam: { crowds: PersonCrowd[]; idx: number[]; sx: number; sz: number; ex: number; ez: number; a: number }[] = [];
  private men: PersonCrowd;
  private women: PersonCrowd;
  private kids: PersonCrowd;
  private stones: InstancedMesh;
  private nFam = 6;

  constructor() {
    const g = this.group;
    g.position.set(SVL, 0, 0);
    g.add(groundMesh(1700));
    bigHills(g);
    const mWall = litMat({ base: '#cdbb90', line: '#3a2e18', angle: 88, angle2: 8, space: 4.8, seed: 902, cross: true });
    const mMud = litMat({ base: '#a88758', angle: 86, angle2: 8, space: 4.8, seed: 3, cross: true });
    const mWood = litMat({ base: '#6e5433', angle: 74, angle2: 10, space: 4.4, seed: 5 });
    // 城：城牆與城門（朝東，+x），城裡的屋頂
    for (const z of [-26, 12]) {
      const w = solid(wallSegGeo(26, 7, 2.2), mWall, 2.0);
      w.position.set(-26, 0, z);
      w.rotation.y = PI / 2;
      g.add(w);
    }
    const gt = solid(gateTowerGeo(5.4, 4.6, 9), mWall, 2.0);
    gt.position.set(-26, 0, -7);
    gt.rotation.y = PI / 2;
    g.add(gt);
    const rnd = mulberry32(1710);
    for (let i = 0; i < 14; i++) {
      const w = 5 + rnd() * 4;
      const h = 4 + rnd() * 6;
      const b = solid(new BoxGeometry(w, h, 5 + rnd() * 3), mMud, 1.6);
      b.position.set(-40 - rnd() * 14, h / 2, -26 + (i % 7) * 7 + rnd() * 2);
      g.add(b);
    }
    // 各家的田與屋子（走回去的地方）
    const frameG = doorFrameGeo();
    const homes: [number, number][] = [[-6, -9], [6, -22], [14, -8], [24, -20], [0, -34], [20, -36]];
    for (const [x, z] of homes) {
      const hg = new Group();
      hg.position.set(x, 0, z);
      hg.add(solid(houseBodyGeo({ w: 6.2, h: 3.0, d: 4.8, doorX: 0, tunnel: 1.4 }), mMud, 2.2));
      hg.add(solid(frameG, mWood, 1.6));
      g.add(hg);
    }
    // 田界石：沿著各家的田埂擺一排小石頭
    const nS = 60;
    this.stones = new InstancedMesh(rockGeo(3), litMat({ base: '#8a8068', parts: ['#8a8068'], angle: 30, space: 4, seed: 1711 }), nS);
    this.stones.frustumCulled = false;
    let k = 0;
    for (const [x, z] of homes) {
      for (let i = 0; i < 10 && k < nS; i++, k++) {
        const side = i < 5 ? 0 : 1;
        const t = i % 5;
        const sx = side === 0 ? x - 6 + t * 3 : x + (t % 2 ? 6 : -6);
        const sz = side === 0 ? z + 5 : z + 5 - t * 2.6;
        setInst(this.stones, k, sx, 0.1, sz, rnd() * 6, 0.36, 0.3);
      }
    }
    for (; k < nS; k++) setInst(this.stones, k, 0, -50, 0, 0, 0.001);
    this.stones.instanceMatrix.needsUpdate = true;
    g.add(this.stones);
    // 人：每家三口（父、母、孩子）
    this.men = new PersonCrowd(personGeo({ low: true, belt: true, staff: true, staffSide: 'R' }), robeMat('#b79a68', 1720), this.nFam, 1.7);
    this.women = new PersonCrowd(personGeo({ low: true, belt: true, veil: true }), robeMat('#d8cdb4', 1721, '#14110e', '#8a5a3a'), this.nFam, 1.7);
    this.kids = new PersonCrowd(personGeo({ low: true, belt: true }), robeMat('#cdbf9e', 1722), this.nFam, 1.6);
    g.add(this.men.group, this.women.group, this.kids.group);
    homes.forEach(([x, z], i) => {
      this.fam.push({ crowds: [this.men, this.women, this.kids], idx: [i, i, i], sx: -21 + (rnd() - 0.5) * 1.5, sz: -7 + (rnd() - 0.5) * 2, ex: x + (i % 2 ? 1.2 : -1.2), ez: z + 3.4 + rnd(), a: 0.1 + i * 0.07 });
      this.men.items[i].sc = 1;
      this.women.items[i].sc = 0.95;
      this.kids.items[i].sc = 0.6;
    });
    g.visible = false;
  }

  update(fr: FrameLite, s: number): void {
    const t = fr.time;
    const mo = !fr.motionOff;
    const p = win(lp(s, 'sv-liberty'), 0.08, 0.9);
    for (let i = 0; i < this.fam.length; i++) {
      const f = this.fam[i];
      const w = clamp((p - f.a) / 0.62);
      const k = walkK(w);
      const moving = w > 0.001 && w < 0.999;
      const dist = Math.hypot(f.ex - f.sx, f.ez - f.sz);
      const head = Math.atan2(f.ex - f.sx, f.ez - f.sz);
      const off: [number, number][] = [[0, 0], [-0.9, -0.5], [0.6, 0.8]];
      for (let m = 0; m < 3; m++) {
        const it = f.crowds[m].items[f.idx[m]];
        it.x = lerp(f.sx, f.ex, k) + off[m][0] * Math.cos(head) + off[m][1] * Math.sin(head);
        it.z = lerp(f.sz, f.ez, k) - off[m][0] * Math.sin(head) + off[m][1] * Math.cos(head);
        it.y = moving ? Math.abs(Math.sin(k * dist / 0.75 + m * 1.7)) * 0.045 : 0;
        it.yaw = moving ? head : lerpAng(head, PI + (i % 2 ? 0.3 : -0.3), smooth(0.96, 1, w));
        it.visible = p > f.a - 0.01;
      }
    }
    this.men.update(t, mo);
    this.women.update(t, mo);
    this.kids.update(t, mo);
  }
}

// ================================================================ 地是我的
export class Land {
  group = new Group();
  private tents: InstancedMesh;
  private strangers: RigPerson[] = [];
  private tentMat: ShaderMaterial;
  private plots: Mesh[] = [];

  constructor() {
    const g = this.group;
    g.position.set(SVW, 0, 0);
    // 一塊塊的地：每塊刻線方向與土色不同（一眼看出是分開的一塊塊）
    const base = new Mesh(new PlaneGeometry(900, 700), litMat({ base: '#6a5a3a', line: '#2a2010', angle: 80, space: 5, seed: 1801 }));
    base.rotation.x = -PI / 2;
    base.position.set(0, 0.01, -150);
    g.add(base);
    const tints: [string, number][] = [['#c8ad72', 84], ['#b9b878', 8], ['#d0b27c', 40], ['#a9b070', 120], ['#c9a86a', 62], ['#b8a870', 100]];
    const mats = tints.map(([col, ang], i) => litMat({ base: col, line: '#4a3a1a', angle: ang, angle2: ang + 70, space: 4.6, seed: 1810 + i, cross: i % 2 === 0 }));
    const rnd = mulberry32(1802);
    for (let ix = 0; ix < 7; ix++) {
      for (let iz = 0; iz < 8; iz++) {
        const w = 33 + rnd() * 4;
        const d = 26 + rnd() * 4;
        const m = new Mesh(new PlaneGeometry(w, d), mats[(ix * 3 + iz * 5 + Math.floor(rnd() * 2)) % mats.length]);
        m.rotation.x = -PI / 2;
        m.position.set(-120 + ix * 40 + (rnd() - 0.5) * 1.5, 0.03, 18 - iz * 32 - 4);
        g.add(m);
        this.plots.push(m);
      }
    }
    bigHills(g, 6, '#a89a60', '#4a3d1c');
    // 前景：幾個寄居的人和他們的帳棚（利25:23「你們在我面前是客旅，是寄居的」）
    this.tentMat = litMat({ base: '#4a3a2a', parts: ['#4f3f2e', '#e7b55a'], partAlt: '#5c4a34', angle: 70, space: 4.4, seed: 61, cross: true, flap: true });
    const tents = solidInstanced(tentGeo(), this.tentMat, 3, 1.6);
    this.tents = tents.main;
    g.add(tents.group);
    const tp: [number, number, number][] = [[-5.2, -0.8, 0.5], [-0.2, -5.2, -0.3], [3.4, 0.6, 0.2]];
    tp.forEach(([x, z, yaw], i) => {
      setInst(this.tents, i, x, 0, z, yaw, 1.2);
      this.tents.setColorAt(i, new Color(i * 0.3, 0, 0));
    });
    this.tents.instanceMatrix.needsUpdate = true;
    if (this.tents.instanceColor) this.tents.instanceColor.needsUpdate = true;
    const sp: [number, number, number, string][] = [[-2.8, 1.2, 0.5, '#6c5a3d'], [1.0, 1.6, -0.4, '#8f7550'], [-4.2, 2.0, 0.9, '#6c5a3d']];
    sp.forEach(([x, z, yaw, col], i) => {
      const r = new RigPerson({ belt: true, staff: i !== 1, staffSide: 'L', veil: i === 1, slim: i === 1, armL: [0.2, 0.14], armR: [0.2, 0.14], seed: 1820 + i }, robeMat(col, 1820 + i, '#14110e', '#8a5a3a'));
      r.group.position.set(x, 0, z);
      r.group.rotation.y = yaw;
      g.add(r.group);
      this.strangers.push(r);
    });
    g.visible = false;
  }

  update(fr: FrameLite, _s: number): void {
    const t = fr.time;
    const mo = !fr.motionOff;
    for (const r of this.strangers) r.update(t, mo);
  }
}

// ================================================================ 回聲：西底家（耶34）
export class Jer {
  group = new Group();
  private servants: RigPerson[] = [];
  private caller: RigPerson;
  private doors: { x: number; z: number; side: number }[] = [];

  constructor() {
    const g = this.group;
    g.position.set(SVJ, 0, 0);
    g.add(groundMesh(1900, '#cdbb90', '#6a5a38'));
    const mMud = litMat({ base: '#c9b88e', angle: 86, angle2: 8, space: 4.8, seed: 1202, cross: true });
    const mWood = litMat({ base: '#6e5433', angle: 74, angle2: 10, space: 4.4, seed: 5 });
    const mWall = litMat({ base: '#cdbb90', line: '#3a2e18', angle: 88, angle2: 8, space: 4.8, seed: 902, cross: true });
    const frameG = doorFrameGeo();
    // 街：兩排平頂房子，門朝街
    const zs = [-3, -11, -19, -27];
    for (const side of [-1, 1]) {
      zs.forEach((z, i) => {
        const hg = new Group();
        hg.position.set(side * 7, 0, z + (i % 2) * 0.6);
        hg.rotation.y = side < 0 ? PI / 2 : -PI / 2;
        hg.add(solid(houseBodyGeo({ w: 7.2, h: 3.4 + (i % 3) * 0.7, d: 6, doorX: 0, tunnel: 1.5 }), mMud, 2.2));
        hg.add(solid(frameG, mWood, 1.6));
        g.add(hg);
        this.doors.push({ x: side * 7, z: z + (i % 2) * 0.6, side });
      });
    }
    // 街底的城牆與城門
    const wl = solid(wallSegGeo(30, 6.5, 2), mWall, 2.0);
    wl.position.set(-19, 0, -40);
    const wr = solid(wallSegGeo(30, 6.5, 2), mWall, 2.0);
    wr.position.set(19, 0, -40);
    const gt = solid(gateTowerGeo(5, 4.2, 8), mWall, 2.0);
    gt.position.set(0, 0, -40);
    g.add(wl, wr, gt);
    // 僕婢（男女各幾個）：從門走出來
    const robes = ['#cdbf9e', '#a88758', '#d8cdb4', '#8f7550', '#b79a68', '#cdbf9e'];
    for (let i = 0; i < 6; i++) {
      const r = new RigPerson({ belt: true, veil: i % 2 === 1, slim: i % 2 === 1, armL: [0.2, 0.14], armR: [0.2, 0.14], seed: 1910 + i }, robeMat(robes[i], 1910 + i));
      g.add(r.group);
      this.servants.push(r);
    }
    // 把他們叫回去的人（街底，手指向門）
    this.caller = new RigPerson({ staff: true, staffSide: 'L', belt: true, armL: [0.2, 0.14], armR: [0.6, 0.2], seed: 1920, outline: 2.4 }, robeMat('#6c4a3a', 1920));
    this.caller.group.position.set(0, 0, -16);
    this.caller.group.rotation.y = 0;
    g.add(this.caller.group);
    g.visible = false;
  }

  update(fr: FrameLite, s: number): void {
    const t = fr.time;
    const mo = !fr.motionOff;
    const p = win(lp(s, 'echo-zedekiah'), 0.1, 0.78);
    // 前半：僕婢一個個走出門；後半：被叫回去、又走進門
    const pick = [0, 5, 2, 7, 1, 6];
    for (let i = 0; i < this.servants.length; i++) {
      const r = this.servants[i];
      const d = this.doors[pick[i] % this.doors.length];
      const out = smooth(0.06 + i * 0.06, 0.28 + i * 0.06, p);
      const back = smooth(0.58 + i * 0.045, 0.78 + i * 0.045, p);
      const doorX = d.x - d.side * 2.8;
      const stX = d.side * -2.4 + (i % 3) * 0.7 * -d.side;
      const stZ = d.z + 6 + (i % 2) * 2.2;
      const k = out * (1 - back);
      const moving = (out > 0.001 && out < 0.999) || (back > 0.001 && back < 0.999);
      // 走出：門 → 街（停一下）→ 走回：街 → 門
      const x = lerp(doorX, stX, k);
      const z = lerp(d.z, stZ, k);
      r.group.position.set(x, moving ? r.gait(k * 40 + i, 1) : 0, z);
      const toward = back > 0.001 ? faceTo(stX, stZ, doorX, d.z) : faceTo(doorX, d.z, stX, stZ);
      r.group.rotation.y = moving ? toward : lerpAng(toward, PI, 0.5);
      r.group.visible = (out > 0.002 && back < 0.995);
      if (r.group.visible) r.update(t, mo);
    }
    // 叫的人：後半抬手指向門
    const call = smooth(0.52, 0.62, p) * (1 - smooth(0.9, 1, p));
    this.caller.swingR = lerp(0.2, 1.4, call);
    this.caller.splayR = lerp(0.14, 0.35, call);
    this.caller.update(t, mo);
  }
}

// ================================================================ 回聲：荒涼的田（代下36）
export class Rest {
  group = new Group();
  private layers: InstancedMesh[] = [];
  private scrub: InstancedMesh;
  private layerH = [0.5, 1.15, 1.9];
  private walls: Mesh[] = [];

  constructor() {
    const g = this.group;
    g.position.set(SVR, 0, 0);
    g.add(groundMesh(2000, '#bfae84', '#5a4a2c'));
    bigHills(g, 6, '#b0a078', '#4a3d1c');
    const mWall = litMat({ base: '#cdbb90', line: '#3a2e18', angle: 88, angle2: 8, space: 4.8, seed: 902, cross: true });
    // 倒塌的牆：斜倒、半埋的牆段
    const segs: [number, number, number, number, number, number][] = [
      [-14, -12, 0.15, 0.32, 0.28, 12], [-4, -16, -0.1, -0.2, 0.3, 9], [9, -13, 0.3, 0.1, -0.35, 10], [18, -19, -0.2, 0.28, 0.25, 8], [-24, -22, 0.1, -0.3, 0.2, 14],
    ];
    for (const [x, z, ry, rx, rz, w] of segs) {
      const wl = solid(wallSegGeo(w, 3.6, 1.6), mWall, 1.8);
      wl.position.set(x, -0.5, z);
      wl.rotation.set(rx, ry, rz);
      g.add(wl);
      this.walls.push(wl.children[0] as Mesh);
    }
    // 散落的石頭
    const rocks = solidInstanced(rockGeo(5), litMat({ base: '#8a8068', angle: 30, space: 4, seed: 2001 }), 40, 1.4);
    g.add(rocks.group);
    const rnd = mulberry32(2002);
    for (let i = 0; i < 40; i++) setInst(rocks.main, i, -26 + rnd() * 52, 0.1, -26 + rnd() * 36, rnd() * 6, 0.25 + rnd() * 0.5, 0.2 + rnd() * 0.3);
    rocks.main.instanceMatrix.needsUpdate = true;
    // 乾灌木
    this.scrub = new InstancedMesh(scrubGeo(), litMat({ base: '#6a5a3a', parts: ['#6a5a3a'], angle: 40, space: 3.6, seed: 2003 }), 90);
    this.scrub.frustumCulled = false;
    for (let i = 0; i < 90; i++) setInst(this.scrub, i, -28 + rnd() * 56, 0, -28 + rnd() * 40, rnd() * 6, 1.2 + rnd() * 1.6);
    this.scrub.instanceMatrix.needsUpdate = true;
    g.add(this.scrub);
    // 野草：三層，一層層長高
    const mGrass = litMat({ base: FIXED.ochre, parts: ['#7f8a46', '#a4a85a'], partAlt: '#6a7238', angle: 80, space: 5, wind: true, seed: 2004 });
    for (let L = 0; L < 3; L++) {
      const im = new InstancedMesh(barleyGeo({ leafLen: 1.2 }), mGrass, 700);
      im.frustumCulled = false;
      this.layers.push(im);
      g.add(im);
    }
    g.visible = false;
    this.seed = 2005;
  }
  private seed: number;
  private lastP = -1;

  update(fr: FrameLite, s: number): void {
    void fr;
    const p = win(lp(s, 'echo-land-rest'), 0.06, 0.92);
    if (Math.abs(p - this.lastP) < 1e-4) return;
    this.lastP = p;
    // 每層在自己的時段長高；密度由近到遠
    for (let L = 0; L < 3; L++) {
      const a = 0.04 + L * 0.24;
      const k = smooth(a, a + 0.34, p);
      const rnd = mulberry32(this.seed + L * 17);
      const im = this.layers[L];
      for (let i = 0; i < 700; i++) {
        const x = -34 + rnd() * 68;
        const z = -34 + rnd() * 52;
        const h = (0.6 + rnd() * 0.7) * this.layerH[L] * k;
        setInst(im, i, x, 0, z, rnd() * 6.28, 0.9 + rnd() * 0.6, Math.max(0.0001, h), (rnd() - 0.5) * 0.3, (rnd() - 0.5) * 0.3);
      }
      im.instanceMatrix.needsUpdate = true;
    }
  }
}

// ================================================================ 回聲：歸回的人起誓（尼10）
export class Oath {
  group = new Group();
  private front: RigPerson[] = [];
  private crowd: PersonCrowd;
  private crowdW: PersonCrowd;
  private home: { x: number; z: number; ph: number; sx: number; sz: number }[] = [];
  private nA = 34;
  private nB = 26;

  constructor() {
    const g = this.group;
    g.position.set(SVO, 0, 0);
    g.add(groundMesh(2100, '#cdbb90', '#6a5a38'));
    bigHills(g, 6, '#b0a078', '#4a3d1c');
    const mWall = litMat({ base: '#cdbb90', line: '#3a2e18', angle: 88, angle2: 8, space: 4.8, seed: 902, cross: true });
    const wl = solid(wallSegGeo(40, 6.8, 2.2), mWall, 2.0);
    wl.position.set(-26, 0, -26);
    const wr = solid(wallSegGeo(40, 6.8, 2.2), mWall, 2.0);
    wr.position.set(26, 0, -26);
    const gt = solid(gateTowerGeo(5.4, 4.6, 9), mWall, 2.0);
    gt.position.set(0, 0, -26);
    g.add(wl, wr, gt);
    const mMud = litMat({ base: '#c9b88e', angle: 86, angle2: 8, space: 4.8, seed: 1202, cross: true });
    const rnd = mulberry32(2110);
    for (let i = 0; i < 12; i++) {
      const w = 5 + rnd() * 4;
      const h = 5 + rnd() * 6;
      const b = solid(new BoxGeometry(w, h, 5 + rnd() * 3), mMud, 1.6);
      b.position.set(-40 + i * 7 + (rnd() - 0.5) * 2, h / 2, -34 - rnd() * 6);
      g.add(b);
    }
    // 前排的人：舉手起誓
    const robes = ['#a88758', '#8f7550', '#b59a68', '#cdbf9e', '#9a7d52', '#b79a68', '#a88758', '#cdbf9e'];
    for (let i = 0; i < 8; i++) {
      const r = new RigPerson({ belt: true, staff: false, slim: i % 3 === 0, armL: [0.2, 0.14], armR: [0.2, 0.14], seed: 2120 + i }, robeMat(robes[i], 2120 + i));
      r.group.position.set(-9 + i * 2.5 + (rnd() - 0.5) * 0.6, 0, 1.2 + (i % 2) * 1.4);
      r.group.rotation.y = PI + (rnd() - 0.5) * 0.3;
      g.add(r.group);
      this.front.push(r);
    }
    this.crowd = new PersonCrowd(personGeo({ low: true, belt: true, staff: true, staffSide: 'R' }), robeMat('#b79a68', 2130), this.nA, 1.7);
    this.crowdW = new PersonCrowd(personGeo({ low: true, belt: true, veil: true }), robeMat('#d8cdb4', 2131, '#14110e', '#8a5a3a'), this.nB, 1.7);
    g.add(this.crowd.group, this.crowdW.group);
    for (let i = 0; i < this.nA + this.nB; i++) {
      const row = Math.floor(i / 15);
      const x = -22 + ((i % 15) + (row % 2) * 0.5) * 3 + (rnd() - 0.5) * 1.1;
      const z = 4.8 + row * 2.4 + (rnd() - 0.5) * 0.8;
      const side = i % 2 === 0 ? -1 : 1;
      this.home.push({ x, z, ph: rnd(), sx: side * (30 + rnd() * 16), sz: 4 + rnd() * 14 });
    }
    g.visible = false;
  }

  update(fr: FrameLite, s: number): void {
    const t = fr.time;
    const mo = !fr.motionOff;
    const p = win(lp(s, 'echo-oath'), 0.1, 0.9);
    const gather = smooth(0.06, 0.5, p);
    const all = this.nA + this.nB;
    for (let i = 0; i < all; i++) {
      const crowd = i < this.nA ? this.crowd : this.crowdW;
      const it = crowd.items[i < this.nA ? i : i - this.nA];
      const h = this.home[i];
      const di = clamp(gather * 1.35 - h.ph * 0.35);
      const k = smooth(0, 1, di);
      const moving = k > 0.001 && k < 0.999;
      it.x = lerp(h.sx, h.x, k);
      it.z = lerp(h.sz, h.z, k);
      it.y = moving ? Math.abs(Math.sin(k * 60 + i)) * 0.045 : 0;
      const head = Math.atan2(h.x - h.sx, h.z - h.sz);
      it.yaw = moving ? head : lerpAng(head, PI + (h.ph - 0.5) * 0.2, smooth(0, 1, (gather - 0.9) / 0.1));
      it.sc = 0.94 + h.ph * 0.12;
      it.visible = true;
    }
    this.crowd.update(t, mo);
    this.crowdW.update(t, mo);
    // 手舉起又放下（兩次）
    const raise = Math.max(0, Math.sin(smooth(0.4, 0.95, p) * PI * 2 - 0.3));
    for (let i = 0; i < this.front.length; i++) {
      const r = this.front[i];
      const k = clamp(raise * 1.15 - (i % 3) * 0.06);
      r.swingR = lerp(0.2, 2.9, k);
      r.swingL = lerp(0.2, 2.9, k);
      r.splayR = lerp(0.14, 0.3, k);
      r.splayL = lerp(0.14, 0.3, k);
      r.update(t, mo);
    }
  }
}

void fruitTreeGeo;
void DoubleSide;
void AnimalCrowd;
void cutOf;
