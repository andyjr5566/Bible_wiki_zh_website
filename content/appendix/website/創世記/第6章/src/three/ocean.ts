import * as THREE from 'three';
import { GLSL_NOISE } from './util';

/**
 * 洪水的水面：四組 Gerstner 浪。waveAt() 是同一套公式的 JS 版本，方舟的起伏照它算。
 * amp=1 是暴風，amp≈0.1 是退水後的平靜水面。
 */
const WAVES = [
  { dir: [0.92, 0.39], len: 74, amp: 2.4, steep: 0.55, speed: 1 },
  { dir: [0.6, 0.8], len: 43, amp: 1.35, steep: 0.6, speed: 1 },
  { dir: [0.98, -0.2], len: 27, amp: 0.75, steep: 0.65, speed: 1 },
  { dir: [0.2, 0.98], len: 15, amp: 0.35, steep: 0.7, speed: 1 },
];
const G = 9.8;

export function waveAt(x: number, z: number, t: number, amp: number): number {
  let y = 0;
  for (const w of WAVES) {
    const k = (2 * Math.PI) / w.len;
    const c = Math.sqrt(G / k);
    const f = k * (w.dir[0] * x + w.dir[1] * z - c * t);
    y += w.amp * amp * Math.sin(f);
  }
  return y;
}

