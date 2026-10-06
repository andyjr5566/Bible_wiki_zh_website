import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createSky, horizonColor } from './sky';
import { animOff } from '../ui/dom';

export type CamPreset = 'top' | 'ground' | 'balaam' | 'orbit';

export const PRESETS: Record<CamPreset, { pos: [number, number, number]; target: [number, number, number] }> = {
  top: { pos: [0, 760, 60], target: [0, 0, 0] },
  orbit: { pos: [-330, 330, 470], target: [0, 0, 0] },
  ground: { pos: [430, 14, 90], target: [0, 8, 0] },
  // 站在營外高處的山頂（山頂約 142 高）往下看
  balaam: { pos: [640, 178, -360], target: [0, 0, 0] },
};

export interface Pose { pos: THREE.Vector3; target: THREE.Vector3 }

export interface Stage {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  /** 目前太陽的方向（單位向量），雲彩、旗子等可以拿來用 */
  sunDir: THREE.Vector3;
  onFrame(fn: (dt: number, t: number) => void): void;
  flyTo(p: CamPreset, ms?: number): void;
  flyCustom(pos: THREE.Vector3, target: THREE.Vector3, ms?: number): void;
  /** 一天裡的時刻：0 深夜、0.5 黎明（太陽剛從東邊出來）、1 白天 */
  setTod(target: number, immediate?: boolean): void;
  tod(): number;
  setNight(n: boolean): void;
  /** 故事模式：鏡頭跟著捲動給的位置走（帶阻尼），不接受拖曳；null 交還給 OrbitControls */
  follow(pose: Pose | null): void;
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
  t.repeat.set(46, 46);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * 太陽的位置只是氣氛：黎明時從正東的地平線出來（民2:3「在東邊，向日出之地」），
 * 白天升高並偏向南邊。經文沒有記任何時刻，這是示意。
 */
function sunDirection(tod: number, out: THREE.Vector3): THREE.Vector3 {
  let elev: number;
  if (tod < 0.4) elev = lerp(-25, -6, tod / 0.4);
  else if (tod < 0.55) elev = lerp(-6, 6, (tod - 0.4) / 0.15);
  else elev = lerp(6, 58, smooth(0.55, 1, tod));
  const az = THREE.MathUtils.degToRad(lerp(-4, 38, smooth(0.45, 1, tod)));
  const e = THREE.MathUtils.degToRad(elev);
  return out.set(Math.cos(e) * Math.cos(az), Math.sin(e), Math.cos(e) * Math.sin(az)).normalize();
}

/** 三個關鍵時刻的顏色，中間線性內插 */
const key3 = (night: string, dawn: string, day: string) => [new THREE.Color(night), new THREE.Color(dawn), new THREE.Color(day)] as const;
function at3(c: readonly [THREE.Color, THREE.Color, THREE.Color], tod: number, out: THREE.Color) {
  return tod < 0.5 ? out.copy(c[0]).lerp(c[1], tod / 0.5) : out.copy(c[1]).lerp(c[2], (tod - 0.5) / 0.5);
}
const HEMI_SKY = key3('#27315a', '#e7ad86', '#fff3dc');
const HEMI_GROUND = key3('#1a1713', '#7a5c46', '#b9a47a');
const GROUND = key3('#4a4336', '#c9ad84', '#d8c59a');
const MOON = new THREE.Color('#8fa6ff');
const SUN_LOW = new THREE.Color('#ffb070');
const SUN_HIGH = new THREE.Color('#fff0d0');
const MOON_DIR = new THREE.Vector3(-0.45, 0.8, -0.35).normalize();

export function createStage(container: HTMLElement): Stage {
  const small = matchMedia('(max-width: 720px)').matches;
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, small ? 1.5 : 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  container.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x16203b, 700, 3000);
  const sky = createSky(5200);
  scene.add(sky.mesh);

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

  const hemi = new THREE.HemisphereLight(0xfff3dc, 0xb9a47a, 1);
  const sun = new THREE.DirectionalLight(0xfff0d0, 2.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048);
  const sc = sun.shadow.camera;
  sc.left = -520; sc.right = 520; sc.top = 420; sc.bottom = -420; sc.near = 50; sc.far = 1600;
  sun.shadow.bias = -0.0006;
  scene.add(hemi, sun, sun.target);

