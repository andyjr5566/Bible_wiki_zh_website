import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/** 抽屜裡的細部模型檢視器。host 從頁面移除後自動釋放。 */
export async function mountDetail(host: HTMLElement, file: string, opts: { gold?: boolean; reducedMotion: boolean }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  host.append(renderer.domElement);
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.add(new THREE.HemisphereLight(0xfff3dc, 0x6b5236, 0.9));
  const key = new THREE.DirectionalLight(0xffffff, 2);
  key.position.set(3, 5, 4);
  scene.add(key);
  const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);

  const gltf = await new GLTFLoader().loadAsync(new URL(`models/${file}`, document.baseURI).href);
  const model = gltf.scene;
  if (opts.gold) {
    // 出25:11：裡外包上精金
    const gold = new THREE.MeshStandardMaterial({ color: '#d9ab3f', metalness: 1, roughness: 0.28 });
    model.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.material = gold; });
  }
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  model.position.sub(center);
  const s = 2 / Math.max(size.x, size.y, size.z);
  model.scale.setScalar(s);
  model.position.multiplyScalar(s);
  scene.add(model);
  camera.position.set(2.2, 1.4, 2.6);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.autoRotate = !opts.reducedMotion;
  controls.autoRotateSpeed = 1.2;
  controls.enablePan = false;
  controls.minDistance = 1.2;
  controls.maxDistance = 6;

  const resize = () => {
    const w = host.clientWidth;
    const h = host.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
  };
  resize();
  const frame = () => {
    if (!host.isConnected) {
      renderer.dispose();
      pmrem.dispose();
      return;
    }
    requestAnimationFrame(frame);
    controls.update();
    renderer.render(scene, camera);
  };
  frame();
}
