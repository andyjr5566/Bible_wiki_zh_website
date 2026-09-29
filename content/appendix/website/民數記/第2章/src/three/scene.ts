import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export type CamPreset = 'top' | 'ground' | 'balaam' | 'orbit';

export const PRESETS: Record<CamPreset, { pos: [number, number, number]; target: [number, number, number] }> = {
  top: { pos: [0, 760, 60], target: [0, 0, 0] },
  orbit: { pos: [-330, 330, 470], target: [0, 0, 0] },
  ground: { pos: [430, 14, 90], target: [0, 8, 0] },
  balaam: { pos: [640, 140, -360], target: [0, 0, 0] },
};

const DAY = { sky: new THREE.Color(0xcfe0ee), fog: new THREE.Color(0xe6dcc4), hemi: 1.0, sun: 2.4, ground: new THREE.Color(0xd8c59a) };
const NIGHT = { sky: new THREE.Color(0x0b1226), fog: new THREE.Color(0x121a30), hemi: 0.28, sun: 0.32, ground: new THREE.Color(0x4d4638) };

export interface Stage {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  onFrame(fn: (dt: number, t: number) => void): void;
  flyTo(p: CamPreset, ms?: number): void;
  flyCustom(pos: THREE.Vector3, target: THREE.Vector3, ms?: number): void;
  setNight(n: boolean): void;
  start(): void;
  stop(): void;
  dispose(): void;
}

function sandTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) {
    const v = 232 + Math.floor(Math.random() * 24);
    g.fillStyle = `rgba(${v},${v - 6},${v - 22},${Math.random() * 0.5})`;
    g.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 2.5, 1 + Math.random() * 2.5);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(120, 120);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createStage(container: HTMLElement): Stage {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  container.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = DAY.sky.clone();
  scene.fog = new THREE.Fog(DAY.fog.clone(), 900, 3200);

  const camera = new THREE.PerspectiveCamera(42, 1, 1, 7000);
  const start = PRESETS.orbit;
  camera.position.set(...start.pos);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(...start.target);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 30;
  controls.maxDistance = 1500;
  controls.maxPolarAngle = Math.PI / 2 - 0.02;
  controls.update();

  const hemi = new THREE.HemisphereLight(0xfff3dc, 0xb9a47a, DAY.hemi);
  const sun = new THREE.DirectionalLight(0xfff0d0, DAY.sun);
  sun.position.set(260, 420, 160);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -480; sc.right = 480; sc.top = 380; sc.bottom = -380; sc.near = 50; sc.far = 1400;
  sun.shadow.bias = -0.0006;
  scene.add(hemi, sun, sun.target);

  const groundMat = new THREE.MeshStandardMaterial({ color: DAY.ground.clone(), map: sandTexture(), roughness: 1 });
  const ground = new THREE.Mesh(new THREE.CircleGeometry(4200, 64), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const frameFns: ((dt: number, t: number) => void)[] = [];
  let raf = 0;
  let running = false;
  let last = 0;
  let nightTarget = 0;
  let nightMix = 0;
  let fly: { from: THREE.Vector3; fromT: THREE.Vector3; to: THREE.Vector3; toT: THREE.Vector3; t0: number; ms: number } | null = null;

  const resize = () => {
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  const tmpC = new THREE.Color();
  function applyNight() {
    (scene.background as THREE.Color).copy(DAY.sky).lerp(NIGHT.sky, nightMix);
    (scene.fog as THREE.Fog).color.copy(DAY.fog).lerp(NIGHT.fog, nightMix);
    hemi.intensity = DAY.hemi + (NIGHT.hemi - DAY.hemi) * nightMix;
    sun.intensity = DAY.sun + (NIGHT.sun - DAY.sun) * nightMix;
    sun.color.set(0xfff0d0).lerp(tmpC.set(0x8fa6ff), nightMix);
    groundMat.color.copy(DAY.ground).lerp(NIGHT.ground, nightMix);
  }

  const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

  function frame(now: number) {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    if (Math.abs(nightTarget - nightMix) > 0.002) {
      nightMix += (nightTarget - nightMix) * Math.min(1, dt * 2.2);
      applyNight();
    }
    if (fly) {
      const k = Math.min(1, (now - fly.t0) / fly.ms);
      const e = ease(k);
      camera.position.lerpVectors(fly.from, fly.to, e);
      controls.target.lerpVectors(fly.fromT, fly.toT, e);
      if (k >= 1) fly = null;
    }
    controls.update();
    for (const fn of frameFns) fn(dt, now / 1000);
    renderer.render(scene, camera);
  }

  return {
    renderer, scene, camera, controls,
    onFrame: (fn) => { frameFns.push(fn); },
    flyTo(p, ms = 1400) {
      const pr = PRESETS[p];
      const reduce = document.documentElement.dataset.motion === 'off' || matchMedia('(prefers-reduced-motion: reduce)').matches;
      fly = {
        from: camera.position.clone(), fromT: controls.target.clone(),
        to: new THREE.Vector3(...pr.pos), toT: new THREE.Vector3(...pr.target),
        t0: performance.now(), ms: reduce ? 1 : ms,
      };
    },
    flyCustom(pos, target, ms = 1100) {
      const reduce = document.documentElement.dataset.motion === 'off' || matchMedia('(prefers-reduced-motion: reduce)').matches;
      fly = { from: camera.position.clone(), fromT: controls.target.clone(), to: pos.clone(), toT: target.clone(), t0: performance.now(), ms: reduce ? 1 : ms };
    },
    setNight(n) { nightTarget = n ? 1 : 0; },
    start() {
      if (running) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    },
    stop() { running = false; cancelAnimationFrame(raf); },
    dispose() {
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
