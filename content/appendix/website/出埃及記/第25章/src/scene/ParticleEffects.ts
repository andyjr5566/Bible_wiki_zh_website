import * as THREE from 'three';

/** Narrative effects are opt-in; R13–R15 may enable these from verified cues. */
export type ParticleCue = 'menorah-flames' | 'incense-smoke' | 'burnt-offering-fire';

export class ParticleEffects {
  readonly root = new THREE.Group();

  // Effects groups
  readonly #menorahFlamesGroup = new THREE.Group();
  readonly #incenseSmokeGroup = new THREE.Group();
  readonly #altarFireGroup = new THREE.Group();
  readonly #dustMotesGroup = new THREE.Group();

  // Flame lights
  readonly #menorahLights: THREE.PointLight[] = [];
  readonly #altarLight: THREE.PointLight;
  readonly #incenseLight: THREE.PointLight;

  // Particle systems
  #dustPoints: THREE.Points | null = null;
  readonly #incenseParticles: THREE.Mesh[] = [];
  #altarEmbers: THREE.Points | null = null;

  #nightMode = false;
  #learningDetailFocus = false;
  #reducedMotion = false;
  readonly #activeCues = new Set<ParticleCue>();

  constructor(parent: THREE.Object3D) {
    this.root.name = 'biblical-particle-effects';
    parent.add(this.root);

    this.root.add(
      this.#menorahFlamesGroup,
      this.#incenseSmokeGroup,
      this.#altarFireGroup,
      this.#dustMotesGroup
    );
    this.#menorahFlamesGroup.name = 'cue-menorah-flames';
    this.#incenseSmokeGroup.name = 'cue-incense-smoke';
    this.#altarFireGroup.name = 'cue-burnt-offering-fire';
    this.#dustMotesGroup.name = 'ambient-dust-motes';

    // Setup Menorah 7-Lamp Flames (Menorah at approx x: -1.2, y: 0.82, z: -4.35)
    this.#buildMenorahFlames();

    // Setup Altar of Incense Smoke (Altar at approx x: 0, y: 1.0, z: -5.85)
    this.#incenseLight = new THREE.PointLight(0xffd175, 1.6, 4.5, 2.0);
    this.#incenseLight.position.set(0, 1.65, -5.85);
    this.#incenseSmokeGroup.add(this.#incenseLight);
    this.#buildIncenseSmoke();
    this.#incenseSmokeGroup.visible = false;

    // Setup Altar of Burnt Offering Fire (Altar at approx x: 0, y: 1.05, z: 9.0)
    this.#altarLight = new THREE.PointLight(0xff8822, 0, 12, 1.6);
    this.#altarLight.position.set(0, 1.8, 9.0);
    this.#altarFireGroup.add(this.#altarLight);
    this.#buildAltarFire();
    this.#altarFireGroup.visible = false;

    // Setup Atmospheric Dust Motes inside Holy Place
    this.#buildDustMotes();

    // Narrative smoke/fire effects stay hidden until a verified cue enables them.
    this.#syncCueVisibility();
  }

  setAtmosphere(mode: 'dawn' | 'midday' | 'night'): void {
    this.#nightMode = mode === 'night';
    this.#syncCueVisibility();
  }

  /** Enable a narrative particle effect only after its source event is verified. */
  setCue(cue: ParticleCue, enabled = true): void {
    if (enabled) this.#activeCues.add(cue);
    else this.#activeCues.delete(cue);
    this.#syncCueVisibility();
  }

  clearNarrativeCues(): void {
    this.#activeCues.clear();
    this.#syncCueVisibility();
  }

  setLearningDetailFocus(focused: boolean): void {
    this.#learningDetailFocus = focused;
    this.#syncCueVisibility();
  }

