import type { StoryState } from '../story/state';
import stoneLyingUrl from '../assets/shechem-env/stone-lying.webp';
import stoneStandingUrl from '../assets/shechem-env/stone-standing.webp';
import figureAtlasUrl from '../assets/figures/atlas.webp';
import figureAtlas from '../assets/figures/atlas.json';

const SVG_NS = 'http://www.w3.org/2000/svg';
type FigureFrame = { width: number; height: number; uv: number[] };
const figureFrames = figureAtlas.frames as Record<string, FigureFrame>;

function svgEl(tag: string, attrs: Record<string, string | number>): SVGElement {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    el.setAttribute(k, String(v));
  }
  return el;
}

/**
 * 當瀏覽器無 WebGL 時，依當前拍的空間與狀態繪製乾淨的石灰岩／橡樹／羊皮紙靜止插圖
 */
export function createWebglFallback(state: StoryState): {
  element: HTMLElement;
  setActive(active: boolean): void;
  sync(): void;
} {
  const wrap = document.createElement('div');
  wrap.className = 'jos-webgl-fallback';
  wrap.setAttribute('aria-hidden', 'true');

  const svg = svgEl('svg', {
    class: 'jos-fallback-svg',
    viewBox: '0 0 1440 900',
    preserveAspectRatio: 'xMidYMid slice',
  });
  wrap.appendChild(svg);

  let enabled = false;
  const atlasImage = new Image();
  let atlasReady = false;
  const silhouetteCache = new Map<string, string>();
  atlasImage.onload = () => {
    atlasReady = true;
    if (enabled) sync();
  };
  atlasImage.src = figureAtlasUrl;

  function silhouette(role: string, pose: string): string | null {
    const key = `${role}/${pose}`;
    const cached = silhouetteCache.get(key);
    if (cached) return cached;
    if (!atlasReady) return null;
    const frame = figureFrames[key] ?? figureFrames[`${role}/stand`] ?? figureFrames['father/stand'];
    const [u, v, w, h] = frame.uv;
    const canvas = document.createElement('canvas');
    canvas.width = frame.width;
    canvas.height = frame.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(
      atlasImage,
      Math.round(u * figureAtlas.size),
      Math.round((1 - v - h) * figureAtlas.size),
      Math.round(w * figureAtlas.size),
      Math.round(h * figureAtlas.size),
      0,
      0,
      frame.width,
      frame.height,
    );
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < pixels.data.length; i += 4) {
      if (pixels.data[i + 3] < 82) pixels.data[i + 3] = 0;
      else {
        pixels.data[i] = 43;
        pixels.data[i + 1] = 35;
        pixels.data[i + 2] = 28;
      }
    }
    ctx.putImageData(pixels, 0, 0);
    const url = canvas.toDataURL('image/png');
    silhouetteCache.set(key, url);
    return url;
  }

  function addFigure(role: string, pose: string, x: number, baseline: number, height: number, opacity = 1): void {
    const src = silhouette(role, pose);
    if (!src) return;
    const frame = figureFrames[`${role}/${pose}`] ?? figureFrames[`${role}/stand`] ?? figureFrames['father/stand'];
    const width = height * frame.width / frame.height;
    svg.appendChild(svgEl('image', {
      class: 'jos-fallback-figure',
      'data-figure': `${role}/${pose}`,
      href: src,
      x: x - width / 2,
      y: baseline - height,
      width,
      height,
      opacity,
    }));
  }

  function addBeatFigures(): void {
    const cue = state.cue;
    if (cue === 'dismiss') {
      const p = Math.max(0, Math.min(1, state.beatProgress));
      if (p < 0.84) {
        const travel = p / 0.84;
        for (let tribe = 0; tribe < 12; tribe++) {
          const angle = tribe * Math.PI / 6;
          const radius = 180 + travel * 300;
          const cx = 650 + Math.sin(angle) * radius;
          const cy = 692 + Math.cos(angle) * radius * .24;
          for (let member = 0; member < 3; member++) {
            addFigure('crowd-back', `stand-${(tribe + member) % 6 + 1}`, cx + (member - 1) * 20, cy + member * 2, 56 - member * 4, .96);
          }
        }
        addFigure('joshua', 'stand', 595, 708, 108);
      } else {
        const walk = Math.min(1, (p - .84) / .16);
        addFigure('joshua', walk > .08 ? `walk-${Math.floor(walk * 8) % 2 + 1}` : 'stand', 595 - walk * 170, 708 - walk * 105, 108);
      }
      return;
    }

    if (cue.startsWith('family-')) {
      addFigure('father', cue === 'family-5' ? 'walk-1' : 'stand', 575, 716, 142);
      addFigure('mother', 'stand', 650, 718, 134);
      addFigure('daughter', 'stand', 710, 720, 98);
      addFigure('joshua', 'stand', 800, 710, 132, .78);
      return;
    }

    const joshuaPose = cue === 'raise' ? 'push-stone' : cue === 'write' ? 'write' : ['now', 'my-house', 'witness'].includes(cue) ? 'point' : 'speak';
    if (['gather', 'leaders', 'before-god', 'answer-1', 'answer-2', 'answer-3'].includes(cue)) {
      for (let i = 0; i < 18; i++) addFigure('crowd-back', `stand-${i % 6 + 1}`, 250 + i * 48, 718 - (i % 3) * 18, 60 + (i % 3) * 5, .9);
    }
    addFigure('joshua', joshuaPose, 610, 710, 138);
    if (cue === 'epilogue-stone' || cue === 'the-stone') addFigure('elders', 'stand', 760, 712, 124, .9);
  }

  function sync(): void {
    if (!enabled) return;
    svg.replaceChildren();
    svg.setAttribute('data-beat', state.beat);

    const sky = state.dark ? '#17150f' : state.later ? '#d6cbb0' : '#e6dcc8';
    const hillBack = state.dark ? '#252119' : '#c9bca2';
    const hillFront = state.dark ? '#2f2a20' : '#b8a88b';
    const oakLeaf = state.dark ? '#5f734d' : '#3d4a30';

    svg.appendChild(svgEl('rect', { x: 0, y: 0, width: 1440, height: 900, fill: sky }));

    if (state.space === 'map') {
      // 羊皮紙記憶地圖靜態示意
      svg.appendChild(
        svgEl('path', {
          d: 'M 0 180 Q 340 240 420 520 Q 470 720 380 900 L 0 900 Z',
          fill: state.dark ? '#1f2b33' : '#bfcdd2',
          opacity: 0.65,
        }),
      );
      svg.appendChild(
        svgEl('path', {
          d: 'M 1080 260 Q 820 180 620 340 Q 440 560 540 660 Q 640 520 580 430',
          fill: 'none',
          stroke: state.dark ? '#e0aa4c' : '#9a4a2a',
          'stroke-width': 4,
          'stroke-dasharray': '10 6',
        }),
      );
      svg.appendChild(svgEl('circle', { cx: 580, cy: 430, r: 9, fill: oakLeaf }));
      addBeatFigures();
      return;
    }

    // 以巴路山與基利心山谷剪影
    svg.appendChild(
      svgEl('path', {
        d: 'M 0 560 Q 260 280 560 500 Q 860 620 1160 320 L 1440 490 L 1440 900 L 0 900 Z',
        fill: hillBack,
      }),
    );
    svg.appendChild(
      svgEl('path', {
        d: 'M 0 650 Q 460 590 820 640 Q 1160 680 1440 610 L 1440 900 L 0 900 Z',
        fill: hillFront,
      }),
    );

    // 泰博橡樹
    svg.appendChild(svgEl('rect', { x: 470, y: 420, width: 32, height: 210, rx: 8, fill: '#4e3d2c' }));
    svg.appendChild(svgEl('ellipse', { cx: 486, cy: 380, rx: 165, ry: 95, fill: oakLeaf }));
    svg.appendChild(svgEl('ellipse', { cx: 410, cy: 410, rx: 110, ry: 68, fill: oakLeaf, opacity: 0.9 }));
    svg.appendChild(svgEl('ellipse', { cx: 565, cy: 405, rx: 115, ry: 72, fill: oakLeaf, opacity: 0.9 }));

    // 見證的大石頭（躺著 vs 立起）
    const upright = state.raiseStone.done || state.space === 'stone-time';
    svg.appendChild(svgEl('image', {
      href: upright ? stoneStandingUrl : stoneLyingUrl,
      x: upright ? 575 : 535,
      y: upright ? 405 : 535,
      width: upright ? 115 : 210,
      height: upright ? 250 : 130,
      preserveAspectRatio: 'xMidYMax meet',
    }));
    addBeatFigures();
  }

  return {
    element: wrap,
    setActive(active: boolean) {
      enabled = active;
      wrap.classList.toggle('jos-webgl-fallback-on', active);
      sync();
    },
    sync,
  };
}