export function createOcean(quality: 'high' | 'low') {
  const segs = quality === 'high' ? 280 : 150;
  const size = 2400;
  const geo = new THREE.PlaneGeometry(size, size, segs, segs);
  geo.rotateX(-Math.PI / 2);
  const uniforms = {
    uTime: { value: 0 },
    uAmp: { value: 1 },
    uSun: { value: new THREE.Vector3(0, 1, 0) },
    uSunColor: { value: new THREE.Color(1, 0.95, 0.85) },
    uSky: { value: new THREE.Color(0.5, 0.6, 0.7) },
    uZenith: { value: new THREE.Color(0.2, 0.3, 0.5) },
    uDeep: { value: new THREE.Color(0.012, 0.035, 0.042) },
    uMurk: { value: 0.6 },
    uStorm: { value: 1 },
    uFlash: { value: 0 },
    fogColor: { value: new THREE.Color() },
    fogDensity: { value: 0.001 },
    fogNear: { value: 1 },
    uArkInv: { value: new THREE.Matrix4() },
    uArkOn: { value: 0 },
    fogFar: { value: 1000 },
  };
  const waveGLSL = WAVES.map(
    (w, i) => `
      { vec2 D = normalize(vec2(${w.dir[0].toFixed(3)}, ${w.dir[1].toFixed(3)}));
        float k = ${((2 * Math.PI) / w.len).toFixed(5)};
        float c = sqrt(${G.toFixed(2)} / k);
        float A = ${w.amp.toFixed(3)} * uAmp;
        float Q = ${w.steep.toFixed(3)} / (k * ${(w.amp * WAVES.length).toFixed(3)} + 0.001);
        float f = k * (dot(D, p.xz) - c * uTime);
        float cf = cos(f), sf = sin(f);
        off.x += Q * A * D.x * cf; off.z += Q * A * D.y * cf; off.y += A * sf;
        tx += vec3(-Q * D.x * D.x * k * A * sf, D.x * k * A * cf, -Q * D.x * D.y * k * A * sf);
        bz += vec3(-Q * D.x * D.y * k * A * sf, D.y * k * A * cf, -Q * D.y * D.y * k * A * sf);
        crest += sf * A; } // ${i}`,
  ).join('\n');
  const mat = new THREE.ShaderMaterial({
    uniforms,
    fog: true,
    vertexShader: /* glsl */ `
      uniform float uTime, uAmp;
      varying vec3 vWPos; varying vec3 vN; varying float vCrest;
      #include <fog_pars_vertex>
      void main(){
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vec3 p = wp.xyz;
        vec3 off = vec3(0.0); vec3 tx = vec3(1.0, 0.0, 0.0); vec3 bz = vec3(0.0, 0.0, 1.0); float crest = 0.0;
        ${waveGLSL}
        // 遠處的浪漸漸變平，不然地平線會鋸齒
        float fade = 1.0 - smoothstep(500.0, 1100.0, length(p.xz - cameraPosition.xz));
        p += off * fade;
        vWPos = p;
        vN = normalize(mix(vec3(0.0, 1.0, 0.0), normalize(cross(bz, tx)), fade));
        vCrest = crest * fade;
        vec4 mv = viewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        vec4 mvPosition = mv;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uAmp, uMurk, uStorm, uFlash, uArkOn;
      uniform vec3 uSun, uSunColor, uSky, uZenith, uDeep;
      uniform mat4 uArkInv;
      varying vec3 vWPos; varying vec3 vN; varying float vCrest;
      #include <fog_pars_fragment>
      ${GLSL_NOISE}
      // 船身在這個高度的半寬（和 build_ark.py 的 beam_at 一樣）
      float halfBeam(float x){ float a = abs(x) / 67.5; if (a <= 0.58) return 11.25; float t = (a - 0.58) / 0.42; return 11.25 * (1.0 - 0.5 * pow(t, 1.7)); }
      void main(){
        // 方舟裡面不畫水
        if (uArkOn > 0.5) { vec3 lp = (uArkInv * vec4(vWPos, 1.0)).xyz; if (abs(lp.x) < 67.4 && abs(lp.z) < halfBeam(lp.x) - 0.05) discard; }
        vec3 V = normalize(cameraPosition - vWPos);
        // 細浪：兩層雜訊斜率擾動法線
        vec2 q = vWPos.xz * 0.09;
        float e = 0.35;
        float n0 = fbm3(q + uTime * vec2(0.05, 0.03));
        float nx = fbm3(q + vec2(e, 0.0) + uTime * vec2(0.05, 0.03));
        float nz = fbm3(q + vec2(0.0, e) + uTime * vec2(0.05, 0.03));
        float dist = length(cameraPosition - vWPos);
        float detail = (0.35 + 0.65 * uAmp) * (1.0 - smoothstep(80.0, 700.0, dist));
        vec3 N = normalize(vN + vec3(n0 - nx, 0.0, n0 - nz) * 1.3 * detail);
        float fres = 0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
        vec3 R = reflect(-V, N);
        vec3 sky = mix(uSky, uZenith, smoothstep(0.0, 0.5, R.y)) * 0.85;
        vec3 body = mix(uDeep, uDeep * 1.4 + vec3(0.015, 0.02, 0.012), uMurk);
        // 浪側透光的顏色
        float sss = pow(max(dot(V, -uSun), 0.0), 3.0) * smoothstep(0.5, 3.0, vCrest) * 0.25;
        vec3 col = mix(body, sky, fres * 0.85) + vec3(0.04, 0.12, 0.1) * sss * (1.0 - uStorm * 0.7);
        vec3 H = normalize(uSun + V);
        float spec = pow(max(dot(N, H), 0.0), 380.0) * 6.0 * (1.0 - uStorm * 0.85);
        col += uSunColor * spec;
        // 浪頂白沫
        float foamN = fbm3(vWPos.xz * vec2(0.5, 0.9) + uTime * 0.25);
        float streak = fbm3(vWPos.xz * vec2(0.12, 0.6) - uTime * 0.05);
        float crest = vCrest / (4.8 * max(uAmp, 0.05));
        float foam = smoothstep(0.42, 0.75, crest + (foamN - 0.5) * 0.5) * uAmp;
        foam += smoothstep(0.72, 0.9, streak) * 0.18 * uAmp * uStorm;
        foam *= 1.0 - smoothstep(250.0, 900.0, dist) * 0.7;
        col = mix(col, vec3(0.62, 0.66, 0.68) * (0.55 + 0.45 * (1.0 - uStorm)), clamp(foam, 0.0, 0.85));
        col += vec3(0.6, 0.65, 0.8) * uFlash * 0.35;
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 1;
  // 遠處再接一圈平的水面蓋到地平線；內圈落在細網格已經變平的範圍裡
  const farGeo = new THREE.RingGeometry(1120, 40000, 96, 1);
  farGeo.rotateX(-Math.PI / 2);
  const far = new THREE.Mesh(farGeo, mat);
  far.frustumCulled = false;
  const group = new THREE.Group();
  group.add(mesh, far);
  return {
    group,
    uniforms,
    update(cam: THREE.Camera, level: number, t: number) {
      // 網格跟著鏡頭走（對齊格點，浪才不會跟著滑動）
      const cell = size / segs;
      mesh.position.set(Math.round(cam.position.x / cell) * cell, level, Math.round(cam.position.z / cell) * cell);
      far.position.set(cam.position.x, level, cam.position.z);
      uniforms.uTime.value = t;
      group.visible = level > -8;
    },
  };
}
export type Ocean = ReturnType<typeof createOcean>;
