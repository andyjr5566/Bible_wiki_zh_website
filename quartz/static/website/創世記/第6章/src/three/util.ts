/** 小工具：插值、雜訊、隨機。地形、浪、動畫共用，務必和 shader 裡的版本一致。 */
export const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (t: number) => {
  const x = clamp(t);
  return x * x * (3 - 2 * x);
};
export const smoother = (t: number) => {
  const x = clamp(t);
  return x * x * x * (x * (x * 6 - 15) + 10);
};
export const step = (e0: number, e1: number, x: number) => smooth((x - e0) / (e1 - e0));
/** 區間 [a,b] 內 0→1，之外夾住 */
export const span = (x: number, a: number, b: number) => clamp((x - a) / (b - a));

const fract = (v: number) => v - Math.floor(v);
export function hash2(x: number, y: number) {
  return fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453);
}
export function vnoise(x: number, y: number) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x: number, y: number, oct = 4) {
  let s = 0, amp = 0.5, f = 1;
  for (let i = 0; i < oct; i++) {
    s += vnoise(x * f, y * f) * amp;
    f *= 2.03;
    amp *= 0.5;
  }
  return s;
}
/** 山脊雜訊：1-|n| 的疊加，做出稜線 */
export function ridged(x: number, y: number, oct = 5) {
  let s = 0, amp = 0.5, f = 1, w = 1;
  for (let i = 0; i < oct; i++) {
    let n = 1 - Math.abs(vnoise(x * f, y * f) * 2 - 1);
    n *= n * w;
    w = clamp(n * 1.6);
    s += n * amp;
    f *= 2.1;
    amp *= 0.5;
  }
  return s;
}

export function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** GLSL 版本，給各個 shader 用 */
export const GLSL_NOISE = /* glsl */ `
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.-2.*f);
  return mix(mix(hash12(i), hash12(i+vec2(1,0)), u.x), mix(hash12(i+vec2(0,1)), hash12(i+vec2(1,1)), u.x), u.y); }
float fbm(vec2 p){ float s = 0., a = .5; for (int i = 0; i < 5; i++){ s += vnoise(p) * a; p = p * 2.03 + 17.1; a *= .5; } return s; }
float fbm3(vec2 p){ float s = 0., a = .5; for (int i = 0; i < 3; i++){ s += vnoise(p) * a; p = p * 2.03 + 17.1; a *= .5; } return s; }
`;
