import type { SiteData } from '../data/types';
import { h } from './dom';
import type { PeekController } from './peek';
import { reviewTerrain } from './review-terrain';

const NS = 'http://www.w3.org/2000/svg';
let mapSequence = 0;
function svg(tag: string, attrs: Record<string, string>): SVGElement {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  return node;
}

export interface ReviewMapPoint { id: string; label?: string; }

/** A static Mercator relief with DOM controls: no wheel, touch or drag interception. */
export function createReviewMap(data: SiteData, peek: PeekController, kind: 'shechem' | 'stones' | 'burials', points: ReviewMapPoint[]): HTMLElement {
  const terrain = reviewTerrain[kind === 'shechem' ? 'shechem' : 'canaan'];
  const worldSize = 256 * 2 ** terrain.zoom;
  const project = (lon: number, lat: number): [number, number] => {
    const sin = Math.sin(lat * Math.PI / 180);
    return [((lon + 180) / 360 * worldSize - terrain.origin.origin_x) * terrain.width / terrain.sourceWidth,
      ((.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * worldSize - terrain.origin.origin_y) * terrain.height / terrain.sourceHeight];
  };
  let x0 = 0, y0 = 0, width = terrain.width, height = terrain.height;
  if (kind !== 'shechem') {
    const northwest = project(kind === 'burials' ? 34.55 : 34.3, kind === 'burials' ? 32.43 : 32.55);
    const southeast = project(kind === 'burials' ? 35.8 : 36.2, kind === 'burials' ? 31.7 : 31.45);
    x0 = northwest[0]; y0 = northwest[1]; width = southeast[0] - x0; height = southeast[1] - y0;
  }
  const stage = h('div', { className: `jos-relief-stage jos-relief-${kind}`, style: `aspect-ratio:${width}/${height}` });
  const artwork = svg('svg', { viewBox: `${x0} ${y0} ${width} ${height}`, 'aria-hidden': 'true', focusable: 'false' });
  const image = svg('image', { width: String(terrain.width), height: String(terrain.height), opacity: '0' });
  image.style.transition = 'opacity 450ms ease-out';
  const observer = new IntersectionObserver(entries => {
    if (!entries.some(entry => entry.isIntersecting)) return;
    observer.disconnect();
    const pending = new Image();
    pending.src = terrain.image;
    void pending.decode().then(() => {
      image.setAttribute('href', terrain.image);
      image.setAttribute('opacity', '1');
    }).catch(error => console.error('Relief image could not be loaded', error));
  }, { rootMargin: '900px' });
  observer.observe(stage);
  const path = (rings: [number, number][][]) => rings.map(ring => ring.map(([lon, lat], i) => `${i ? 'L' : 'M'}${project(lon, lat).map(v => v.toFixed(2)).join(',')}`).join(' ') + ' Z').join(' ');
  if (kind !== 'shechem') {
    const clipId = `jos-relief-land-${++mapSequence}`;
    const defs = svg('defs', {});
    const clip = svg('clipPath', { id: clipId });
    for (const polygon of data.geo.canaan.land) clip.append(svg('path', { d: path(polygon), 'clip-rule': 'evenodd' }));
    defs.append(clip); artwork.append(defs);
    artwork.append(svg('rect', { x: String(x0), y: String(y0), width: String(width), height: String(height), class: 'jos-map-water' }));
    image.setAttribute('clip-path', `url(#${clipId})`);
    artwork.append(image);
    for (const lake of data.geo.canaan.lakes) artwork.append(svg('path', { d: path(lake.rings), class: 'jos-map-water' }));
    for (const river of data.geo.canaan.rivers) artwork.append(svg('polyline', {
      points: river.pts.map(([lon, lat]) => project(lon, lat).join(',')).join(' '), class: 'jos-map-river',
    }));
    for (const [label, lon, lat] of [['地中海', 34.65, 32.35], ['約但河', 35.57, 32.1], ['死海', 35.48, 31.55]] as const) {
      const [x, y] = project(lon, lat);
      if (x >= x0 && x < x0 + width && y >= y0 && y < y0 + height) {
        const text = svg('text', { x: String(x), y: String(y), class: 'jos-map-water-label' });
        text.textContent = label; artwork.append(text);
      }
    }
  } else artwork.append(image);
  stage.append(artwork);

  const legend = h('div', { className: 'jos-map-legend' });
  points.forEach((point, i) => {
    const place = data.places[point.id];
    if (!place) return;
    const [px, py] = project(place.lon, place.lat);
    const x = (px - x0) / width * 100, y = (py - y0) / height * 100;
    const name = point.label ?? place.nameZh;
    const uncertain = place.uncertain || place.unlocated;
    // Screen-space label displacement keeps close sites distinct; geographic coordinates stay fixed.
    const offset = kind === 'stones' && place.id === 'ebal' ? [0, -27]
      : kind === 'stones' && place.id === 'shechem' ? [0, 25]
      : kind === 'stones' && place.id === 'gilgal' ? [0, -12]
      : kind === 'stones' && place.id === 'jordan-witness' ? [12, 14]
      : kind === 'burials' && place.id === 'timnath-serah' ? [-18, -22]
      : kind === 'burials' && place.id === 'gaash' ? [4, 24] : [0, 0];
    if (offset[0] || offset[1]) stage.append(h('span', {
      className: 'jos-map-leader', 'aria-hidden': 'true',
      style: `left:${x}%;top:${y}%;width:${Math.hypot(...offset)}px;transform:rotate(${Math.atan2(offset[1], offset[0])}rad);`,
    }));
    const marker = h('button', {
      type: 'button', className: `jos-map-marker${place.unlocated ? ' jos-map-marker-region' : ''}`,
      style: `left:calc(${x}% + ${offset[0]}px);top:calc(${y}% + ${offset[1]}px);`, title: name,
      'data-review-place': place.id,
      'aria-label': `${name}${uncertain ? '，只是可能在這一帶' : ''}`,
    }, kind === 'shechem' ? name : String(i + 1));
    marker.addEventListener('click', () => peek.openPlace(place.id));
    if (place.unlocated) {
      const radius = place.rKm ?? 12;
      const [rx] = project(place.lon + radius / (111.32 * Math.cos(place.lat * Math.PI / 180)), place.lat);
      const [, ry] = project(place.lon, place.lat + radius / 111.32);
      stage.append(h('span', { className: 'jos-map-region', 'aria-hidden': 'true',
        style: `left:${x}%;top:${y}%;width:${Math.abs(rx - px) * 200 / width}%;height:${Math.abs(ry - py) * 200 / height}%;` }));
    }
    stage.append(marker);
    const button = h('button', { type: 'button', className: 'jos-map-legend-button' },
      h('span', { className: 'jos-map-legend-number' }, String(i + 1)),
      h('span', null, name, uncertain ? h('small', null, '只是可能在這一帶') : null));
    button.addEventListener('click', () => peek.openPlace(place.id));
    legend.append(button);
  });
  stage.append(h('span', { className: 'jos-map-north', 'aria-hidden': 'true' }, '↑ 北'));
  const scaleKm = kind === 'shechem' ? 2 : 20;
  const midLat = (terrain.bbox.north + terrain.bbox.south) / 2;
  const scaleWidth = (scaleKm * 1000 / (40075016.686 * Math.cos(midLat * Math.PI / 180) / worldSize)) * terrain.width / terrain.sourceWidth / width * 100;
  stage.append(h('span', { className: 'jos-map-scale', style: `width:${scaleWidth}%` }, `${scaleKm} 公里`));
  return h('figure', { className: 'jos-review-map', 'aria-label': kind === 'shechem' ? '示劍山谷地圖' : kind === 'stones' ? '七塊石頭地圖' : '三個葬禮地圖' },
    h('div', { className: 'jos-map-layout' }, stage, legend),
    h('figcaption', null, '地形：Mapzen／Tilezen；SRTM、GMTED2010（USGS）、ETOPO1（NOAA）。地點：OpenBible.info（CC BY 4.0）；水系：Natural Earth（公有領域）。'));
}
