import type { StoryState } from '../story/state';
import { ease, layerPose, sampleStation, stations, type Station } from './stations';
import { stationReadPx } from '../data/storytelling';

// 建置時只收集雜湊 URL；讀到本站才下載本站與下一站。
const assets = import.meta.glob<string>('../assets/stations/*.webp', { eager: true, query: '?url', import: 'default' });
const source = (asset: string) => assets[`../assets/stations/${asset}`];

export function createStationPlayer(state: StoryState) {
  const element = document.createElement('div');
  element.className = 'jos-station-player';
  element.hidden = true;
  const frame = document.createElement('div');
  frame.className = 'jos-station-frame';
  element.append(frame);
  const resident = new Map<string, { node: HTMLElement; images: HTMLImageElement[]; ready: boolean }>();
  let lastKey = '';
  let prefetched = '';
  let prefetch: HTMLImageElement[] = [];

  function mount(station: Station) {
    let item = resident.get(station.id);
    if (item) return item;
    const node = document.createElement('div');
    node.className = 'jos-station-composition';
    node.dataset.stationId = station.id;
    node.dataset.ready = 'false';
    const artwork = document.createElement('div');
    artwork.className = 'jos-station-artwork';
    node.append(artwork);
    const images = station.layers.map(layer => {
      const img = new Image();
      img.alt = '';
      img.decoding = 'async';
      img.className = `jos-station-layer${layer.role === 'person' ? ' jos-station-person' : ''}`;
      img.dataset.layerId = layer.id;
      img.dataset.role = layer.role;
      if (layer.clip) img.style.clipPath = layer.clip;
      img.src = source(layer.asset);
      if (layer.role === 'coffin') {
        const marker = document.createElement('button');
        marker.type = 'button';
        marker.className = 'jos-station-coffin';
        marker.title = '約瑟的棺材（創50:26；出13:19）';
        marker.setAttribute('aria-label', marker.title);
        // 按鈕只包住小圖的實際輪廓區，避免整張透明畫布攔截捲動。
        marker.append(img);
        artwork.append(marker);
      } else artwork.append(img);
      return img;
    });
    if (station.id === 'wilderness') {
      const orbit = document.createElement('div');
      orbit.className = 'jos-station-orbit';
      orbit.setAttribute('aria-hidden', 'true');
      orbit.innerHTML = '<i class="jos-station-sun"></i><i class="jos-station-moon"></i>';
      artwork.append(orbit);
    }
    if (station.id === 'egypt' || station.id === 'canaan') {
      const marks = document.createElement('div');
      marks.className = `jos-station-marks jos-station-marks-${station.id}`;
      marks.setAttribute('aria-hidden', 'true');
      for (let i = 0; i < (station.id === 'egypt' ? 10 : 9); i++) {
        const mark = document.createElement('i');
        const places = [[16,75], [76,78], [38,83], [58,88], [26,89], [85,90], [45,78], [65,84], [12,87]];
        mark.style.left = `${station.id === 'canaan' ? places[i][0] : 23 + (i % 5) * 13}%`;
        mark.style.top = `${station.id === 'canaan' ? places[i][1] : 49 + Math.floor(i / 5) * 15}%`;
        marks.append(mark);
      }
      artwork.append(marks);
    }
    const memoryLight = document.createElement('div');
    memoryLight.className = 'jos-station-memory-light';
    memoryLight.setAttribute('aria-hidden', 'true');
    artwork.append(memoryLight);
    frame.append(node);
    item = { node, images, ready: false };
    resident.set(station.id, item);
    const current = item;
    const decoded = images.map(img => img.decode());
    void Promise.allSettled(decoded).then(results => {
      results.forEach((result, i) => {
        if (result.status === 'rejected') {
          images[i].style.visibility = 'hidden';
          console.error('Station image could not be decoded', station.id, images[i].src);
        }
      });
      markReady();
    });
    // 天空與遠景兩層好了就先顯示（最多等 1.2 秒），其餘圖層載入後再補上；不再整站空白等全部解碼完
    void Promise.race([
      Promise.allSettled(decoded.slice(0, 2)),
      new Promise(resolve => window.setTimeout(resolve, 1200)),
    ]).then(markReady);
    function markReady() {
      if (current.ready) return;
      current.ready = true;
      current.node.dataset.ready = 'true';
      lastKey = '';
      tick(element.hidden);
    }
    return item;
  }

  function draw(station: Station, progress: number, opacity: number) {
    const item = mount(station);
    item.node.style.opacity = String(opacity);
    item.node.inert = opacity < .95;
    const p = state.motionOff ? station.still : progress;
    station.layers.forEach((layer, i) => {
      const pose = layerPose(layer, p, stationReadPx(station));
      const img = item.images[i];
      img.style.transform = `translate(${pose.x}%,${pose.y}%) scale(${pose.scale})`;
      img.style.opacity = String(pose.opacity);
      img.style.filter = pose.brightness === undefined ? '' : `brightness(${pose.brightness})`;
      if (layer.role === 'coffin') {
        const marker = img.parentElement!;
        marker.style.left = `${50 + pose.x - pose.scale * 50}%`;
        marker.style.top = `${50 + pose.y - pose.scale * 50}%`;
        marker.style.width = `${pose.scale * 100}%`;
        marker.style.height = `${pose.scale * 100}%`;
        img.style.transform = 'none';
      }
    });
    const orbit = item.node.querySelector<HTMLElement>('.jos-station-orbit');
    if (orbit) orbit.style.transform = `rotate(${p * 1440}deg)`;
    item.node.querySelectorAll<HTMLElement>('.jos-station-marks i').forEach((mark, i, all) => {
      mark.style.opacity = String(ease(i / (all.length + 1), (i + 2) / (all.length + 1), p));
    });
  }

  // 進第二幕前，在背景把全部站圖依序下載進瀏覽器快取（只下載不解碼，免得手機記憶體不夠）；
  // 讀者捲得比網路快時，到站才不會一片空白
  let warmed = false;
  function warmCache() {
    if (warmed) return;
    warmed = true;
    const urls = [...new Set(stations.flatMap(st => st.layers.map(layer => source(layer.asset))))];
    let next = 0;
    const worker = async () => {
      while (next < urls.length) {
        const url = urls[next++];
        try { await (await fetch(url, { priority: 'low' } as RequestInit)).arrayBuffer(); } catch { /* 下載失敗就到站時再載 */ }
      }
    };
    void worker();
    void worker();
  }

  function tick(hidden = false) {
    if (!hidden && state.cue === 'family-1') preload(stations[0]);
    if (!hidden && (state.cue === 'family-1' || state.segment === 'act-2')) warmCache();
    const sample = !hidden && sampleStation(state.beat, state.beatProgress);
    const active = Boolean(sample);
    element.hidden = !active;
    document.body.classList.toggle('jos-in-stations', active);
    if (!sample) return;
    const { station, previous, index, p, flight, flightProgress: t } = sample;
    const useFlight = flight && !state.motionOff;
    element.dataset.station = station.id;
    element.dataset.phase = useFlight ? 'flight' : 'scene';
    element.dataset.progress = String(p);
    const key = `${index}:${p.toFixed(5)}:${t.toFixed(5)}:${state.motionOff}:${resident.get(station.id)?.ready}:${resident.get(previous.id)?.ready}`;
    if (key === lastKey) return;
    lastKey = key;
    for (const [id, item] of resident) {
      if (id !== station.id && (!useFlight || id !== previous.id)) {
        item.node.remove();
        resident.delete(id);
      }
    }
    if (useFlight) {
      if (index > 0) draw(previous, 1, 1 - ease(0, .3, t));
      draw(station, 0, ease(.7, 1, t));
      frame.style.background = 'transparent';
      element.style.background = 'transparent';
    } else {
      draw(station, p, 1);
      frame.style.background = '#1a1420';
      element.style.background = '#1a1420';
    }
    const next = stations[index + 1];
    if (next && resident.get(station.id)?.ready) preload(next);
    element.dataset.preloaded = prefetched;
    element.dataset.preloadCount = String(prefetch.length);
  }
  function preload(next: Station) {
    if (next.id === prefetched) return;
    prefetched = next.id;
    prefetch = next.layers.map(layer => {
        const image = new Image();
        image.fetchPriority = 'low';
        image.src = source(layer.asset);
        void image.decode().catch(() => {});
        return image;
      });
  }
  return { element, tick };
}
