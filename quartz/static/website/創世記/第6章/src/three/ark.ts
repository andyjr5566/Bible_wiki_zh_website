import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { planks, softDot } from './textures';
import { mulberry32, smooth, span } from './util';

/**
 * 方舟（scripts/blender/build_ark.py 產生）。Blender 的 (x, y, z) 在這裡是 (x, z, -y)：
 * 船長沿 +X，門開在 −Z 那一側。模型原點在船中央、船底平面；龍骨再往下 0.55 公尺。
 */
export const KEEL = 0.55;
const B = (x: number, y: number, z: number) => new THREE.Vector3(x, z + KEEL, -y);

export const ARK_POINTS = {
  doorSill: B(10.7, 11.6, 1.25),
  rampFoot: B(10.7, 27.6, -0.55),
  window: B(-32.5, 11.6, 10.3),
  tsohar: B(0, 0, 12.9),
  lowerDeck: B(-20, 0, 1.25),
};
export const DRAFT = 4.6;

type Build = { frames: number; planks: number; roof: number; inner: number; pitch: number; door: number };

export function setupArk(gltf: GLTF, quality: 'high' | 'low') {
  const root = new THREE.Group();
  root.name = 'ark';
  const model = gltf.scene;
  model.position.y = KEEL;
  root.add(model);

  const shared = { uPitch: { value: 0 }, uWet: { value: 0 } };
  const hullTex = planks({ base: '#7b5a37', dark: '#3a2410', rows: 4, seed: 7 });
  const deckTex = planks({ base: '#a07a4a', dark: '#4a2e14', rows: 8, seed: 21 });
  const roofTex = planks({ base: '#7f5c36', dark: '#352010', rows: 8, seed: 33 });
  const beamTex = planks({ base: '#6d4a29', dark: '#2e1a0a', rows: 3, seed: 45, knots: 2 });
  // 船板長 3–7 公尺：貼圖沿長度方向拉開
  for (const t of [hullTex, deckTex, roofTex]) {
    t.map.repeat.set(0.4, 1);
    t.bump.repeat.set(0.4, 1);
  }

  /** 松香：由船底往上一層一層塗上去（uPitch 0→1 對應塗到的高度 0→15 公尺），剛塗的那一圈比較亮 */
  const pitchable = (m: THREE.MeshStandardMaterial, amount = 1) => {
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uPitch = shared.uPitch;
      sh.uniforms.uWet = shared.uWet;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying float vPY;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPY = position.y;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uPitch, uWet;\nvarying float vPY;')
        .replace('#include <color_fragment>', `#include <color_fragment>
          float edge = uPitch * 16.0 - 0.8;
          float pk = (1.0 - smoothstep(edge - 0.5, edge + 0.3, vPY)) * ${amount.toFixed(2)};
          float fresh = pk * (1.0 - smoothstep(0.0, 2.2, edge - vPY)) * step(uPitch, 0.995);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.02, 0.015, 0.011) + diffuseColor.rgb * 0.07, pk);
          diffuseColor.rgb *= 1.0 - 0.3 * uWet;`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
          roughnessFactor = mix(roughnessFactor, 0.72, pk);
          roughnessFactor = mix(roughnessFactor, 0.28, fresh);
          roughnessFactor = mix(roughnessFactor, 0.22, uWet);`);
    };
    m.customProgramCacheKey = () => `pitch${amount}`;
    return m;
  };
  const wood = (t: { map: THREE.Texture; bump: THREE.Texture }, rough = 0.85, bump = 0.04) =>
    new THREE.MeshStandardMaterial({ map: t.map, bumpMap: t.bump, bumpScale: bump, roughness: rough, metalness: 0, side: THREE.DoubleSide, envMapIntensity: 0.4 });

  const MATS: Record<string, THREE.MeshStandardMaterial> = {
    hull_planks: pitchable(wood(hullTex, 0.82, 0.06)),
    roof_planks: pitchable(wood(roofTex, 0.86), 0.7),
    deck_planks: wood(deckTex, 0.9),
    frame_timber: wood(beamTex, 0.88),
    trim_timber: pitchable(wood(beamTex, 0.85), 0.4),
    dark_wood: wood(beamTex, 0.9),
    straw: new THREE.MeshStandardMaterial({ color: '#b39650', roughness: 1 }),
    clay: new THREE.MeshStandardMaterial({ color: '#a4603c', roughness: 0.75 }),
    cloth: new THREE.MeshStandardMaterial({ color: '#b1a283', roughness: 1 }),
    rope: new THREE.MeshStandardMaterial({ color: '#7a6242', roughness: 1 }),
  };

  // 建造與剖面用的裁切平面（在方舟本地座標定義，每格換算成世界座標）
  const planes = {
    frames: { local: new THREE.Plane(new THREE.Vector3(-1, 0, 0), 1e5), world: new THREE.Plane() },
    planks: { local: new THREE.Plane(new THREE.Vector3(0, -1, 0), 1e5), world: new THREE.Plane() },
    roof: { local: new THREE.Plane(new THREE.Vector3(-1, 0, 0), 1e5), world: new THREE.Plane() },
    cut: { local: new THREE.Plane(new THREE.Vector3(0, 0, 1), 1e5), world: new THREE.Plane() },
  };
  const parts: Record<string, THREE.Mesh> = {};
  model.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    parts[m.name] = m;
    const src = m.material as THREE.Material;
    const key = src.name.replace(/\.\d+$/, '');
    const mat = MATS[key] ?? MATS.frame_timber;
    // 每個物件自己一份材質，才能各自裁切
    const own = mat.clone();
    own.onBeforeCompile = mat.onBeforeCompile;
    own.customProgramCacheKey = mat.customProgramCacheKey;
    m.material = own;
    m.castShadow = quality === 'high' || /hull|roof|ridge/.test(m.name);
    m.receiveShadow = true;
  });
  const get = (n: string) => parts[n] ?? parts[`${n}_1`];
  const byName = (re: RegExp) => Object.values(parts).filter((m) => re.test(m.name));
  const clipWith = (meshes: THREE.Mesh[], list: THREE.Plane[]) => meshes.forEach((m) => ((m.material as THREE.Material).clippingPlanes = list));

  const G = {
    frames: byName(/^(frames|posts)/),
    hull: byName(/^hull_planks/),
    roof: byName(/^(roof_planks|ridge|cover)/),
    inner: byName(/^(deck_|pens|straw|stores|sacks|shelves|rooms|bedding|ladders)/),
    door: byName(/^(door|door_frame|ramp|window_shutter)/),
  };
  clipWith(G.frames, [planes.frames.world, planes.cut.world]);
  clipWith(G.hull, [planes.planks.world, planes.cut.world]);
  clipWith(G.roof, [planes.roof.world, planes.cut.world]);
  clipWith(byName(/^(door_frame|window_shutter|door$)/), [planes.cut.world]);

  const door = get('door');
  const shutter = get('window_shutter');
  const cover = get('cover');
  const ramp = get('ramp');
  const coverHome = cover ? cover.position.clone() : new THREE.Vector3();

  // ---------------------------------------------------------------- 艙內油燈（經文沒寫，示意）
  const lamps: THREE.PointLight[] = [];
  const lampGlow = new THREE.SpriteMaterial({ map: softDot('rgba(255,190,110,1)'), color: 0xffc27a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const lampSpots = [B(-34, 0, 3.9), B(-18, 0, 3.9), B(-2, 0, 3.9), B(14, 0, 3.9), B(30, 0, 3.9), B(-20, 0, 7.8), B(4, 0, 7.8), B(-12, 0, 11.3), B(8, 0, 11.3)];
  const n = quality === 'high' ? lampSpots.length : 5;
  for (let i = 0; i < n; i++) {
    const l = new THREE.PointLight(0xffa65a, 0, 16, 1.7);
    l.position.copy(lampSpots[i]);
    root.add(l);
    lamps.push(l);
    const g = new THREE.Sprite(lampGlow);
    g.scale.setScalar(0.9);
    l.add(g);
  }

  // ---------------------------------------------------------------- 工地：鷹架、木材堆、鋸木架（示意）
  const yard = new THREE.Group();
  const rnd = mulberry32(5);
  const poleMat = new THREE.MeshStandardMaterial({ color: '#7a5a38', roughness: 0.95 });
  const logMat = new THREE.MeshStandardMaterial({ map: beamTex.map, roughness: 0.9 });
  const scaffold: THREE.Mesh[] = [];
  const pole = new THREE.BoxGeometry(0.22, 1, 0.22);
  const plank = new THREE.BoxGeometry(2.2, 0.12, 0.6);
  for (let x = -60; x <= 60; x += 7.5) {
    for (const side of [-1, 1]) {
      const w = 11.25 * (Math.abs(x) < 39 ? 1 : 1 - 0.5 * Math.pow((Math.abs(x) / 67.5 - 0.58) / 0.42, 1.7)) + 2.2;
      for (const dz of [0, 1.8]) {
        const p = new THREE.Mesh(pole, poleMat);
        p.position.set(x, 0, side * (w + dz));
        p.userData.full = 14.5;
        p.castShadow = quality === 'high';
        yard.add(p);
        scaffold.push(p);
      }
      for (let lvl = 1; lvl <= 4; lvl++) {
        const b = new THREE.Mesh(plank, poleMat);
        b.position.set(x, lvl * 3.2, side * (w + 0.9));
        b.rotation.y = Math.PI / 2;
        b.userData.level = lvl * 3.2;
        yard.add(b);
        scaffold.push(b);
      }
    }
  }
  const logGeo = new THREE.CylinderGeometry(0.3, 0.3, 9, 8);
  logGeo.rotateZ(Math.PI / 2);
  for (let k = 0; k < 6; k++) {
    const bx = -50 + k * 22 + (rnd() - 0.5) * 6, bz = (k % 2 ? 1 : -1) * (32 + rnd() * 10);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 6 - r; c++) {
      const log = new THREE.Mesh(logGeo, logMat);
      log.position.set(bx + (r % 2) * 0.2, 0.3 + r * 0.55, bz + (c - (5 - r) / 2) * 0.62);
      log.rotation.y = (rnd() - 0.5) * 0.08;
      log.castShadow = quality === 'high';
      yard.add(log);
    }
  }

  // ---------------------------------------------------------------- 船底與地面接觸的暗影，擱淺時才看得出是壓在地上
  const contact = (() => {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 64;
    const g = c.getContext('2d')!;
    const grd = g.createRadialGradient(128, 32, 4, 128, 32, 128);
    grd.addColorStop(0, 'rgba(0,0,0,.75)');
    grd.addColorStop(0.45, 'rgba(0,0,0,.45)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.setTransform(1, 0, 0, 0.25, 0, 24);
    g.fillStyle = grd;
    g.fillRect(0, -128, 256, 256);
    const tex = new THREE.CanvasTexture(c);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(160, 40), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.8 }));
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.55;
    m.renderOrder = 1;
    root.add(m);
    return m;
  })();

  const tmpM = new THREE.Matrix4();
  const state: Build = { frames: 1, planks: 1, roof: 1, inner: 1, pitch: 1, door: 1 };
  let cut = 0;

  return {
    root,
    yard,
    parts,
    shared,
    /** build：0 空地 → 1 龍骨肋材 → 2 船板 → 3 船艙 → 4 屋頂 → 5 門與坡道；pitch 另外算 */
    setBuild(b: number) {
      state.frames = span(b, 0.05, 1);
      state.planks = span(b, 1, 2);
      state.inner = span(b, 2, 3);
      state.roof = span(b, 3, 4);
      state.door = span(b, 4, 4.6);
      G.frames.forEach((m) => (m.visible = state.frames > 0.001));
      G.hull.forEach((m) => (m.visible = state.planks > 0.001));
      G.roof.forEach((m) => (m.visible = state.roof > 0.001));
      G.inner.forEach((m) => (m.visible = state.inner > 0.3));
      G.door.forEach((m) => (m.visible = state.door > 0.5));
      yard.visible = b < 5.2 && cut < 0.3;
      // 鷹架跟著船板往上長
      const top = 1 + 13.5 * Math.max(state.frames * 0.35, state.planks);
      scaffold.forEach((s) => {
        if (s.userData.full) {
          s.scale.y = top;
          s.position.y = top / 2;
          s.visible = b < 4.9;
        } else s.visible = s.userData.level < top && b < 4.9;
      });
    },
    setPitch(p: number) {
      shared.uPitch.value = p;
    },
    setContact(v: number) {
      contact.visible = v > 0.02;
      (contact.material as THREE.MeshBasicMaterial).opacity = 0.8 * v;
    },
    setWet(w: number) {
      shared.uWet.value = w;
    },
    /** 0 開、1 關（創7:16） */
    setDoor(closed: number) {
      if (door) door.rotation.y = -(1 - smooth(closed)) * 1.72;
    },
    setShutter(open: number) {
      if (shutter) shutter.rotation.x = smooth(open) * 1.25;
    },
    /** 0 蓋著、1 撤去（創8:13） */
    setCover(removed: number) {
      if (!cover) return;
      const t = smooth(removed);
      cover.position.copy(coverHome).add(new THREE.Vector3(0, t * 3, -t * 9));
      cover.rotation.x = t * 0.5;
      cover.visible = t < 0.98;
    },
    setRamp(v: boolean) {
      if (ramp) ramp.visible = v && state.door > 0.5;
    },
    setCut(c: number) {
      cut = c;
    },
    setLamps(v: number, t: number) {
      lamps.forEach((l, i) => {
        l.intensity = v * (26 + Math.sin(t * 7 + i * 1.7) * 3 + Math.sin(t * 19 + i) * 1.5);
        l.visible = v > 0.01;
      });
    },
    /** 每格：把本地裁切平面換成世界座標 */
    update() {
      root.updateMatrixWorld();
      const mw = root.matrixWorld;
      // 龍骨肋材由船頭往船尾出現；船板由下往上；屋頂由船頭往船尾
      planes.frames.local.constant = state.frames >= 1 ? 1e5 : -70 + 141 * smooth(state.frames);
      planes.planks.local.constant = state.planks >= 1 ? 1e5 : -0.2 + 13 * state.planks;
      planes.roof.local.constant = state.roof >= 1 ? 1e5 : -70 + 141 * smooth(state.roof);
      planes.cut.local.constant = cut <= 0.001 ? 1e5 : 13 - 13.6 * smooth(cut);
      tmpM.copy(mw);
      for (const p of Object.values(planes)) p.world.copy(p.local).applyMatrix4(tmpM);
    },
  };
}
export type Ark = ReturnType<typeof setupArk>;
