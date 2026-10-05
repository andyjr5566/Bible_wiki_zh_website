import * as THREE from 'three';

export interface Sky {
  mesh: THREE.Mesh;
  /** tod: 0 = deep night, 0.5 = dawn (sun just above the eastern horizon), 1 = full day */
  update(o: { sunDir: THREE.Vector3; tod: number; t: number }): void;
}

const nightZenith = new THREE.Color(0x060a18);
const nightHorizon = new THREE.Color(0x16203b);
const dawnZenith = new THREE.Color(0x26375f);
const dawnSunHorizon = new THREE.Color(0xc9895a);
const dawnAwayHorizon = new THREE.Color(0x5d6385);
const dawnMeanHorizon = dawnSunHorizon.clone().lerp(dawnAwayHorizon, 0.5);
const dayZenith = new THREE.Color(0x4f7fb8);
const dayHorizon = new THREE.Color(0xe6d8bb);

const vertexShader = /* glsl */`
  varying vec3 vLocalDir;
  void main() {
    vLocalDir = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */`
  uniform vec3 uSunDir;
  uniform float uTod;
  uniform float uTime;
  uniform vec3 uNightZenith;
  uniform vec3 uNightHorizon;
  uniform vec3 uDawnZenith;
  uniform vec3 uDawnSunHorizon;
  uniform vec3 uDawnAwayHorizon;
  uniform vec3 uDayZenith;
  uniform vec3 uDayHorizon;
  varying vec3 vLocalDir;

  float hash31(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
  }

  void main() {
    vec3 dir = normalize(vLocalDir);
    vec3 sun = normalize(uSunDir);
    float dawn = clamp(1.0 - abs(uTod - 0.5) * 2.0, 0.0, 1.0);
    vec3 dawnSide = normalize(vec3(sun.x, 0.0, sun.z));
    float facing = dot(normalize(vec3(dir.x, 0.0, dir.z)), dawnSide) * 0.5 + 0.5;
    vec3 horizonDawn = mix(uDawnAwayHorizon, uDawnSunHorizon, facing);

    vec3 zenith;
    vec3 horizon;
    if (uTod < 0.5) {
      float k = clamp(uTod * 2.0, 0.0, 1.0);
      zenith = mix(uNightZenith, uDawnZenith, k);
      horizon = mix(uNightHorizon, horizonDawn, k);
    } else {
      float k = clamp((uTod - 0.5) * 2.0, 0.0, 1.0);
      zenith = mix(uDawnZenith, uDayZenith, k);
      horizon = mix(horizonDawn, uDayHorizon, k);
    }

    float height = smoothstep(-0.04, 0.92, dir.y);
    vec3 skyColor = mix(horizon, zenith, height);
    float sunDot = max(dot(dir, sun), 0.0);
    float aboveHorizon = smoothstep(-0.08, 0.04, sun.y);
    vec3 sunTint = mix(vec3(1.0, 0.81, 0.54), vec3(1.0, 0.96, 0.86), clamp((uTod - 0.5) * 2.0, 0.0, 1.0));
    skyColor += sunTint * pow(sunDot, 8.0) * (1.0 - dawn * 0.25) * aboveHorizon;
    skyColor += vec3(1.0, 0.91, 0.72) * smoothstep(0.9993, 0.9997, sunDot) * aboveHorizon;

    // 網格不能太細：每格要有幾個像素，星星才看得到（ACES 色調映射會再壓暗一些）
    vec3 cell = floor(dir * 300.0);
    vec3 local = fract(dir * 300.0) - 0.5;
    float seed = hash31(cell);
    float star = (1.0 - smoothstep(0.06, 0.16, length(local))) * step(0.9965, seed);
    float bright = step(0.9993, seed);
    star *= 1.4 + bright * 2.6;
    float twinkle = 0.78 + 0.22 * sin(uTime * 0.7 + seed * 80.0);
    float starFade = (1.0 - smoothstep(0.15, 0.5, uTod)) * smoothstep(0.0, 0.15, dir.y);
    skyColor += vec3(0.72, 0.82, 1.0) * star * twinkle * starFade;
    skyColor += vec3(1.0, 0.9, 0.72) * bright * star * starFade;

    if (dir.y < 0.0) skyColor = horizon;
    gl_FragColor = vec4(skyColor, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function horizonColor(tod: number, out = new THREE.Color()): THREE.Color {
  const clamped = THREE.MathUtils.clamp(tod, 0, 1);
  if (clamped < 0.5) return out.copy(nightHorizon).lerp(dawnMeanHorizon, clamped * 2);
  return out.copy(dawnMeanHorizon).lerp(dayHorizon, (clamped - 0.5) * 2);
}

export function createSky(radius = 5200): Sky {
  const uniforms = {
    uSunDir: { value: new THREE.Vector3(1, 0.04, 0) },
    uTod: { value: 1 },
    uTime: { value: 0 },
    uNightZenith: { value: nightZenith },
    uNightHorizon: { value: nightHorizon },
    uDawnZenith: { value: dawnZenith },
    uDawnSunHorizon: { value: dawnSunHorizon },
    uDawnAwayHorizon: { value: dawnAwayHorizon },
    uDayZenith: { value: dayZenith },
    uDayHorizon: { value: dayHorizon },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 32), material);
  mesh.renderOrder = -1;
  mesh.frustumCulled = false;

  return {
    mesh,
    update({ sunDir, tod, t }) {
      uniforms.uSunDir.value.copy(sunDir).normalize();
      uniforms.uTod.value = THREE.MathUtils.clamp(tod, 0, 1);
      uniforms.uTime.value = t;
    },
  };
}
