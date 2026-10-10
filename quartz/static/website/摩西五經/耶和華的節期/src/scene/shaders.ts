// 所有 GLSL 都在這裡。版畫刻線的核心是 hatchCov：螢幕空間的平行線，線寬跟著暗度 t 變化。
// three 會替 ShaderMaterial 自動補上 precision、attribute position/normal/uv、modelMatrix 等宣告。

export const GLSL_COMMON = /* glsl */ `
uniform vec2 uViewport;
uniform vec2 uRes;
uniform float uDpr;
uniform float uTime;
uniform float uAnim;
uniform float uDark;

float hash11(float p){ p = fract(p * .1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash21(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float hash31(vec3 p3){ p3 = fract(p3 * .1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p){
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3. - 2. * f);
  float a = hash21(i), b = hash21(i + vec2(1., 0.)), c = hash21(i + vec2(0., 1.)), d = hash21(i + vec2(1., 1.));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm(vec2 p){
  float v = 0.; float a = .5;
  for (int i = 0; i < 4; i++){ v += a * vnoise(p); p = p * 2.03 + vec2(17.1, 9.2); a *= .5; }
  return v;
}

// 螢幕空間平行刻線。t：0..1 線寬比例；ang：弧度；spacingPx：CSS px 的線距。
// 低頻噪聲讓線略微抖動、粗細不均，並在亮部斷成短線，像手刻。
float hatchCov(vec2 frag, float t, float ang, float spacingPx, float seed){
  float s = spacingPx * uDpr;
  float ca = cos(ang), sa = sin(ang);
  vec2 p = vec2(ca * frag.x + sa * frag.y, -sa * frag.x + ca * frag.y);
  float px = p.x / uDpr;
  float wob = (vnoise(vec2(px * .018 + seed * 3.1, p.y * .0035 / uDpr + seed)) - .5) * .8;
  float cell = p.y / s + wob;
  float id = floor(cell);
  float fr = fract(cell) - .5;
  float thick = vnoise(vec2(px * .03 + id * 7.13 + seed, id * 3.7 + seed * 5.)) - .5;
  float w = clamp(t + thick * 1.8 * t * (1. - t), 0., 1.);
  float dash = vnoise(vec2(px * .045 + id * 13.1 + seed * 2., id * 1.7));
  w *= mix(smoothstep(.12, .42, dash + t * .9), 1., smoothstep(.45, .7, t));
  float hw = mix(w * .5, .8, smoothstep(.9, 1., w));
  float aa = 1. / s;
  float c = clamp((hw - abs(fr)) / aa + .5, 0., 1.);
  return c * smoothstep(.015, .09, w);
}
`;

