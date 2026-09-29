import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as skClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { ARK_POINTS } from './ark';
import { DECK_Y, innerHalf } from './interior';
import { heightAt } from './terrain';
import { clamp, lerp, mulberry32, smooth, span } from './util';

/**
 * 動物、挪亞一家、鳥。經文沒有列出動物名單，這裡的種類只是舉例。
 * len：身長（公尺）；yaw：模型本身朝向的修正；walk：走路速度。
 */
interface Species { file: string; len: number; yaw: number; walk: number; gap: number }
export const SPECIES: Species[] = [
  { file: 'elephant', len: 6.0, yaw: 0, walk: 1.2, gap: 11 },
  { file: 'sheep', len: 1.3, yaw: 0, walk: 1.2, gap: 4 },
  { file: 'horse', len: 2.4, yaw: 0, walk: 1.4, gap: 6 },
  { file: 'camel', len: 3.0, yaw: 0, walk: 1.2, gap: 7 },
  { file: 'cow', len: 2.4, yaw: 0, walk: 1.2, gap: 6 },
  { file: 'giraffe', len: 4.2, yaw: 0, walk: 1.3, gap: 8 },
  { file: 'deer', len: 1.8, yaw: 0, walk: 1.4, gap: 5 },
  { file: 'lion', len: 2.4, yaw: 0, walk: 1.3, gap: 6 },
  { file: 'donkey', len: 2.0, yaw: 0, walk: 1.2, gap: 5 },
  { file: 'pig', len: 1.4, yaw: 0, walk: 1.1, gap: 4 },
  { file: 'stag', len: 2.0, yaw: 0, walk: 1.4, gap: 5 },
  { file: 'alpaca', len: 1.7, yaw: 0, walk: 1.2, gap: 5 },
  { file: 'wolf', len: 1.4, yaw: 0, walk: 1.4, gap: 4 },
  { file: 'bull', len: 2.6, yaw: 0, walk: 1.2, gap: 6 },
  { file: 'fox', len: 0.95, yaw: 0, walk: 1.4, gap: 3.5 },
  { file: 'horse_w', len: 2.4, yaw: 0, walk: 1.4, gap: 6 },
  { file: 'chicken', len: 0.45, yaw: 0, walk: 0.9, gap: 3 },
];

interface Walker {
  obj: THREE.Object3D;
  sp: Species;
  mixer?: THREE.AnimationMixer;
  walk?: THREE.AnimationAction;
  idle?: THREE.AnimationAction;
  eat?: THREE.AnimationAction;
  width: number;
  height: number;
  moving: boolean;
  phase: number;
}

type Loaded = Map<string, GLTF>;

/** 依模型邊框把身長縮放到 len，並把最長的水平軸轉到 +Z */
function normalize(obj: THREE.Object3D, sp: Species) {
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj, true);
  const size = box.getSize(new THREE.Vector3());
  const alongX = size.x > size.z;
  const len = Math.max(size.x, size.z);
  const s = sp.len / Math.max(len, 1e-6);
  const inner = new THREE.Group();
  inner.add(obj);
  obj.scale.multiplyScalar(s);
  obj.rotation.y += (alongX ? Math.PI / 2 : 0) + sp.yaw;
  inner.updateMatrixWorld(true);
  const b2 = new THREE.Box3().setFromObject(inner, true);
  const c = b2.getCenter(new THREE.Vector3());
  obj.position.x -= c.x;
  obj.position.z -= c.z;
  obj.position.y -= b2.min.y;
  const outer = new THREE.Group();
  outer.add(inner);
  return { outer, width: Math.min(size.x, size.z) * s, height: size.y * s };
}

function makeWalker(g: GLTF, sp: Species): Walker {
  const src = g.animations.length ? skClone(g.scene) : g.scene.clone(true);
  src.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
      m.frustumCulled = false;
    }
  });
  const { outer, width, height } = normalize(src, sp);
  const w: Walker = { obj: outer, sp, width, height, moving: false, phase: Math.random() * 10 };
  if (g.animations.length) {
    w.mixer = new THREE.AnimationMixer(src);
    const find = (n: string) => g.animations.find((a) => a.name === n);
    const walk = find('Walk'), idle = find('Idle'), eat = find('Eat');
    if (walk) w.walk = w.mixer.clipAction(walk);
    if (idle) w.idle = w.mixer.clipAction(idle);
    if (eat) w.eat = w.mixer.clipAction(eat);
    w.walk?.play();
    w.mixer.setTime(w.phase);
  }
  outer.visible = false;
  return w;
}

