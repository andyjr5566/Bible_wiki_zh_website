import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { SceneId } from '../data/types';
import { DRAFT, setupArk, type Ark } from './ark';
import { BEATS, EXPLORE, HERO, beatAt, mix, type Look, type V3 } from './director';
import { createAltarFx, createPost } from './fx';
import { createInterior } from './interior';
import { createLife, SPECIES } from './life';
import { createOcean, waveAt } from './ocean';
import { createSky, skyHorizon, skyZenith } from './sky';
import { createTerrain, heightAt } from './terrain';
import { clamp, lerp, smooth } from './util';
import { createLightning, createRain } from './weather';

export interface Frame {
  look: Look;
  inside: boolean;
  floating: number;
  flash: number;
  camera: THREE.PerspectiveCamera;
}
export interface EngineEvents {
  onProgress?: (loaded: number, label: string) => void;
  onReady?: () => void;
  onFrame?: (f: Frame) => void;
  onThunder?: (distance: number) => void;
}

const MODEL_URL = (f: string) => new URL(`models/${f}`, document.baseURI).href;
const TRANSITION = 0.3;
/** 這幾個轉場跨過牆或整個場景換地方，用淡出淡入接起來 */
const FADE_INTO = new Set<SceneId>(['corrupt', 'door', 'inside', 'remember']);