  #syncCueVisibility(): void {
    this.#reducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const canShowNarrativeCue = !this.#learningDetailFocus && !this.#reducedMotion;
    this.#menorahFlamesGroup.visible = canShowNarrativeCue && this.#activeCues.has('menorah-flames');
    const altarActive = this.#activeCues.has('burnt-offering-fire');
    this.#incenseSmokeGroup.visible = canShowNarrativeCue && this.#activeCues.has('incense-smoke');
    this.#altarFireGroup.visible = canShowNarrativeCue && altarActive;
    this.#dustMotesGroup.visible = !this.#reducedMotion;
    this.#altarLight.intensity = altarActive ? (this.#nightMode ? 5.5 : 3.5) : 0;
  }

  #buildMenorahFlames(): void {
    // 7 branches of Menorah along X axis (centered at x: -1.2, z: -4.35)
    const offsetsX = [-0.42, -0.28, -0.14, 0.0, 0.14, 0.28, 0.42];
    const flameGeo = new THREE.SphereGeometry(0.024, 8, 8);
    const flameMat = new THREE.MeshBasicMaterial({
      color: 0xffc74a,
      transparent: true,
      opacity: 0.88,
      blending: THREE.AdditiveBlending,
    });

    offsetsX.forEach((ox, i) => {
      const flame = new THREE.Mesh(flameGeo, flameMat);
      const posX = -1.2 + ox;
      const posY = 1.42;
      const posZ = -4.35;
      flame.position.set(posX, posY, posZ);
      this.#menorahFlamesGroup.add(flame);

      if (i === 1 || i === 3 || i === 5) {
        const pLight = new THREE.PointLight(0xffbe44, 0.9, 3.2, 2.0);
        pLight.position.set(posX, posY + 0.05, posZ);
        this.#menorahFlamesGroup.add(pLight);
        this.#menorahLights.push(pLight);
      }
    });
  }

  #buildIncenseSmoke(): void {
    const puffGeo = new THREE.SphereGeometry(0.06, 8, 6);
    for (let i = 0; i < 18; i++) {
      const puffMat = new THREE.MeshBasicMaterial({
        color: 0xf5eedd,
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
      });
      const puff = new THREE.Mesh(puffGeo, puffMat);
      puff.position.set(
        Math.sin(i * 1.5) * 0.12,
        1.55 + (i / 18) * 1.6,
        -5.85 + Math.cos(i * 1.5) * 0.12
      );
      this.#incenseParticles.push(puff);
      this.#incenseSmokeGroup.add(puff);
    }
  }

  #buildAltarFire(): void {
    // Embers are retained as a cue-driven primitive; the former cone fire was
    // too coarse for a reading view and implied an unsupported default event.
    const emberCount = 35;
    const emberGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(emberCount * 3);
    for (let i = 0; i < emberCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 1.2;
      positions[i * 3 + 1] = 1.3 + Math.random() * 1.8;
      positions[i * 3 + 2] = 9.0 + (Math.random() - 0.5) * 1.2;
    }
    emberGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const emberMat = new THREE.PointsMaterial({
      color: 0xffaa33,
      size: 0.045,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
    });
    this.#altarEmbers = new THREE.Points(emberGeo, emberMat);
    this.#altarFireGroup.add(this.#altarEmbers);
  }

  #buildDustMotes(): void {
    const moteCount = 60;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(moteCount * 3);
    for (let i = 0; i < moteCount; i++) {
      // Confined to the Holy Place and Most Holy Place
      positions[i * 3] = (Math.random() - 0.5) * 4.5;
      positions[i * 3 + 1] = 0.5 + Math.random() * 3.0;
      positions[i * 3 + 2] = -9.5 + Math.random() * 10.5;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xfde3a7,
      size: 0.032,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
    });
    this.#dustPoints = new THREE.Points(geo, mat);
    this.#dustMotesGroup.add(this.#dustPoints);
  }

  update(deltaSeconds: number, timeSeconds: number): void {
    const reducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion !== this.#reducedMotion) this.#syncCueVisibility();
    if (reducedMotion) {
      this.#menorahLights.forEach((light) => { light.intensity = 0; });
      this.#altarLight.intensity = 0;
      return;
    }

    // Flicker Menorah lights & flames
    const flicker = Math.sin(timeSeconds * 12.0) * 0.08 + Math.cos(timeSeconds * 23.0) * 0.05;
    this.#menorahLights.forEach((light, i) => {
      light.intensity = 0.9 + flicker + Math.sin(timeSeconds * 15.0 + i) * 0.08;
    });

    // Flicker Altar fire light
    const altarFlicker = Math.sin(timeSeconds * 8.0) * 0.4 + Math.sin(timeSeconds * 19.0) * 0.3;
    this.#altarLight.intensity = this.#activeCues.has('burnt-offering-fire')
      ? (this.#nightMode ? 5.5 : 3.5) + altarFlicker * 0.45
      : 0;

    // Animate Incense smoke
    this.#incenseParticles.forEach((puff, i) => {
      puff.position.y += deltaSeconds * 0.42;
      puff.position.x += Math.sin(timeSeconds * 1.5 + i) * 0.003;
      puff.position.z += Math.cos(timeSeconds * 1.2 + i) * 0.003;
      const scale = 0.8 + (puff.position.y - 1.55) * 1.2;
      puff.scale.setScalar(scale);

      if (puff.position.y > 3.2) {
        puff.position.y = 1.55;
        puff.position.x = Math.sin(i * 1.5) * 0.05;
        puff.position.z = -5.85 + Math.cos(i * 1.5) * 0.05;
      }
    });

    // Animate Altar embers
    if (this.#altarEmbers) {
      const posAttr = this.#altarEmbers.geometry.getAttribute('position') as THREE.BufferAttribute;
      const arr = posAttr.array as Float32Array;
      for (let i = 0; i < arr.length / 3; i++) {
        const yIdx = i * 3 + 1;
        const xIdx = i * 3;
        const currentY = arr[yIdx] ?? 1.35;
        const currentX = arr[xIdx] ?? 0;
        arr[yIdx] = currentY + deltaSeconds * 0.65;
        arr[xIdx] = currentX + Math.sin(timeSeconds * 2.0 + i) * 0.004;
        if (arr[yIdx]! > 3.4) {
          arr[yIdx] = 1.35;
          arr[xIdx] = (Math.random() - 0.5) * 1.0;
        }
      }
      posAttr.needsUpdate = true;
    }

    // Animate Dust Motes gently swirling
    if (this.#dustPoints) {
      const posAttr = this.#dustPoints.geometry.getAttribute('position') as THREE.BufferAttribute;
      const arr = posAttr.array as Float32Array;
      for (let i = 0; i < arr.length / 3; i++) {
        const yIdx = i * 3 + 1;
        const xIdx = i * 3;
        const currentY = arr[yIdx] ?? 0.5;
        const currentX = arr[xIdx] ?? 0;
        arr[yIdx] = currentY + Math.sin(timeSeconds * 0.5 + i) * 0.0015;
        arr[xIdx] = currentX + Math.cos(timeSeconds * 0.4 + i) * 0.0012;
      }
      posAttr.needsUpdate = true;
    }

  }

  dispose(): void {
    this.root.traverse((node) => {
      if (node instanceof THREE.Mesh || node instanceof THREE.Points) {
        node.geometry.dispose();
        const mats = Array.isArray(node.material) ? node.material : [node.material];
        mats.forEach((m) => m.dispose());
      }
    });
    this.root.removeFromParent();
  }
}
