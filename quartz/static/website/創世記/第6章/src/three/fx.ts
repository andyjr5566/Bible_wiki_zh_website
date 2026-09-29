import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { smokePuff, softDot } from './textures';

/** 後製：柔光、調色、暗角、顆粒。低畫質時只留調色。 */
export function createPost(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, quality: 'high' | 'low') {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.35, 0.6, 0.86);
  if (quality === 'high') composer.addPass(bloom);
  const grade = new ShaderPass({
    uniforms: {
      tDiffuse: { value: null },
      uTime: { value: 0 },
      uVignette: { value: 0.35 },
      uGrain: { value: 0.04 },
      uWarm: { value: 0 },
      uSat: { value: 1 },
      uLift: { value: 0 },
      uFade: { value: 0 },
      uContrast: { value: 0.12 },
    },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D tDiffuse; uniform float uTime, uVignette, uGrain, uWarm, uSat, uLift, uFade, uContrast;
      varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main(){
        vec4 c = texture2D(tDiffuse, vUv);
        vec3 col = c.rgb;
        float l = dot(col, vec3(0.299, 0.587, 0.114));
        col = mix(vec3(l), col, uSat);
        col *= mix(vec3(1.0), vec3(1.08, 1.0, 0.9), uWarm);
        col = mix(col, col * vec3(0.92, 0.98, 1.08), max(-uWarm, 0.0));
        col += uLift * vec3(0.05, 0.055, 0.06);
        col = max((col - 0.18) * (1.0 + uContrast) + 0.18, 0.0);
        vec2 d = vUv - 0.5;
        col *= 1.0 - uVignette * smoothstep(0.25, 0.85, length(d * vec2(1.25, 1.0)));
        col += (h(vUv * 1000.0 + uTime) - 0.5) * uGrain;
        col = mix(col, vec3(0.0), uFade);
        gl_FragColor = vec4(col, c.a);
      }`,
  });
  composer.addPass(grade);
  composer.addPass(new OutputPass());
  return {
    composer,
    bloom,
    grade: grade.uniforms,
    setSize(w: number, h: number) {
      composer.setSize(w, h);
      bloom.resolution.set(w / 2, h / 2);
    },
  };
}
export type Post = ReturnType<typeof createPost>;

/** 祭壇的火和煙（創8:20）。粒子數不多，在 CPU 上更新即可。 */
export function createAltarFx() {
  const group = new THREE.Group();
  const smokeTex = smokePuff(5);
  const fireTex = softDot('rgba(255,200,120,1)');
  const N = 42;
  const smoke = Array.from({ length: N }, (_, i) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, color: 0xcfc6b8, transparent: true, depthWrite: false, opacity: 0 }));
    s.userData.ph = i / N;
    s.userData.dx = (Math.random() - 0.5) * 2;
    s.userData.rot = Math.random() * 6;
    group.add(s);
    return s;
  });
  const flames = Array.from({ length: 14 }, (_, i) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: fireTex, color: 0xff9a40, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
    s.userData.ph = i / 14;
    s.userData.dx = (Math.random() - 0.5) * 0.9;
    group.add(s);
    return s;
  });
  const light = new THREE.PointLight(0xff8a3a, 0, 28, 1.5);
  light.position.y = 2.4;
  group.add(light);
  return {
    group,
    update(t: number, on: number, wind: THREE.Vector2) {
      group.visible = on > 0.01;
      if (!group.visible) return;
      light.intensity = on * (40 + Math.sin(t * 11) * 8 + Math.sin(t * 27) * 5);
      for (const s of smoke) {
        const ph = (t * 0.07 + s.userData.ph) % 1;
        const rise = ph * 26;
        s.position.set(s.userData.dx * 0.6 + wind.x * rise * rise * 0.02 + Math.sin(t * 0.5 + s.userData.rot) * ph * 1.4, 2.2 + rise, wind.y * rise * rise * 0.02);
        const sc = 1.4 + ph * 9;
        s.scale.set(sc, sc, 1);
        (s.material as THREE.SpriteMaterial).opacity = on * Math.sin(Math.PI * ph) * 0.42;
        (s.material as THREE.SpriteMaterial).rotation = s.userData.rot + ph * 1.5;
      }
      for (const f of flames) {
        const ph = (t * 1.3 + f.userData.ph) % 1;
        f.position.set(f.userData.dx * (1 - ph), 1.9 + ph * 1.8, (f.userData.dx - 0.2) * 0.5 * (1 - ph));
        const sc = (1 - ph) * 1.6 + 0.3;
        f.scale.set(sc, sc * 1.4, 1);
        (f.material as THREE.SpriteMaterial).opacity = on * (1 - ph) * 0.85;
      }
    },
  };
}
