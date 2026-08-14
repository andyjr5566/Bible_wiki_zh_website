import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { ExperienceMode } from '../types/ui';
import type { Vector3Data } from '../types/core';
import type { WorldBounds } from './WorldAlignment';

export class CameraManager {
  readonly camera: THREE.PerspectiveCamera;
  readonly #controls: OrbitControls | null;
  #mode: ExperienceMode = 'overview';

  constructor(aspect: number, domElement?: HTMLElement) {
    this.camera = new THREE.PerspectiveCamera(48, aspect, 0.1, 500);
    this.camera.position.set(17, 13, 30); this.camera.lookAt(0, 0.8, 0);
    this.#controls = domElement ? new OrbitControls(this.camera, domElement) : null;
    if (this.#controls) {
      this.#controls.enableDamping = true;
      this.#controls.dampingFactor = 0.075;
      this.#controls.enablePan = false;
      this.#controls.minDistance = 2.2;
      this.#controls.maxDistance = 92;
      this.#controls.minPolarAngle = 0.12;
      this.#controls.maxPolarAngle = Math.PI * 0.48;
      this.#controls.zoomToCursor = false;
      this.#controls.target.set(0, 0.8, 0);
      this.#controls.update();
    }
  }

  resize(aspect: number): void { this.camera.aspect = aspect; this.camera.updateProjectionMatrix(); }
  update(): void { this.#controls?.update(); }
  dispose(): void { this.#controls?.dispose(); }
  applyMode(mode: ExperienceMode): void {
    this.#mode = mode; this.camera.up.set(0, 1, 0);
    if (mode === 'overview') this.applyRig({ position: { x: 17, y: 13, z: 30 }, target: { x: 0, y: 0.8, z: 0 }, fov: 46 });
    if (mode === 'tour') this.applyRig({ position: { x: 10, y: 7, z: 22 }, target: { x: 0, y: 1.2, z: 12 }, fov: 46 });
    if (mode === 'learning') this.applyRig({ position: { x: 8, y: 5.5, z: 14 }, target: { x: 0, y: 1.2, z: 7 }, fov: 48 });
  }
  focus(target: Vector3Data, distance = 8): void {
    const offset = this.#mode === 'tour'
      ? { x: distance * 0.18, y: distance * 0.4, z: distance }
      : { x: distance * 0.12, y: distance * 0.36, z: distance };
    this.applyRig({ position: { x: target.x + offset.x, y: target.y + offset.y, z: target.z + offset.z }, target: { ...target, y: target.y + 1 }, fov: this.#mode === 'tour' ? 46 : 48 });
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
    this.camera.fov = 42; this.camera.updateProjectionMatrix();
    const target = new THREE.Vector3(bounds.center.x, targetY + 0.15, bounds.center.z - 1.5);
    if (this.#controls) { this.#controls.target.copy(target); this.#controls.update(); }
    else this.camera.lookAt(target);
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
    return { position: { x: this.camera.position.x, y: this.camera.position.y, z: this.camera.position.z }, targetDirection: { x: direction.x, y: direction.y, z: direction.z }, fov: this.camera.fov, mode: this.#mode };
  }
  private applyRig(rig: { position: Vector3Data; target: Vector3Data; fov: number }): void {
    this.camera.position.set(rig.position.x, rig.position.y, rig.position.z); this.camera.fov = rig.fov; this.camera.updateProjectionMatrix();
    if (this.#controls) { this.#controls.target.set(rig.target.x, rig.target.y, rig.target.z); this.#controls.update(); }
    else this.camera.lookAt(rig.target.x, rig.target.y, rig.target.z);
  }
}
