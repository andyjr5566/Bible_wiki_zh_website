import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { ExperienceMode } from '../types/ui';
import type { Vector3Data } from '../types/core';
import type { WorldBounds } from './WorldAlignment';

export interface CameraTransition {
  startPos: THREE.Vector3;
  endPos: THREE.Vector3;
  startTarget: THREE.Vector3;
  endTarget: THREE.Vector3;
  startFov: number;
  endFov: number;
  duration: number;
  elapsed: number;
  onComplete?: (() => void) | undefined;
}

export class CameraManager {
  readonly camera: THREE.PerspectiveCamera;
  readonly #controls: OrbitControls | null;
  #mode: ExperienceMode = 'overview';
  #activeTransition: CameraTransition | null = null;

  constructor(aspect: number, domElement?: HTMLElement) {
    this.camera = new THREE.PerspectiveCamera(48, aspect, 0.1, 500);
    this.camera.position.set(17, 13, 30);
    this.camera.lookAt(0, 0.8, 0);

    this.#controls = domElement ? new OrbitControls(this.camera, domElement) : null;
    if (this.#controls) {
      this.#controls.enableDamping = true;
      this.#controls.dampingFactor = 0.075;
      this.#controls.enablePan = false;
      this.#controls.minDistance = 1.8;
      this.#controls.maxDistance = 95;
      this.#controls.minPolarAngle = 0.08;
      this.#controls.maxPolarAngle = Math.PI * 0.485;
      this.#controls.zoomToCursor = false;
      this.#controls.target.set(0, 0.8, 0);
      this.#controls.update();
    }
  }

  get controls(): OrbitControls | null {
    return this.#controls;
  }

  resize(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  setFov(fov: number): void {
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
  }

  update(deltaSeconds = 0.016): void {
    if (this.#activeTransition) {
      this.#activeTransition.elapsed += deltaSeconds;
      const t = Math.min(1.0, this.#activeTransition.elapsed / this.#activeTransition.duration);
      // Smooth cosine ease-in-out curve
      const easeT = 0.5 - 0.5 * Math.cos(t * Math.PI);

      this.camera.position.lerpVectors(
        this.#activeTransition.startPos,
        this.#activeTransition.endPos,
        easeT
      );

      const curTarget = new THREE.Vector3().lerpVectors(
        this.#activeTransition.startTarget,
        this.#activeTransition.endTarget,
        easeT
      );

      if (this.#controls) {
        this.#controls.target.copy(curTarget);
        this.#controls.update();
      } else {
        this.camera.lookAt(curTarget);
      }

      this.camera.fov = THREE.MathUtils.lerp(
        this.#activeTransition.startFov,
        this.#activeTransition.endFov,
        easeT
      );
      this.camera.updateProjectionMatrix();

      if (t >= 1.0) {
        const cb = this.#activeTransition.onComplete;
        this.#activeTransition = null;
        cb?.();
      }
    } else {
      this.#controls?.update();
    }
  }

  flyAlongPath(
    start: { position: Vector3Data; target: Vector3Data; fov: number },
    end: { position: Vector3Data; target: Vector3Data; fov: number },
    durationSeconds = 3.5,
    onComplete?: () => void
  ): void {
    // Immediately position camera at start of path
    this.camera.position.set(start.position.x, start.position.y, start.position.z);
    this.camera.fov = start.fov;
    this.camera.updateProjectionMatrix();
    if (this.#controls) {
      this.#controls.target.set(start.target.x, start.target.y, start.target.z);
      this.#controls.update();
    } else {
      this.camera.lookAt(start.target.x, start.target.y, start.target.z);
    }

    // Set transition to smoothly glide from start to end
    this.#activeTransition = {
      startPos: new THREE.Vector3(start.position.x, start.position.y, start.position.z),
      endPos: new THREE.Vector3(end.position.x, end.position.y, end.position.z),
      startTarget: new THREE.Vector3(start.target.x, start.target.y, start.target.z),
      endTarget: new THREE.Vector3(end.target.x, end.target.y, end.target.z),
      startFov: start.fov,
      endFov: end.fov,
      duration: Math.max(0.5, durationSeconds),
      elapsed: 0,
      onComplete,
    };
  }

  flyToPath(
    goal: { position: Vector3Data; target: Vector3Data; fov?: number },
    durationSeconds = 2.8,
    onComplete?: () => void
  ): void {
    const startTarget = this.#controls
      ? this.#controls.target.clone()
      : new THREE.Vector3().addVectors(
          this.camera.position,
          this.camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(8)
        );

    this.#activeTransition = {
      startPos: this.camera.position.clone(),
      endPos: new THREE.Vector3(goal.position.x, goal.position.y, goal.position.z),
      startTarget,
      endTarget: new THREE.Vector3(goal.target.x, goal.target.y, goal.target.z),
      startFov: this.camera.fov,
      endFov: goal.fov ?? 46,
      duration: Math.max(0.5, durationSeconds),
      elapsed: 0,
      onComplete,
    };
  }

