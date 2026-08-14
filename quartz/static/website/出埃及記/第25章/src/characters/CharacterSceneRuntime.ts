import * as THREE from 'three';
import type { Vector3Data } from '../types/core';

export class CharacterSceneRuntime {
  #resource: THREE.Group | null = null;
  #route: Vector3Data[] = [];
  #targetIndex = 0;
  #position: Vector3Data | null = null;
  #groundY = 0;

  bind(resource: THREE.Group, start: Vector3Data, route: Vector3Data[]): void {
    this.#resource = resource; this.#route = route.map((point) => ({ ...point })); this.#targetIndex = Math.min(1, Math.max(0, this.#route.length - 1));
    this.#position = { ...start }; resource.position.set(0, 0, 0); resource.scale.setScalar(0.92); resource.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(resource); this.#groundY = bounds.isEmpty() ? 0 : -bounds.min.y + 0.02;
    resource.position.set(start.x, this.#groundY, start.z); resource.visible = true;
  }

  update(deltaSeconds: number): void {
    if (!this.#resource || !this.#position || !this.#route.length) return;
    const target = this.#route[this.#targetIndex]; if (!target) return;
    const dx = target.x - this.#position.x; const dz = target.z - this.#position.z; const distance = Math.hypot(dx, dz);
    if (distance < 0.18) { this.#targetIndex = (this.#targetIndex + 1) % this.#route.length; return; }
    const step = Math.min(distance, deltaSeconds * 0.55); this.#position.x += dx / distance * step; this.#position.z += dz / distance * step;
    this.#resource.position.set(this.#position.x, this.#groundY + Math.sin(performance.now() * 0.004) * 0.015, this.#position.z);
    this.#resource.rotation.y = Math.atan2(dx, dz); this.#resource.updateMatrixWorld();
  }

  navigateTo(target: Vector3Data): void { if (this.#position) { this.#route = [{ ...this.#position }, { ...target }]; this.#targetIndex = 1; } }
  get position(): Vector3Data | null { return this.#position ? { ...this.#position } : null; }
  dispose(): void { this.#resource = null; this.#route = []; this.#position = null; this.#groundY = 0; }
}