export function createEngine(host: HTMLElement, order: SceneId[], ev: EngineEvents = {}) {
  const coarse = matchMedia('(pointer: coarse)').matches || innerWidth < 900;
  const quality: 'high' | 'low' = coarse ? 'low' : 'high';
  const renderer = new THREE.WebGLRenderer({ antialias: quality === 'high', powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, quality === 'high' ? 1.6 : 1.25));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.localClippingEnabled = true;
  host.append(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x9fb1c2, 0.0012);
  const camera = new THREE.PerspectiveCamera(45, 1, 0.3, 20000);

  const sky = createSky();
  scene.add(sky.dome, sky.bow);
  const hemi = new THREE.HemisphereLight(0xbcd0e6, 0x5b5040, 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0d8, 3);
  sun.castShadow = true;
  sun.shadow.mapSize.setScalar(quality === 'high' ? 2048 : 1024);
  const SC = 110;
  Object.assign(sun.shadow.camera, { left: -SC, right: SC, top: SC, bottom: -SC, near: 10, far: 700 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.05;
  sun.shadow.camera.updateProjectionMatrix();
  scene.add(sun, sun.target);

  // ---------------------------------------------------------------- 環境光：把天空的顏色做成環境貼圖，船身和地面才有天光
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  const envU = { uZ: { value: new THREE.Color() }, uH: { value: new THREE.Color() }, uG: { value: new THREE.Color(0.18, 0.17, 0.14) }, uSun: { value: new THREE.Vector3(0, 1, 0) }, uSunC: { value: new THREE.Color() } };
  envScene.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, uniforms: envU,
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 uZ, uH, uG, uSun, uSunC; varying vec3 vD;
      void main(){ vec3 d = normalize(vD); vec3 c = d.y > 0.0 ? mix(uH, uZ, smoothstep(0.0, 0.6, d.y)) : mix(uH * 0.7, uG, smoothstep(0.0, -0.3, d.y));
        c += uSunC * pow(max(dot(d, uSun), 0.0), 24.0) * 3.0; gl_FragColor = vec4(c, 1.0); }`,
  })));
  let envRT: THREE.WebGLRenderTarget | null = null;
  let envKey = '';
  let envAge = 99;
  function updateEnv(el: number, storm: number, sunDirV: THREE.Vector3, sunCol: THREE.Color, dt: number) {
    envAge += dt;
    const key = `${el.toFixed(2)}|${storm.toFixed(2)}|${sunDirV.x.toFixed(1)}${sunDirV.z.toFixed(1)}`;
    if (key === envKey || envAge < 0.35) return;
    envKey = key;
    envAge = 0;
    skyZenith(el, storm, envU.uZ.value);
    skyHorizon(el, storm, envU.uH.value);
    envU.uSun.value.copy(sunDirV);
    envU.uSunC.value.copy(sunCol).multiplyScalar(1 - storm * 0.9);
    const rt = pmrem.fromScene(envScene, 0, 0.1, 100);
    scene.environment = rt.texture;
    envRT?.dispose();
    envRT = rt;
  }

  const terrain = createTerrain(quality);
  scene.add(terrain.group);
  const ocean = createOcean(quality);
  scene.add(ocean.group);
  const rain = createRain(quality);
  scene.add(rain.object);
  const lightning = createLightning((d) => ev.onThunder?.(d));
  scene.add(lightning.group);
  const life = createLife(scene);
  const altarFx = createAltarFx();
  scene.add(altarFx.group);
  const post = createPost(renderer, scene, camera, quality);

  // ---------------------------------------------------------------- 尺寸標註（第 3 幕）
  const dims = new THREE.Group();
  const dimMat = new THREE.LineBasicMaterial({ color: 0xf1d9a0, transparent: true, depthTest: false, opacity: 0 });
  const seg = (a: V3, b: V3) => new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...a), new THREE.Vector3(...b)]), dimMat);
  const tick = (p: V3, d: V3) => seg([p[0] - d[0], p[1] - d[1], p[2] - d[2]], [p[0] + d[0], p[1] + d[1], p[2] + d[2]]);
  dims.add(seg([-67.5, 0.3, -20], [67.5, 0.3, -20]), tick([-67.5, 0.3, -20], [0, 0, 1.6]), tick([67.5, 0.3, -20], [0, 0, 1.6]));
  dims.add(seg([75, 0, -12], [75, 13.5, -12]), tick([75, 0, -12], [1.6, 0, 0]), tick([75, 13.5, -12], [1.6, 0, 0]));
  dims.add(seg([-75, 0.3, -11.25], [-75, 0.3, 11.25]), tick([-75, 0.3, -11.25], [1.6, 0, 0]), tick([-75, 0.3, 11.25], [1.6, 0, 0]));
  dims.renderOrder = 20;
  dims.children.forEach((c) => (c.renderOrder = 20));
  scene.add(dims);
  const dimLabels: { el: HTMLElement; at: THREE.Vector3 }[] = [];

  // ---------------------------------------------------------------- 載入
  const loader = new GLTFLoader();
  const models = new Map<string, GLTF>();
  let ark: Ark | null = null;
  let interior: ReturnType<typeof createInterior> | null = null;
  const loadOne = (name: string, file: string) => loader.loadAsync(MODEL_URL(file)).then((g) => (models.set(name, g), g));
  const arkP = loadOne('ark', 'ark.glb').then((g) => {
    ark = setupArk(g, quality);
    scene.add(ark.root, ark.yard);
    interior = createInterior(ark.root);
  });
  let loaded = 0;
  const extras = ['figures', 'birds', 'altar'];
  const animalFiles = SPECIES.map((s) => s.file);
  const total = 1 + extras.length + animalFiles.length;
  const tickLoad = (label: string) => ev.onProgress?.(++loaded / total, label);
  arkP.then(() => {
    tickLoad('方舟');
    ev.onReady?.();
  });
  // 其餘模型背景載入，不擋開場
  arkP.then(async () => {
    await Promise.all(extras.map((e) => loadOne(e, `${e}.glb`).then(() => tickLoad(e)).catch(() => tickLoad(e))));
    for (let i = 0; i < animalFiles.length; i += 4) {
      await Promise.all(animalFiles.slice(i, i + 4).map((f) => loadOne(f, `animals/${f}.glb`).then(() => tickLoad(f)).catch(() => tickLoad(f))));
    }
    if (ark) life.attach(models, ark.root);
    const al = life.altar;
    if (al) al.add(altarFx.group);
  });

  // ---------------------------------------------------------------- 鏡頭與狀態
  let mode: 'story' | 'explore' = 'story';
  let progress = 0;
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enabled = false;
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI * 0.495;
  controls.minDistance = 6;
  controls.maxDistance = 420;
  controls.target.set(0, 6, 0);
  let explore = { ...EXPLORE, cut: 0, lamps: 0 };
  let exploreBlend = 0;
  let rotateAllowed = true;
  let wasExplore = false;
  const walk = { on: false, yaw: Math.PI / 2, pitch: 0, pos: new THREE.Vector3(-40, 3.4, 0), deck: 0, keys: new Set<string>(), drag: null as null | { x: number; y: number } };

  const arkPose = { pos: new THREE.Vector3(), yaw: 0, pitch: 0, roll: 0, heave: 0, floating: 0 };
  const tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler();
  const staticMatrix = (l: Look) => {
    const g = Math.max(heightAt(l.arkX, l.arkZ), l.water - DRAFT);
    tmpE.set(0, l.arkYaw, 0);
    return new THREE.Matrix4().compose(new THREE.Vector3(l.arkX, g, l.arkZ), tmpQ.setFromEuler(tmpE), new THREE.Vector3(1, 1, 1));
  };
  const absCam = (l: Look, m: THREE.Matrix4, useRot: boolean) => {
    const c = new THREE.Vector3(...l.cam), t = new THREE.Vector3(...l.look);
    if (l.anchor === 'world') return { c, t };
    const pos = new THREE.Vector3().setFromMatrixPosition(m);
    if (l.anchor === 'ark' || !useRot) {
      // 以方舟為原點、跟著船頭方向轉，但不跟著浪搖
      const yaw = new THREE.Vector3(0, 1, 0);
      return { c: c.applyAxisAngle(yaw, l.arkYaw).add(pos), t: t.applyAxisAngle(yaw, l.arkYaw).add(pos) };
    }
    return { c: c.applyMatrix4(m), t: t.applyMatrix4(m) };
  };

  /** 依捲動進度取得這一格的狀態 */
  function storyLook(): { look: Look; a?: Look; b?: Look; w: number; fade: number } {
    const P = clamp(progress, 0, order.length + 0.999);
    const i = Math.floor(P);
    const t = P - i;
    if (i === 0) return { look: beatAt(HERO, t), w: 1, fade: 0 };
    const cur = BEATS[order[i - 1]];
    if (!cur) return { look: beatAt(HERO, 1), w: 1, fade: 0 };
    if (t >= TRANSITION) return { look: beatAt(cur, (t - TRANSITION) / (1 - TRANSITION)), w: 1, fade: 0 };
    const prev = i === 1 ? HERO : BEATS[order[i - 2]];
    const a = beatAt(prev, 1), b = beatAt(cur, 0);
    const k = smooth(t / TRANSITION);
    const fadeHere = FADE_INTO.has(order[i - 1]);
    // 淡出淡入：前半段停在上一幕、後半段直接是這一幕
    if (fadeHere) {
      const look = k < 0.5 ? a : b;
      return { look, w: 1, fade: Math.sin(Math.PI * k) ** 0.6 };
    }
    return { look: mix(a, b, k), a, b, w: k, fade: 0 };
  }

  // ---------------------------------------------------------------- 迴圈
  const clock = new THREE.Clock();
  let time = 0;
  let visible = true;
  let active = true;
  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(host);
  const sunDir = new THREE.Vector3();
  const tmpV = new THREE.Vector3();
  const fogCol = new THREE.Color();
  let shakeT = 0;
  const reduced = () => document.documentElement.dataset.motion === 'off' || matchMedia('(prefers-reduced-motion: reduce)').matches;

  function resize() {
    const w = host.clientWidth, h = host.clientHeight;
    renderer.setSize(w, h, false);
    post.setSize(w, h);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(host);
  resize();

  function frame() {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, clock.getDelta());
    if (!visible || !active || document.hidden) return;
    time += dt;

    // 1. 狀態
    let L: Look, camC: THREE.Vector3, camT: THREE.Vector3, fade = 0;
    const s = storyLook();
    const storyL = s.look;
    if (mode === 'explore' || exploreBlend > 0) {
      exploreBlend = clamp(exploreBlend + (mode === 'explore' ? dt : -dt) * 1.6);
    }
    const inExplore = mode === 'explore' && exploreBlend > 0.5;
    // 剛切進探索模式的那一格，把鏡頭放到探索的起點（之前幾格還是故事的鏡頭）
    if (inExplore && !wasExplore) {
      camera.clearViewOffset();
      // 直式螢幕看不到整艘船，退遠一點、視角放寬
      const far = camera.aspect < 1 ? 1.9 : 1;
      camera.position.set(...EXPLORE.cam).sub(controls.target.set(...EXPLORE.look)).multiplyScalar(far).add(controls.target);
      camera.fov = EXPLORE.fov * (camera.aspect < 1 ? 1.3 : 1);
      camera.updateProjectionMatrix();
    }
    wasExplore = inExplore;
    L = inExplore ? explore : storyL;
    fade = mode === 'explore' || exploreBlend > 0 ? Math.sin(Math.PI * exploreBlend) : s.fade;
    if (!inExplore) fade = Math.max(fade, s.fade);

    // 2. 方舟位置：地面或水面，浮起時照浪起伏
    const ground = heightAt(L.arkX, L.arkZ);
    const floatY = L.water - DRAFT;
    arkPose.floating = clamp((floatY - ground) / 1.2);
    const amp = L.waves;
    const cy = Math.cos(L.arkYaw), sy = Math.sin(L.arkYaw);
    const hAt = (lx: number, lz: number) => waveAt(L.arkX + lx * cy + lz * sy, L.arkZ - lx * sy + lz * cy, time, amp);
    const bow = hAt(55, 0), stern = hAt(-55, 0), port = hAt(0, -10), star = hAt(0, 10);
    const f = arkPose.floating * (reduced() ? 0.3 : 1);
    arkPose.heave = ((bow + stern + port + star) / 4) * f;
    arkPose.pitch = Math.atan2(bow - stern, 110) * f * 0.8;
    arkPose.roll = Math.atan2(port - star, 20) * f * 0.5;
    // 擱淺時龍骨陷進泥裡一點，看起來才是壓在地上
    arkPose.pos.set(L.arkX, Math.max(ground - 0.5, floatY + arkPose.heave), L.arkZ);
    if (ark) {
      ark.root.position.copy(arkPose.pos);
      ark.root.rotation.set(arkPose.roll, L.arkYaw, arkPose.pitch, 'YXZ');
      ark.yard.position.set(0, 0, 0);
      ark.setBuild(L.build);
      ark.setPitch(L.pitch);
      ark.setDoor(L.door);
      ark.setShutter(L.shutter);
      ark.setCover(L.cover);
      ark.setCut(L.cut);
      ark.setRamp(L.ramp > 0.5 && arkPose.floating < 0.05 && Math.abs(L.arkX) < 1);
      ark.setWet(L.wet);
      ark.setContact(1 - arkPose.floating);
      ark.setLamps(L.lamps, time);
      // 船艙擺設：探索時、故事裡在艙內或剖開時才畫
      interior?.update(time, inExplore || L.anchor === 'local' || L.cut > 0.05, (inExplore && walk.on) || L.anchor === 'local');
      ark.update();
    }

    // 3. 鏡頭
    controls.enabled = inExplore && !walk.on && rotateAllowed;
    controls.enableZoom = false;
    renderer.domElement.style.touchAction = (inExplore && (rotateAllowed || walk.on)) ? 'none' : 'pan-y';
    if (inExplore) {
      if (walk.on && ark) {
        stepWalk(dt);
      } else {
        controls.update();
      }
    } else {
      const dyn = ark ? ark.root.matrixWorld : staticMatrix(L);
      if (s.a && s.b && s.a.anchor !== s.b.anchor) {
        const A = absCam(s.a, staticMatrix(s.a), false), B = absCam(s.b, staticMatrix(s.b), false);
        camC = A.c.lerp(B.c, s.w);
        camT = A.t.lerp(B.t, s.w);
      } else {
        const r = absCam(L, dyn, true);
        camC = r.c;
        camT = r.t;
        if (L.anchor === 'ark') {
          // 跟著浪上下，但只跟一部分，免得暈
          camC.y -= arkPose.heave * 0.6;
          camT.y -= arkPose.heave * 0.4;
        }
      }
      // 暴風中的手持晃動
      shakeT += dt;
      const sh = reduced() ? 0 : L.shake;
      camC.x += Math.sin(shakeT * 1.3) * 0.25 * sh + Math.sin(shakeT * 3.1) * 0.08 * sh;
      camC.y += Math.sin(shakeT * 1.7 + 1) * 0.18 * sh;
      // 鏡頭不鑽進地面或水裡
      const floor = Math.max(heightAt(camC.x, camC.z) + 1.2, L.water + (L.anchor === 'local' ? -99 : 2 + L.waves * 5));
      if (L.anchor !== 'local' && camC.y < floor) camC.y = floor;
      camera.position.copy(camC);
      camera.lookAt(camT);
      // 直式手機：視角放寬一點，畫面主體往上移，讓出下半部給文字卡片
      const narrow = clamp((1.2 - camera.aspect) / 0.7);
      camera.fov = Math.min(80, L.fov * (1 + 0.5 * narrow));
      if (narrow > 0) camera.setViewOffset(host.clientWidth, host.clientHeight, 0, host.clientHeight * 0.2 * narrow, host.clientWidth, host.clientHeight);
      else camera.clearViewOffset();
      camera.updateProjectionMatrix();
    }

    // 4. 天氣與光
    const el = THREE.MathUtils.degToRad(L.sunEl), az = THREE.MathUtils.degToRad(L.sunAz);
    sunDir.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)).normalize();
    lightning.update(dt, L.bolts, camera, Math.max(L.water, 0));
    const flash = lightning.flash;
    sky.set(sunDir, L.storm, L.cloud, time, flash * flash);
    sky.setBow(L.bow);
    sky.follow(camera);
    const warm = clamp(1 - el / 0.5);
    sun.color.setRGB(1, lerp(0.96, 0.7, warm), lerp(0.9, 0.5, warm));
    updateEnv(el, L.storm, sunDir, sun.color, dt);
    scene.environmentIntensity = (L.anchor === 'local' || (walk.on && inExplore) ? 0.12 : lerp(0.75, 0.5, L.storm)) + flash * 0.6;
    sun.intensity = lerp(3.2, 0.35, L.storm) * clamp(el / 0.08 + 0.15) + flash * 2.5;
    const indoors = L.anchor === 'local' || (walk.on && inExplore);
    hemi.intensity = lerp(0.95, 0.55, L.storm) + flash * 1.5 + (indoors ? -0.3 : 0);
    hemi.color.copy(skyZenith(el, L.storm)).lerp(new THREE.Color(1, 1, 1), 0.35);
    const focus = ark ? arkPose.pos : new THREE.Vector3();
    sun.position.copy(focus).addScaledVector(sunDir, 300);
    sun.target.position.copy(focus);
    skyHorizon(el, L.storm, fogCol);
    (scene.fog as THREE.FogExp2).color.copy(fogCol);
    (scene.fog as THREE.FogExp2).density = 0.00055 * L.fog * (L.anchor === 'local' ? 0.2 : 1);
    renderer.toneMappingExposure = L.exposure * (1 + flash * 0.3);

    // 5. 水
    ocean.update(camera, L.water, time);
    if (ark) {
      ocean.uniforms.uArkInv.value.copy(ark.root.matrixWorld).invert();
      ocean.uniforms.uArkOn.value = 1;
    }
    ocean.uniforms.uAmp.value = L.waves;
    ocean.uniforms.uSun.value.copy(sunDir);
    ocean.uniforms.uStorm.value = L.storm;
    ocean.uniforms.uFlash.value = flash;
    ocean.uniforms.uSky.value.copy(fogCol);
    skyZenith(el, L.storm, ocean.uniforms.uZenith.value);
    ocean.uniforms.uSunColor.value.copy(sun.color);
    ocean.uniforms.uMurk.value = 0.4 + L.storm * 0.5;
    terrain.set({ mud: L.mud, green: L.green, water: L.water });
    terrain.smoke(time, L.water);
    terrain.grass(camera.position.y, L.water);
    rain.set(L.rain, time, flash, L.water);

    // 6. 生命
    const altarPos = ark ? ark.root.localToWorld(tmpV.set(22, 0, -46)).clone() : null;
    if (life.altar && altarPos) {
      life.altar.position.set(altarPos.x, heightAt(altarPos.x, altarPos.z), altarPos.z);
      life.altar.visible = L.altar > 0.02;
    }
    altarFx.update(time, L.altar, new THREE.Vector2(0.4, 0.15));
    if (ark) {
      life.update({
        dt, time, mode: inExplore ? 'pens' : L.life, spawn: L.spawn > 0.5, family: L.family, familyMode: inExplore ? 'home' : L.familyMode,
        flock: inExplore ? 0 : L.flock, birds: inExplore ? 0 : L.birds, ark: ark.root, altarPos, perch: inExplore,
      });
    }

    // 7. 尺寸標註
    dimMat.opacity = L.dims;
    dims.visible = L.dims > 0.01;
    dimLabels.forEach((d) => {
      tmpV.copy(d.at).project(camera);
      const on = L.dims > 0.05 && tmpV.z < 1;
      d.el.style.opacity = String(on ? L.dims : 0);
      d.el.style.transform = `translate(-50%, -50%) translate(${((tmpV.x + 1) / 2) * host.clientWidth}px, ${((1 - tmpV.y) / 2) * host.clientHeight}px)`;
    });

    // 8. 後製
    post.grade.uTime.value = time;
    post.grade.uWarm.value = L.warm;
    post.grade.uSat.value = L.sat;
    post.grade.uVignette.value = L.vignette;
    post.grade.uFade.value = fade;
    post.grade.uGrain.value = 0.035 + L.storm * 0.02;
    post.bloom.strength = 0.28 + L.lamps * 0.25 + L.altar * 0.2 + flash * 0.6;
    post.composer.render(dt);

    ev.onFrame?.({ look: L, inside: L.anchor === 'local' || (walk.on && inExplore), floating: arkPose.floating, flash, camera });
  }

  // ---------------------------------------------------------------- 走進船艙（探索模式）
  const DECK_EYE = [1.8 + 1.6, 5.8 + 1.6, 9.5 + 1.6];
  function stepWalk(dt: number) {
    if (!ark) return;
    const k = walk.keys;
    const f = (k.has('w') || k.has('arrowup') ? 1 : 0) - (k.has('s') || k.has('arrowdown') ? 1 : 0);
    const r = (k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0);
    const sp = (k.has('shift') ? 7 : 3.4) * dt;
    const fx = Math.sin(walk.yaw), fz = Math.cos(walk.yaw);
    walk.pos.x += (fx * f - fz * r) * sp;
    walk.pos.z += (fz * f + fx * r) * sp;
    const half = Math.abs(walk.pos.x) < 38 ? 10.4 : 10.4 * (1 - 0.5 * Math.pow(clamp((Math.abs(walk.pos.x) / 67.5 - 0.58) / 0.42), 1.7)) - 0.6;
    walk.pos.x = clamp(walk.pos.x, -64, 64);
    walk.pos.z = clamp(walk.pos.z, -half, half);
    walk.pos.y = lerp(walk.pos.y, DECK_EYE[walk.deck], 0.15);
    camera.position.copy(walk.pos).applyMatrix4(ark.root.matrixWorld);
    tmpV.set(walk.pos.x + Math.sin(walk.yaw) * Math.cos(walk.pitch), walk.pos.y + Math.sin(walk.pitch), walk.pos.z + Math.cos(walk.yaw) * Math.cos(walk.pitch)).applyMatrix4(ark.root.matrixWorld);
    camera.lookAt(tmpV);
    camera.fov = 62;
    camera.updateProjectionMatrix();
  }
  addEventListener('keydown', (e) => {
    if (!walk.on) return;
    const key = e.key.toLowerCase();
    walk.keys.add(key);
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) e.preventDefault();
  });
  addEventListener('keyup', (e) => walk.keys.delete(e.key.toLowerCase()));
  renderer.domElement.addEventListener('pointerdown', (e) => {
    if (walk.on) walk.drag = { x: e.clientX, y: e.clientY };
  });
  addEventListener('pointermove', (e) => {
    if (!walk.on || !walk.drag) return;
    walk.yaw -= (e.clientX - walk.drag.x) * 0.004;
    walk.pitch = clamp(walk.pitch - (e.clientY - walk.drag.y) * 0.003, -1.1, 1.1);
    walk.drag = { x: e.clientX, y: e.clientY };
  });
  addEventListener('pointerup', () => (walk.drag = null));

  frame();

  return {
    quality,
    renderer,
    get ready() {
      return !!ark;
    },
    setProgress(p: number) {
      progress = p;
    },
    /** 內容區蓋住整個畫面時停掉繪圖，省電 */
    setActive(v: boolean) {
      active = v;
    },
    zoom(f: number) {
      const d = camera.position.clone().sub(controls.target);
      const len = clamp(d.length() * f, controls.minDistance, controls.maxDistance);
      camera.position.copy(controls.target).add(d.setLength(len));
    },
    setMode(m: 'story' | 'explore') {
      if (m === mode) return;
      mode = m;
      if (m !== 'explore') walk.on = false;
    },
    setExplore(o: Partial<{ cut: number; lamps: number; sunEl: number; walk: boolean; deck: number; rotate: boolean; view: 'side' | 'top' | 'door' | 'end' }>) {
      if (o.rotate !== undefined) rotateAllowed = o.rotate;
      explore = { ...explore, ...(o.cut !== undefined ? { cut: o.cut } : {}), ...(o.lamps !== undefined ? { lamps: o.lamps } : {}), ...(o.sunEl !== undefined ? { sunEl: o.sunEl } : {}) };
      if (o.walk !== undefined) {
        walk.on = o.walk;
        if (o.walk) {
          walk.pos.set(-40, DECK_EYE[walk.deck], 0);
          walk.yaw = Math.PI / 2;
          walk.pitch = 0;
          explore = { ...explore, lamps: 1 };
        } else {
          camera.position.set(...EXPLORE.cam);
          controls.target.set(...EXPLORE.look);
        }
      }
      if (o.deck !== undefined) walk.deck = o.deck;
      if (o.view) {
        const V: Record<string, [V3, V3]> = {
          side: [[-10, 12, -95], [0, 6, 0]], top: [[0, 150, -40], [0, 0, 0]], door: [[22, 5, -32], [10.7, 3, -11.3]], end: [[-120, 18, -30], [0, 6, 0]],
        };
        camera.position.set(...V[o.view][0]);
        controls.target.set(...V[o.view][1]);
      }
    },
    walkPad(dir: 'f' | 'b' | 'l' | 'r', on: boolean) {
      const map = { f: 'w', b: 's', l: 'a', r: 'd' } as const;
      if (on) walk.keys.add(map[dir]);
      else walk.keys.delete(map[dir]);
    },
    /** 方舟本地座標 → 螢幕座標；給船艙標示用 */
    project(at: V3) {
      if (!ark) return null;
      const w = ark.root.localToWorld(new THREE.Vector3(...at));
      const dist = w.distanceTo(camera.position);
      const v = w.clone().project(camera);
      return { x: ((v.x + 1) / 2) * host.clientWidth, y: ((1 - v.y) / 2) * host.clientHeight, front: v.z < 1 && v.z > -1, dist };
    },
    get walking() {
      return walk.on && mode === 'explore';
    },
    get deck() {
      return walk.deck;
    },
    addDimLabel(el: HTMLElement, at: V3) {
      dimLabels.push({ el, at: new THREE.Vector3(...at) });
    },
    /** 除錯用 */
    debug: { scene, camera, life, get ark() { return ark; }, models },
  };
}
export type Engine = ReturnType<typeof createEngine>;