  // 營地附近的地面；更外圈由 Blender 做的地形接手（world.ts）
  const groundMat = new THREE.MeshStandardMaterial({ color: 0xd8c59a, map: sandTexture(), roughness: 1 });
  const ground = new THREE.Mesh(new THREE.CircleGeometry(1600, 72), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const frameFns: ((dt: number, t: number) => void)[] = [];
  let followPose: Pose | null = null;
  let raf = 0;
  let running = false;
  let last = 0;
  let todTarget = 1;
  let todNow = 1;
  let fly: { from: THREE.Vector3; fromT: THREE.Vector3; to: THREE.Vector3; toT: THREE.Vector3; t0: number; ms: number } | null = null;
  const sunDir = new THREE.Vector3();
  const lightDir = new THREE.Vector3();

  const resize = () => {
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // 直式螢幕把視角放寬，營地才放得進畫面
    camera.fov = camera.aspect < 0.8 ? 58 : 42;
    frame0();
  };
  /**
   * 故事的鏡頭是照橫幅、卡片在左邊構圖的。直式螢幕的卡片在下半部，
   * 故事模式時把投影中心往上移到約 32% 的高度，主體就落在卡片上方。
   */
  function frame0() {
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    if (followPose && w / h < 0.8) camera.setViewOffset(w, h * 1.36, 0, h * 0.36, w, h);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  const tmpC = new THREE.Color();
  function applyTod() {
    const tod = todNow;
    sunDirection(tod, sunDir);
    const up = smooth(-0.06, 0.08, sunDir.y);
    lightDir.copy(MOON_DIR).lerp(sunDir, up).normalize();
    sun.position.copy(lightDir).multiplyScalar(700);
    sun.color.copy(MOON).lerp(tmpC.copy(SUN_LOW).lerp(SUN_HIGH, smooth(0.05, 0.5, sunDir.y)), up);
    sun.intensity = lerp(0.32, 0.5 + 2.1 * smooth(-0.02, 0.4, sunDir.y), up);
    at3(HEMI_SKY, tod, hemi.color);
    at3(HEMI_GROUND, tod, hemi.groundColor);
    hemi.intensity = tod < 0.5 ? lerp(0.32, 0.62, tod / 0.5) : lerp(0.62, 1.0, (tod - 0.5) / 0.5);
    at3(GROUND, tod, groundMat.color);
    const fog = scene.fog as THREE.Fog;
    horizonColor(tod, fog.color);
    fog.near = lerp(600, 1100, tod);
    fog.far = lerp(2600, 5600, tod);
  }
  applyTod();

  const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

  function frame(now: number) {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    // rAF 的時間戳可能比 last 早一點，dt 夾在 0–0.25 秒，避免負值或背景分頁回來的大跳
    const dt = Math.min(0.25, Math.max(0, (now - last) / 1000));
    last = now;
    if (Math.abs(todTarget - todNow) > 0.0005) {
      todNow += (todTarget - todNow) * Math.min(1, dt * (animOff() ? 30 : 2.4));
      applyTod();
    }
    if (followPose) {
      // 故事模式：阻尼跟隨，捲得快時鏡頭也不會跳
      const k = 1 - Math.exp(-dt * (animOff() ? 30 : 3.2));
      camera.position.lerp(followPose.pos, k);
      controls.target.lerp(followPose.target, k);
      camera.lookAt(controls.target);
    } else {
      if (fly) {
        const k = Math.min(1, (now - fly.t0) / fly.ms);
        const e = ease(k);
        camera.position.lerpVectors(fly.from, fly.to, e);
        controls.target.lerpVectors(fly.fromT, fly.toT, e);
        if (k >= 1) fly = null;
      }
      controls.update();
    }
    sky.mesh.position.copy(camera.position);
    sky.update({ sunDir, tod: todNow, t: now / 1000 });
    for (const fn of frameFns) fn(dt, now / 1000);
    renderer.render(scene, camera);
  }

  // 換視角、選了東西才飛過去：使用者自己按的，只看本站開關
  const reduce = animOff;

  return {
    renderer, scene, camera, controls, sunDir,
    onFrame: (fn) => { frameFns.push(fn); },
    flyTo(p, ms = 1400) {
      const pr = PRESETS[p];
      fly = {
        from: camera.position.clone(), fromT: controls.target.clone(),
        to: new THREE.Vector3(...pr.pos), toT: new THREE.Vector3(...pr.target),
        t0: performance.now(), ms: reduce() ? 1 : ms,
      };
    },
    flyCustom(pos, target, ms = 1100) {
      fly = { from: camera.position.clone(), fromT: controls.target.clone(), to: pos.clone(), toT: target.clone(), t0: performance.now(), ms: reduce() ? 1 : ms };
    },
    setTod(target, immediate = false) {
      todTarget = Math.min(1, Math.max(0, target));
      if (immediate) { todNow = todTarget; applyTod(); }
    },
    tod: () => todNow,
    setNight(n) { todTarget = n ? 0 : 1; },
    follow(pose) {
      followPose = pose;
      controls.enabled = !pose;
      if (!pose) fly = null;
      frame0();
    },
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