  stopFlyTo(): void {
    this.#activeTransition = null;
  }

  dispose(): void {
    this.#controls?.dispose();
  }

  applyMode(mode: ExperienceMode): void {
    this.#mode = mode;
    this.camera.up.set(0, 1, 0);
    this.stopFlyTo();
    if (mode === 'overview') this.applyRig({ position: { x: 17, y: 13, z: 30 }, target: { x: 0, y: 0.8, z: 0 }, fov: 46 });
    if (mode === 'tour') this.applyRig({ position: { x: 10, y: 7, z: 22 }, target: { x: 0, y: 1.2, z: 12 }, fov: 46 });
    if (mode === 'learning') this.applyRig({ position: { x: 8, y: 5.5, z: 14 }, target: { x: 0, y: 1.2, z: 7 }, fov: 48 });
  }

  focus(target: Vector3Data, distance = 8): void {
    const offset = this.#mode === 'tour'
      ? { x: distance * 0.18, y: distance * 0.4, z: distance }
      : { x: distance * 0.12, y: distance * 0.36, z: distance };
    this.applyRig({
      position: { x: target.x + offset.x, y: target.y + offset.y, z: target.z + offset.z },
      target: { ...target, y: target.y + 1 },
      fov: this.#mode === 'tour' ? 46 : 48
    });
  }

  focusMostHoly(target: Vector3Data): void {
    this.applyRig({
      position: { x: target.x + 1.45, y: target.y + 1.32, z: target.z + 1.15 },
      target: { x: target.x, y: target.y + 0.72, z: target.z - 0.18 },
      fov: 47,
    });
  }

  focusObject(objectId: string, target: Vector3Data): void {
    const rigs: Record<string, { position: Vector3Data; target: Vector3Data; fov: number }> = {
      'burnt-altar': { position: { x: 1.3, y: 3.1, z: 15.2 }, target: { x: 0, y: 1.05, z: 9 }, fov: 43 },
      laver: { position: { x: 1.05, y: 2.45, z: 4.9 }, target: { x: 0, y: 0.8, z: 0 }, fov: 43 },
      'incense-altar': { position: { x: 0.45, y: 1.7, z: -2.15 }, target: { x: 0, y: 1, z: -5.85 }, fov: 41 },
      menorah: { position: { x: 0.28, y: 1.5, z: -2.45 }, target: { x: -1.2, y: 0.82, z: -4.35 }, fov: 40 },
      'shewbread-table': { position: { x: -0.28, y: 1.5, z: -2.45 }, target: { x: 1.2, y: 0.78, z: -4.35 }, fov: 40 },
      ark: { position: { x: -1.45, y: 1.32, z: -7.85 }, target: { x: 0, y: 0.72, z: -9.18 }, fov: 47 },
    };
    const rig = rigs[objectId];
    if (rig) this.applyRig(rig);
    else this.focus(target);
  }

  frameBounds(bounds: WorldBounds): void {
    const targetY = bounds.min.y + bounds.size.y * 0.32;
    this.camera.position.set(bounds.center.x + bounds.size.x * 0.62, targetY + bounds.size.z * 0.17, bounds.center.z + bounds.size.z * 0.82);
    this.camera.fov = 42;
    this.camera.updateProjectionMatrix();
    const target = new THREE.Vector3(bounds.center.x, targetY + 0.15, bounds.center.z - 1.5);
    if (this.#controls) {
      this.#controls.target.copy(target);
      this.#controls.update();
    } else {
      this.camera.lookAt(target);
    }
  }

  frameDetailBounds(bounds: WorldBounds): void {
    const extent = Math.max(bounds.size.x, bounds.size.y, bounds.size.z);
    const distance = Math.max(3.4, extent * 1.7);
    this.applyRig({
      position: { x: bounds.center.x + distance * 0.38, y: bounds.center.y + extent * 0.18, z: bounds.center.z + distance },
      target: { x: bounds.center.x - extent * 0.2, y: bounds.center.y, z: bounds.center.z },
      fov: 42,
    });
  }

  get pose(): { position: Vector3Data; targetDirection: Vector3Data; fov: number; mode: ExperienceMode } {
    const direction = this.camera.getWorldDirection(new THREE.Vector3());
    return {
      position: { x: this.camera.position.x, y: this.camera.position.y, z: this.camera.position.z },
      targetDirection: { x: direction.x, y: direction.y, z: direction.z },
      fov: this.camera.fov,
      mode: this.#mode
    };
  }

  private applyRig(rig: { position: Vector3Data; target: Vector3Data; fov: number }): void {
    this.stopFlyTo();
    this.camera.position.set(rig.position.x, rig.position.y, rig.position.z);
    this.camera.fov = rig.fov;
    this.camera.updateProjectionMatrix();
    if (this.#controls) {
      this.#controls.target.set(rig.target.x, rig.target.y, rig.target.z);
      this.#controls.update();
    } else {
      this.camera.lookAt(rig.target.x, rig.target.y, rig.target.z);
    }
  }
}
