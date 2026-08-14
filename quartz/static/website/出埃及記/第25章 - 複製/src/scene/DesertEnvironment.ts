import * as THREE from 'three';

export class DesertEnvironment {
  readonly #root = new THREE.Group();

  constructor(scene: THREE.Scene) {
    this.#root.name = 'desert-art-direction';
    scene.add(this.#root);
    scene.fog = new THREE.Fog(0xd6b77f, 64, 176);
    this.installSky();
    this.installTerrain();
    this.installMountains();
    this.installCamp();
    this.installLighting();
  }

  dispose(): void {
    this.#root.traverse((node) => {
      if (!(node instanceof THREE.Mesh || node instanceof THREE.Points)) return;
      node.geometry.dispose();
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      materials.forEach((material) => material.dispose());
    });
    this.#root.removeFromParent();
  }

  private installSky(): void {
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(185, 48, 24),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          topColor: { value: new THREE.Color(0x527a98) },
          horizonColor: { value: new THREE.Color(0xd9c39b) },
          sunColor: { value: new THREE.Color(0xffe3aa) },
          sunDirection: { value: new THREE.Vector3(-0.46, 0.58, 0.67).normalize() },
        },
        vertexShader: `varying vec3 vDirection;
          void main() {
            vDirection = normalize(position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: `uniform vec3 topColor;
          uniform vec3 horizonColor;
          uniform vec3 sunColor;
          uniform vec3 sunDirection;
          varying vec3 vDirection;
          void main() {
            float skyMix = smoothstep(-0.08, 0.30, vDirection.y);
            vec3 color = mix(horizonColor, topColor, skyMix);
            float sun = pow(max(dot(normalize(vDirection), sunDirection), 0.0), 84.0);
            color += sunColor * sun * 0.72;
            gl_FragColor = vec4(color, 1.0);
          }`,
      }),
    );
    sky.name = 'graded-desert-sky';
    sky.scale.y = 0.72;
    sky.renderOrder = -20;
    this.#root.add(sky);
  }

  private installTerrain(): void {
    const geometry = new THREE.PlaneGeometry(230, 230, 112, 112);
    const positions = geometry.getAttribute('position');
    const colors = new Float32Array(positions.count * 3);
    const low = new THREE.Color(0x9a6a3d);
    const high = new THREE.Color(0xd2aa6d);
    const color = new THREE.Color();
    for (let index = 0; index < positions.count; index += 1) {
      const x = positions.getX(index);
      const z = -positions.getY(index);
      const radius = Math.hypot(x * 0.86, z);
      const relief = THREE.MathUtils.smoothstep(radius, 27, 68);
      const dunes = Math.sin(x * 0.085 + z * 0.018) * 1.15 + Math.sin(z * 0.112 - x * 0.025) * 0.72 + Math.sin((x + z) * 0.037) * 1.6;
      const height = relief * dunes - 0.12;
      positions.setZ(index, height);
      color.copy(low).lerp(high, THREE.MathUtils.clamp(0.55 + height * 0.08, 0, 1));
      colors[index * 3] = color.r; colors[index * 3 + 1] = color.g; colors[index * 3 + 2] = color.b;
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    const terrain = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.98, metalness: 0 }));
    terrain.name = 'sculpted-desert-terrain';
    terrain.rotation.x = -Math.PI / 2;
    terrain.position.y = -0.08;
    terrain.receiveShadow = true;
    this.#root.add(terrain);

    const courtBlend = new THREE.Mesh(
      new THREE.PlaneGeometry(31, 53),
      new THREE.MeshStandardMaterial({ color: 0xcaa66d, roughness: 1, transparent: true, opacity: 0.52, depthWrite: false }),
    );
    courtBlend.name = 'court-ground-blend';
    courtBlend.rotation.x = -Math.PI / 2;
    courtBlend.position.y = -0.025;
    courtBlend.receiveShadow = true;
    this.#root.add(courtBlend);
  }

  private installMountains(): void {
    const ridges = [
      { name: 'north-near', seed: 17, color: 0x76523a, position: [0, 0, -94] as const, rotationY: 0, height: 1 },
      { name: 'north-far', seed: 73, color: 0x8a684e, position: [0, 0, -126] as const, rotationY: 0, height: 1.28 },
      { name: 'west', seed: 31, color: 0x79563f, position: [-105, 0, 0] as const, rotationY: Math.PI / 2, height: 0.9 },
      { name: 'east', seed: 59, color: 0x79563f, position: [105, 0, 0] as const, rotationY: -Math.PI / 2, height: 0.9 },
    ];
    ridges.forEach((definition) => {
      const ridge = new THREE.Mesh(
        createMountainRidge(definition.seed, definition.height),
        new THREE.MeshStandardMaterial({ color: definition.color, roughness: 1, flatShading: true }),
      );
      ridge.name = `mountain-ridge-${definition.name}`;
      ridge.rotation.set(-Math.PI / 2, definition.rotationY, 0);
      ridge.position.set(definition.position[0], definition.position[1], definition.position[2]);
      ridge.receiveShadow = true;
      this.#root.add(ridge);
    });
  }

  private installCamp(): void {
    const tentGeometry = createTentGeometry();
    const tentMaterials = [0x664a35, 0x7d5b3d, 0x92704b].map((color) => new THREE.MeshStandardMaterial({ color, roughness: 1, flatShading: true }));
    const tents = tentMaterials.map((material, group) => {
      const mesh = new THREE.InstancedMesh(tentGeometry.clone(), material, 24);
      mesh.name = `camp-tents-${group + 1}`; mesh.castShadow = true; mesh.receiveShadow = true; this.#root.add(mesh); return mesh;
    });
    const random = seededRandom(20260811);
    const dummy = new THREE.Object3D();
    const counts = [0, 0, 0];
    for (let ring = 0; ring < 3; ring += 1) {
      for (let index = 0; index < 24; index += 1) {
        const angle = index / 24 * Math.PI * 2 + ring * 0.09 + (random() - 0.5) * 0.12;
        const radius = 35 + ring * 11 + (random() - 0.5) * 4;
        const x = Math.sin(angle) * radius;
        const z = Math.cos(angle) * radius;
        const group = (index + ring) % 3;
        const scale = 0.82 + random() * 0.5;
        dummy.position.set(x, 0.02, z);
        dummy.rotation.set(0, -angle + (random() - 0.5) * 0.45, 0);
        dummy.scale.set(scale * (1.05 + random() * 0.3), scale, scale);
        dummy.updateMatrix();
        tents[group]!.setMatrixAt(counts[group]!, dummy.matrix);
        counts[group] = counts[group]! + 1;
      }
    }
    tents.forEach((tent) => { tent.instanceMatrix.needsUpdate = true; });

    const fireGeometry = new THREE.SphereGeometry(0.18, 8, 6);
    const fireMaterial = new THREE.MeshStandardMaterial({ color: 0xffb05e, emissive: 0xff6a22, emissiveIntensity: 2.2 });
    const fires = new THREE.InstancedMesh(fireGeometry, fireMaterial, 10);
    fires.name = 'camp-embers';
    for (let index = 0; index < 10; index += 1) {
      const angle = index / 10 * Math.PI * 2 + 0.23;
      const radius = 38 + (index % 3) * 10;
      dummy.position.set(Math.sin(angle) * radius, 0.16, Math.cos(angle) * radius);
      dummy.scale.setScalar(0.8 + random() * 0.6); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); fires.setMatrixAt(index, dummy.matrix);
    }
    fires.instanceMatrix.needsUpdate = true;
    this.#root.add(fires);
  }

  private installLighting(): void {
    this.#root.add(new THREE.HemisphereLight(0xdce8ef, 0x6a4128, 1.38));
    const sun = new THREE.DirectionalLight(0xffd6a0, 4.5);
    sun.name = 'late-afternoon-sun';
    sun.position.set(-38, 54, 36);
    sun.castShadow = true;
    sun.shadow.mapSize.set(4096, 4096);
    sun.shadow.camera.left = -70; sun.shadow.camera.right = 70; sun.shadow.camera.top = 70; sun.shadow.camera.bottom = -70;
    sun.shadow.camera.near = 1; sun.shadow.camera.far = 160; sun.shadow.bias = -0.0003;
    this.#root.add(sun);
    const warmFill = new THREE.DirectionalLight(0xe8b87a, 0.52); warmFill.position.set(34, 16, -42); this.#root.add(warmFill);

    const holyPlaceGlow = new THREE.PointLight(0xffca82, 18, 13, 2);
    holyPlaceGlow.name = 'holy-place-warm-glow';
    holyPlaceGlow.position.set(0, 3.2, -4.7);
    this.#root.add(holyPlaceGlow);

    const arkLight = new THREE.SpotLight(0xffd58f, 42, 16, Math.PI / 7, 0.72, 1.7);
    arkLight.name = 'most-holy-focused-light';
    arkLight.position.set(-1.2, 7.2, -6.7);
    arkLight.target.position.set(0, 0.6, -9.1);
    this.#root.add(arkLight, arkLight.target);
  }
}

function createTentGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    -1, 0, -1, 1, 0, -1, 0, 1.25, -1,
    -1, 0, 1, 1, 0, 1, 0, 1.25, 1,
  ], 3));
  geometry.setIndex([
    0, 1, 2, 3, 5, 4,
    0, 2, 5, 0, 5, 3,
    2, 1, 4, 2, 4, 5,
    0, 3, 4, 0, 4, 1,
  ]);
  geometry.computeVertexNormals();
  return geometry;
}

function createMountainRidge(seed: number, heightScale: number): THREE.BufferGeometry {
  const geometry = new THREE.PlaneGeometry(250, 44, 84, 7);
  const positions = geometry.getAttribute('position');
  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const depth = positions.getY(index);
    const across = (depth + 22) / 44;
    const profile = Math.pow(Math.sin(Math.PI * across), 0.7);
    const broad = Math.sin((x + seed * 3.7) * 0.043) * 3.6 + Math.sin((x - seed) * 0.091) * 2.1;
    const crags = Math.abs(Math.sin((x + seed * 1.9) * 0.17)) * 2.6 + Math.abs(Math.sin((x - seed * 2.1) * 0.29)) * 1.1;
    const ridgeHeight = Math.max(0, profile * (8.2 + broad + crags) * heightScale);
    positions.setZ(index, ridgeHeight);
  }
  geometry.computeVertexNormals();
  return geometry;
}

function seededRandom(initialSeed: number): () => number {
  let seed = initialSeed >>> 0;
  return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 0x100000000; };
}