// ---------- 刻線光照材質（泛用） ----------
export const LIT_VERT = /* glsl */ `
varying vec3 vN;
varying vec3 vW;
varying vec3 vObj;
#ifdef USE_PART
attribute float aPart;
varying float vPart;
#endif
#ifdef USE_INSTANCING_COLOR
varying vec3 vIC;
#endif
uniform float uTime;
uniform float uWind;
#ifdef SWAY
attribute float aS;
#endif
#ifdef CUTX
uniform float uCutX;
#endif
#ifdef GUST
uniform float uGustT[4];
uniform vec2 uGustP;
#endif
#ifdef CROP
uniform float uGrow;
uniform float uCut;
uniform float uCutAll;
#endif
#ifdef REAP
uniform float uReap;
#endif
#ifdef FLAP
uniform vec2 uBlowC;
uniform float uBlowA;
uniform float uBlowT;
#endif
#ifdef SWAY
uniform float uSwayK;
#endif
void main(){
  vec4 p = vec4(position, 1.);
  vec3 n = normal;
  float hgt = position.y;
  #if defined(CUTX) && defined(USE_INSTANCING) && defined(USE_PART)
    // 割麥：收割線以左的麥子還站著，以右（身後）只剩殘茬
    vec4 io = modelMatrix * instanceMatrix * vec4(0., 0., 0., 1.);
    float cm = step(uCutX, io.x) * step(abs(io.z + .8), 2.9) * step(io.x, 4.7);
    if (aPart > .5 && aPart < 1.5) p.xyz *= 1. - cm; else p.y *= mix(1., .13, cm);
  #endif
  #if defined(REAP) && defined(USE_INSTANCING) && defined(USE_PART)
    // 收割線（沿 x 走）：線以左已割成殘茬，線附近 1 公尺內漸漸倒下
    vec4 ior = modelMatrix * instanceMatrix * vec4(0., 0., 0., 1.);
    float cmr = 1. - smoothstep(uReap - .5, uReap + .5, ior.x);
    if (aPart > .5 && aPart < 1.5) p.xyz *= 1. - cmr; else p.y *= mix(1., .13, cmr);
  #endif
  #if defined(CROP) && defined(USE_PART) && defined(USE_INSTANCING_COLOR)
    // 作物：uGrow 是整體生長（殘茬→全高）；instanceColor.g＝1 的田角不被割（uCut）
    float zone = instanceColor.g;
    float hk = mix(mix(uGrow, 0.17, uCut), uGrow, zone);
    hk = mix(hk, 0.17, uCutAll);
    float earK = smoothstep(.3, .55, hk);
    if (aPart > .5 && aPart < 1.5) {
      p.xz *= earK;
      p.y = hk * .84 + (p.y - .84) * earK;
    } else {
      p.y *= hk;
    }
  #endif
  #ifdef USE_INSTANCING
    p = instanceMatrix * p;
    n = mat3(instanceMatrix) * n;
  #endif
  #ifdef USE_INSTANCING_COLOR
    vIC = instanceColor;
  #endif
  #ifdef USE_PART
    vPart = aPart;
  #endif
  vec4 wp = modelMatrix * p;
  #ifdef WIND
    // 基礎擺動約 0.08 rad，加上順風移動的陣風（每 4–7 秒一波推過）
    vec2 wd = vec2(.94, .34);
    float ph = wp.x * .35 + wp.z * .22;
    float sw = sin(uTime * 1.7 + ph) * .6 + sin(uTime * .9 + ph * 1.7) * .4;
    float along = dot(wp.xz, wd);
    float gph = along * .085 - uTime * .8 + .7 * sin(wp.z * .09 + uTime * .13);
    float gust = pow(.5 + .5 * sin(gph), 3.) * (.65 + .35 * sin(uTime * 1.07 + along * .02));
    float hh = hgt * hgt;
    float bend = (sw * .1 + gust * .26) * uWind;
    wp.xz += wd * bend * hh;
    wp.z += cos(uTime * 1.3 + ph * 1.2) * uWind * hh * .035;
    wp.y -= abs(bend) * hh * .22;
  #endif
  #ifdef SWAY
    float sp = wp.x * .21 + wp.z * .33;
    wp.xyz += vec3(sin(uTime * .9 + sp) * .26, sin(uTime * 1.35 + sp * 1.6) * .17, cos(uTime * .8 + sp * 1.2) * .22) * aS * aS * uWind * uSwayK;
  #endif
  #ifdef FLAP
    {
      float fh = clamp(position.y / 2.1, 0., 1.);
      vec3 nw = normalize(mat3(modelMatrix) * n);
      float wf = .5 + .5 * dot(normalize(nw.xz + vec2(1e-4)), vec2(-.94, -.34));
      float fl = sin(uTime * 1.9 + wp.x * .6 + wp.z * .4) * .6 + sin(uTime * 3.3 + wp.z * .9 + wp.x * .3) * .4;
      wp.xz += vec2(.94, .34) * fl * .05 * fh * (.3 + .7 * wf) * uWind;
      wp.y += fl * .018 * fh * uWind;
      // 吹角：聲波從會幕院子門口推過來，帳棚布面被推開一下（讀者觸發，動態關也照常）
      vec2 bd = wp.xz - uBlowC;
      float br = length(bd);
      float bw = sin(br * .5 - uBlowT * 8.) * exp(-br * .035);
      wp.xz += bd / max(br, .01) * bw * uBlowA * .3 * fh;
      wp.y += abs(bw) * uBlowA * .09 * fh;
    }
  #endif
  #ifdef GUST
    // 禾捆搖一下，一陣風浪從近（z 大）往遠（z 小）推開
    float amp = 0.;
    for (int gi = 0; gi < 4; gi++){
      float ga = uGustT[gi];
      if (ga >= 0.){
        float gd = wp.z - (uGustP.x - ga * uGustP.y);
        amp += exp(-gd * gd * .03) * (1. - smoothstep(2.6, 3.8, ga)) * smoothstep(0., .22, ga);
      }
    }
    amp = min(amp, 1.3);
    float gh = hgt * hgt;
    wp.z -= amp * gh * .5;
    wp.y -= amp * gh * .22;
    wp.x += amp * gh * .3 * sin(wp.x * .8 + wp.z * .6);
  #endif
  vW = wp.xyz;
  vN = normalize(mat3(modelMatrix) * n);
  vObj = position;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const LIT_FRAG = /* glsl */ `
