import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

import type { View } from '../data/stops';

/**
 * 會幕主場景。模型 tabernacle-main.glb（thedeserttabernacle，CC BY-NC）沿用舊版的擺放：
 * 縮放 0.3、繞 Y 軸轉 -90°，使 +Z 為東、+X 為北。
 */

/** 四層頂蓋，由內而外（材質名來自模型本身） */
// 實測對照（截圖逐一上色確認）：First_Curtain_Mat＝繡基路伯的細麻幔子、ThirdCovering＝染紅的公羊皮、
// FourthCovering＝海狗皮頂蓋。這個模型沒有做山羊毛罩棚那一層；Inner/Outer_Curtain 是內幔與門簾，不屬頂蓋。
export const LAYER_MATERIALS: Record<'linen' | 'goathair' | 'ramskin' | 'seacow', readonly string[]> = {
  linen: ['First_Curtain_Mat'],
  goathair: [],
  ramskin: ['ThirdCovering'],
  seacow: ['FourthCovering'],
};
export type LayerId = keyof typeof LAYER_MATERIALS;
export const MODEL_HAS_LAYER = (id: LayerId) => LAYER_MATERIALS[id].length > 0;

export interface Stage {
  /** 導覽路徑（第 0 站固定是全景） */
  setPath(views: View[], peels: number[]): void;
  /** 捲動進度，以站為單位的浮點數：1.5 代表第 1 站和第 2 站的正中間 */
  setProgress(p: number): void;
  /** 直接飛到某個視角（按鈕用），下一次捲動就回到路徑 */
  go(view: View, peel: boolean): void;
  setPeel(v: boolean | null): void;
  setLayer(id: LayerId, visible: boolean): void;
  resetLayers(): void;
  interact(fn: () => void): void;
  debug: { materials(): string[]; scene: THREE.Scene };
}

const OVERVIEW: View = { pos: [34, 22, 40], target: [0, 0, 2], fov: 42 };

