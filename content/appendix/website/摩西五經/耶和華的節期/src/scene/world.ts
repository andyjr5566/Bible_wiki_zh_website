// 夜間世界與隔日世界：所有場景物件與它們隨 s（cue＋進度）的狀態。
import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
} from 'three';
import { story } from '../story/state';
import {
  barleyGeo,
  basinGeo,
  bedGeo,
  doorFrameGeo,
  doorLeafGeo,
  flameGeo,
  houseBodyGeo,
  mergeParts,
  palmFrondsGeo,
  palmTrunkGeo,
  personGeo,
  T,
  torchGeo,
  type Part,
  type PersonOpts,
} from './geo';
import { decalMat, FIXED, glowMat, hullMat, litMat, moonMat, setGlowFlick, skyMat, solid, solidInstanced, sunMat, U } from './materials';
import { c as cu, CUE_IDX, CUT, DAY_S, HYSSOP_IDX, OX, departDist, dxShiftAt, foldReliefAt, inCoda, inEgyptReplay, isAutumnCamp, lp, torchOn, upShiftAt, boxEaseAt, windowOff, worldAt, type TrackOut } from './tracks';
import { Autumn } from './autumn';
import { BlowFx } from './blowfx';
import { Gate, Gilgal, Ruth, Temple } from './echoes';
import { Jerusalem, Village } from './booths';
import { Sevens } from './sevens';
import { makeFx, type FxSet } from './fx';
import { Animal, AnimalCrowd, PersonCrowd, RigPerson } from './rig';
import { Camp } from './camp';
import { Fields } from './fields';
import { Home } from './home';
import { clamp, hexTo, lerp, mulberry32, smooth } from './util';

const RAD = Math.PI / 180;
const DESK_HYSSOP = [0, 0, 0, 0, 0, 0, 0, 0];
const DESK_MEAL = [0, 0, 0, 0, 0, 0, 0, 0];
const PARTS = ['lintel', 'left', 'right'] as const;
const MOON_R = 900;
const AMBER = new Vector3();
const BLOOD = new Vector3();
hexTo('#d98a3c', AMBER);
hexTo('#a3231b', BLOOD);

export interface Frame {
  s: number;
  idx: number;
  dt: number;
  time: number;
  dark: number;
  motionOff: boolean;
  /** 說明框收起程度 0..1（1＝完全收起）；構圖的左右／上推移依此平順歸零。省略視為 0 */
  fold?: number;
}

export interface DecalRig {
  mesh: Mesh;
  mat: ShaderMaterial;
  grow: number;
}

export interface HouseRig {
  group: Group;
  x: number;
  leafPivot: Group;
  decals: DecalRig[];
  door: Vector3;
  delay: number;
  markT: number;
  d: number;
}

const _v = new Vector3();
const _dummy = new Object3D();
const _col = new Color();
const _m = new Vector3();

export class World {
  scene = new Scene();
  camera = new PerspectiveCamera(50, 1, 0.1, 8000);
  skyM: ShaderMaterial;
  moon: Mesh;
  moonHull: Mesh;
  moonM: ShaderMaterial;
  night = new Group();
  day = new Group();
  camp = new Camp();
  fields = new Fields();
  home = new Home();
  autumn = new Autumn();
  blowfx = new BlowFx();
  gilgal = new Gilgal();
  temple = new Temple();
  ruth = new Ruth();
  gate = new Gate();
  village = new Village();
  jerusalem = new Jerusalem();
  sevens = new Sevens();
  sun: Mesh;
  private dayK = 1;
  private leftHouse!: Group;
  private ground!: Mesh;
  private childrenPair = new Group();
  private father!: RigPerson;
  private child!: RigPerson;
  houses: HouseRig[] = [];
  hero!: HouseRig;
  basinPos = new Vector3(-1.35, 0, 0.95);
  doorD = 0;
  /** 有讀者觸發的動畫正在播放（減少動態時用來判斷要不要繼續畫） */
  busy = false;
  private doneTimer = 0;
  private onShut: () => void;
  private shutFired = false;

  // 動態物件
  private lamb!: Animal;
  private lambProps = new Group();
  private doorwayPerson!: RigPerson;
  private leader!: RigPerson;
  private basinG = new Group();
  private bender!: RigPerson;
  private fxTorchSpark!: FxSet;
  private fxTorchSmoke!: FxSet;
  private fxDust!: FxSet;
  private ppl: RigPerson[] = [];
  private winMat: ShaderMaterial;
  private torchMat: ShaderMaterial;
  private barleyGroups: InstancedMesh[] = [];
  private procG = new Group();
  private procPeople: { crowd: PersonCrowd; x0: number[] }[] = [];
  private procAnimals: { crowd: AnimalCrowd; x0: number[] }[] = [];
  private farLine: Group;
  private farLineMesh: InstancedMesh;
  private doorGlowMat: ShaderMaterial;
  private spillMat: ShaderMaterial;

  constructor(onShut: () => void) {
    this.onShut = onShut;
    const sc = this.scene;
    sc.add(this.night, this.day, this.camp.succoth, this.camp.sinai, this.fields.barley, this.fields.wheat);

    // ---- 天空與月亮
    this.skyM = skyMat();
    const sky = new Mesh(new PlaneGeometry(2, 2), this.skyM);
    sky.frustumCulled = false;
    sky.renderOrder = -100;
    sc.add(sky);

    this.moonM = moonMat();
    this.moon = new Mesh(new SphereGeometry(1, 36, 24), this.moonM);
    this.moon.renderOrder = -90;
    this.moon.frustumCulled = false;
    this.moonHull = new Mesh(new SphereGeometry(1, 36, 24), hullMat(2.2));
    this.moonHull.renderOrder = -91;
    this.moonHull.frustumCulled = false;
    sc.add(this.moonHull, this.moon);
    this.sun = new Mesh(new SphereGeometry(1, 28, 18), sunMat());
    this.sun.renderOrder = -89;
    this.sun.frustumCulled = false;
    this.sun.visible = false;
    sc.add(this.sun);
    this.camp.sinai.add(this.autumn.group);
    sc.add(this.gilgal.group, this.temple.group, this.ruth.group, this.gate.group, this.village.group, this.jerusalem.group, this.sevens.group);
    sc.add(this.blowfx.vert, this.blowfx.flat);

    // ---- 材質
    const mGround = litMat({ base: 'paper', angle: 0, angle2: 0, space: 5.4, seed: 2, bias: -0.26 });
    const mHill = litMat({ base: 'paper', angle: 4, angle2: 0, space: 5.0, seed: 6, bias: -0.3 });
    const mMud = litMat({ base: FIXED.ochre, angle: 86, angle2: 8, space: 4.8, seed: 3, cross: true });
    const mMudPaper = litMat({ base: 'paper', angle: 84, angle2: 6, space: 5, seed: 4 });
    const mWood = litMat({ base: '#6e5433', angle: 74, angle2: 10, space: 4.4, seed: 5 });
    const mTrunk = litMat({ base: '#8f7145', angle: 82, angle2: 10, space: 4.6, seed: 7, cross: true });
    const mFrond = litMat({ base: '#5c5836', angle: 28, angle2: 28, space: 4.6, seed: 8, side: DoubleSide, sway: true });
    const mSilh = litMat({ base: 'silh' });
    const mBlood = litMat({ base: FIXED.blood, line: '#3a0c09', angle: 20, space: 4.6, bias: 0.25 });
    this.doorGlowMat = glowMat({ hatch: 0.75, edge: '#2a1c0a' });
    this.spillMat = glowMat({ spill: true });

    // ---- 地面與遠山
    const ground = new Mesh(new PlaneGeometry(9000, 9000), mGround);
    ground.rotation.x = -Math.PI / 2;
    sc.add(ground);
    this.ground = ground;
    const hill = (x: number, z: number, sx: number, sy: number, sz: number) => {
      const m = new Mesh(new SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), mHill);
      m.position.set(x, 0, z);
      m.scale.set(sx, sy, sz);
      this.night.add(m);
    };
    hill(-120, -170, 100, 15, 55);
    hill(150, -200, 120, 20, 60);
    hill(0, -260, 170, 12, 50);
    hill(-260, -60, 90, 13, 80);
    hill(60, -78, 58, 15.5, 42); // 埃及城所在的山丘
    hill(OX + 70, -150, 110, 16, 55);
    hill(OX - 90, -170, 100, 12, 50);

