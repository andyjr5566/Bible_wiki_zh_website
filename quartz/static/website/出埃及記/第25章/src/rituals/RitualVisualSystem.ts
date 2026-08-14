import * as THREE from 'three';

export class RitualVisualSystem {
  readonly #root = new THREE.Group();
  readonly #washing = new THREE.Group();
  readonly #incense = new THREE.Group();
  #activeRitualId: string | null = null;

  constructor(parent: THREE.Object3D) {
    this.#root.name = 'ritual-visuals'; parent.add(this.#root);
    for (let index = 0; index < 3; index += 1) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.38 + index * 0.16, 0.42 + index * 0.16, 48), new THREE.MeshBasicMaterial({ color: 0x76d6e8, transparent: true, opacity: 0.46 - index * 0.1, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2; ring.position.set(0, 0.06 + index * 0.01, 0); ring.scale.setScalar(0.4); this.#washing.add(ring);
    }
    this.#washing.position.set(0, 0, 0); this.#root.add(this.#washing);
    for (let index = 0; index < 8; index += 1) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.08 + index * 0.025, 10, 8), new THREE.MeshBasicMaterial({ color: 0xd8d0bf, transparent: true, opacity: 0.2 }));
      puff.position.set(Math.sin(index * 1.7) * 0.13, 0.45 + index * 0.18, Math.cos(index * 1.3) * 0.1); this.#incense.add(puff);
    }
    this.#incense.position.set(0, 0, -5.2); this.#root.add(this.#incense); this.stop();
  }

  play(ritualId: string): void { this.#activeRitualId = ritualId; this.#washing.visible = ritualId === 'priestly-washing'; this.#incense.visible = ritualId === 'incense-service'; }
  pause(): void { this.#washing.visible = false; this.#incense.visible = false; }
  stop(): void { this.#activeRitualId = null; this.pause(); }
  update(timeSeconds: number): void {
    if (!this.#activeRitualId) return;
    this.#washing.children.forEach((child, index) => { const pulse = 0.75 + ((timeSeconds * 0.55 + index * 0.22) % 1); child.scale.setScalar(pulse); });
    this.#incense.children.forEach((child, index) => { child.position.x = Math.sin(timeSeconds * 0.7 + index) * 0.14; child.position.y = 0.45 + ((timeSeconds * 0.22 + index * 0.17) % 1.4); });
  }
  dispose(): void { this.#root.traverse((node) => { if (node instanceof THREE.Mesh) { node.geometry.dispose(); (Array.isArray(node.material) ? node.material : [node.material]).forEach((material) => material.dispose()); } }); this.#root.removeFromParent(); }
}
