import * as THREE from 'three';
import { CameraManager } from './CameraManager';
import { DesertEnvironment } from './DesertEnvironment';
import { ParticleEffects } from './ParticleEffects';
import type { AtmosphereMode } from '../types/atmosphere';

export interface SceneContext {
  scene: THREE.Scene;
  worldRoot: THREE.Group;
  assetRoot: THREE.Group;
  renderer: THREE.WebGLRenderer;
  cameraManager: CameraManager;
  particles: ParticleEffects;
  environment: DesertEnvironment;
}

export class SceneBootstrap {
  readonly context: SceneContext;
  #animationFrame = 0;
  #lastTime = 0;
  #elapsedTime = 0;
  #update: (deltaSeconds: number) => void = () => undefined;
  readonly #canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.#canvas = canvas;
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x9bb0ba);

    const worldRoot = new THREE.Group();
    worldRoot.name = 'canonical-world-root';
    scene.add(worldRoot);

    const assetRoot = new THREE.Group();
    assetRoot.name = 'runtime-assets';
    worldRoot.add(assetRoot);

    const cameraManager = new CameraManager(1, canvas);
    const environment = new DesertEnvironment(scene);
    const particles = new ParticleEffects(worldRoot);

    this.context = {
      scene,
      worldRoot,
      assetRoot,
      renderer,
      cameraManager,
      particles,
      environment
    };

    this.resize();
  }

  setAtmosphere(mode: AtmosphereMode): void {
    this.context.environment.setAtmosphere(mode);
    this.context.particles.setAtmosphere(mode);
  }

  setQuality(preset: 'high' | 'medium' | 'low'): void {
    if (preset === 'high') {
      this.context.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      this.context.renderer.shadowMap.enabled = true;
    } else if (preset === 'medium') {
      this.context.renderer.setPixelRatio(1.0);
      this.context.renderer.shadowMap.enabled = true;
    } else {
      this.context.renderer.setPixelRatio(0.85);
      this.context.renderer.shadowMap.enabled = false;
    }
  }

  setUpdate(update: (deltaSeconds: number) => void): void {
    this.#update = update;
  }

  start(): void {
    if (this.#animationFrame) return;
    this.#lastTime = performance.now();
    this.#animationFrame = requestAnimationFrame(this.#tick);
  }

  stop(): void {
    cancelAnimationFrame(this.#animationFrame);
    this.#animationFrame = 0;
  }

  resize(): void {
    const width = Math.max(1, this.#canvas.clientWidth);
    const height = Math.max(1, this.#canvas.clientHeight);
    this.context.renderer.setSize(width, height, false);
    this.context.cameraManager.resize(width / height);
  }

  dispose(): void {
    this.stop();
    this.context.environment.dispose();
    this.context.particles.dispose();
    this.context.cameraManager.dispose();
    this.context.renderer.dispose();
  }

  readonly #tick = (time: number): void => {
    const deltaSeconds = Math.min((time - this.#lastTime) / 1000, 0.1);
    this.#lastTime = time;
    this.#elapsedTime += deltaSeconds;

    this.#update(deltaSeconds);
    this.context.particles.update(deltaSeconds, this.#elapsedTime);
    this.context.cameraManager.update();
    this.context.renderer.render(this.context.scene, this.context.cameraManager.camera);
    this.#animationFrame = requestAnimationFrame(this.#tick);
  };
}