function weaveTexture(cherubim: boolean): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const g = c.getContext('2d')!;
  const bands = ['#2f4f9a', '#6a3b8c', '#b3263a', '#efe6d2'];
  const bw = c.width / 16;
  for (let i = 0; i < 16; i++) {
    g.fillStyle = bands[i % 4];
    g.fillRect(i * bw, 0, bw + 1, c.height);
  }
  g.globalAlpha = 0.16;
  for (let y = 0; y < c.height; y += 4) {
    g.fillStyle = y % 8 ? '#000' : '#fff';
    g.fillRect(0, y, c.width, 1);
  }
  if (cherubim) {
    // 基路伯的繡紋：只畫成抽象的金色翅膀，經文沒有描述它的樣子
    g.globalAlpha = 0.75;
    g.strokeStyle = '#e0b44a';
    g.lineWidth = 5;
    for (let i = 0; i < 4; i++) {
      const cx = 64 + i * 128;
      g.beginPath();
      g.moveTo(cx, 158);
      g.quadraticCurveTo(cx - 50, 118, cx - 44, 68);
      g.moveTo(cx, 158);
      g.quadraticCurveTo(cx + 50, 118, cx + 44, 68);
      g.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export async function createStage(host: HTMLElement, opts: { reducedMotion: boolean; lowPower: boolean; onProgress?: (p: number) => void }): Promise<Stage> {
  const renderer = new THREE.WebGLRenderer({ antialias: !opts.lowPower, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, opts.lowPower ? 1 : 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = !opts.lowPower;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.setAttribute('role', 'img');
  renderer.domElement.setAttribute('aria-label', '可以拖曳轉動的 3D 會幕（示意重建）');
  host.append(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#e8d6b4');
  scene.fog = new THREE.Fog('#e8d6b4', 60, 160);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(OVERVIEW.fov, 1, 0.05, 400);
  camera.position.set(...OVERVIEW.pos);

  scene.add(new THREE.HemisphereLight(0xfff3dc, 0x8a6b44, 0.8));
  const sun = new THREE.DirectionalLight(0xfff0d0, 2.2);
  sun.position.set(20, 30, 14);
  sun.castShadow = !opts.lowPower;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 90 });
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  // 聖所裡面暗，掀開頂之後補一點暖光，才看得見器具
  const inner = new THREE.PointLight(0xffd9a0, 0, 12, 1.5);
  inner.position.set(0, 2.6, -5);
  scene.add(inner);

  const sand = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d')!;
    g.fillStyle = '#d8c29a';
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2600; i++) {
      const v = 180 + Math.random() * 50;
      g.fillStyle = `rgba(${v},${v * 0.86},${v * 0.66},${0.25 + Math.random() * 0.3})`;
      g.fillRect(Math.random() * 256, Math.random() * 256, 1.5, 1.5);
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(40, 40);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ map: sand, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  ground.receiveShadow = true;
  scene.add(ground);

  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(new URL('models/tabernacle-main.glb', document.baseURI).href, (e) => {
    if (e.total) opts.onProgress?.(e.loaded / e.total);
  });
  const model = gltf.scene;
  model.scale.setScalar(0.3);
  model.rotation.y = -Math.PI / 2;
  const layerMeshes: Record<LayerId, THREE.Mesh[]> = { linen: [], goathair: [], ramskin: [], seacow: [] };
  const matNames = new Set<string>();
  model.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.castShadow = !opts.lowPower;
    m.receiveShadow = !opts.lowPower;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    for (const mat of mats) {
      matNames.add(mat.name);
      for (const [id, names] of Object.entries(LAYER_MATERIALS) as [LayerId, readonly string[]][]) {
        if (names.includes(mat.name)) layerMeshes[id].push(m);
      }
    }
  });
  // 院門與帳幕門簾（Outer_Curtain）、內幔（Inner_Curtain）原本是漩渦貼圖；換成三色線加細麻的織紋（出26:31、36；27:16）
  const gateTex = weaveTexture(false);
  const veilTex = weaveTexture(true);
  model.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const mat = m.material as THREE.MeshStandardMaterial;
    if (mat.name === 'Outer_Curtain' || mat.name === 'Inner_Curtain') {
      m.material = new THREE.MeshStandardMaterial({ name: mat.name, map: mat.name === 'Inner_Curtain' ? veilTex : gateTex, roughness: 0.85, side: THREE.DoubleSide });
    }
  });
  // 約櫃、桌子、燈臺在模型裡是半透明或米白色；經文說「包上精金」「用精金做」（出25:11、24、31），統一成金色
  const gold = new THREE.MeshStandardMaterial({ name: 'scripture_gold', color: '#d9ab3f', metalness: 1, roughness: 0.3 });
  for (const name of ['Ark001', 'Border002', 'LampStand001']) {
    model.getObjectByName(name)?.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.material = gold;
    });
  }
  scene.add(model);

  /* ---------------------------------------------------------- 燔祭壇的火與煙（出27 的壇；利6:13 壇上的火常常燒著） */
  const altarFire = new THREE.PointLight(0xff8a3a, 0, 9, 1.6);
  altarFire.position.set(0, 1.1, 9);
  scene.add(altarFire);
  const smokeTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d')!;
    const grd = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    grd.addColorStop(0, 'rgba(255,255,255,0.55)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();
  const puffCount = opts.lowPower ? 8 : 18;
  const puffs = Array.from({ length: puffCount }, (_, i) => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, color: 0xd9d2c7, transparent: true, depthWrite: false, opacity: 0 }));
    sp.userData.phase = i / puffCount;
    sp.userData.dx = (Math.random() - 0.5) * 0.5;
    scene.add(sp);
    return sp;
  });

  /* ---------------------------------------------------------- 四層頂蓋：淡入淡出，不是瞬間消失 */
  const layerMats = new Map<LayerId, THREE.Material[]>();
  for (const id of Object.keys(layerMeshes) as LayerId[]) {
    const mats: THREE.Material[] = [];
    for (const m of layerMeshes[id]) {
      const list = Array.isArray(m.material) ? m.material : [m.material];
      m.material = list.length === 1 ? list[0].clone() : list.map((x) => x.clone());
      mats.push(...(Array.isArray(m.material) ? m.material : [m.material]));
    }
    layerMats.set(id, mats);
  }
  const layerOn: Record<LayerId, boolean> = { linen: true, goathair: true, ramskin: true, seacow: true };
  const layerOp: Record<LayerId, number> = { linen: 1, goathair: 1, ramskin: 1, seacow: 1 };

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(...OVERVIEW.target);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.minDistance = 0.8;
  controls.maxDistance = 90;

  /* ---------------------------------------------------------- 鏡頭：沿路徑跟隨，帶阻尼 */
  let path: View[] = [OVERVIEW];
  let peels: number[] = [0];
  let progress = 0;
  let manual: { view: View; peel: number } | null = null;
  let free = false;
  let peelOverride: number | null = null;
  let peelCur = 0;
  const listeners: (() => void)[] = [];
  controls.addEventListener('start', () => {
    free = true;
    listeners.forEach((f) => f());
  });

  let visible = true;
  const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
  io.observe(host);
  const resize = () => {
    const w = host.clientWidth;
    const h = host.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(host);
  resize();

  const P = new THREE.Vector3();
  const T = new THREE.Vector3();
  const A = new THREE.Vector3();
  const B = new THREE.Vector3();
  const smooth = (x: number) => x * x * (3 - 2 * x);
  const clock = new THREE.Clock();

  /** 目前進度應有的鏡頭姿勢；兩站之間走弧線，飛過屋頂而不是穿牆 */
  function pose(time: number): { fov: number; peel: number } {
    if (manual) {
      P.set(...manual.view.pos);
      T.set(...manual.view.target);
      return { fov: manual.view.fov, peel: manual.peel };
    }
    const n = path.length;
    const i = Math.max(0, Math.min(n - 1, Math.floor(progress)));
    const j = Math.min(n - 1, i + 1);
    const f = i === j ? 0 : smooth(Math.min(1, Math.max(0, progress - i)));
    const a = path[i];
    const b = path[j];
    P.lerpVectors(A.set(...a.pos), B.set(...b.pos), f);
    const dist = A.distanceTo(B);
    P.y += Math.min(3.2, dist * 0.22) * Math.sin(Math.PI * f);
    T.lerpVectors(A.set(...a.target), B.set(...b.target), f);
    // 停在全景（第 0 站）時，院子慢慢繞著轉；越往第一站走，轉得越少
    if (i === 0 && !opts.reducedMotion) {
      const ang = time * 0.05 * (1 - f);
      const dx = P.x - T.x;
      const dz = P.z - T.z;
      P.x = T.x + dx * Math.cos(ang) - dz * Math.sin(ang);
      P.z = T.z + dx * Math.sin(ang) + dz * Math.cos(ang);
    }
    // 往室內飛：頂先掀開；往外飛：晚一點才蓋回去。免得半透明的頂擋在鏡頭前
    const raw = i === j ? 0 : Math.min(1, Math.max(0, progress - i));
    const pf = peels[j] > peels[i] ? smooth(Math.min(1, raw * 2.2)) : peels[j] < peels[i] ? smooth(Math.max(0, (raw - 0.55) / 0.45)) : 0;
    return { fov: a.fov + (b.fov - a.fov) * f, peel: peels[i] + (peels[j] - peels[i]) * pf };
  }

  const ease = (dt: number, rate: number) => (opts.reducedMotion ? 1 : 1 - Math.exp(-dt * rate));
  let last = performance.now();
  function frame() {
    requestAnimationFrame(frame);
    const now = performance.now();
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (!visible || document.hidden) return;
    const time = clock.getElapsedTime();
    const want = pose(time);
    if (!free) {
      // 停著的時候有極輕微的呼吸感
      if (!opts.reducedMotion) P.y += Math.sin(time * 0.6) * 0.03;
      const k = ease(dt, 4.5);
      camera.position.lerp(P, k);
      controls.target.lerp(T, k);
      camera.fov += (want.fov - camera.fov) * k;
      camera.updateProjectionMatrix();
    }
    const peelWant = peelOverride ?? want.peel;
    peelCur += (peelWant - peelCur) * ease(dt, 3.5);
    for (const id of Object.keys(layerOp) as LayerId[]) {
      const target = layerOn[id] ? 1 - peelCur : 0;
      layerOp[id] += (target - layerOp[id]) * ease(dt, 4);
      const op = layerOp[id];
      for (const m of layerMats.get(id) ?? []) {
        m.transparent = op < 0.995;
        m.opacity = op;
        m.depthWrite = op > 0.6;
      }
      for (const mesh of layerMeshes[id]) mesh.visible = op > 0.02;
    }
    inner.intensity = 6 * Math.max(peelCur, 1 - layerOp.linen);
    altarFire.intensity = 3 + Math.sin(time * 9) * 0.6 + Math.sin(time * 23) * 0.4;
    for (const sp of puffs) {
      const ph = (time * 0.12 + sp.userData.phase) % 1;
      sp.position.set(sp.userData.dx * ph * 2, 0.9 + ph * 3.2, 9 + ph * 0.6);
      const sc = 0.4 + ph * 1.6;
      sp.scale.set(sc, sc, 1);
      (sp.material as THREE.SpriteMaterial).opacity = opts.reducedMotion ? 0 : Math.sin(Math.PI * ph) * 0.35;
    }
    controls.update();
    renderer.render(scene, camera);
  }
  frame();

  return {
    setPath(views, ps) {
      path = [OVERVIEW, ...views];
      peels = [0, ...ps];
    },
    setProgress(p) {
      progress = p;
      manual = null;
      free = false;
    },
    go(view, peel) {
      manual = { view, peel: peel ? 1 : 0 };
      free = false;
    },
    setPeel(v) {
      peelOverride = v === null ? null : v ? 1 : 0;
    },
    setLayer(id, v) {
      layerOn[id] = v;
    },
    resetLayers() {
      (Object.keys(layerOn) as LayerId[]).forEach((k) => (layerOn[k] = true));
    },
    interact(fn) {
      listeners.push(fn);
    },
    debug: { materials: () => [...matNames], scene },
  };
}

export { OVERVIEW };
