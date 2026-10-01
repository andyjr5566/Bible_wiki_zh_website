import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/**
 * 首頁的 3D 會幕院子。模型由 scripts/blender/build_courtyard.py 產生（單位：肘）。
 * glTF 座標：+X 東、-Z 北、+Y 上。
 */

export interface LabelSpec {
  id: string;
  text: string;
  node: string;
  offset?: [number, number, number];
}

export interface Courtyard {
  /** 給 3D 演練用：場景、相機、每格更新 */
  scene: THREE.Scene;
  model: THREE.Object3D;
  flyTo(pos: THREE.Vector3, target: THREE.Vector3, instant?: boolean): void;
  onTick(fn: (t: number, dt: number) => void): void;
  /** 3D 座標 → 畫面座標（px） */
  project(v: THREE.Vector3): { x: number; y: number; hidden: boolean };
  focus(node: string): void;
  overview(): void;
  setRoof(open: boolean): void;
  setFire(level: number): void;
  setAutoRotate(on: boolean): void;
  dispose(): void;
}

interface View { pos: THREE.Vector3; target: THREE.Vector3 }

const VIEWS: Record<string, View> = {
  overview: { pos: new THREE.Vector3(78, 58, 72), target: new THREE.Vector3(-2, 0, 0) },
  altar: { pos: new THREE.Vector3(30, 11, 13), target: new THREE.Vector3(18, 2, 0) },
  ash_heap: { pos: new THREE.Vector3(32, 8, 10), target: new THREE.Vector3(22, 0.5, 0) },
  laver: { pos: new THREE.Vector3(10, 7, 9), target: new THREE.Vector3(2, 1.8, 0) },
  incense_altar: { pos: new THREE.Vector3(-22, 14, 12), target: new THREE.Vector3(-33, 1.5, 0) },
  veil: { pos: new THREE.Vector3(-20, 15, 14), target: new THREE.Vector3(-35, 4, 0) },
  fence_linen: { pos: new THREE.Vector3(62, 26, 44), target: new THREE.Vector3(0, 2, 0) },
  gate_screen: { pos: new THREE.Vector3(72, 8, 18), target: new THREE.Vector3(50, 3, 0) },
};
const INSIDE = new Set(['incense_altar', 'veil']);