function setGait(w: Walker, moving: boolean, eat = false) {
  if (!w.mixer) return;
  const want = moving ? w.walk : eat && w.eat ? w.eat : w.idle ?? w.walk;
  const cur = [w.walk, w.idle, w.eat].find((a) => a && a.isRunning() && a.getEffectiveWeight() > 0.5);
  if (want && cur !== want) {
    want.reset().play();
    if (cur) want.crossFadeFrom(cur, 0.4, false);
  }
  w.moving = moving;
}

/** 折線路徑：以距離取點 */
class Path {
  pts: THREE.Vector3[];
  acc: number[] = [0];
  constructor(pts: THREE.Vector3[]) {
    this.pts = pts;
    for (let i = 1; i < pts.length; i++) this.acc.push(this.acc[i - 1] + pts[i].distanceTo(pts[i - 1]));
  }
  get length() {
    return this.acc[this.acc.length - 1];
  }
  at(s: number, pos: THREE.Vector3, dir: THREE.Vector3) {
    const L = this.length;
    const d = clamp(s, 0, L);
    let i = 1;
    while (i < this.acc.length - 1 && this.acc[i] < d) i++;
    const a = this.pts[i - 1], b = this.pts[i];
    const t = (d - this.acc[i - 1]) / Math.max(1e-6, this.acc[i] - this.acc[i - 1]);
    pos.lerpVectors(a, b, t);
    dir.subVectors(b, a).normalize();
    return pos;
  }
}

