import * as THREE from 'three';

export class ParticleEffects {
  readonly root = new THREE.Group();

  // Effects groups
  readonly #shekinahGroup = new THREE.Group();
  readonly #menorahFlamesGroup = new THREE.Group();
  readonly #incenseSmokeGroup = new THREE.Group();
  readonly #altarFireGroup = new THREE.Group();
  readonly #dustMotesGroup = new THREE.Group();
  readonly #pillarOfFireGroup = new THREE.Group();

  // Flame lights
  readonly #menorahLights: THREE.PointLight[] = [];
  readonly #altarLight: THREE.PointLight;
  readonly #incenseLight: THREE.PointLight;
  readonly #shekinahLight: THREE.PointLight;

  // Particle systems
  #dustPoints: THREE.Points | null = null;
  readonly #incenseParticles: THREE.Mesh[] = [];
  #altarEmbers: THREE.Points | null = null;
  #pillarMesh: THREE.Mesh | null = null;

  #nightMode = false;

  constructor(parent: THREE.Object3D) {
    this.root.name = 'biblical-particle-effects';
    parent.add(this.root);

    this.root.add(
      this.#shekinahGroup,
      this.#menorahFlamesGroup,
      this.#incenseSmokeGroup,
      this.#altarFireGroup,
      this.#dustMotesGroup,
      this.#pillarOfFireGroup
    );

    // Setup Shekinah Glory in Most Holy Place (Ark at approx x: 0, y: 0.72, z: -9.18)
    this.#shekinahLight = new THREE.PointLight(0xfff4d6, 3.5, 9, 1.8);
    this.#shekinahLight.position.set(0, 2.2, -9.18);
    this.#shekinahGroup.add(this.#shekinahLight);
    this.#buildShekinahRays();

    // Setup Menorah 7-Lamp Flames (Menorah at approx x: -1.2, y: 0.82, z: -4.35)
    this.#buildMenorahFlames();

    // Setup Altar of Incense Smoke (Altar at approx x: 0, y: 1.0, z: -5.85)
    this.#incenseLight = new THREE.PointLight(0xffd175, 1.6, 4.5, 2.0);
    this.#incenseLight.position.set(0, 1.65, -5.85);
    this.#incenseSmokeGroup.add(this.#incenseLight);
    this.#buildIncenseSmoke();

    // Setup Altar of Burnt Offering Fire (Altar at approx x: 0, y: 1.05, z: 9.0)
    this.#altarLight = new THREE.PointLight(0xff8822, 5.0, 12, 1.6);
    this.#altarLight.position.set(0, 1.8, 9.0);
    this.#altarFireGroup.add(this.#altarLight);
    this.#buildAltarFire();

    // Setup Atmospheric Dust Motes inside Holy Place
    this.#buildDustMotes();

    // Setup Pillar of Fire above Tabernacle (Exodus 40:38)
    this.#buildPillarOfFire();
  }

  setAtmosphere(mode: 'dawn' | 'midday' | 'night'): void {
    this.#nightMode = mode === 'night';
    this.#pillarOfFireGroup.visible = this.#nightMode;
    this.#shekinahLight.intensity = this.#nightMode ? 5.5 : 3.5;
    this.#altarLight.intensity = this.#nightMode ? 7.0 : 4.5;
  }

  #buildShekinahRays(): void {
    // Volumetric Shekinah Light Shaft
    const rayGeo = new THREE.CylinderGeometry(0.18, 1.4, 3.8, 24, 1, true);
    const rayMat = new THREE.MeshBasicMaterial({
      color: 0xfffae0,
      transparent: true,
      opacity: 0.38,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const rayMesh = new THREE.Mesh(rayGeo, rayMat);
    rayMesh.position.set(0, 2.4, -9.18);
    this.#shekinahGroup.add(rayMesh);

    // Glowing Cherubim Aura Sphere
    const auraGeo = new THREE.SphereGeometry(0.85, 20, 16);
    const auraMat = new THREE.MeshBasicMaterial({
      color: 0xffeed4,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const auraMesh = new THREE.Mesh(auraGeo, auraMat);
    auraMesh.position.set(0, 1.5, -9.18);
    this.#shekinahGroup.add(auraMesh);
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
    // Altar fire base geometry
    const fireConeGeo = new THREE.ConeGeometry(0.7, 1.1, 12);
    const fireConeMat = new THREE.MeshBasicMaterial({
      color: 0xff7711,
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending,
    });
    const fireCone = new THREE.Mesh(fireConeGeo, fireConeMat);
    fireCone.position.set(0, 1.65, 9.0);
    this.#altarFireGroup.add(fireCone);

    // Glowing Embers
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

  #buildPillarOfFire(): void {
    // Exodus 40:38 Pillar of Fire / Cloud extending to the heavens
    const pillarGeo = new THREE.CylinderGeometry(1.2, 2.4, 45, 24, 1, true);
    const pillarMat = new THREE.MeshBasicMaterial({
      color: 0xff9933,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.#pillarMesh = new THREE.Mesh(pillarGeo, pillarMat);
    this.#pillarMesh.position.set(0, 22, -4.5);
    this.#pillarOfFireGroup.add(this.#pillarMesh);
    this.#pillarOfFireGroup.visible = false;
  }

  update(deltaSeconds: number, timeSeconds: number): void {
    // Flicker Menorah lights & flames
    const flicker = Math.sin(timeSeconds * 12.0) * 0.08 + Math.cos(timeSeconds * 23.0) * 0.05;
    this.#menorahLights.forEach((light, i) => {
      light.intensity = 0.9 + flicker + Math.sin(timeSeconds * 15.0 + i) * 0.08;
    });

    // Flicker Altar fire light
    const altarFlicker = Math.sin(timeSeconds * 8.0) * 0.4 + Math.sin(timeSeconds * 19.0) * 0.3;
    this.#altarLight.intensity = (this.#nightMode ? 7.0 : 4.5) + altarFlicker;

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

    // Animate Pillar of Fire pulsating
    if (this.#pillarMesh && this.#pillarOfFireGroup.visible) {
      this.#pillarMesh.rotation.y = timeSeconds * 0.08;
      const pulse = 1.0 + Math.sin(timeSeconds * 1.8) * 0.06;
      this.#pillarMesh.scale.set(pulse, 1.0, pulse);
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