    // ---- 以色列人的村子：主角的家在 x=0，鄰舍分列兩側
    this.buildVillage(mMud, mMudPaper, mWood, mSilh, mBlood);

    // ---- 椰棗樹
    const palmSets = [
      { t: palmTrunkGeo(7.5, 0.9), f: palmFrondsGeo(7.5, 0.9, 3) },
      { t: palmTrunkGeo(6.2, -0.7), f: palmFrondsGeo(6.2, -0.7, 9) },
      { t: palmTrunkGeo(8.6, 1.1), f: palmFrondsGeo(8.6, 1.1, 14) },
    ];
    const palmAt = (parent: Group, x: number, z: number, kind: number, yaw: number, scale = 1) => {
      const g = new Group();
      const ps = palmSets[kind];
      g.add(solid(ps.t, mTrunk, 2.4));
      g.add(new Mesh(ps.f, mFrond));
      g.position.set(x, 0, z);
      g.rotation.y = yaw;
      g.scale.setScalar(scale);
      parent.add(g);
    };
    palmAt(this.night, -6.2, -7.5, 0, 0.4, 1.1);
    palmAt(this.night, 11.5, -9, 2, 2.2);
    palmAt(this.night, -17.5, 3.2, 1, 1.3);
    palmAt(this.night, 20.5, 5.5, 0, 3.6, 0.95);
    palmAt(this.night, -28, -4, 2, 0.8);
    palmAt(this.night, 31, -6, 1, 2.9);
    palmAt(this.night, -13, 8.5, 1, 1.6, 0.9);
    palmAt(this.day, OX + 7.5, -2, 0, 2.0, 1.1);
    palmAt(this.day, OX - 9, -6, 2, 0.5);

