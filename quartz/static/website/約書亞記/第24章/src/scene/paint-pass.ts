import * as THREE from 'three';

/** Five taps at a capped render resolution; stable paper grain, independent of motion. */
export function createPaintPass(renderer: THREE.WebGLRenderer) {
  // Keep linear HDR through the scene pass; tone map only at display output.
  const target = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: true, type: THREE.HalfFloatType });
  const material = new THREE.ShaderMaterial({
    uniforms: { image: { value: target.texture }, pixel: { value: new THREE.Vector2(1, 1) }, strength: { value: .45 } },
    depthTest: false, depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader: `
      uniform sampler2D image; uniform vec2 pixel; uniform float strength; varying vec2 vUv;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      void main(){
        vec3 c=texture2D(image,vUv).rgb;
        vec3 l=texture2D(image,vUv-vec2(pixel.x*1.6,0.)).rgb;
        vec3 r=texture2D(image,vUv+vec2(pixel.x*1.6,0.)).rgb;
        vec3 u=texture2D(image,vUv+vec2(0.,pixel.y*1.6)).rgb;
        vec3 d=texture2D(image,vUv-vec2(0.,pixel.y*1.6)).rgb;
        // Edge-directed brush: average only the smoother axis, preserve silhouette contours.
        vec3 brush=dot(l-r,l-r)<dot(u-d,u-d)?(l+c*2.+r)*.25:(u+c*2.+d)*.25;
        vec3 paint=mix(c,brush,strength*.55);
        vec2 paper=gl_FragCoord.xy;
        float grain=hash(floor(paper*.7))-.5;
        float fibre=sin(paper.x*.43+sin(paper.y*.09))*sin(paper.y*1.7);
        gl_FragColor=vec4(paint*(1.+strength*(grain*.025+fibre*.009)),1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  quad.frustumCulled = false;
  const passScene = new THREE.Scene(); passScene.add(quad);
  const passCamera = new THREE.Camera();
  return {
    resize(w: number, h: number, dpr: number) {
      const ratio = Math.min(1.5, dpr);
      target.setSize(Math.round(w * ratio), Math.round(h * ratio));
      material.uniforms.pixel.value.set(1 / target.width, 1 / target.height);
    },
    render(scene: THREE.Scene, camera: THREE.Camera) {
      renderer.info.autoReset = false; renderer.info.reset();
      renderer.setRenderTarget(target); renderer.render(scene, camera);
      renderer.setRenderTarget(null); renderer.render(passScene, passCamera);
    },
    dispose() { target.dispose(); quad.geometry.dispose(); material.dispose(); },
  };
}
