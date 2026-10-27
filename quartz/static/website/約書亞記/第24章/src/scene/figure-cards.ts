import * as THREE from 'three';
import atlasUrl from '../assets/figures/atlas.webp';
import atlas from '../assets/figures/atlas.json';
import { deferredTexture } from './texture';

export interface FigureFrame {
  width: number; height: number; head: number[]; foot: number[]; uv: number[];
}
export const frames: Record<string, FigureFrame> = atlas.frames;

/** One atlas / one crowd draw. The camera-facing rotation is strictly around world Y. */
export function createFigureMaterials() {
  const atlasTexture = deferredTexture(atlasUrl);
  const texture = atlasTexture.texture;
  void atlasTexture.load();
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.anisotropy = 2;
  const tint = { value: new THREE.Color('#bba28c') };
  const rimSide = { value: 1 };
  const texel = { value: 1 / atlas.size };
  const make = (instanced: boolean) => {
    const rect = { value: new THREE.Vector4(0, 0, 1, 1) };
    const fade = { value: 1 };
    const mat = new THREE.MeshBasicMaterial({ map: texture, transparent: true, alphaTest: 0.32, side: THREE.DoubleSide, fog: true });
    mat.onBeforeCompile = (s) => {
      s.uniforms.figureRect = rect;
      s.uniforms.figureTint = tint;
      s.uniforms.rimSide = rimSide;
      s.uniforms.atlasTexel = texel;
      s.uniforms.figureFade = fade;
      s.vertexShader = `${instanced ? 'attribute vec4 cardRect;' : 'uniform vec4 figureRect;'}\nvarying vec4 vCardRect;\n${s.vertexShader}`;
      s.vertexShader = s.vertexShader.replace('#include <uv_vertex>', `#include <uv_vertex>\nvCardRect = ${instanced ? 'cardRect' : 'figureRect'};`);
      s.vertexShader = `${instanced ? 'attribute float cardFade;' : 'uniform float figureFade;'} varying float vFigureFade;\n${s.vertexShader}`;
      s.vertexShader = s.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\nvFigureFade = ${instanced ? 'cardFade' : 'figureFade'};`);
      s.fragmentShader = `varying float vFigureFade;\n${s.fragmentShader}`;
      s.fragmentShader = s.fragmentShader.replace('#include <alphatest_fragment>', '#include <alphatest_fragment>\ndiffuseColor.a *= vFigureFade;');
      s.fragmentShader = `uniform vec3 figureTint; uniform float rimSide; uniform float atlasTexel; varying vec4 vCardRect;\n${s.fragmentShader}`;
      s.fragmentShader = s.fragmentShader.replace('#include <map_fragment>', `
        vec2 cardUV = vCardRect.xy + vMapUv * vCardRect.zw;
        vec4 figure = texture2D(map, cardUV);
        float neighbour = texture2D(map, clamp(cardUV + vec2(rimSide * atlasTexel * 3.0, 0.), vCardRect.xy, vCardRect.xy + vCardRect.zw)).a;
        float edge = max(0., figure.a - neighbour);
        // Suppress the baked warm edge on the unlit side; relight from the current sun.
        vec3 ink = mix(vec3(.034, .026, .028), figure.rgb * .30, .45);
        diffuseColor *= vec4(ink * figureTint + edge * vec3(.92, .60, .28), figure.a);
      `);
    };
    mat.customProgramCacheKey = () => `jos-figure-${instanced}`;
    return { mat, rect, fade };
  };
  return { texture, tint, rimSide, make };
}

export function frameFor(role: string, pose: string): FigureFrame {
  return frames[`${role}/${pose}`] ?? frames[`${role}/stand`] ?? frames['father/stand'];
}

/** Opaque geometry is bounded to the art; shadows never enlarge head/bubble bounds. */
export function fitCard(mesh: THREE.Mesh, frame: FigureFrame, height: number): void {
  const scale = height / (frame.foot[1] - frame.head[1]);
  mesh.scale.set(frame.width * scale, frame.height * scale, 1);
  mesh.position.set((frame.width * .5 - frame.foot[0]) * scale, (frame.foot[1] - frame.height * .5) * scale, 0);
}

export function createContactShadowMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1,
    vertexShader: `varying vec2 vUv; void main(){vUv=uv; vec4 p=vec4(position,1.); #ifdef USE_INSTANCING\n p=instanceMatrix*p;\n #endif\n gl_Position=projectionMatrix*modelViewMatrix*p;}`.replace(' #ifdef', '\n#ifdef'),
    fragmentShader: `varying vec2 vUv; void main(){float r=length((vUv-.5)*2.); float a=(1.-smoothstep(.05,1.,r))*.24; if(a<.004)discard; gl_FragColor=vec4(.095,.065,.04,a);}`,
  });
}