export function createLife(scene: THREE.Scene) {
  const group = new THREE.Group();
  scene.add(group);
  const pairs: [Walker, Walker][] = [];
  const figures: THREE.Object3D[] = [];
  let birds: { raven: THREE.Object3D; dove: THREE.Object3D; flock: THREE.Object3D[]; mixers: THREE.AnimationMixer[]; leaf?: THREE.Object3D } | null = null;
  let altar: THREE.Object3D | null = null;
  let ready = false;

  // ---------------------------------------------------------------- 路徑：從田野走到坡道、進門
  const onGround = (x: number, z: number) => new THREE.Vector3(x, heightAt(x, z), z);
  const walkPath = new Path([
    onGround(150, -240), onGround(118, -178), onGround(84, -122), onGround(52, -78), onGround(28, -48),
    ARK_POINTS.rampFoot.clone().setY(0.1), ARK_POINTS.doorSill.clone(), ARK_POINTS.doorSill.clone().add(new THREE.Vector3(0, 0, 6)),
  ]);
  const rampStart = walkPath.acc[5];
  const doorAt = walkPath.acc[6];
  const famPath = new Path([
    onGround(40, -66), onGround(24, -44), ARK_POINTS.rampFoot.clone().setY(0.1), ARK_POINTS.doorSill.clone(), ARK_POINTS.doorSill.clone().add(new THREE.Vector3(0, 0, 4)),
  ]);

  const P = new THREE.Vector3(), D = new THREE.Vector3(), side = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  // 一開始隊伍就已經排滿整條路
  let T = 220;
  const offsets: number[] = [];
  let totalGap = 0;
  const done: boolean[] = [];

  function place(w: Walker, pos: THREE.Vector3, dir: THREE.Vector3, bob: number) {
    w.obj.position.copy(pos);
    w.obj.rotation.set(0, Math.atan2(dir.x, dir.z), 0);
    if (!w.mixer && bob > 0) {
      // 沒有動畫的模型：用起伏和左右晃動假裝在走
      const ph = T * 3.2 + w.phase;
      w.obj.position.y += Math.abs(Math.sin(ph)) * 0.035 * w.sp.len * bob;
      w.obj.rotation.z = Math.sin(ph) * 0.03 * bob;
    }
  }

  return {
    group,
    get ready() {
      return ready;
    },
    attach(models: Loaded, arkRoot: THREE.Object3D) {
      for (const sp of SPECIES) {
        const g = models.get(sp.file);
        if (!g) continue;
        const a = makeWalker(g, sp), b = makeWalker(g, sp);
        b.phase += 0.37;
        pairs.push([a, b]);
        group.add(a.obj, b.obj);
        offsets.push(totalGap);
        done.push(false);
        totalGap += sp.gap + sp.len;
      }
      const fig = models.get('figures');
      if (fig) {
        fig.scene.children.slice().forEach((c) => {
          c.position.set(0, 0, 0);
          c.traverse((o) => ((o as THREE.Mesh).isMesh ? ((o as THREE.Mesh).castShadow = true) : null));
          const holder = new THREE.Group();
          holder.add(c);
          holder.visible = false;
          group.add(holder);
          figures.push(holder);
        });
      }
      const bg = models.get('birds');
      if (bg) {
        const pick = (n: string) => bg.scene.getObjectByName(n)!;
        const clip = bg.animations[0];
        const mixers: THREE.AnimationMixer[] = [];
        const mk = (kind: 'raven' | 'dove', scale = 1) => {
          const o = pick(kind).clone(true);
          o.position.set(0, 0, 0);
          o.scale.setScalar(scale);
          if (clip) {
            const sub = new THREE.AnimationClip(`${kind}_flap`, clip.duration, clip.tracks.filter((t) => t.name.startsWith(kind)));
            const m = new THREE.AnimationMixer(o);
            m.clipAction(sub).setDuration(0.34 + Math.random() * 0.08).play();
            m.setTime(Math.random());
            mixers.push(m);
          }
          o.visible = false;
          o.traverse((x) => ((x as THREE.Mesh).isMesh ? ((x as THREE.Mesh).castShadow = true) : null));
          group.add(o);
          return o;
        };
        const raven = mk('raven', 2.2);
        const dove = mk('dove', 2.6);
        const flock: THREE.Object3D[] = [];
        for (let i = 0; i < 18; i++) flock.push(mk(i % 3 === 0 ? 'raven' : 'dove', 2.2));
        birds = { raven, dove, flock, mixers, leaf: dove.getObjectByName('olive_leaf') ?? undefined };
      }
      const al = models.get('altar');
      if (al) {
        altar = al.scene;
        altar.traverse((o) => ((o as THREE.Mesh).isMesh ? (((o as THREE.Mesh).castShadow = true), ((o as THREE.Mesh).receiveShadow = true)) : null));
        altar.visible = false;
        group.add(altar);
      }
      void arkRoot;
      ready = true;
    },
    get altar() {
      return altar;
    },
    /**
     * 每格更新。mode 決定動物在哪裡：
     *  procession 工地排隊上船｜pens 洪水中待在下層隔欄｜exit 在亞拉臘往四周散開｜none 都不顯示
     */
    update(o: {
      dt: number; time: number; mode: 'procession' | 'pens' | 'exit' | 'none'; spawn: boolean;
      family: number; familyMode: 'board' | 'altar' | 'home' | 'none'; flock: number; birds: number; perch?: boolean;
      ark: THREE.Object3D; altarPos: THREE.Vector3 | null;
    }) {
      if (!ready) return;
      const { dt, mode, ark } = o;
      // 走路時間只在需要時前進，停在某一幕時隊伍照樣在走
      if (mode === 'procession') T += dt;
      const all = pairs.flat();
      all.forEach((w) => w.mixer?.update(dt));

      if (mode === 'procession') {
        const cycle = totalGap + walkPath.length;
        pairs.forEach((pr, k) => {
          const sp = pr[0].sp;
          let s = T * sp.walk - offsets[k];
          // 走完的回到隊尾（還在放行的時候）
          while (s > walkPath.length && o.spawn && !done[k]) {
            offsets[k] += cycle;
            s = T * sp.walk - offsets[k];
          }
          if (!o.spawn && s < 0) done[k] = true;
          if (o.spawn) done[k] = false;
          const vis = s > 0 && s < walkPath.length - 0.5 && !(done[k] && s <= 0);
          walkPath.at(s, P, D);
          side.crossVectors(D, up).normalize();
          const onRamp = s > rampStart - 2;
          const spread = onRamp ? Math.min(1.1, 0.35 + pr[0].width * 0.4) : 0.6 + pr[0].width * 0.7;
          pr.forEach((w, j) => {
            w.obj.visible = vis;
            if (!vis) return;
            const lag = j * (onRamp ? sp.len * 0.9 : 0.4);
            walkPath.at(s - lag, P, D);
            const off = onRamp ? (j ? 1 : -1) * Math.min(spread, 0.4) : (j ? 1 : -1) * spread;
            P.addScaledVector(side, off);
            if (s - lag < rampStart) P.y = heightAt(P.x, P.z);
            place(w, P, D, 1);
            setGait(w, true);
          });
          void doorAt;
        });
      } else if (mode === 'pens') {
        // 下層隔欄：每一對住一欄，左右兩排；太高的縮一點免得頂到上層的樑
        const PENS: number[] = [];
        for (let x = -45; x <= 45; x += 6) PENS.push(x);
        let p = 0;
        pairs.forEach((pr) => {
          if (pr[0].sp.file === 'giraffe') { pr.forEach((w) => (w.obj.visible = false)); return; }
          const k = p++;
          const side = k % 2 ? -1 : 1;
          const x0 = PENS[Math.floor(k / 2) % PENS.length];
          pr.forEach((w, j) => {
            if (w.obj.parent !== ark) ark.add(w.obj);
            const fit = Math.min(1, 3.0 / Math.max(0.1, w.height));
            w.obj.scale.setScalar(fit);
            const len = w.sp.len * fit;
            const z = side * Math.min(innerHalf(x0) - 0.4 - len / 2, 4.6 + len / 2);
            w.obj.position.set(x0 + 1.5 + (j ? 1 : -1) * Math.min(1.3, 0.4 + w.width * fit * 0.6), ARK_POINTS.lowerDeck.y + 0.05, z);
            w.obj.rotation.set(0, (side > 0 ? Math.PI : 0) + (j ? 0.25 : -0.2), 0);
            w.obj.visible = true;
            setGait(w, false, (k + j) % 3 === 0);
          });
        });
      } else if (mode === 'exit') {
        // 從門口往山坡四散，走遠了再從門口出來
        const R = mulberry32(3);
        let i = 0;
        pairs.forEach((pr) => pr.forEach((w, j) => {
          const k = i++;
          if (w.obj.parent !== group) group.add(w.obj);
          const ang = -Math.PI / 2 + (R() - 0.5) * 2.6;
          const speed = w.sp.walk * (0.8 + R() * 0.4);
          const start = ark.localToWorld(ARK_POINTS.doorSill.clone().add(new THREE.Vector3(0, 0, -3)));
          const L = 70 + R() * 50;
          const s = (o.time * speed + k * 9.3) % L;
          D.set(Math.cos(ang), 0, Math.sin(ang));
          const q = new THREE.Quaternion().setFromAxisAngle(up, ark.rotation.y);
          D.applyQuaternion(q);
          P.copy(start).addScaledVector(D, s + 4 + j * 1.5).addScaledVector(side.crossVectors(D, up), j * 1.2);
          P.y = heightAt(P.x, P.z);
          w.obj.visible = s < L - 3;
          place(w, P, D, 1);
          setGait(w, true);
        }));
      } else {
        all.forEach((w) => (w.obj.visible = false));
      }
      if (mode !== 'pens') all.forEach((w) => {
        if (w.obj.parent === ark) group.add(w.obj);
        w.obj.scale.setScalar(1);
      });

      // ---------------------------------------------------------------- 挪亞一家
      figures.forEach((f, i) => {
        if (o.familyMode !== 'home' && f.parent === ark) group.add(f);
        if (o.familyMode === 'home') {
          // 上層：四個人圍著餐桌，四個人在房間門口
          if (f.parent !== ark) ark.add(f);
          const HOME: [number, number, number][] = [[-26, -4.2, 0], [-22, -4.2, Math.PI], [-24, -3.3, -Math.PI / 2], [-24, -6.4, Math.PI / 2],
            [-12, -3.2, -Math.PI / 2], [-4.2, -3.1, -Math.PI / 2], [3.4, -3.2, -Math.PI / 2], [10.8, -3.0, -Math.PI / 2]];
          const [x, z, r] = HOME[i % HOME.length];
          f.visible = true;
          f.position.set(x, DECK_Y[2], z);
          f.rotation.set(0, r, 0);
        } else if (o.familyMode === 'board') {
          const s = o.family * (famPath.length + 8 * 2.2) - i * 2.2;
          f.visible = s > 0 && s < famPath.length - 0.3;
          famPath.at(s, P, D);
          if (s < famPath.acc[2]) P.y = heightAt(P.x, P.z);
          f.position.copy(P);
          f.rotation.set(0, Math.atan2(D.x, D.z) - Math.PI / 2, 0);
          f.position.y += Math.abs(Math.sin(s * 2.4)) * 0.04;
        } else if (o.familyMode === 'altar' && o.altarPos) {
          const a = (i / 8) * Math.PI * 1.4 + Math.PI * 0.8;
          f.visible = true;
          f.position.set(o.altarPos.x + Math.cos(a) * 4.2, 0, o.altarPos.z + Math.sin(a) * 4.2);
          f.position.y = heightAt(f.position.x, f.position.z);
          f.rotation.set(0, Math.atan2(o.altarPos.x - f.position.x, o.altarPos.z - f.position.z) - Math.PI / 2, 0);
        } else f.visible = false;
      });

      // ---------------------------------------------------------------- 鳥
      if (birds) {
        birds.mixers.forEach((m) => m.update(dt));
        const t = o.time;
        const top = ark.localToWorld(ARK_POINTS.tsohar.clone());
        birds.flock.forEach((b, i) => {
          const m = birds!.mixers[i + 2];
          if (o.perch) {
            // 上層的棲木上
            if (b.parent !== ark) ark.add(b);
            const x = -34 + (i % 12) * 6.2 + (i >= 12 ? 3 : 0);
            b.visible = true;
            b.position.set(x, DECK_Y[2] + (i % 2 ? 1.75 : 1.05) + 0.12, innerHalf(x) - 0.8);
            b.rotation.set(0, Math.PI + (i % 3 - 1) * 0.4, 0);
            b.scale.setScalar(1.2);
            if (m) m.timeScale = 0.06;
            return;
          }
          if (b.parent === ark) group.add(b);
          if (m) m.timeScale = 1;
          b.visible = o.flock > 0.01;
          if (!b.visible) return;
          const r = 16 + (i % 5) * 6, sp = 0.35 + (i % 4) * 0.05, ph = i * 1.7;
          const a = t * sp + ph;
          b.position.set(top.x + Math.cos(a) * r * 1.8, top.y + 8 + Math.sin(t * 0.7 + i) * 3 + (i % 3) * 4, top.z + Math.sin(a) * r);
          b.rotation.set(0, -a + Math.PI, Math.sin(t + i) * 0.2);
        });
        // 烏鴉與鴿子：birds 0→1 對應第 15 幕的進度
        const win = ark.localToWorld(ARK_POINTS.window.clone().add(new THREE.Vector3(0, 0.2, -1.2)));
        const b = o.birds;
        const raven = birds.raven, dove = birds.dove;
        raven.visible = b > 0.02 && b < 0.99;
        dove.visible = b > 0.3;
        if (raven.visible) {
          // 飛來飛去：在窗外大圈盤旋
          const r = 14, a = t * 0.7;
          const k = smooth(span(b, 0.02, 0.12));
          P.set(win.x + 25 + Math.cos(a) * r * 1.5, win.y + 12 + Math.sin(t * 0.9) * 3, win.z - 22 + Math.sin(a) * r);
          raven.position.lerpVectors(win, P, k);
          raven.rotation.set(0, -a, Math.sin(a) * 0.3);
        }
        if (dove.visible) {
          // 三次：出去又回來、叼葉回來、不再回來
          const trip = (u: number, far: number, back: boolean) => {
            const out = new THREE.Vector3(win.x + far * 0.6, win.y + 8, win.z - far * 0.6);
            const go = back ? Math.sin(Math.PI * clamp(u)) : smooth(u);
            dove.position.lerpVectors(win, out, go);
            dove.position.y += Math.sin(clamp(u) * Math.PI) * 6;
            D.subVectors(out, win);
            const heading = Math.atan2(D.x, D.z) + (back && u > 0.5 ? Math.PI : 0);
            dove.rotation.set(0, heading - Math.PI / 2, 0);
          };
          if (b < 0.55) trip(span(b, 0.32, 0.54), 28, true);
          else if (b < 0.8) trip(span(b, 0.56, 0.79), 40, true);
          else trip(span(b, 0.82, 1), 220, false);
          if (birds.leaf) birds.leaf.visible = b > 0.64 && b < 0.8;
          dove.visible = b > 0.3 && b < 0.995;
        }
      }
      void lerp;
    },
  };
}
export type Life = ReturnType<typeof createLife>;