    // ---- 大麥田
    const bg = barleyGeo();
    const bm = litMat({ base: FIXED.ochre, parts: ['#a07f4f', '#c6a96c'], partAlt: '#7e6b3d', angle: 80, space: 5, wind: true, seed: 9 });
    // 三群麥株：A 在鏡頭下降的路徑兩側（只在開場畫面用），B／C 是遠處與兩側（半夜到出發的前景也會用）
    const groups = [2000, 900, 500];
    const rnd = mulberry32(21);
    // 鏡頭走過麥田的路徑（xz），讓葉片不要貼在鏡頭上
    const path: number[][] = [[0.4, 38], [0.4, 30], [0.2, 21], [-0.4, 17], [-1.9, 8.2]];
    const nearPath = (x: number, z: number): boolean => {
      for (let k = 0; k < path.length - 1; k++) {
        const [ax, az] = path[k];
        const [bx, bz] = path[k + 1];
        const dx = bx - ax;
        const dz = bz - az;
        const t = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz));
        if (Math.hypot(x - (ax + dx * t), z - (az + dz * t)) < 1.5) return true;
      }
      return false;
    };
    groups.forEach((total, gi) => {
      const barley = new InstancedMesh(bg, bm, total);
      barley.frustumCulled = false;
      for (let i = 0; i < total; i++) {
        let x = 0;
        let z = 0;
        for (let tries = 0; tries < 8; tries++) {
          if (gi === 0) {
            x = (rnd() - 0.5) * 11 * (0.4 + rnd() * 0.6);
            z = 14 + rnd() * 18;
          } else if (gi === 1) {
            x = (rnd() - 0.5) * 40;
            z = 11.5 + rnd() * 28;
          } else {
            x = (rnd() - 0.5) * 90;
            z = 11.5 + rnd() * 44;
          }
          if (!nearPath(x, z)) break;
        }
        _dummy.position.set(x, 0, z);
        _dummy.rotation.set((rnd() - 0.5) * 0.12, rnd() * Math.PI * 2, (rnd() - 0.5) * 0.12);
        const h = 0.62 + rnd() * 0.34;
        _dummy.scale.set(0.9 + rnd() * 0.7, h, 1);
        _dummy.updateMatrix();
        barley.setMatrixAt(i, _dummy.matrix);
        _col.setRGB(rnd(), 0, 0);
        barley.setColorAt(i, _col);
      }
      this.barleyGroups.push(barley);
      this.night.add(barley);
    });
    // ---- 羊羔（day-10 被牽到主角家門口拴好）
    const lmat = litMat({ base: 'paper', parts: ['#e9e1cc', '#14110e'], angle: 52, space: 4.4, seed: 12 });
    this.lamb = new Animal('lamb', lmat, 2.2, 12);
    this.lamb.baseScale = 1;
    this.night.add(this.lamb.group);
    const stake = new Mesh(new CylinderGeometry(0.04, 0.05, 0.6, 5), mWood);
    stake.position.set(1.45, 0.3, 0.95);
    this.lambProps.add(stake);
    const rope = new Mesh(new CylinderGeometry(0.012, 0.012, 1, 4), mSilh);
    {
      const a = new Vector3(1.45, 0.5, 0.95);
      const b = new Vector3(1.75, 0.62, 1.4);
      const dir = _v.copy(b).sub(a);
      rope.scale.y = dir.length();
      rope.position.copy(a).addScaledVector(dir, 0.5);
      rope.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), dir.normalize());
    }
    this.lambProps.add(rope);
    this.night.add(this.lambProps);
    // 牽羊羔的人：從畫面左邊走來，拴好後往右走開
    this.leader = new RigPerson({ staff: true, staffSide: 'R', belt: true, armL: [0.3, 0.14], armR: [0.5, 0.12], seed: 3 }, litMat({ base: FIXED.ochre, parts: ['#a88758', '#14110e', '#2b2218', '#4e3a22', '#14110e', '#d8cdb4'], angle: 40, space: 4.4, seed: 17 }));
    this.night.add(this.leader.group);
    this.ppl.push(this.leader);

    // ---- 埃及的城、宮殿與火炬
    const city = this.buildCity(mSilh);
    this.winMat = city.winMat;
    this.torchMat = city.torchMat;

    // ---- 埃及人的近屋（哀號那一幕的近景）
    this.buildNearEgypt(mMud, mSilh);

    // ---- 隊伍
    this.procG.visible = false;
    this.night.add(this.procG);
    this.buildProcession();
    const far = this.buildFarLine();
    this.farLine = far.group;
    this.farLineMesh = far.mesh;
    this.night.add(this.farLine);

    // ---- 隔日（應許之地）
    this.buildDay(mMud, mWood, mSilh);
    this.day.add(this.home.group);

  }

  // ------------------------------------------------------------- 村子
  private buildVillage(mMud: ShaderMaterial, mMudPaper: ShaderMaterial, mWood: ShaderMaterial, _mSilh: ShaderMaterial, mBlood: ShaderMaterial): void {
    const rnd = mulberry32(5);
    const frameG = doorFrameGeo();
    const leafG = doorLeafGeo();
    const glowG = new PlaneGeometry(1.5, 2.3);
    const winG = new PlaneGeometry(0.62, 0.52);
    const spillG = new PlaneGeometry(2.4, 2.3);
    const specs: { x: number; w: number; h: number; d: number; z: number; paper: boolean }[] = [{ x: 0, w: 7, h: 3.3, d: 5.2, z: 0, paper: false }];
    let cur = 3.5;
    for (let i = 0; i < 4; i++) {
      const w = 5.4 + rnd() * 2;
      specs.push({ x: cur + 0.9 + w / 2, w, h: 2.8 + rnd() * 0.9, d: 4.4 + rnd(), z: (rnd() - 0.5) * 1.1, paper: rnd() > 0.6 });
      cur += 0.9 + w;
    }
    cur = -3.5;
    for (let i = 0; i < 4; i++) {
      const w = 5.4 + rnd() * 2;
      specs.push({ x: cur - 0.9 - w / 2, w, h: 2.8 + rnd() * 0.9, d: 4.4 + rnd(), z: (rnd() - 0.5) * 1.1, paper: rnd() > 0.6 });
      cur -= 0.9 + w;
    }
    specs.forEach((sp, i) => {
      const g = new Group();
      g.position.set(sp.x, 0, sp.z);
      const body = houseBodyGeo({ w: sp.w, h: sp.h, d: sp.d, doorX: 0, tunnel: 1.6, roofHut: i % 3 === 1 });
      g.add(solid(body, sp.paper ? mMudPaper : mMud, 2.6));
      g.add(solid(frameG, mWood, 2.0));
      const pivot = new Group();
      pivot.position.set(-0.7, 0, -0.02);
      pivot.add(solid(leafG, mWood, 1.8));
      g.add(pivot);
      const glow = new Mesh(glowG, this.doorGlowMat);
      glow.position.set(0, 1.15, -1.58);
      g.add(glow);
      const spill = new Mesh(spillG, this.spillMat);
      spill.rotation.x = -Math.PI / 2;
      spill.position.set(0, 0.03, 1.15);
      spill.renderOrder = 4;
      g.add(spill);
      // 窗（只有部分人家）
      if (i === 0 || i % 2 === 1) {
        const wx = i === 0 ? 2.5 : sp.w * 0.28;
        const win = new Mesh(winG, this.doorGlowMat);
        win.position.set(wx, 1.9, 0.012);
        g.add(win);
        const wf = solid(new BoxGeometry(0.78, 0.68, 0.1), mWood, 1.6);
        wf.position.set(wx, 1.9, -0.05);
        g.add(wf);
      }
      // 血跡貼花：門楣、左門柱、右門柱
      const decals: DecalRig[] = [];
      const defs = [
        { x: 0, y: 2.46, size: [2.1, 0.7], rad: [0.66, 0.13] },
        { x: -0.9, y: 1.3, size: [0.62, 1.7], rad: [0.12, 0.6] },
        { x: 0.9, y: 1.3, size: [0.62, 1.7], rad: [0.12, 0.6] },
      ];
      defs.forEach((df, k) => {
        const mat = decalMat();
        (mat.uniforms.uSize.value as { set: (a: number, b: number) => void }).set(df.size[0], df.size[1]);
        (mat.uniforms.uRad.value as { set: (a: number, b: number) => void }).set(df.rad[0], df.rad[1]);
        mat.uniforms.uSeed.value = 1.7 + i * 3.1 + k * 7.3;
        const mesh = new Mesh(new PlaneGeometry(df.size[0], df.size[1]), mat);
        mesh.position.set(df.x, df.y, 0.236);
        mesh.renderOrder = 5;
        mesh.visible = false;
        g.add(mesh);
        decals.push({ mesh, mat, grow: 0 });
      });
      this.night.add(g);
      const rig: HouseRig = {
        group: g,
        x: sp.x,
        leafPivot: pivot,
        decals,
        door: new Vector3(sp.x, 1.25, sp.z + 0.25),
        delay: i === 0 ? 0 : 0.25 + rnd() * 0.9,
        markT: 0,
        d: rnd(),
      };
      this.houses.push(rig);
    });
    this.hero = this.houses[0];

    // 主角家的門內人影（dusk-street 把盆端出來）、門口的盆與羊羔的血盆
    const mDoorMan = litMat({ base: '#10132a', line: '#6b5a3a', angle: 62, angle2: 20, space: 4.6, bias: -0.1, seed: 41, parts: ['#10132a', '#0d0f1f', '#0d0f1f', '#10132a', '#10132a', '#10132a'] });
    this.doorwayPerson = new RigPerson({ belt: true, armL: [0.06, 0.12], armR: [0.06, 0.12], seed: 8 }, mDoorMan);
    this.doorwayPerson.group.position.set(0, 0, -0.35);
    this.hero.group.add(this.doorwayPerson.group);
    this.ppl.push(this.doorwayPerson);

    const bs = basinGeo();
    const mBowl = litMat({ base: '#7b5a39', angle: 20, space: 4.4, seed: 13 });
    this.basinG.add(solid(bs.bowl, mBowl, 2.2));
    this.basinG.add(new Mesh(bs.blood, mBlood));
    this.basinG.position.copy(this.basinPos);
    this.basinG.visible = false;
    this.night.add(this.basinG);
  }

  // ------------------------------------------------------------- 埃及的城
  private buildCity(mSilh: ShaderMaterial): { winMat: ShaderMaterial; torchMat: ShaderMaterial } {
    const rnd = mulberry32(31);
    const hillH = (x: number, z: number) => {
      const dx = (x - 60) / 58;
      const dz = (z + 78) / 42;
      const v = 1 - dx * dx - dz * dz;
      return v > 0 ? 15.5 * Math.sqrt(v) : 0;
    };
    const boxes: Part[] = [];
    const wins: { x: number; y: number; z: number; th: number }[] = [];
    for (let i = 0; i < 60; i++) {
      const x = 18 + rnd() * 84;
      const z = -118 + rnd() * 78;
      const y0 = hillH(x, z);
      if (y0 < 0.6) continue;
      if (x > 44 && x < 76 && z > -90 && z < -66) continue;
      const w = 4 + rnd() * 5;
      const h = 3.5 + rnd() * 6;
      const d = 4 + rnd() * 4;
      boxes.push({ g: new BoxGeometry(w, h, d), m: T(x, y0 - 0.8 + h / 2, z) });
      const nw = 1 + Math.floor(rnd() * 3);
      for (let k = 0; k < nw; k++) {
        wins.push({ x: x + (rnd() - 0.5) * (w - 1.6), y: y0 - 0.8 + h * (0.4 + rnd() * 0.4), z: z + d / 2 + 0.04, th: 0.05 + rnd() * 0.95 });
      }
    }
    // 宮殿
    const py = 15.2;
    const pal: Part[] = [
      { g: new BoxGeometry(26, 9, 10), m: T(60, py + 4.5, -78) },
      { g: new BoxGeometry(14, 4, 8), m: T(60, py + 11, -78) },
      { g: new BoxGeometry(5, 15, 5), m: T(46.5, py + 7.5, -75) },
      { g: new BoxGeometry(5, 15, 5), m: T(73.5, py + 7.5, -75) },
      { g: new BoxGeometry(10, 6, 8), m: T(41, py + 3, -81) },
      { g: new BoxGeometry(10, 6, 8), m: T(79, py + 3, -81) },
    ];
    for (let i = 0; i < 6; i++) pal.push({ g: new CylinderGeometry(0.7, 0.8, 8.4, 7), m: T(51 + i * 3.6, py + 4.2, -72.6) });
    const cityGeo = mergeParts([...boxes, ...pal]);
    const cityM = solid(cityGeo, mSilh, 1.3);
    this.night.add(cityM);
    // 宮殿正面的窗
    for (let k = 0; k < 5; k++) wins.push({ x: 53 + k * 3.5, y: py + 5.2, z: -72.9, th: 0.02 + rnd() * 0.98 });
    wins.push({ x: 46.5, y: py + 12, z: -72.4, th: 0.4 }, { x: 73.5, y: py + 12, z: -72.4, th: 0.7 });

    const winMat = glowMat({ hatch: 0.25 });
    const winMesh = new InstancedMesh(new PlaneGeometry(1, 1.3), winMat, wins.length);
    winMesh.frustumCulled = false;
    wins.forEach((w, i) => {
      _dummy.position.set(w.x, w.y, w.z);
      _dummy.rotation.set(0, 0, 0);
      _dummy.scale.set(1, 1, 1);
      _dummy.updateMatrix();
      winMesh.setMatrixAt(i, _dummy.matrix);
      _col.setRGB(w.th, 0, 0);
      winMesh.setColorAt(i, _col);
    });
    this.night.add(winMesh);

    // 火炬
    const torchM = glowMat({ on: '#f0c46a', edge: '#b24a14', hatch: 0.9, flick: 0.35, fixedFlick: true });
    const tg = solid(torchGeo(), mSilh, 1.5);
    for (const x of [51.5, 68.5]) {
      const t = tg.clone();
      t.position.set(x, py, -69.5);
      this.night.add(t);
      const fl = new Mesh(flameGeo(), torchM);
      fl.position.set(x, py + 1.8, -69.5);
      fl.scale.setScalar(6);
      this.night.add(fl);
    }
    const tf: [number, number, number][] = [[51.5, py + 2.1, -69.5], [68.5, py + 2.1, -69.5]];
    this.fxTorchSpark = makeFx('spark', tf, 9, 0.3, 11);
    this.fxTorchSmoke = makeFx('smoke', tf, 5, 1.3, 12);
    this.night.add(this.fxTorchSpark.mesh, this.fxTorchSmoke.mesh);
    return { winMat, torchMat: torchM };
  }

  // ------------------------------------------------------------- 近景的埃及人家
  private buildNearEgypt(mMud: ShaderMaterial, mSilh: ShaderMaterial): void {
    const g = new Group();
    g.position.set(47.5, 0, -22);
    g.rotation.y = 0.38;
    g.scale.setScalar(1.5);
    const w = 7;
    const h = 3.5;
    const d = 5.2;
    const td = 1.5;
    const wx0 = -2.2;
    const wx1 = -0.55;
    const sill = 0.7;
    const top = 2.45;
    const parts: Part[] = [
      { g: new BoxGeometry(wx0 + w / 2, h, td), m: T((wx0 - w / 2) / 2, h / 2, -td / 2) },
      { g: new BoxGeometry(w / 2 - wx1, h, td), m: T((wx1 + w / 2) / 2, h / 2, -td / 2) },
      { g: new BoxGeometry(wx1 - wx0, sill, td), m: T((wx0 + wx1) / 2, sill / 2, -td / 2) },
      { g: new BoxGeometry(wx1 - wx0, h - top, td), m: T((wx0 + wx1) / 2, top + (h - top) / 2, -td / 2) },
      { g: new BoxGeometry(w, h, d - td), m: T(0, h / 2, -td - (d - td) / 2) },
      { g: new BoxGeometry(w + 0.3, 0.22, d + 0.3), m: T(0, h + 0.1, -d / 2) },
    ];
    g.add(solid(mergeParts(parts), mMud, 2.6));
    const wcx = (wx0 + wx1) / 2;
    const room = new Mesh(new PlaneGeometry(wx1 - wx0 + 0.2, top - sill + 0.2), glowMat({ hatch: 0.7, edge: '#2a1c0a' }));
    room.position.set(wcx, (sill + top) / 2, -td + 0.02);
    g.add(room);
    // 床與俯身的人影
    const mBed = litMat({ base: '#6e5433', angle: 70, space: 4.4 });
    const bed = solid(bedGeo(), mBed, 1.6);
    bed.position.set(wcx + 0.05, 0.2, -0.95);
    g.add(bed);
    this.bender = new RigPerson({ bow: 0.95, armL: [0.9, 0.15], armR: [0.9, 0.15], wrap: true, outline: 2.0, seed: 21 }, mSilh);
    this.bender.group.position.set(wcx - 0.12, 0, -0.45);
    this.bender.group.rotation.y = Math.PI;
    g.add(this.bender.group);
    this.ppl.push(this.bender);
    this.night.add(g);
  }

  // ------------------------------------------------------------- 出埃及的隊伍
  private buildProcession(): void {
    const rnd = mulberry32(77);
    const mP = litMat({ base: FIXED.ochre, parts: ['#a88758', '#14110e', '#2b2218', '#4e3a22', '#14110e', '#d8cdb4'], partAlt: '#cdbf9e', angle: 40, space: 4.4, seed: 14 });
    const mSheep = litMat({ base: 'paper', parts: ['#e9e1cc', '#14110e'], angle: 50, space: 4.4, seed: 15 });
    const mCow = litMat({ base: '#6b5030', parts: ['#6b5030', '#14110e'], angle: 50, space: 4.4, seed: 16 });
    const A: PersonOpts = { bundle: true, staff: false, belt: true, armL: [0.1, 0.15], armR: [0.55, 0.1], low: true };
    const B: PersonOpts = { staff: true, staffSide: 'R', belt: true, armL: [0.2, 0.15], armR: [0.35, 0.15], low: true };
    const peopleA = new PersonCrowd(personGeo(A), mP, 22, 1.8);
    const peopleB = new PersonCrowd(personGeo(B), mP, 18, 1.8);
    const sheep = new AnimalCrowd('lamb', mSheep, 22, 1.5);
    const cattle = new AnimalCrowd('cow', mCow, 8, 1.5);
    this.procG.add(peopleA.group, peopleB.group, sheep.group, cattle.group);
    const mk = (n: number, startX: number, gap: number, zLo: number, zHi: number, scLo: number, scHi: number, items: { ph: number; sc: number; z: number }[]): number[] => {
      const x0: number[] = [];
      for (let i = 0; i < n; i++) {
        x0.push(startX + i * gap + rnd() * gap * 0.8);
        items[i].z = zLo + rnd() * (zHi - zLo);
        items[i].sc = scLo + rnd() * (scHi - scLo);
        items[i].ph = rnd() * 6.28;
      }
      return x0;
    };
    this.procPeople.push({ crowd: peopleA, x0: mk(22, 3, 4.4, 6.8, 9.4, 0.95, 1.06, peopleA.items) });
    this.procPeople.push({ crowd: peopleB, x0: mk(18, 4.2, 5.2, 4.8, 7.2, 0.95, 1.08, peopleB.items) });
    this.procAnimals.push({ crowd: sheep, x0: mk(22, 2, 4.4, 8.2, 10.6, 0.85, 1.15, sheep.items) });
    this.procAnimals.push({ crowd: cattle, x0: mk(8, 6, 12, 4.4, 6.2, 0.95, 1.1, cattle.items) });
    // 腳下的塵土：每個人身後兩團
    const org: [number, number, number][] = [];
    for (const g of this.procPeople) g.x0.forEach((x, i) => org.push([x, 0, g.crowd.items[i].z]));
    this.fxDust = makeFx('dust', org, 2, 1.1, 41);
    this.procG.add(this.fxDust.mesh);
  }

  private buildFarLine(): { group: Group; mesh: InstancedMesh } {
    const mSil = litMat({ base: 'silh' });
    const g = new Group();
    const r = solidInstanced(personGeo({ bundle: true, belt: false, low: true, tiny: true }), mSil, 70, 0);
    g.add(r.group);
    const rnd = mulberry32(5);
    for (let i = 0; i < 70; i++) {
      _dummy.position.set(-150 + i * 1.5 + rnd() * 0.5, 0, -150 - rnd() * 4);
      _dummy.rotation.set(0, -Math.PI / 2, 0);
      _dummy.scale.setScalar(2.4);
      _dummy.updateMatrix();
      r.main.setMatrixAt(i, _dummy.matrix);
    }
    r.main.instanceMatrix.needsUpdate = true;
    g.visible = false;
    return { group: g, mesh: r.main };
  }

  // ------------------------------------------------------------- 日後
  private buildDay(mMud: ShaderMaterial, mWood: ShaderMaterial, mSilh: ShaderMaterial): void {
    void mSilh;
    const g = this.day;
    g.position.set(OX, 0, 0);
    // 主屋與兩側鄰居
    const frameG = doorFrameGeo();
    const body = houseBodyGeo({ w: 6.6, h: 3.2, d: 5, doorX: 0, tunnel: 1.6 });
    g.add(solid(body, mMud, 2.6));
    g.add(solid(frameG, mWood, 2.0));
    const glow = new Mesh(new PlaneGeometry(1.5, 2.3), this.doorGlowMat);
    glow.position.set(0, 1.15, -1.58);
    g.add(glow);
    const l = houseBodyGeo({ w: 6, h: 2.9, d: 4.6, doorX: 1.4, tunnel: 1.6 });
    const left = solid(l, mMud, 2.6);
    left.position.set(-7.4, 0, -0.4);
    g.add(left);
    this.leftHouse = left;
    const r = houseBodyGeo({ w: 5.6, h: 3.4, d: 4.6 });
    const right = solid(r, mMud, 2.6);
    right.position.set(7.2, 0, -0.8);
    g.add(right);
    // 父親與孩子：背對鏡頭看著門框
    const mFather = litMat({ base: FIXED.ochre, parts: ['#a88758', '#14110e', '#2b2218', '#4e3a22', '#14110e', '#d8cdb4'], angle: 40, space: 4.4, seed: 17 });
    const mChild = litMat({ base: FIXED.ochre, parts: ['#cdbf9e', '#14110e', '#3a2e22', '#4e3a22', '#14110e', '#d8cdb4'], angle: 40, space: 4.4, seed: 18 });
    this.father = new RigPerson({ staff: true, staffSide: 'R', belt: true, slim: true, armL: [0.25, 0.14], armR: [0.5, 0.12], seed: 31, outline: 2.4 }, mFather);
    this.father.group.position.set(0.95, 0, 2.3);
    this.father.group.rotation.y = Math.PI - 0.35;
    this.childrenPair.add(this.father.group);
    this.child = new RigPerson({ scale: 0.56, armL: [0.35, 0.95], armR: [1.45, 0.45], wrap: true, kid: true, seed: 32 }, mChild);
    this.child.group.position.set(0.25, 0, 2.4);
    this.child.group.rotation.y = Math.PI + 0.1;
    this.childrenPair.add(this.child.group);
    this.ppl.push(this.father, this.child);
    g.add(this.childrenPair);
    g.visible = false;
  }

  // ------------------------------------------------------------- 每幀
  /**
   * 設定鏡頭（含 fitW 的寬度保證與微漂移）、月亮、光線、天空。
   * panel：meal 分格在畫面上的位置（CSS px）；沒有分格時傳 null。
   */
  updateScene(fr: Frame, tr: TrackOut, W: number, H: number, panel: { x: number; y: number; w: number; h: number } | null): void {
    const s = fr.s;
    const aspect = W / Math.max(H, 1);
    const cam = this.camera;
    const c = tr.cam;
    const mobileUI = W <= 720;
    // 以 view offset 平移整個畫面（不動鏡頭本身）：shiftPx > 0 把畫面推向右，shiftY > 0 把畫面推向上
    let shiftPx = 0;
    let shiftY = 0;
    // 說明框收起時，留給說明框的推移（左右／往上）依 fold 歸零；有互動按鈕留著的拍不歸零（foldReliefAt）
    const relief = 1 - (fr.fold ?? 0) * foldReliefAt(s);
    // 各 cue 的 UP 是照說明框最高 66svh 調的；說明框上限改成 50svh 後可用的上方空間變大，整體少推 boxEaseAt，主體落在新可用帶的中段
    if (mobileUI) shiftY = Math.max(0, upShiftAt(s) - boxEaseAt(s)) * H * relief;
    const aw = mobileUI ? 0 : smooth(1.05, 1.3, aspect);
    if (aw > 0) {
      // 塗血那一拍：說明框固定在左邊，門＋盆＋把手整組擺在右側
      const wH = aw * smooth(cu('hyssop', -0.4), cu('hyssop', 0.15), s) * (1 - smooth(cu('hyssop', 1.0), cu('hyssop', 1.3), s));
      if (wH > 0) {
        const left = W * 0.47;
        const right = W - Math.max(140, W * 0.1);
        const span = 3.9;
        const pxm = Math.max(120, right - left) / span;
        const fv = 40;
        const dist = W / pxm / (2 * Math.tan(fv * 0.5 * RAD) * aspect);
        const P = DESK_HYSSOP;
        P[0] = 0.22;
        P[1] = 1.5;
        P[2] = dist;
        P[3] = 0.05;
        P[4] = 1.22;
        P[5] = 0;
        P[6] = fv;
        P[7] = 0;
        for (let i = 0; i < 8; i++) c[i] = lerp(c[i], P[i], wH);
        shiftPx += wH * ((left + right) * 0.5 - W * 0.5);
      }
      // 日後：說明框改放左邊，父子與門框往右偏
      const wC = aw * smooth(cu('children', -0.3), cu('children', -0.03), s) * (1 - smooth(CUT['bake'] - 0.2, CUT['bake'] - 0.03, s));
      shiftPx += wC * W * 0.1 * relief;
      // 其餘拍：依各拍的說明框在左或右，把主體推向另一側
      shiftPx += aw * dxShiftAt(s) * W * relief;
    }
    // 吃羊羔：DOM 分格是「屋內」，有血的那扇門整個擺在分格正下方（桌機）／分格與說明框之間（手機）
    const wM = smooth(cu('meal', -0.25), cu('meal', 0.25), s) * (1 - smooth(cu('meal', 0.85), cu('meal', 1.3), s));
    if (wM > 0) {
      const panelBottom = panel ? panel.y + panel.h : H * 0.5;
      const panelCx = panel ? panel.x + panel.w * 0.5 : W * 0.5;
      const floorY = mobileUI ? H * 0.615 : H - 22;
      const pxm = clamp((floorY - panelBottom) / 2.95, 26, 90);
      const fv = 40;
      const dist = H / (2 * pxm * Math.tan(fv * 0.5 * RAD));
      const P = DESK_MEAL;
      P[0] = 0;
      P[1] = 1.6;
      P[2] = dist;
      P[3] = 0;
      P[4] = 1.6;
      P[5] = 0;
      P[6] = fv;
      P[7] = 0;
      for (let i = 0; i < 8; i++) c[i] = lerp(c[i], P[i], wM);
      // 地面線要落在 floorY：沒位移時地面在 H/2 + 1.6·pxm
      const needDown = floorY - (H * 0.5 + 1.6 * pxm);
      shiftY = lerp(shiftY, -needDown, wM);
      shiftPx += wM * (panelCx - W * 0.5);
    }
    const drift = fr.motionOff ? 0 : 1;
    // 手持漂移：幅度隨鏡頭到目標的距離略增（遠景才看得出來）
    const dd = Math.hypot(c[0] - c[3], c[1] - c[4], c[2] - c[5]);
    const amp = Math.min(0.14, 0.03 + 0.0028 * dd);
    const dx = Math.sin(fr.time * 0.31) * amp * drift;
    const dy = Math.sin(fr.time * 0.23 + 1.3) * amp * 0.7 * drift;
    let px = c[0] + dx;
    let py = c[1] + dy;
    let pz = c[2];
    const tx = c[3];
    const ty = c[4] + dy * 0.5;
    const tz = c[5];
    const fov = c[6];
    const fitW = c[7];
    if (fitW > 0) {
      const dX = px - tx;
      const dY = py - ty;
      const dZ = pz - tz;
      const dist = Math.hypot(dX, dY, dZ);
      const need = fitW * 0.5 / (Math.tan(fov * 0.5 * RAD) * aspect);
      if (dist < need) {
        const k = need / dist;
        px = tx + dX * k;
        py = ty + dY * k;
        pz = tz + dZ * k;
      }
    }
    cam.fov = fov;
    cam.aspect = aspect;
    cam.position.set(px, py, pz);
    cam.lookAt(tx, ty, tz);
    // 吹角：鏡頭震動，幅度正比於 story.blow.level，最大約畫面高度的 0.6%（讀者觸發，動態關也照常）
    const bl = story.blow.level;
    if (bl > 0.001) {
      const amp = bl * 0.006 * H * 0.62;
      shiftPx += (Math.sin(fr.time * 61.3) + 0.6 * Math.sin(fr.time * 97.1 + 1.3)) * amp;
      shiftY += (Math.sin(fr.time * 53.7 + 0.7) + 0.6 * Math.sin(fr.time * 89.9)) * amp;
    }
    if (Math.abs(shiftPx) > 0.5 || Math.abs(shiftY) > 0.5) cam.setViewOffset(W, H, -shiftPx, shiftY, W, H);
    else if (cam.view !== null) cam.clearViewOffset();
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();

    // 光線
    const L = tr.light;
    U.uLightDir.value.set(L[0], L[1], L[2]).normalize();
    U.uAmb.value = L[3];
    U.uGain.value = L[4];
    U.uWind.value = fr.motionOff ? 0 : 1 + 0.7 * smooth(cu('count', -0.1), cu('count', 0.2), s) * (1 - smooth(cu('count', 0.9), cu('two-loaves', 0.3), s));

    // 天空
    const sk = this.skyM.uniforms;
    (sk.uInvProj.value as Matrix4).copy(cam.projectionMatrixInverse);
    (sk.uCamWorld.value as Matrix4).copy(cam.matrixWorld);
    sk.uHorizon.value = tr.sky[0];
    sk.uStars.value = tr.sky[1];
    sk.uSkyDay.value = tr.sky[2];
    sk.uTwinkle.value = fr.motionOff ? 0 : 1;
    (sk.uHorizonCol.value as Vector3).lerpVectors(BLOOD, AMBER, tr.sky[3]);

    // 月亮：方位角／仰角是世界固定的方向；相位由 day 決定，光源方向在視圖空間
    const az = tr.moon[0];
    const el = tr.moon[1] * RAD;
    const ang = tr.moon[2] * RAD;
    _v.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
    let angUse = ang;
    const wMoon = mobileUI ? tr.moonS[0] : 0;
    if (wMoon > 0.001) {
      // 手機：依指定的畫面位置反推方向（要扣掉 view offset 的位移）
      const e = cam.matrixWorld.elements;
      const tanV = Math.tan(cam.fov * 0.5 * RAD);
      const xN = tr.moonS[1] * 2 - 1;
      const yN = 1 - 2 * (tr.moonS[2] + shiftY / H);
      _m.set(
        -e[8] + e[0] * xN * tanV * aspect + e[4] * yN * tanV,
        -e[9] + e[1] * xN * tanV * aspect + e[5] * yN * tanV,
        -e[10] + e[2] * xN * tanV * aspect + e[6] * yN * tanV,
      ).normalize();
      _v.lerp(_m, wMoon).normalize();
      angUse = lerp(ang, ang * 0.8, wMoon);
    }
    this.moon.position.copy(cam.position).addScaledVector(_v, MOON_R);
    const r = MOON_R * Math.tan(angUse / 2);
    this.moon.scale.setScalar(r);
    this.moonHull.position.copy(this.moon.position);
    this.moonHull.scale.setScalar(r);
    const showMoon = tr.sky[2] < 0.5 && (tr.moon[1] > -3);
    this.moon.visible = showMoon;
    this.moonHull.visible = showMoon;
    // 太陽（夏日過場、贖罪日、清晨）
    if (tr.sun[1] > -3) {
      const sa = tr.sun[0];
      const se = tr.sun[1] * RAD;
      _v.set(Math.sin(sa) * Math.cos(se), Math.sin(se), -Math.cos(sa) * Math.cos(se));
      this.sun.position.copy(cam.position).addScaledVector(_v, MOON_R * 0.98);
      this.sun.scale.setScalar(MOON_R * 0.98 * Math.tan((tr.sun[2] * RAD) / 2));
      this.sun.visible = true;
    } else this.sun.visible = false;
    this.dayK = tr.sky[2];
    // 月相 1–30：初一細鉤（亮面朝右＝西）、十四滿月、十五起由西側（畫面右）開始虧缺、二十一約下弦
    const inSinai = s >= CUT['sinai'] && s < CUT['echo-hezekiah'];
    // 七的節奏的夜：月相固定在近滿（日數牌沒有 day）；sv-egypt 是逾越節的夜（十四日）；coda 回到開場的新月（初一）
    const day = inCoda(s) ? 1 : worldAt(s) === 'sevens' ? 12 : inEgyptReplay(s) ? 14 : tr.moonDay > 0 ? tr.moonDay : inSinai ? 14 : story.day;
    let th: number;
    let ly: number;
    if (day <= 14) {
      const dayN = clamp((day - 1) / 13);
      th = lerp(0.26 * Math.PI, Math.PI, dayN);
      ly = 0.28 * (1 - dayN);
    } else if (day <= 21) {
      th = lerp(Math.PI, 1.5 * Math.PI, clamp((day - 14) / 7));
      ly = 0.1 * smooth(14, 21, day);
    } else {
      th = lerp(1.5 * Math.PI, 1.8 * Math.PI, clamp((day - 21) / 9));
      ly = 0.1 + 0.18 * smooth(21, 30, day);
    }
    (this.moonM.uniforms.uLightV.value as Vector3).set(Math.sin(th), ly, -Math.cos(th));

    // 夜與日兩個世界的可見性
    const w = worldAt(s);
    this.night.visible = w === 'night';
    this.day.visible = w === 'home';
    this.camp.succoth.visible = w === 'succoth';
    this.camp.sinai.visible = w === 'sinai';
    this.fields.barley.visible = w === 'barley';
    this.fields.wheat.visible = w === 'wheat';
    this.gilgal.group.visible = w === 'gilgal';
    this.temple.group.visible = w === 'temple';
    this.ruth.group.visible = w === 'ruth';
    this.gate.group.visible = w === 'gate';
    this.village.group.visible = w === 'booths';
    this.jerusalem.group.visible = w === 'roofs';
    this.ground.visible = w !== 'barley' && w !== 'wheat' && w !== 'ruth' && w !== 'gilgal' && w !== 'booths' && w !== 'sevens';
    this.camp.setAutumn(isAutumnCamp(s), 17.5, 12.5);
  }

  updateObjects(fr: Frame): void {
    const sReal = fr.s;
    const dt = fr.dt;
    // 夜景（埃及街道）的物件狀態：sv-egypt 重演「門已關、血在門框上」；coda-night 回到開場的第一個畫面（一律當作 s = 0）
    const egy = inEgyptReplay(sReal);
    const coda = inCoda(sReal);
    const s = coda ? 0 : egy ? cu('door-shut', 0.9) : sReal;
    const idx = coda ? 0 : egy ? CUE_IDX['door-shut'] : fr.idx;

    // ---- 門：時間追蹤，播放不受 motionOff 影響
    const target = idx >= CUE_IDX['door-shut'] && s < DAY_S ? 1 : 0;
    const prevD = this.doorD;
    this.doorD = clamp(this.doorD + Math.sign(target - this.doorD) * (dt / 0.95), 0, 1);
    if (Math.abs(this.doorD - target) < 1e-4) this.doorD = target;
    let busy = this.doorD !== target;
    if (this.doorD >= 1 && prevD < 1 && !this.shutFired && !egy) {
      this.shutFired = true;
      this.onShut();
    }
    if (this.doorD < 0.5) this.shutFired = false;

    // ---- 血跡
    const marksOn = idx >= HYSSOP_IDX && s < DAY_S;
    const hy = story.hyssop;
    const hdone = hy.done || egy;
    this.doneTimer = marksOn && hdone ? (egy ? 99 : this.doneTimer + dt) : 0;
    for (let i = 0; i < this.houses.length; i++) {
      const hh = this.houses[i];
      // 門板與人影
      const Di = i === 0 ? this.doorD : clamp(this.doorD * 1.5 - 0.5 * hh.d, 0, 1);
      const ang = 1.65 * (1 - smooth(0.2, 1, Di));
      hh.leafPivot.rotation.y = ang;
      // 血跡
      if (i === 0) {
        for (let k = 0; k < 3; k++) {
          const dr = hh.decals[k];
          const want = marksOn && (egy || hy.marks[PARTS[k]]) ? 1 : 0;
          dr.grow = clamp(dr.grow + (want ? dt / 0.3 : -dt / 0.12) * (want || dr.grow > 0 ? 1 : 0), 0, 1);
          dr.mesh.visible = dr.grow > 0.001;
          dr.mat.uniforms.uGrow.value = dr.grow;
          if (dr.grow !== want) busy = true;
        }
      } else {
        hh.markT = marksOn && hdone ? clamp((this.doneTimer - hh.delay) / 0.5, 0, 1) : 0;
        if (marksOn && hdone && hh.markT < 1) busy = true;
        for (let k = 0; k < 3; k++) {
          const dr = hh.decals[k];
          dr.grow = clamp(hh.markT * 1.7 - k * 0.3, 0, 1);
          dr.mesh.visible = dr.grow > 0.001;
          dr.mat.uniforms.uGrow.value = dr.grow;
        }
      }
    }
    this.busy = busy;
    this.spillMat.uniforms.uOn.value = 1 - 0.55 * smooth(0.3, 1, this.doorD);
    const t = fr.time;
    const mo = !fr.motionOff;
    setGlowFlick(mo);

    // ---- 麥田分群（控制三角形數）
    const field = s < DAY_S;
    this.barleyGroups[0].visible = s < cu('day-14', 0.3);
    const wide = field && (s < cu('dusk-street', 0.3) || s >= cu('meal', 0.6));
    this.barleyGroups[1].visible = wide;
    this.barleyGroups[2].visible = wide;

    // ---- day-10：一個人牽著羊羔從畫面左邊走來，在門口拴好（隨捲動）；十四日黃昏羊羔被牽走
    this.updateDay10(s);
    // ---- dusk-street：門口的人把盆端出來放在門檻邊
    this.updateDusk(s);

    // ---- 埃及城：窗一扇一扇熄燈（黑暗掃過時）、火炬熄滅
    this.winMat.uniforms.uOff.value = windowOff(s);
    const ton = torchOn(s);
    this.torchMat.uniforms.uOn.value = ton;
    this.torchMat.uniforms.uFlick.value = mo ? 0.35 : 0;
    const nightOn = s < DAY_S;
    const sparkOn = mo && nightOn && ton > 0.01 ? ton : 0;
    this.fxTorchSpark.mat.uniforms.uOn.value = sparkOn;
    this.fxTorchSmoke.mat.uniforms.uOn.value = sparkOn;
    this.fxTorchSpark.mesh.visible = sparkOn > 0;
    this.fxTorchSmoke.mesh.visible = sparkOn > 0;

    // ---- wailing：亮窗裡俯身的人上身緩慢前後起伏
    const pw = lp(s, 'wailing');
    this.bender.bow = 0.95 + 0.13 * Math.sin(pw * 15) + 0.06 * Math.sin(pw * 6.3);
    this.bender.swingL = 0.9 + 0.2 * Math.sin(pw * 15 + 1);
    this.bender.swingR = 0.9 + 0.2 * Math.sin(pw * 15 + 2);

    // ---- 隊伍與塵土
    const procOn = s >= cu('wailing', 0.85) && s < DAY_S;
    this.procG.visible = procOn;
    if (procOn) this.updateProcession(s, t, mo);
    this.farLine.visible = s >= cu('depart', 0.55) && s < DAY_S;
    if (this.farLine.visible) {
      const k = smooth(cu('depart', 0.55), cu('vigil'), s);
      this.farLine.scale.set(1, k, 1);
      this.farLine.position.x = -3.2 * (s - cu('depart', 0.55));
    }

    // ---- children：孩子拉父親的衣角，父親轉身看向門框
    const pc = lp(s, 'children');
    this.father.group.rotation.y = lerp(Math.PI + 0.9, Math.PI - 0.35, smooth(0.25, 0.65, pc));
    this.father.headYaw = lerp(0.5, 0, smooth(0.3, 0.7, pc));
    this.child.swingL = 0.35 + 0.5 * Math.sin(pc * 34) * (1 - smooth(0.45, 0.65, pc));
    this.child.swingR = lerp(0.25, 1.45, smooth(0.5, 0.78, pc));
    this.child.splayR = lerp(0.2, 0.45, smooth(0.5, 0.78, pc));
    this.child.group.rotation.y = lerp(Math.PI + 0.7, Math.PI + 0.1, smooth(0.35, 0.7, pc));

    for (const r of this.ppl) r.update(t, mo);
    this.lamb.update(t, mo);

    // ---- 春季新場景（以下一律用真實的 s）
    const sr = sReal;
    this.childrenPair.visible = sr < CUT['bake'];
    this.leftHouse.visible = sr < CUT['no-leaven'];
    this.home.update(sr, t, mo);
    const wd = worldAt(sr);
    if (wd === 'succoth' || wd === 'sinai') this.camp.update(fr, sr);
    if (wd === 'barley' || wd === 'wheat') this.fields.update(fr, sr);
    if (wd === 'gilgal') this.gilgal.update(fr, sr);
    if (wd === 'temple') this.temple.update(fr, sr);
    if (wd === 'ruth') this.ruth.update(fr, sr);
    if (wd === 'gate') this.gate.update(fr, sr);
    if (wd === 'booths') this.village.update(fr, sr);
    if (wd === 'roofs') this.jerusalem.update(fr, sr);
    // 第三批：七的節奏的各個小地點（sevens 這個世界裡每個 cue 各有自己的地點）
    this.sevens.update(fr, sr);
    if (this.sevens.busy) this.busy = true;
    // 秋季：會幕院子的人物與器物、吹角的聲波
    this.autumn.update(fr, sr, this.dayK);
    this.camp.fireK = this.autumn.fireK;
    this.blowfx.update(dt, story.blow.level, isAutumnCamp(sr) && sr < CUT['echo-water-gate']);
    if (this.blowfx.busy) this.busy = true;
  }

  private updateDay10(s: number): void {
    const p = lp(s, 'day-10');
    const lead = this.leader;
    const lamb = this.lamb;
    const lg = smooth(cu('day-14', 0.8), cu('dusk-street', 0.05), s);
    const shown = s >= cu('day-10') && lg < 0.999;
    this.lambProps.visible = shown && p > 0.7;
    lamb.group.visible = shown;
    const inCue = s >= cu('day-10') && s < cu('day-14');
    lead.group.visible = inCue;
    // 牽的人
    let lx = lerp(-10, 0.9, smooth(0, 0.6, p));
    const lz = lerp(3.4, 2.2, smooth(0, 0.6, p));
    let yaw = Math.PI / 2 - 0.1;
    let bob = 0;
    lead.bow = 0;
    lead.twist = 0;
    if (p < 0.6) {
      bob = lead.gait(lx / 0.8, 1);
    } else if (p < 0.85) {
      yaw = lerp(Math.PI / 2 - 0.1, 2.1, smooth(0.6, 0.68, p));
      const dip = smooth(0.66, 0.72, p) * (1 - smooth(0.8, 0.85, p));
      lead.bow = 0.7 * dip;
      lead.swingL = 0.3 + 0.9 * dip;
      lead.swingR = 0.5;
      lead.twist = 0;
    } else {
      const e = smooth(0.85, 1, p);
      lx = lerp(0.9, 9, e);
      yaw = lerp(2.1, Math.PI / 2, smooth(0.85, 0.9, p));
      bob = lead.gait(lx / 0.8, 1);
    }
    lead.group.position.set(lx, bob, lz);
    lead.group.rotation.y = yaw;
    // 羊羔：跟在後面，之後走向拴羊的樁
    const e1 = smooth(0, 0.6, p);
    let ax = lerp(-10, 0.9, e1) - 1.5;
    let az = lerp(3.0, 1.9, e1);
    let ay = Math.PI / 2;
    if (p >= 0.55) {
      const k = smooth(0.55, 0.7, p);
      const e55 = smooth(0, 0.6, 0.55);
      ax = lerp(lerp(-10, 0.9, e55) - 1.5, 1.95, k);
      az = lerp(lerp(3.0, 1.9, e55), 1.55, k);
      ay = lerp(Math.PI / 2, 0.9, smooth(0.62, 0.78, p));
    }
    if (s >= cu('day-14')) {
      ax = 1.95;
      az = 1.55;
      ay = 0.9;
    }
    const walking = inCue && p < 0.7;
    lamb.stomp = !walking && p > 0.72;
    lamb.graze = !walking;
    lamb.group.position.set(ax + 7 * lg, 0, az);
    lamb.group.rotation.y = ay;
    lamb.baseScale = 1 - lg;
    if (walking) lamb.group.position.y = Math.abs(Math.sin(ax / 0.5)) * 0.03;
    else lamb.setBaseY(0);
  }

  private updateDusk(s: number): void {
    const person = this.doorwayPerson;
    const pd = lp(s, 'dusk-street');
    const door = this.doorD;
    // 位置：門內 → 走到盆邊 → 回到門內
    let x = 0;
    let z = -0.35;
    let yaw = 0;
    let bow = 0;
    let carry = 0;
    let bob = 0;
    const inDusk = s >= cu('dusk-street') && s < cu('hyssop');
    person.twist = 0;
    if (inDusk) {
      if (pd < 0.12) {
        carry = 1;
      } else if (pd < 0.5) {
        const e = smooth(0.12, 0.5, pd);
        x = lerp(0, -0.85, e);
        z = lerp(-0.35, 0.6, e);
        yaw = Math.atan2(-0.85, 0.95);
        carry = 1;
        bob = person.gait(e * 7, 1);
      } else if (pd < 0.72) {
        x = -0.85;
        z = 0.6;
        yaw = Math.atan2(-0.5, 0.35);
        const dip = smooth(0.5, 0.6, pd) * (1 - smooth(0.64, 0.72, pd));
        bow = 0.9 * dip;
        carry = 1 - smooth(0.58, 0.66, pd);
      } else {
        const e = smooth(0.72, 1, pd);
        x = lerp(-0.85, 0, e);
        z = lerp(0.6, -0.35, e);
        yaw = lerp(Math.atan2(0.85, -0.95), 0, smooth(0.9, 1, pd));
        bob = person.gait(e * 7, 1);
      }
    } else if (s >= cu('door-shut')) {
      z = -0.35 - 1.05 * smooth(0, 0.45, door);
    }
    person.bow = bow;
    person.group.position.set(x, bob, z);
    person.group.rotation.y = yaw;
    if (carry > 0.01) {
      person.swingL = 0.95 * carry + 0.06 * (1 - carry);
      person.swingR = 0.95 * carry + 0.06 * (1 - carry);
    } else {
      person.swingL = 0.06;
      person.swingR = 0.06;
    }
    // 盆：先在人手裡，放下後留在門檻邊
    const b = this.basinG;
    b.visible = s >= cu('dusk-street') && s < DAY_S;
    if (inDusk && pd < 0.72) {
      const k = smooth(0.5, 0.68, pd);
      const fx = x + Math.sin(yaw) * 0.45;
      const fz = z + Math.cos(yaw) * 0.45;
      b.position.set(lerp(fx, this.basinPos.x, k), lerp(0.85, 0.0, k), lerp(fz, this.basinPos.z, k));
    } else {
      b.position.copy(this.basinPos);
    }
    // 門內的人在關門前先退進屋裡（door-shut 以後）
    person.group.visible = door < 0.999 && s < DAY_S;
  }

  private updateProcession(s: number, t: number, mo: boolean): void {
    const dist = departDist(s);
    const stride = 0.78;
    for (const g of this.procPeople) {
      for (let i = 0; i < g.x0.length; i++) {
        const it = g.crowd.items[i];
        const phase = dist / stride + it.ph;
        it.x = g.x0[i] - dist;
        it.y = Math.abs(Math.sin(phase)) * 0.07;
        it.yaw = -Math.PI / 2 + 0.05;
      }
      g.crowd.update(t, mo);
    }
    for (const g of this.procAnimals) {
      for (let i = 0; i < g.x0.length; i++) {
        const it = g.crowd.items[i];
        const phase = dist / stride + it.ph;
        it.x = g.x0[i] - dist;
        it.y = Math.abs(Math.sin(phase)) * 0.04;
        it.yaw = -Math.PI / 2;
        it.roll = Math.sin(phase) * 0.03;
        it.walking = true;
      }
      g.crowd.update(t, mo, 0);
    }
    this.fxDust.mat.uniforms.uDist.value = dist;
  }

  get farLineRef(): InstancedMesh {
    return this.farLineMesh;
  }

  dispose(): void {
    this.scene.traverse((o) => {
      const m = o as Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as ShaderMaterial | ShaderMaterial[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else if (mat) mat.dispose();
    });
  }
}



















