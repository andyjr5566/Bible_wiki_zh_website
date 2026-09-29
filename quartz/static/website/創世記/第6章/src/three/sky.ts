import * as THREE from 'three';
import { GLSL_NOISE, clamp, lerp } from './util';

/**
 * 天空：顏色隨太陽高度和暴風變化，雲用 fbm 投影在天幕上。
 * skyHorizon() 是同一套公式的 JS 版本，讓霧和水面反射的顏色跟天空接得起來。
 */
const DAY_Z = new THREE.Color(0.11, 0.26, 0.56), DAY_H = new THREE.Color(0.56, 0.68, 0.84);
const SET_Z = new THREE.Color(0.16, 0.2, 0.38), SET_H = new THREE.Color(1.0, 0.55, 0.3);
const DUSK_Z = new THREE.Color(0.04, 0.05, 0.1), DUSK_H = new THREE.Color(0.28, 0.2, 0.22);
const STORM_Z = new THREE.Color(0.09, 0.1, 0.12), STORM_H = new THREE.Color(0.26, 0.28, 0.3);

function mixSky(el: number, storm: number, out: { z: THREE.Color; h: THREE.Color }) {
  // el：太陽高度（弧度）
  const day = clamp((el - 0.05) / 0.35);
  const set = clamp(1 - Math.abs(el - 0.04) / 0.16);
  const dusk = clamp(-el / 0.12);
  out.z.copy(DAY_Z).lerp(SET_Z, set * (1 - day)).lerp(DUSK_Z, dusk).lerp(STORM_Z, storm);
  out.h.copy(DAY_H).lerp(SET_H, set * (1 - day)).lerp(DUSK_H, dusk).lerp(STORM_H, storm);
  return out;
}
const tmp = { z: new THREE.Color(), h: new THREE.Color() };
export function skyHorizon(el: number, storm: number, target = new THREE.Color()) {
  return target.copy(mixSky(el, storm, tmp).h);
}
export function skyZenith(el: number, storm: number, target = new THREE.Color()) {
  return target.copy(mixSky(el, storm, tmp).z);
}

