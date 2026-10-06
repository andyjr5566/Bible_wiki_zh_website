import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * 利11:33「你們要把這瓦器打破了」：一個瓦罐碎在地上。
 * 模型與碎裂動畫在 Blender 做好（public/models/clay-jar.glb，16 片，30fps），這裡只負責播放。
 * still = true（減少動態）時直接停在碎片落地的最後一格。
 */
export interface JarPlayer {
  play(): void;
  dispose(): void;
}

export async function mountJar(host: HTMLElement, still: boolean): Promise<JarPlayer> {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  host.append(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 50);
  camera.position.set(1.9, 1.25, 2.3);
  camera.lookAt(0.12, 0.18, 0);

  scene.add(new THREE.HemisphereLight(0xfff4e6, 0x6b5a48, 1.6));
  const sun = new THREE.DirectionalLight(0xffe2c0, 2.6);
  sun.position.set(2.5, 4, 1.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = sun.shadow.camera.bottom = -1.6;
  sun.shadow.camera.right = sun.shadow.camera.top = 1.6;
  sun.shadow.radius = 4;
  scene.add(sun);
  // 只接影子的地面：畫面背景跟著頁面的顏色
  const ground = new THREE.Mesh(new THREE.CircleGeometry(3, 48), new THREE.ShadowMaterial({ opacity: 0.22 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const gltf = await new GLTFLoader().loadAsync(new URL('models/clay-jar.glb', document.baseURI).href);
  gltf.scene.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = o.receiveShadow = true;
  });
  scene.add(gltf.scene);
  const mixer = new THREE.AnimationMixer(gltf.scene);
  const clips = gltf.animations;
  const actions = clips.map((c) => {
    const a = mixer.clipAction(c);
    a.setLoop(THREE.LoopOnce, 1);
    a.clampWhenFinished = true;
    return a;
  });
  const length = Math.max(0, ...clips.map((c) => c.duration));

  const size = () => {
    const w = host.clientWidth || 320;
    const hgt = host.clientHeight || 220;
    renderer.setSize(w, hgt, false);
    camera.aspect = w / hgt;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(() => { size(); renderer.render(scene, camera); });
  ro.observe(host);
  size();

  const clock = new THREE.Clock();
  let raf = 0;
  let left = 0;
  const tick = () => {
    const dt = Math.min(clock.getDelta(), 1 / 10);
    mixer.update(dt);
    renderer.render(scene, camera);
    left -= dt;
    raf = left > 0 ? requestAnimationFrame(tick) : 0;
  };

  const player: JarPlayer = {
    play() {
      actions.forEach((a) => { a.reset(); a.play(); });
      if (still) {
        mixer.setTime(length);
        renderer.render(scene, camera);
        return;
      }
      cancelAnimationFrame(raf);
      clock.getDelta();
      left = length + 0.2;
      raf = requestAnimationFrame(tick);
    },
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
  return player;
}
