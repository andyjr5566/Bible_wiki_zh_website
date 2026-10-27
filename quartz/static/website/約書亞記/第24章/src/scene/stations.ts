import stationData from '../data/stations.json';
import { ENTER_PX, FLIGHT_PX, stationReadPx } from '../data/storytelling';

export interface LayerAction {
  property: string;
  start: number;
  end: number;
  from: number;
  to: number;
  step?: boolean;
}
export interface StationLayer {
  id: string;
  asset: string;
  source: string;
  role: string;
  x: number;
  y: number;
  scale: number;
  parallax: number;
  actions: LayerAction[];
  clip?: string;
}
export interface Station {
  id: string;
  beat: string;
  verses: number[];
  weight: number;
  place: string;
  still: number;
  layers: StationLayer[];
}
export const stations: Station[] = stationData;
const beatStations = new Map<string, Station[]>();
for (const station of stations) {
  const list = beatStations.get(station.beat) ?? [];
  list.push(station);
  beatStations.set(station.beat, list);
}
const emptyStations: Station[] = [];
export const clamp = (n: number) => Math.min(1, Math.max(0, n));
export function ease(a: number, b: number, n: number): number {
  const t = clamp((n - a) / (b - a));
  return t * t * (3 - 2 * t);
}
export function stationsForBeat(beat: string): Station[] {
  return beatStations.get(beat) ?? emptyStations;
}
interface StationSample {
  station: Station;
  previous: Station;
  index: number;
  p: number;
  local: number;
  flight: boolean;
  flightProgress: number;
  verse: number;
}
let lastBeat = '';
let lastProgress = -1;
let lastSample: StationSample | null = null;
/** 純函式：前進、倒捲、直接定位皆由同一進度決定，無時間累積或捲頁副作用。 */
export function sampleStation(beat: string, progress: number) {
  if (beat === lastBeat && progress === lastProgress) return lastSample;
  lastBeat = beat;
  lastProgress = progress;
  const list = stationsForBeat(beat);
  if (!list.length) { lastSample = null; return null; }
  const total = list.reduce((sum, s) => sum + FLIGHT_PX + stationReadPx(s), 0);
  const cursor = clamp(progress) * total;
  let offset = 0;
  let station = list[list.length - 1];
  let local = 1;
  for (const s of list) {
    const length = FLIGHT_PX + stationReadPx(s);
    if (cursor < offset + length) {
      station = s;
      local = (cursor - offset) / length;
      break;
    }
    offset += length;
  }
  const index = stations.indexOf(station);
  const previous = stations[Math.max(0, index - 1)];
  const flightRatio = FLIGHT_PX / (FLIGHT_PX + stationReadPx(station));
  const flight = local < flightRatio;
  const flightProgress = flight ? clamp(local / flightRatio) : 1;
  const p = clamp((local - flightRatio) / (1 - flightRatio));
  const verse = station.verses[Math.min(station.verses.length - 1, Math.floor(p * station.verses.length))];
  lastSample = { station, previous, index, p, local, flight, flightProgress, verse };
  return lastSample;
}
export function layerPose(layer: StationLayer, p: number, scrollSpan = 1400) {
  const pose: Record<string, number> = { x: layer.x, y: layer.y, scale: layer.scale, opacity: 1 };
  for (const a of layer.actions) {
    const t = a.step && a.property === 'opacity'
      ? ease(a.start, a.start + ENTER_PX / scrollSpan, p)
      : a.step ? (p < a.start ? 0 : 1) : ease(a.start, a.end, p);
    pose[a.property] = a.from + (a.to - a.from) * t;
  }
  pose.x -= (p - .5) * layer.parallax;
  return pose;
}
