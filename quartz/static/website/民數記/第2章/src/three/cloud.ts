import * as THREE from 'three';

export interface Cloud {
  group: THREE.Group;
  light: THREE.PointLight;
  /** lift: 0 = resting over the tabernacle, 1 = risen ~170 units and fully faded out. night: 0..1 */
  update(dt: number, o: { lift: number; night: number; t: number }): void;
}

interface Puff {
  sprite: THREE.Sprite;
  material: THREE.SpriteMaterial;
  x: number;
  y: number;
  z: number;
  rotationSpeed: number;
  phase: number;
  opacity: number;
  color: THREE.Color;
}

function puffTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d')!;
  const image = context.createImageData(size, size);
  const noise = new Float32Array(size * size);
  let seed = 23891;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < noise.length; i++) noise[i] = random();

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x - 63.5) / 63.5;
      const dy = (y - 63.5) / 63.5;
      const radius = Math.sqrt(dx * dx + dy * dy);
      // 高斯衰減，邊緣完全淡掉；一點雜訊讓每團不是完美的圓
      const falloff = Math.exp(-radius * radius * 4.2) * (1 - THREE.MathUtils.smoothstep(radius, 0.85, 1));
      const noiseValue = noise[y * size + x] * 0.12 + noise[(y >> 3) * size + (x >> 3)] * 0.22;
      const alpha = THREE.MathUtils.clamp(falloff * (0.78 + noiseValue), 0, 1);
      const offset = (y * size + x) * 4;
      image.data[offset] = 255;
      image.data[offset + 1] = 255;
      image.data[offset + 2] = 255;
      image.data[offset + 3] = Math.round(alpha * 255);
    }
  }
  context.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const x = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return x * x * (3 - 2 * x);
}

export function createCloud(): Cloud {
  const texture = puffTexture();
  const group = new THREE.Group();
  const inner = new THREE.Group();
  group.add(inner);

  let seed = 64127;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const smoke: Puff[] = [];
  const firePuffs: Puff[] = [];
  const smokeLow = new THREE.Color(0xcfc9c0);
  const smokeHigh = new THREE.Color(0xffffff);
  // 夜裡雲彩「形狀如火」：煙轉成暗紅的餘燼色，裡面透出火光
  const darkSmoke = new THREE.Color(0x7a2e12);
  const fireLow = new THREE.Color(0xff4f0f);
  const fireHigh = new THREE.Color(0xffa040);
  const reducedMotionQuery = matchMedia('(prefers-reduced-motion: reduce)');

  const makePuff = (isFire: boolean): Puff => {
    const y = isFire ? 20 + random() * 76 : 22 + random() * 98;
    const column = THREE.MathUtils.smoothstep(y, 43, 88);
    const radius = (1 - column) * 38 + column * 16;
    const angle = random() * Math.PI * 2;
    const distance = Math.sqrt(random()) * radius;
    const x = Math.cos(angle) * distance;
    const z = Math.sin(angle) * distance;
    const size = (isFire ? 26 + random() * 18 : 36 + random() * 20) * (1 - column * 0.18);
    const color = isFire ? fireLow.clone().lerp(fireHigh, random()) : smokeLow.clone().lerp(smokeHigh, column * 0.8 + random() * 0.2);
    const material = new THREE.SpriteMaterial({
      map: texture,
      color,
      transparent: true,
      opacity: isFire ? 0 : 0.5,
      depthWrite: false,
      blending: isFire ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    const sprite = new THREE.Sprite(material);
    sprite.position.set(x, y, z);
    sprite.scale.set(size * (0.85 + random() * 0.3), size * (0.75 + random() * 0.35), 1);
    if (isFire) sprite.renderOrder = 3;
    inner.add(sprite);
    return {
      sprite,
      material,
      x,
      y,
      z,
      rotationSpeed: (random() - 0.5) * 0.035,
      phase: random() * Math.PI * 2,
      opacity: isFire ? 0.32 : 0.5,
      color,
    };
  };

  for (let i = 0; i < 80; i++) smoke.push(makePuff(false));
  for (let i = 0; i < 30; i++) firePuffs.push(makePuff(true));

  const light = new THREE.PointLight(0xff8a3c, 0, 420, 1.6);
  light.position.set(0, 40, 0);
  inner.add(light);

  return {
    group,
    light,
    update(dt, { lift, night, t }) {
      const raised = THREE.MathUtils.clamp(lift, 0, 1);
      const nightMix = THREE.MathUtils.clamp(night, 0, 1);
      const fade = 1 - smoothstep(0.35, 1, raised);
      const reduceMotion = document.documentElement.dataset.motion === 'off'
        || reducedMotionQuery.matches;
      inner.position.y = raised * 170;
      inner.visible = fade > 0.001;
      light.intensity = nightMix * 2600 * (1 - raised * 0.8);

      for (const puff of smoke) {
        const bob = reduceMotion ? 0 : Math.sin(t * 0.42 + puff.phase) * 2.4;
        puff.sprite.position.set(puff.x, puff.y + bob, puff.z);
        if (!reduceMotion) puff.material.rotation += dt * puff.rotationSpeed;
        puff.material.color.copy(puff.color).lerp(darkSmoke, nightMix * 0.72);
        puff.material.opacity = puff.opacity * (1 - 0.25 * nightMix) * fade;
      }
      for (const puff of firePuffs) {
        const bob = reduceMotion ? 0 : Math.sin(t * 0.58 + puff.phase) * 2.1;
        puff.sprite.position.set(puff.x, puff.y + bob, puff.z);
        if (!reduceMotion) {
          puff.material.rotation += dt * puff.rotationSpeed;
          const flicker = 1 + (Math.sin(t * 1.7 + puff.phase) + Math.sin(t * 0.93 + puff.phase * 1.9)) * 0.075;
          puff.material.opacity = puff.opacity * nightMix * fade * flicker;
        } else {
          puff.material.opacity = puff.opacity * nightMix * fade;
        }
      }
    },
  };
}