export function createSky() {
  const uniforms = {
    uSun: { value: new THREE.Vector3(0.3, 0.5, 0.2).normalize() },
    uZenith: { value: new THREE.Color() },
    uHorizon: { value: new THREE.Color() },
    uStorm: { value: 0 },
    uCloud: { value: 0.35 },
    uFlash: { value: 0 },
    uTime: { value: 0 },
    uSunColor: { value: new THREE.Color(1, 0.9, 0.75) },
    uGlow: { value: 1 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main(){
        vDir = normalize((modelMatrix * vec4(position, 0.0)).xyz);
        vec4 p = projectionMatrix * viewMatrix * vec4((modelMatrix * vec4(position,1.)).xyz, 1.);
        p.z = p.w * 0.99999;   // 永遠畫在最遠處
        gl_Position = p;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uSun, uZenith, uHorizon, uSunColor;
      uniform float uStorm, uCloud, uFlash, uTime, uGlow;
      varying vec3 vDir;
      ${GLSL_NOISE}
      void main(){
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 col = mix(uHorizon, uZenith, smoothstep(-0.02, 0.55, h));
        // 地平線以下：接近霧色，避免天幕底部露出硬邊
        col = mix(col, uHorizon * 0.85, smoothstep(0.0, -0.2, h));
        float cs = max(dot(d, uSun), 0.0);
        // 太陽附近的光暈與日輪
        float glow = pow(cs, 8.0) * 0.35 + pow(cs, 64.0) * 0.5;
        float disc = smoothstep(0.9994, 0.9998, cs);
        // 雲：把方向投到一個高空平面上
        vec2 uv = d.xz / max(h + 0.1, 0.06) * 0.7;
        vec2 wind = vec2(uTime * 0.006, uTime * 0.002) * (1.0 + uStorm * 4.0);
        float n = fbm(uv * 1.2 + wind) * 0.65 + fbm(uv * 3.1 - wind * 1.7) * 0.35;
        float cover = mix(uCloud, 0.92, uStorm);
        float dens = smoothstep(1.0 - cover, 1.0 - cover + 0.28, n) * smoothstep(-0.02, 0.12, h);
        // 雲的明暗：面向太陽的邊亮一點，暴風時整片壓暗
        float lit = 0.55 + 0.45 * pow(cs, 3.0);
        vec3 cloudLit = mix(uHorizon * 1.15 + 0.08, uSunColor * 1.1, 0.35 * lit) ;
        vec3 cloudDark = mix(uZenith * 0.8 + 0.05, vec3(0.06, 0.065, 0.075), uStorm);
        vec3 cloud = mix(cloudDark, cloudLit, (1.0 - uStorm * 0.8) * smoothstep(0.2, 0.9, n));
        col += uSunColor * (glow * uGlow + disc * 18.0) * (1.0 - dens) * (1.0 - uStorm * 0.95);
        col = mix(col, cloud, dens);
        // 雲邊被太陽照亮
        col += uSunColor * pow(cs, 12.0) * dens * (1.0 - dens) * 1.4 * (1.0 - uStorm);
        // 閃電：整片雲底一亮
        col += vec3(0.75, 0.8, 1.0) * uFlash * (0.25 + dens * 1.2);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), mat);
  dome.scale.setScalar(9000);
  dome.frustumCulled = false;
  dome.renderOrder = -10;

  // ---------------------------------------------------------------- 彩虹：以反日點為中心、半徑約 42°
  const bowU = {
    uAnti: { value: new THREE.Vector3(0, 0.1, -1) },
    uBow: { value: 0 },
    uTime: { value: 0 },
  };
  const bowMat = new THREE.ShaderMaterial({
    uniforms: bowU,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uAnti; uniform float uBow, uTime;
      varying vec3 vDir;
      ${GLSL_NOISE}
      vec3 spectrum(float x){ // x: 0 = 紫（內）→ 1 = 紅（外）
        vec3 c = vec3(
          smoothstep(0.45, 0.85, x) + smoothstep(0.1, 0.0, x) * 0.5,
          smoothstep(0.15, 0.5, x) * smoothstep(1.0, 0.6, x),
          smoothstep(0.55, 0.15, x));
        return c;
      }
      void main(){
        vec3 d = normalize(vDir);
        float ang = degrees(acos(clamp(dot(d, normalize(uAnti)), -1.0, 1.0)));
        float x1 = (ang - 40.4) / 2.2;          // 主虹
        float x2 = (53.2 - ang) / 3.4;          // 副虹，顏色順序相反
        float b1 = smoothstep(0.0, 0.12, x1) * smoothstep(1.0, 0.88, x1);
        float b2 = smoothstep(0.0, 0.15, x2) * smoothstep(1.0, 0.85, x2);
        vec3 col = spectrum(clamp(x1, 0.0, 1.0)) * b1 * 0.55 + spectrum(clamp(x2, 0.0, 1.0)) * b2 * 0.14;
        // 虹內側比外面亮一點
        col += vec3(0.05) * smoothstep(40.5, 25.0, ang) * 0.5;
        // 不均勻：雨幕有疏有密，貼地的部分淡出
        float patchy = 0.55 + 0.45 * fbm(d.xz * 3.0 + d.y * 2.0 + uTime * 0.01);
        float ground = smoothstep(-0.02, 0.06, d.y);
        gl_FragColor = vec4(col * uBow * patchy * ground, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const bow = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), bowMat);
  bow.scale.setScalar(2400);
  bow.frustumCulled = false;
  bow.renderOrder = 5;

  return {
    dome,
    bow,
    uniforms,
    set(sun: THREE.Vector3, storm: number, cloud: number, time: number, flash: number) {
      uniforms.uSun.value.copy(sun);
      const el = Math.asin(clamp(sun.y, -1, 1));
      mixSky(el, storm, { z: uniforms.uZenith.value, h: uniforms.uHorizon.value });
      uniforms.uStorm.value = storm;
      uniforms.uCloud.value = cloud;
      uniforms.uTime.value = time;
      uniforms.uFlash.value = flash;
      const warm = clamp(1 - el / 0.5);
      uniforms.uSunColor.value.setRGB(1, lerp(0.95, 0.62, warm), lerp(0.85, 0.38, warm));
      bowU.uAnti.value.copy(sun).multiplyScalar(-1);
      bowU.uTime.value = time;
    },
    setBow(v: number) {
      bowU.uBow.value = v;
      bow.visible = v > 0.001;
    },
    follow(cam: THREE.Camera) {
      dome.position.copy(cam.position);
      bow.position.copy(cam.position);
    },
  };
}
export type Sky = ReturnType<typeof createSky>;