${GLSL_COMMON}
varying vec3 vN;
varying vec3 vW;
varying vec3 vObj;
#ifdef USE_PART
varying float vPart;
uniform vec3 uPartCol[6];
uniform vec3 uPartAlt;
#endif
#ifdef USE_INSTANCING_COLOR
varying vec3 vIC;
#endif
uniform vec3 uBase;
uniform vec3 uLineCol;
uniform float uInvert;
uniform float uAngle;
uniform float uAngle2;
uniform float uSpace;
uniform float uBias;
uniform float uSeed;
uniform float uCross;
uniform vec3 uLightDir;
uniform float uAmb;
uniform float uGain;
uniform vec4 uPt;
#ifdef BAKE
uniform float uBake;
uniform vec3 uBurnCol;
#endif
void main(){
  vec3 N = normalize(vN);
  if (!gl_FrontFacing) N = -N;
  float lam;
  #ifdef POINT
    vec3 Lp = uPt.xyz - vW;
    float d = length(Lp);
    Lp /= max(d, .001);
    lam = clamp(max(dot(N, Lp), 0.) * uPt.w / (1. + .16 * d * d), 0., 1.);
  #else
    lam = max(dot(N, normalize(uLightDir)), 0.);
  #endif
  float lum = clamp((uAmb + (1. - uAmb) * lam) * uGain + uBias, 0., 1.);
  float t = 1. - lum;
  vec3 base = uBase;
  #ifdef USE_PART
    int pidx = int(vPart + .5);
    base = uPartCol[pidx];
    #ifdef USE_INSTANCING_COLOR
      if (pidx == 0) base = mix(base, uPartAlt, vIC.r);
    #endif
  #endif
  float te = mix(t, 1. - t, uDark * uInvert);
  #ifdef BAKE
    // 烤餅：焦痕斑點隨 uBake 擴大，刻線加密；生麵團是淺色，烤過偏深黃
    float bn = vnoise(vObj.xz * 5.5 + 3.1) * .62 + vnoise(vObj.xz * 14.) * .38;
    float burn = smoothstep(.76 - uBake * .2, .88 - uBake * .12, bn) * smoothstep(.04, .45, uBake);
    base = mix(base, vec3(.74, .53, .27), smoothstep(0., 1., uBake) * .72);
    base = mix(base, uBurnCol, burn);
    te = clamp(te + burn * .5 + uBake * .12, 0., 1.);
  #endif
  float ang = mix(uAngle, uAngle2, step(.6, N.y));
  float cov = hatchCov(gl_FragCoord.xy, te, ang, uSpace, uSeed);
  if (uCross > .5){
    float t2 = smoothstep(.55, 1., te) * .85;
    cov = max(cov, hatchCov(gl_FragCoord.xy, t2, ang + 1.05, uSpace * 1.1, uSeed + 4.3));
  }
  gl_FragColor = vec4(mix(base, uLineCol, cov), 1.);
}
`;

// ---------- 倒殼輪廓（inverted hull）：螢幕空間固定像素寬 ----------
export const HULL_VERT = /* glsl */ `
uniform vec2 uViewport;
uniform float uDpr;
uniform float uOutlinePx;
void main(){
  vec4 p = vec4(position, 1.);
  vec3 n = normal;
  #ifdef USE_INSTANCING
    p = instanceMatrix * p;
    n = mat3(instanceMatrix) * n;
  #endif
  vec4 mv = modelViewMatrix * p;
  vec4 clip = projectionMatrix * mv;
  vec3 nv = normalize(normalMatrix * n);
  vec4 cn = projectionMatrix * vec4(nv, 0.);
  vec2 dir = cn.xy;
  float l = length(dir);
  dir = l > 1e-5 ? dir / l : vec2(0.);
  clip.xy += dir * (uOutlinePx * uDpr) * 2. / uViewport * clip.w;
  gl_Position = clip;
}
`;
export const HULL_FRAG = /* glsl */ `
uniform vec3 uOutCol;
void main(){ gl_FragColor = vec4(uOutCol, 1.); }
`;

// ---------- 平塗發光（門內燈光、窗、火炬） ----------
export const GLOW_VERT = /* glsl */ `
varying vec2 vUv;
varying float vTh;
#ifdef USE_INSTANCING_COLOR
varying vec3 vIC;
#endif
void main(){
  vUv = uv;
  vec4 p = vec4(position, 1.);
  #ifdef USE_INSTANCING
    p = instanceMatrix * p;
  #endif
  #ifdef USE_INSTANCING_COLOR
    vIC = instanceColor;
    vTh = instanceColor.r;
  #else
    vTh = 1.;
  #endif
  gl_Position = projectionMatrix * modelViewMatrix * p;
}
`;
export const GLOW_FRAG = /* glsl */ `
${GLSL_COMMON}
varying vec2 vUv;
varying float vTh;
uniform vec3 uOnCol;
uniform vec3 uOffCol;
uniform vec3 uEdgeCol;
uniform float uOn;      // 0..1：整體亮度（火炬熄滅用）
uniform float uOff;     // 窗戶門檻：vTh < uOff 的窗熄燈
uniform float uHatch;   // 邊緣刻線強度
uniform float uFlick;
void main(){
  #ifdef SPILL
    #ifdef POOL
      float vv = clamp(1. - length(vUv - .5) * 2.1, 0., 1.);
    #else
      float vv = clamp(1. - length((vUv - vec2(.5, 1.)) * vec2(1.15, 1.)) * 1.12, 0., 1.);
    #endif
    float cv = hatchCov(gl_FragCoord.xy, vv * vv * 1.1, 1.62, 5., 3.7);
    cv *= 1. + uFlick * 2. * (vnoise(vec2(uTime * 7., 3.3)) - .5);
    gl_FragColor = vec4(uOnCol, cv * uOn);
    return;
  #endif
  vec2 c = vUv - .5;
  float v = length(c * vec2(1., 1.15)) * 1.55;
  float on = uOn * step(uOff, vTh);
  float t = uHatch * smoothstep(.3, 1., v);
  float cov = hatchCov(gl_FragCoord.xy, t, 1.5708, 4.6, 2.2);
  vec3 col = mix(uOffCol, uOnCol, on);
  col = mix(col, uEdgeCol, cov * (.35 + .65 * on));
  col *= 1. + uFlick * (vnoise(vec2(uTime * 4. + vTh * 17., vUv.y * 3.)) - .5) * 2.;
  gl_FragColor = vec4(col, 1.);
}
`;

// ---------- 火焰：兩片交叉的豎面，水滴形，邊緣刻線，會搖 ----------
export const FLAME_FRAG = /* glsl */ `
${GLSL_COMMON}
varying vec2 vUv;
uniform float uFlick;
uniform vec3 uCol;
uniform vec3 uEdge;
void main(){
  float y = vUv.y;
  float x = (vUv.x - .5) * 2.;
  float wob = (vnoise(vec2(y * 2.6 + uTime * 3.4, 1.7)) - .5) * .9 * uFlick * y;
  float env = pow(sin(3.14159 * pow(clamp(y, 0., 1.), .72)), .85) * (1. - y * .28);
  float d = abs(x - wob) / max(env * (.85 + .3 * uFlick * vnoise(vec2(y * 5., uTime * 5.))), .001);
  if (d > 1. || y > .985) discard;
  float cov = hatchCov(gl_FragCoord.xy, .22 + .55 * d, 1.5708, 4.2, 2.2);
  vec3 col = mix(uCol, uEdge, smoothstep(.35, 1., d) * .85 + y * .25);
  col = mix(col, uEdge * .45, cov * .6);
  gl_FragColor = vec4(col, 1.);
}
`;

// ---------- 血跡貼花 ----------
export const DECAL_VERT = /* glsl */ `
varying vec2 vUv;
void main(){
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
}
`;
export const DECAL_FRAG = /* glsl */ `
${GLSL_COMMON}
varying vec2 vUv;
uniform vec3 uCol;
uniform vec3 uCol2;
uniform float uGrow;
uniform float uSeed;
uniform vec2 uSize;
uniform vec2 uRad;
void main(){
  vec2 p = (vUv - .5) * uSize;
  float g = smoothstep(0., 1., uGrow);
  vec2 q = p / (uRad * (.2 + .8 * g));
  float ang = atan(q.y, q.x);
  float r = length(q);
  float edge = 1. + .38 * (vnoise(vec2(ang * 2.1 + uSeed, uSeed * 2.)) - .5) * 2.
             + pow(vnoise(vec2(ang * 6.5 + uSeed * 3., 1.7)), 3.) * 1.1 * g;
  float body = 1. - smoothstep(edge - .07, edge, r);
  float drop = 0.;
  for (int i = 0; i < 10; i++){
    float fi = float(i);
    vec2 c = (vec2(hash11(fi * 3.1 + uSeed), hash11(fi * 5.7 + uSeed * 1.3)) - .5) * uSize * .92;
    float rr = (.012 + .03 * hash11(fi * 9.3 + uSeed)) * g;
    drop = max(drop, 1. - smoothstep(rr * .7, rr, length(p - c)));
  }
  float drip = 0.;
  for (int i = 0; i < 3; i++){
    float fi = float(i);
    float cx = (hash11(fi * 4.3 + uSeed * 2.) - .5) * uRad.x * 1.5;
    float len = (.12 + .32 * hash11(fi * 6.1 + uSeed)) * g;
    float top = -uRad.y * .3;
    float inx = 1. - smoothstep(.012, .02, abs(p.x - cx));
    float iny = step(p.y, top) * step(top - len - uRad.y * .3, p.y);
    float endcap = 1. - smoothstep(.0, .03, (top - len - uRad.y * .3) - p.y + .03);
    drip = max(drip, inx * iny * (.4 + .6 * endcap));
  }
  float a = max(max(body, drop), drip);
  float inner = smoothstep(.4, 1., r);
  float cov = hatchCov(gl_FragCoord.xy, .18 + .42 * inner, 1.3, 5., uSeed);
  vec3 col = mix(uCol, uCol2, cov * .85);
  if (a < .01) discard;
  gl_FragColor = vec4(col, a);
}
`;

// ---------- 月亮：刻線球，光源方向在視圖空間（相位）----------
export const MOON_VERT = /* glsl */ `
varying vec3 vNv;
varying vec3 vObj;
void main(){
  vNv = normalize(normalMatrix * normal);
  vObj = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
}
`;
export const MOON_FRAG = /* glsl */ `
${GLSL_COMMON}
varying vec3 vNv;
varying vec3 vObj;
uniform vec3 uLightV;
uniform vec3 uBaseL;
uniform vec3 uBaseD;
uniform vec3 uLineL;
uniform vec3 uLineD;
void main(){
  vec3 N = normalize(vNv);
  float lam = dot(N, normalize(uLightV));
  float lum = smoothstep(.0, .5, lam);
  vec3 on = normalize(vObj);
  vec2 sph = vec2(atan(on.z, on.x), asin(clamp(on.y, -1., 1.)));
  float cr = 0.;
  for (int k = 0; k < 2; k++){
    float sc = k == 0 ? 1. : 2.1;
    vec2 g = sph * vec2(5.5, 8.5) * sc;
    vec2 id = floor(g);
    vec2 f = fract(g) - .5;
    vec2 off = (vec2(hash21(id), hash21(id + 7.7)) - .5) * .5;
    float rad = .14 + .12 * hash21(id + 3.3);
    float d = length(f - off);
    float has = step(.52, hash21(id + 11.));
    cr += has * ((1. - smoothstep(rad * .6, rad, d)) * .55 - (smoothstep(rad * .8, rad, d) * (1. - smoothstep(rad, rad * 1.3, d))) * .35);
  }
  float mare = smoothstep(.46, .68, fbm(sph * vec2(1.3, 2.1) + 3.));
  lum = clamp(lum - cr * .32 * smoothstep(.1, .5, lum) - mare * .22 * smoothstep(.1, .5, lum), 0., 1.);
  float t = 1. - lum;
  float te = mix(t, 1. - t, uDark);
  float cov = hatchCov(gl_FragCoord.xy, te, -.38, 4.2, 1.7);
  vec3 base = mix(uBaseL, uBaseD, uDark);
  vec3 lc = mix(uLineL, uLineD, uDark);
  gl_FragColor = vec4(mix(base, lc, cov), 1.);
}
`;

// ---------- 夜空（全螢幕，依視線方向算仰角）----------
export const FS_VERT = /* glsl */ `
varying vec2 vNdc;
void main(){
  vNdc = position.xy;
  gl_Position = vec4(position.xy, 1., 1.);
}
`;
export const SKY_FRAG = /* glsl */ `
${GLSL_COMMON}
varying vec2 vNdc;
uniform mat4 uInvProj;
uniform mat4 uCamWorld;
uniform float uHorizon;
uniform vec3 uHorizonCol;
uniform float uSkyDay;
uniform float uStars;
uniform float uTwinkle;
uniform vec3 uNightL;
uniform vec3 uNightD;
uniform vec3 uDaySky;
uniform vec3 uInk;
uniform vec3 uPaper;
void main(){
  vec4 v = uInvProj * vec4(vNdc, 1., 1.);
  vec3 dir = normalize((uCamWorld * vec4(v.xyz / v.w, 0.)).xyz);
  float el = dir.y;
  float hz = uHorizon * pow(1. - smoothstep(0., .5, el), 1.7);
  vec3 night = mix(uNightL, uNightD, uDark);
  vec3 base = mix(night, uHorizonCol, hz * .96);
  base = mix(base, uDaySky, uSkyDay);
  float z = smoothstep(.02, .85, el);
  float tL = mix(.16, .8, z) * (1. - hz * .85);
  float tD = (1. - z) * .5 * (1. - hz * .4) + .06;
  float tt = mix(tL, tD, uDark);
  vec3 lineN = mix(uNightL * .38, uNightD * 2.6 + vec3(.05, .06, .12), uDark);
  float dayT = mix(.1 + .22 * z, (.1 + .22 * (1. - z)) * .7, uDark);
  tt = mix(tt, dayT, uSkyDay);
  vec3 lc = mix(lineN, uInk, uSkyDay);
  float cov = hatchCov(gl_FragCoord.xy, tt, .02, 5.6, 3.1);
  vec3 col = mix(base, lc, cov);
  // 星星：在刻線上挖掉的小白點
  vec3 sp = dir * 62.;
  vec3 ic = floor(sp);
  vec3 fc = sp - ic;
  float hh = hash31(ic);
  vec3 cc = vec3(hash31(ic + 1.3), hash31(ic + 2.7), hash31(ic + 4.1));
  float rs = .1 + .12 * hash31(ic + 9.1);
  float d = length(fc - cc);
  float st = step(.45, hh) * (1. - smoothstep(rs * .55, rs, d));
  // 只有約 5% 的星慢慢明滅
  float tw = 1. - uTwinkle * (step(.955, hash31(ic + 7.7)) * .8 + .04) * (.5 + .5 * sin(uTime * (.7 + hh * 1.2) + hh * 40.));
  st *= smoothstep(.015, .09, el) * (1. - hz) * (1. - uSkyDay) * uStars * tw;
  vec3 starCol = mix(uPaper * .98 + vec3(.04), uInk, uDark);
  col = mix(col, starCol, st);
  // 白天的雲帶：幾條淡淡的刻線雲，緩慢橫移
  if (uSkyDay > .01){
    vec2 cu = dir.xz / max(el + .16, .08) * vec2(.5, 1.3) + vec2(uAnim * .018, 0.);
    float cn = fbm(cu * .9 + 4.);
    float cl = smoothstep(.5, .7, cn) * smoothstep(.02, .14, el) * (1. - smoothstep(.4, .75, el)) * uSkyDay;
    vec3 cloudCol = mix(vec3(1.), mix(uDaySky, uInk, .16), uDark * .85 + .12);
    float cov2 = hatchCov(gl_FragCoord.xy, .3, .015, 5.6, 6.3);
    col = mix(col, cloudCol, cl * .62);
    col = mix(col, lc, cl * cov2 * .35);
  }
  gl_FragColor = vec4(col, 1.);
}
`;

// ---------- 半夜的黑暗：沿 x 掃過的帶狀遮罩，繞過有血的門 ----------
export const DARK_FRAG = /* glsl */ `
${GLSL_COMMON}
uniform vec4 uDoors[10];
uniform float uDoorN;
uniform float uFront;
uniform float uBand;
uniform float uAmt;
uniform float uHorizonY;
uniform float uFlow;
uniform float uRise;
uniform vec3 uCol;
void main(){
  vec2 f = gl_FragCoord.xy;
  float H = uRes.y;
  vec2 q = f / H;
  vec2 warp = vec2(0.);
  float prot = 0.;
  for (int i = 0; i < 10; i++){
    if (float(i) >= uDoorN) break;
    vec4 d = uDoors[i];
    vec2 c = d.xy / H;
    vec2 r = d.zw / H;
    vec2 dv = q - c;
    vec2 e2 = dv / r;
    e2.y *= e2.y > 0. ? (1. / 3.4) : (1. / 1.15);
    float e = length(e2);
    prot = max(prot, 1. - smoothstep(.78, 1.3, e));
    float push = exp(-e * e * .4) * .2;
    warp += normalize(dv + vec2(1e-4)) * push * r.x * 3.2;
  }
  vec2 w = q + warp;
  float n = fbm(vec2(w.x * 2.2 - uFlow * .6, w.y * 7. + uFlow * .1));
  float n2 = fbm(vec2(w.x * 5.5 - uFlow * 1.4, w.y * 15.));
  float b = (f.x - uFront) / uBand;
  float edgeN = (n - .5) * .9 + (n2 - .5) * .4;
  float cov = 1. - smoothstep(.55, 1., abs(b) + edgeN);
  float top = uHorizonY + (n2 * .6 + n) * uRise * H;
  cov *= 1. - smoothstep(top - .03 * H, top + .02 * H, f.y);
  cov *= 1. - prot * .98;
  cov *= uAmt;
  float h = hatchCov(f, cov, -.16, 5.2, 8.1);
  gl_FragColor = vec4(uCol, h);
}
`;

// ---------- 整片直向刻線抹除轉場 ----------
export const WIPE_FRAG = /* glsl */ `
${GLSL_COMMON}
uniform float uWipe;
uniform vec3 uCol;
void main(){
  vec2 f = gl_FragCoord.xy / uDpr;
  vec2 uvn = gl_FragCoord.xy / uRes;
  float colw = 7.;
  float cx = f.x / colw;
  float id = floor(cx);
  float fr = fract(cx) - .5;
  float h = hash11(id * 1.37);
  float h2 = hash11(id * 7.77 + 3.);
  float prog = clamp(uWipe * 1.7 - h * .5 - (1. - uvn.y) * .38 - (h2 - .5) * .15, 0., 1.);
  float ragged = vnoise(vec2(id * .7, f.y * .012));
  float widthT = clamp(prog * 1.25 - ragged * .22, 0., 1.);
  float hw = widthT * .62;
  float aa = 1. / (colw * uDpr);
  float c = clamp((hw - abs(fr)) / aa + .5, 0., 1.) * smoothstep(.02, .1, widthT);
  c = max(c, smoothstep(.97, 1., uWipe));
  gl_FragColor = vec4(uCol, c);
}
`;

// ---------- 紙紋：multiply 疊在整個畫面最上層 ----------
export const GRAIN_FRAG = /* glsl */ `
${GLSL_COMMON}
uniform float uJitter;
void main(){
  vec2 f = gl_FragCoord.xy / uDpr;
  float tt = floor(uJitter * 8.);
  float n1 = hash21(floor(f * .9) + tt * 17.3);
  float n2 = vnoise(f * .35 + tt * 3.1);
  float n3 = vnoise(f * .05);
  float g = (n1 - .5) * .075 + (n2 - .5) * .06 + (n3 - .5) * .06;
  float fleck = step(.9985, hash21(floor(f) + 3.3 + tt)) * .22;
  gl_FragColor = vec4(vec3(1. + g - fleck), 1.);
}
`;




// ---------- 火星、煙、塵土：實例化的 billboard 方塊，位置全在頂點著色器算 ----------
export const FX_VERT = /* glsl */ `
attribute vec4 aOrg;
uniform float uAnim;
uniform float uSize;
uniform float uDist;
uniform float uOn;
uniform float uP;
varying vec2 vUv;
varying float vLife;
float h11(float p){ p = fract(p * .1031); p *= p + 33.33; p *= p + p; return fract(p); }
void main(){
  float seed = aOrg.w;
  vec3 org = (modelMatrix * vec4(aOrg.xyz, 1.)).xyz;
  float life = 0.;
  vec3 pos = org;
  float size = uSize;
  #if defined(SPARK)
    float rate = .32 + .4 * h11(seed * 7.1);
    life = fract(uAnim * rate + seed);
    float j = h11(seed * 3.3);
    pos += vec3((j - .5) * .3 + sin(uAnim * 2.2 + seed * 31.) * .14 * life, life * (1.1 + 1.6 * h11(seed * 5.7)) + .1, (h11(seed * 9.1) - .5) * .3);
    size *= (1. - life * .75) * (.6 + .6 * h11(seed * 2.2));
  #elif defined(CLOUD)
    // 香的煙雲：由 uP（捲動進度）決定，往回捲就倒回；漫開後整個遮住施恩座
    float birth = seed * .5;
    float age = clamp((uP - birth) / .5, 0., 1.4);
    float h1 = h11(seed * 3.7), h2 = h11(seed * 5.9), h3 = h11(seed * 8.3);
    float ang = h1 * 6.2832;
    float rad = (.15 + .85 * h2) * (.3 + 1.7 * min(age, 1.));
    pos += vec3(cos(ang) * rad * 1.6 + sin(uAnim * .35 + seed * 17.) * .12 * age, .2 + age * (.6 + 1.6 * h3) + sin(uAnim * .5 + seed * 13.) * .1 * age, sin(ang) * rad * 1.1 + cos(uAnim * .3 + seed * 11.) * .12 * age);
    life = clamp(age, 0., 1.);
    size *= (age > 0.001 ? 1. : 0.) * (.15 + 1.35 * smoothstep(0., 1., min(age, 1.)));
  #elif defined(SMOKE)
    life = fract(uAnim * .075 + seed);
    pos += vec3(life * 1.4 + sin(uAnim * .8 + seed * 20.) * .25 * life, .5 + life * 3.4, sin(seed * 40. + uAnim * .6) * .3 * life);
    size *= .45 + life * 2.2;
  #else
    // 塵土：位置由 uDist（隊伍走過的距離）決定，往回捲就倒回
    life = fract(uDist / 3.1 + seed);
    pos += vec3(-uDist + life * 2.2, .06 + life * .7, (h11(seed * 4.3) - .5) * .9);
    size *= .5 + life * 1.6;
  #endif
  vLife = life;
  vUv = uv;
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vec3 wp = pos + (right * position.x + up * position.y) * size * uOn;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.);
}
`;
export const FX_FRAG = /* glsl */ `
${GLSL_COMMON}
uniform float uOn;
varying vec2 vUv;
varying float vLife;
void main(){
  vec2 c = vUv - .5;
  float d = length(c) * 2.;
  if (d > 1.) discard;
  #if defined(SPARK)
    float a = (1. - smoothstep(.2, 1., d)) * pow(1. - vLife, .8);
    vec3 col = mix(vec3(1., .82, .4), vec3(1., .42, .12), vLife);
    gl_FragColor = vec4(col, a * uOn);
  #else
    float a = (1. - d * d);
    float cov = hatchCov(gl_FragCoord.xy, .5 + .3 * a, 1.2, 4.2, 5.2);
    #if defined(CLOUD)
      float fade = smoothstep(0., .1, vLife) * .68;
      vec3 col = vec3(.72, .68, .6);
    #elif defined(SMOKE)
      float fade = (1. - vLife) * smoothstep(0., .12, vLife) * .72;
      vec3 col = vec3(.82, .78, .7);
    #else
      float fade = (1. - vLife) * smoothstep(0., .1, vLife) * .55;
      vec3 col = vec3(.72, .6, .42);
    #endif
    gl_FragColor = vec4(col, cov * a * fade);
  #endif
}
`;

// ---------- 太陽：刻線球，邊緣加密，朝向鏡頭 ----------
export const SUN_FRAG = /* glsl */ `
${GLSL_COMMON}
varying vec3 vNv;
uniform vec3 uCol;
uniform vec3 uLine;
void main(){
  vec3 N = normalize(vNv);
  float lam = clamp(N.z, 0., 1.);
  float t = pow(1. - lam, 1.7) * 1.15 + .06;
  float cov = hatchCov(gl_FragCoord.xy, t, .9, 4.0, 2.3);
  float cov2 = hatchCov(gl_FragCoord.xy, smoothstep(.55, 1., 1. - lam) * .9, -.6, 4.4, 5.1);
  gl_FragColor = vec4(mix(uCol, uLine, max(cov, cov2)), 1.);
}
`;

// ---------- 聲波環：刻線同心環。VERT：垂直面（以院子門口為圓心，朝鏡頭）；否則平放在地面上 ----------
export const RING_VERT = /* glsl */ `
varying vec3 vP;
void main(){
  vec4 wp = modelMatrix * vec4(position, 1.);
  vP = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;
export const RING_FRAG = /* glsl */ `
${GLSL_COMMON}
varying vec3 vP;
uniform vec3 uC;
uniform float uR[8];
uniform float uA[8];
uniform float uSpd;
void main(){
  #ifdef VERT
    vec2 d = vP.xy - uC.xy;
  #else
    vec2 d = vP.xz - uC.xz;
  #endif
  float r = length(d);
  float cov = 0.;
  float amp = 0.;
  for (int i = 0; i < 8; i++){
    float R = uR[i];
    if (R < 0.) continue;
    float w = .32 + R * .02;
    float dd = abs(r - R);
    // 一圈 = 三道刻線（外粗內細），線寬隨年齡變細
    float m = 0.;
    for (int k = 0; k < 3; k++){
      float off = float(k) * .34 * (1. + R * .03);
      float lw = (.1 - float(k) * .028) * (1. - R * .015);
      m = max(m, 1. - smoothstep(lw * .6, lw, abs(r - R + off)));
    }
    float env = 1. - smoothstep(w * 4., w * 5.5, dd);
    // 線條斷成短刻痕
    float ang = atan(d.y, d.x);
    float dash = step(.22, vnoise(vec2(ang * 5. + float(i) * 3.1, R * .6)));
    cov = max(cov, m * env * dash * uA[i]);
    amp = max(amp, uA[i]);
  }
  if (cov < .01) discard;
  gl_FragColor = vec4(mix(vec3(.96, .9, .74), vec3(.99, .97, .88), cov), cov * .92);
}
`;

// ---------- 時間跳躍抹除：帶紙纖維紋理的舊紙色斜向抹除，抹過時畫面短暫褪成單色 ----------
export const TJ_FRAG = /* glsl */ `
${GLSL_COMMON}
uniform sampler2D tScene;
uniform float uTJ;      // 0..2：0＝無；1＝舊紙色全蓋；2＝抹完
uniform float uDirT;    // +1：左下→右上；-1：反向
uniform vec3 uPaperC;
uniform vec3 uInkC;
float fibers(vec2 f){
  // 幾組不同方向的細長纖維
  float v = 0.;
  for (int k = 0; k < 3; k++){
    float a = .5 + float(k) * 2.1;
    vec2 p = vec2(cos(a) * f.x + sin(a) * f.y, -sin(a) * f.x + cos(a) * f.y);
    float n = vnoise(vec2(p.x * .55 + float(k) * 9., p.y * .018 + float(k) * 4.));
    v = max(v, smoothstep(.62, .78, n));
  }
  return v;
}
void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  vec3 sc = texture2D(tScene, uv).rgb;
  float asp = uRes.x / uRes.y;
  float d = (uv.x * asp * .5 + uv.y * .866) / (asp * .5 + .866);
  if (uDirT < 0.) d = 1. - d;
  vec2 f = gl_FragCoord.xy / uDpr;
  float fib = fibers(f);
  float rag = (vnoise(f * .045) - .5) * .16 + (vnoise(f * .21) - .5) * .05 + (fib - .5) * .03;
  float a = clamp(uTJ, 0., 1.);
  float b = clamp(uTJ - 1., 0., 1.);
  float front = a * 1.5 - d + rag;
  float back = b * 1.5 - d + rag;
  float cover = smoothstep(0., .05, front) * (1. - smoothstep(0., .05, back));
  float afterB = step(0., back);
  float mono = smoothstep(-.32, 0., front) * (1. - afterB) + afterB * (1. - smoothstep(0., .32, back));
  mono *= 1. - cover;
  float g = dot(sc, vec3(.299, .587, .114));
  vec3 sepia = mix(vec3(g), uPaperC * (.35 + g * .85), .45);
  vec3 col = mix(sc, sepia, clamp(mono, 0., 1.));
  // 舊紙：底色＋細纖維＋斑駁；前緣有一道深色的燒邊
  float stain = vnoise(f * .012) * .08 + vnoise(f * .09) * .04;
  vec3 paper = uPaperC * (.97 - stain) - uInkC * fib * .1;
  float edge = (1. - smoothstep(.0, .035, abs(front))) + (1. - smoothstep(.0, .035, abs(back))) * afterB;
  paper = mix(paper, uInkC * .8 + uPaperC * .2, edge * .5 * step(.001, uTJ) * step(uTJ, 1.999));
  col = mix(col, paper, cover);
  gl_FragColor = vec4(col, 1.);
}
`;