function weaveTexture(kind: 'gate' | 'veil'): THREE.CanvasTexture {
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
  g.globalAlpha = 0.18;
  for (let y = 0; y < c.height; y += 4) {
    g.fillStyle = y % 8 ? '#000' : '#fff';
    g.fillRect(0, y, c.width, 1);
  }
  if (kind === 'veil') {
    // 基路伯繡紋：抽象的金色翅膀圖樣（示意）
    g.globalAlpha = 0.7;
    g.strokeStyle = '#e0b44a';
    g.lineWidth = 5;
    for (let i = 0; i < 4; i++) {
      const cx = 64 + i * 128;
      const cy = 128;
      g.beginPath();
      g.moveTo(cx, cy + 30);
      g.quadraticCurveTo(cx - 50, cy - 10, cx - 44, cy - 60);
      g.moveTo(cx, cy + 30);
      g.quadraticCurveTo(cx + 50, cy - 10, cx + 44, cy - 60);
      g.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function sandTexture(): THREE.CanvasTexture {
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
  t.repeat.set(26, 26);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeFire(): { group: THREE.Group; tick: (t: number) => void; level: (n: number) => void } {
  const group = new THREE.Group();
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uLevel: { value: 0.35 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
    fragmentShader: `
      varying vec2 vUv; uniform float uTime; uniform float uLevel;
      float n(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
      float sn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
        return mix(mix(n(i),n(i+vec2(1,0)),f.x), mix(n(i+vec2(0,1)),n(i+vec2(1,1)),f.x), f.y); }
      void main(){
        vec2 uv=vUv; float t=uTime*1.6;
        float shape = 1.0 - smoothstep(0.0, 0.5, abs(uv.x-0.5) * (1.3 + uv.y*1.8));
        float flick = sn(vec2(uv.x*5.0, uv.y*4.0 - t*2.0)) * 0.6 + sn(vec2(uv.x*11.0, uv.y*9.0 - t*3.5)) * 0.4;
        float a = shape * smoothstep(1.0, 0.1, uv.y + (1.0-uLevel)*0.55) * (0.55 + flick*0.8);
        vec3 col = mix(vec3(1.0,0.35,0.05), vec3(1.0,0.85,0.4), smoothstep(0.55, 0.0, uv.y) * flick);
        gl_FragColor = vec4(col * a * 1.6, a);
      }`,
  });
  for (let i = 0; i < 3; i++) {
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 4.2), mat);
    plane.position.y = 2.1;
    plane.rotation.y = (i * Math.PI) / 3;
    group.add(plane);
  }
  const light = new THREE.PointLight(0xff8a3a, 12, 18, 1.6);
  light.position.y = 1.6;
  group.add(light);
  return {
    group,
    tick: (t) => {
      mat.uniforms.uTime.value = t;
      light.intensity = (8 + Math.sin(t * 9) * 1.5 + Math.sin(t * 23) * 0.8) * (0.4 + mat.uniforms.uLevel.value);
    },
    level: (n) => (mat.uniforms.uLevel.value = n),
  };
}

export async function createCourtyard(
  host: HTMLElement,
  labelsHost: HTMLElement,
  labels: LabelSpec[],
  onLabel: (id: string) => void,
  opts: { reducedMotion: boolean; lowPower: boolean; heroOffset?: boolean; autoRotate?: boolean; drift?: boolean },
): Promise<Courtyard> {
  const renderer = new THREE.WebGLRenderer({ antialias: !opts.lowPower, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, opts.lowPower ? 1 : 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = !opts.lowPower;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  host.append(renderer.domElement);
  renderer.domElement.setAttribute('aria-label', '可以拖曳轉動的 3D 會幕院子（示意重建）');
  renderer.domElement.setAttribute('role', 'img');

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#e8d6b4');
  scene.fog = new THREE.Fog('#e8d6b4', 140, 320);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 800);
  camera.position.copy(VIEWS.overview.pos);

  scene.add(new THREE.HemisphereLight(0xfff3dc, 0x8a6b44, 0.9));
  const sun = new THREE.DirectionalLight(0xfff0d0, 2.4);
  sun.position.set(60, 90, 40);
  sun.castShadow = !opts.lowPower;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 45, bottom: -45, near: 10, far: 250 });
  sun.shadow.bias = -0.0005;
  scene.add(sun);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshStandardMaterial({ map: sandTexture(), roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  const courtFloor = new THREE.Mesh(new THREE.PlaneGeometry(100, 50), new THREE.MeshStandardMaterial({ color: '#e6d5b0', roughness: 1 }));
  courtFloor.rotation.x = -Math.PI / 2;
  courtFloor.position.y = 0.02;
  courtFloor.receiveShadow = true;
  scene.add(courtFloor);

  const gltf = await new GLTFLoader().loadAsync(new URL('models/courtyard.glb', document.baseURI).href);
  const model = gltf.scene;
  const gateTex = weaveTexture('gate');
  const veilTex = weaveTexture('veil');
  model.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.castShadow = !opts.lowPower;
    m.receiveShadow = !opts.lowPower;
    const mat = m.material as THREE.MeshStandardMaterial;
    if (mat.name === 'gate_weave' || mat.name === 'veil_weave') {
      m.material = new THREE.MeshStandardMaterial({ map: mat.name === 'gate_weave' ? gateTex : veilTex, roughness: 0.85, side: THREE.DoubleSide });
    } else if (mat.name === 'linen') {
      mat.side = THREE.DoubleSide;
      mat.transparent = true;
      mat.opacity = 0.92;
    }
  });
  scene.add(model);

  const roof = model.getObjectByName('tent_roof');
  const fire = makeFire();
  const altar = model.getObjectByName('altar');
  fire.group.position.set(18, 3, 0);
  scene.add(fire.group);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(VIEWS.overview.target);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI * 0.47;
  controls.minDistance = 6;
  controls.maxDistance = 190;
  controls.autoRotate = !opts.reducedMotion && opts.autoRotate !== false;
  controls.autoRotateSpeed = 0.35;
  controls.enablePan = true;
  controls.screenSpacePanning = false;

  // 標籤
  const tmp = new THREE.Vector3();
  const labelEls = labels.map((l) => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'label3d';
    el.textContent = l.text;
    el.addEventListener('click', () => onLabel(l.id));
    labelsHost.append(el);
    const node = model.getObjectByName(l.node);
    const box = node ? new THREE.Box3().setFromObject(node) : null;
    const anchor = box ? new THREE.Vector3((box.min.x + box.max.x) / 2, box.max.y, (box.min.z + box.max.z) / 2) : new THREE.Vector3();
    if (l.offset) anchor.add(new THREE.Vector3(...l.offset));
    return { el, anchor };
  });

  // 相機移動
  let tween: { from: View; to: View; t: number } | null = null;
  function flyTo(v: View, instant = false) {
    controls.autoRotate = false;
    tween = { from: { pos: camera.position.clone(), target: controls.target.clone() }, to: v, t: opts.reducedMotion || instant ? 1 : 0 };
  }
  const tickers: ((t: number, dt: number) => void)[] = [];

  let running = true;
  let visible = true;
  const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
  io.observe(host);
  const clock = new THREE.Clock();
  const resize = () => {
    const w = host.clientWidth;
    const hh = host.clientHeight;
    renderer.setSize(w, hh, false);
    camera.aspect = w / Math.max(1, hh);
    camera.fov = w < 640 ? 50 : 38;
    // 寬螢幕：左邊是直排標題、下方是填空句，把院子往右上推一點
    if (w >= 1000 && opts.heroOffset !== false) camera.setViewOffset(w, hh, -w * 0.06, hh * 0.1, w, hh);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();

  function frame() {
    if (!running) return;
    requestAnimationFrame(frame);
    if (!visible || document.hidden) return;
    // dt 夾在 0–0.25 秒：背景分頁回來時不要一次跳太大，慢機器也不會變成慢動作
    const dt = Math.max(0, Math.min(0.25, clock.getDelta()));
    const t = clock.elapsedTime;
    for (const fn of tickers) fn(t, dt);
    if (tween) {
      tween.t = Math.min(1, tween.t + dt / 1.7);
      const e = tween.t < 0.5 ? 4 * tween.t ** 3 : 1 - (-2 * tween.t + 2) ** 3 / 2;
      camera.position.lerpVectors(tween.from.pos, tween.to.pos, e);
      controls.target.lerpVectors(tween.from.target, tween.to.target, e);
      if (tween.t >= 1) {
        tween = null;
        // 演練時鏡頭到位後慢慢繞，畫面不會停住
        if (opts.drift && !opts.reducedMotion) {
          controls.autoRotateSpeed = 0.22;
          controls.autoRotate = true;
        }
      }
    }
    controls.update();
    fire.tick(t);
    renderer.render(scene, camera);
    const w = host.clientWidth;
    const hh = host.clientHeight;
    for (const l of labelEls) {
      tmp.copy(l.anchor).project(camera);
      const hidden = tmp.z > 1 || Math.abs(tmp.x) > 1.05 || Math.abs(tmp.y) > 1.05;
      l.el.style.opacity = hidden ? '0' : '1';
      l.el.style.pointerEvents = hidden ? 'none' : 'auto';
      l.el.style.left = `${((tmp.x + 1) / 2) * w}px`;
      l.el.style.top = `${((1 - tmp.y) / 2) * hh - 6}px`;
    }
  }
  frame();
  void altar;

  return {
    scene,
    model,
    flyTo(pos, target, instant) {
      flyTo({ pos: pos.clone(), target: target.clone() }, instant);
    },
    onTick(fn) {
      tickers.push(fn);
    },
    project(v) {
      tmp.copy(v).project(camera);
      return {
        x: ((tmp.x + 1) / 2) * host.clientWidth,
        y: ((1 - tmp.y) / 2) * host.clientHeight,
        hidden: tmp.z > 1 || Math.abs(tmp.x) > 1.05 || Math.abs(tmp.y) > 1.05,
      };
    },
    focus(node) {
      const v = VIEWS[node];
      if (!v) return;
      if (roof) roof.visible = !INSIDE.has(node);
      flyTo(v);
    },
    overview() {
      if (roof) roof.visible = true;
      flyTo(VIEWS.overview);
    },
    setRoof(open) {
      if (roof) roof.visible = !open;
    },
    setFire(level) {
      fire.level(level);
    },
    setAutoRotate(on) {
      controls.autoRotate = on && !opts.reducedMotion;
    },
    dispose() {
      running = false;
      ro.disconnect();
      io.disconnect();
      renderer.dispose();
    },
  };
}
