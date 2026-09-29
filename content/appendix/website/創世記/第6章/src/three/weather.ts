import * as THREE from 'three';
import { mulberry32 } from './util';

/** 雨：每一滴的位置都在 shader 裡算，CPU 不必逐格更新 */
export function createRain(quality: 'high' | 'low') {
  const N = quality === 'high' ? 26000 : 9000;
  const seed = new Float32Array(N * 2 * 4);
  const end = new Float32Array(N * 2);
  const rnd = mulberry32(12);
  for (let i = 0; i < N; i++) {
    const s = [rnd(), rnd(), rnd(), rnd()];
    seed.set(s, i * 8);
    seed.set(s, i * 8 + 4);
    end[i * 2] = 0;
    end[i * 2 + 1] = 1;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 2 * 3), 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
  geo.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
  const uniforms = {
    uTime: { value: 0 },
    uDensity: { value: 0 },
    uWind: { value: new THREE.Vector2(0.28, 0.12) },
    uColor: { value: new THREE.Color(0.55, 0.6, 0.66) },
    uFlash: { value: 0 },
    uFloor: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      attribute vec4 aSeed; attribute float aEnd;
      uniform float uTime, uDensity, uFloor; uniform vec2 uWind;
      varying float vA;
      const float BOX = 140.0; const float H = 90.0;
      void main(){
        if (aSeed.w > uDensity) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vA = 0.0; return; }
        float speed = 34.0 + aSeed.z * 16.0;
        vec3 c = cameraPosition;
        float x = c.x + mod(aSeed.x * BOX - c.x + uWind.x * uTime * speed, BOX) - BOX * 0.5;
        float z = c.z + mod(aSeed.z * BOX - c.z + uWind.y * uTime * speed, BOX) - BOX * 0.5;
        float y = c.y - H * 0.35 + mod(aSeed.y * H - uTime * speed, H);
        vec3 p = vec3(x, max(y, uFloor), z);
        vec3 vel = normalize(vec3(uWind.x, -1.0, uWind.y));
        p -= vel * aEnd * (1.2 + aSeed.x * 1.4);
        vA = (1.0 - aEnd * 0.9) * smoothstep(BOX * 0.5, BOX * 0.15, length(p.xz - c.xz)) * step(uFloor + 0.05, y);
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uFlash; varying float vA;
      void main(){ gl_FragColor = vec4(uColor + uFlash * 0.6, vA * 0.2); }`,
  });
  const lines = new THREE.LineSegments(geo, mat);
  lines.frustumCulled = false;
  lines.renderOrder = 8;
  return {
    object: lines,
    uniforms,
    set(density: number, t: number, flash: number, floor: number) {
      uniforms.uDensity.value = density;
      uniforms.uTime.value = t;
      uniforms.uFlash.value = flash;
      uniforms.uFloor.value = floor;
      lines.visible = density > 0.01;
    },
  };
}

/** 閃電：隔一陣子在鏡頭前方遠處打下一道，附帶天空一亮；onStrike 讓聲音延遲打雷 */
export function createLightning(onStrike: (distance: number) => void) {
  const group = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.3, 3), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  let bolt: THREE.Mesh | null = null;
  let life = 0;
  let next = 3;
  let flash = 0;
  const rnd = mulberry32(99);
  const tmpDir = new THREE.Vector3();

  function makeBolt(from: THREE.Vector3, to: THREE.Vector3) {
    const pts: THREE.Vector3[] = [];
    const n = 22;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const p = from.clone().lerp(to, t);
      const j = (1 - Math.abs(t - 0.5) * 1.2) * 40;
      p.x += (rnd() - 0.5) * j;
      p.z += (rnd() - 0.5) * j;
      pts.push(p);
    }
    const geos: THREE.BufferGeometry[] = [new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.1), 80, 1.6, 4, false)];
    // 分岔
    for (let b = 0; b < 3; b++) {
      const k = 4 + Math.floor(rnd() * 12);
      const s = pts[k];
      const bp = [s.clone()];
      for (let i = 1; i < 6; i++) bp.push(s.clone().add(new THREE.Vector3((rnd() - 0.5) * 60 * i / 3, -i * 25, (rnd() - 0.5) * 60 * i / 3)));
      geos.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(bp), 20, 0.7, 3, false));
    }
    const merged = new THREE.Group();
    geos.forEach((g) => merged.add(new THREE.Mesh(g, mat)));
    return merged;
  }

  return {
    group,
    get flash() {
      return flash;
    },
    update(dt: number, rate: number, cam: THREE.Camera, floor: number) {
      flash = Math.max(0, flash - dt * 3.2);
      if (bolt) {
        life -= dt;
        mat.opacity = life > 0 ? (Math.sin(life * 60) > -0.3 ? 1 : 0.2) * Math.min(1, life * 6) : 0;
        if (life <= 0) {
          group.remove(bolt);
          bolt.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
          bolt = null;
        }
      }
      if (rate <= 0.01) return;
      next -= dt * rate;
      if (next > 0) return;
      next = 4 + rnd() * 8;
      cam.getWorldDirection(tmpDir);
      tmpDir.y = 0;
      tmpDir.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), (rnd() - 0.5) * 1.6);
      const dist = 700 + rnd() * 1600;
      const base = cam.position.clone().addScaledVector(tmpDir, dist);
      const from = base.clone();
      from.y = floor + 650;
      const to = base.clone();
      to.y = floor;
      bolt = makeBolt(from, to) as unknown as THREE.Mesh;
      group.add(bolt);
      life = 0.32;
      flash = 1;
      onStrike(dist);
    },
  };
}
