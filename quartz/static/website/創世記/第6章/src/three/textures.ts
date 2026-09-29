import * as THREE from 'three';
import { mulberry32 } from './util';

/**
 * 用 canvas 畫木板紋理（顏色＋凹凸），不必下載圖檔。
 * 一張貼圖＝一塊 4 公尺見方的面，u 沿船身長度、v 橫過木板。
 */
export function planks(opts: { base: string; dark: string; rows: number; seed: number; size?: number; knots?: number }) {
  const N = opts.size ?? 1024;
  const cv = document.createElement('canvas');
  cv.width = cv.height = N;
  const g = cv.getContext('2d')!;
  const bv = document.createElement('canvas');
  bv.width = bv.height = N;
  const b = bv.getContext('2d')!;
  const r = mulberry32(opts.seed);
  g.fillStyle = opts.base;
  g.fillRect(0, 0, N, N);
  b.fillStyle = '#808080';
  b.fillRect(0, 0, N, N);
  const ph = N / opts.rows;
  for (let i = 0; i < opts.rows; i++) {
    const y = i * ph;
    // 每一排木板切成幾段，接縫錯開
    let x0 = -r() * N * 0.5;
    while (x0 < N) {
      const len = N * (0.35 + r() * 0.4);
      const shade = (r() - 0.5) * 0.1;
      g.fillStyle = shift(opts.base, shade);
      g.fillRect(x0, y, len, ph - 2);
      // 木紋
      for (let k = 0; k < 14; k++) {
        const gy = y + r() * ph;
        g.strokeStyle = `rgba(30,16,6,${0.04 + r() * 0.07})`;
        g.lineWidth = 0.6 + r() * 1.8;
        g.beginPath();
        g.moveTo(x0, gy);
        g.bezierCurveTo(x0 + len * 0.3, gy + (r() - 0.5) * 10, x0 + len * 0.7, gy + (r() - 0.5) * 10, x0 + len, gy);
        g.stroke();
        b.strokeStyle = r() > 0.5 ? 'rgba(255,255,255,.35)' : 'rgba(40,40,40,.35)';
        b.lineWidth = 1;
        b.beginPath();
        b.moveTo(x0, gy);
        b.lineTo(x0 + len, gy + (r() - 0.5) * 4);
        b.stroke();
      }
      for (let k = 0; k < (opts.knots ?? 1); k++) {
        if (r() < 0.5) continue;
        const kx = x0 + r() * len, ky = y + ph * (0.3 + r() * 0.4), kr = 3 + r() * 5;
        const kg = g.createRadialGradient(kx, ky, 0, kx, ky, kr * 2.4);
        kg.addColorStop(0, 'rgba(40,22,10,.85)');
        kg.addColorStop(1, 'rgba(40,22,10,0)');
        g.fillStyle = kg;
        g.beginPath();
        g.arc(kx, ky, kr * 2.4, 0, 6.283);
        g.fill();
      }
      // 端縫與木釘
      g.fillStyle = 'rgba(30,18,8,.55)';
      g.fillRect(x0 + len - 1.5, y, 1.5, ph);
      b.fillStyle = '#202020';
      b.fillRect(x0 + len - 2, y, 3, ph);
      g.fillStyle = 'rgba(25,14,6,.8)';
      for (const px of [x0 + 10, x0 + len - 12]) {
        g.beginPath();
        g.arc(px, y + ph * 0.3, 2.2, 0, 6.283);
        g.arc(px, y + ph * 0.7, 2.2, 0, 6.283);
        g.fill();
      }
      x0 += len;
    }
    g.fillStyle = opts.dark;
    g.fillRect(0, y + ph - 2.5, N, 2.5);
    b.fillStyle = '#101010';
    b.fillRect(0, y + ph - 3, N, 3);
  }
  // 風吹日曬：大片的深淺斑
  for (let k = 0; k < 60; k++) {
    const x = r() * N, y = r() * N, rad = 40 + r() * 160;
    const grd = g.createRadialGradient(x, y, 0, x, y, rad);
    const dark = r() < 0.6;
    grd.addColorStop(0, dark ? `rgba(20,12,4,${0.05 + r() * 0.08})` : `rgba(255,240,210,${0.03 + r() * 0.05})`);
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  const map = new THREE.CanvasTexture(cv);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  const bump = new THREE.CanvasTexture(bv);
  bump.wrapS = bump.wrapT = THREE.RepeatWrapping;
  return { map, bump };
}

function shift(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, v + Math.round(amt * 255)));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

/** 柔和的圓形貼圖（煙、光暈、雨滴濺起） */
export function softDot(inner = 'rgba(255,255,255,0.9)', size = 64) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(size / 2, size / 2, 1, size / 2, size / 2, size / 2);
  grd.addColorStop(0, inner);
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** 煙：幾團雜訊疊成的不規則雲朵 */
export function smokePuff(seed = 3) {
  const S = 128;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  const r = mulberry32(seed);
  for (let i = 0; i < 18; i++) {
    const x = S / 2 + (r() - 0.5) * S * 0.45, y = S / 2 + (r() - 0.5) * S * 0.45, rad = S * (0.12 + r() * 0.2);
    const grd = g.createRadialGradient(x, y, 0, x, y, rad);
    grd.addColorStop(0, `rgba(255,255,255,${0.18 + r() * 0.2})`);
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.beginPath();
    g.arc(x, y, rad, 0, 6.283);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
