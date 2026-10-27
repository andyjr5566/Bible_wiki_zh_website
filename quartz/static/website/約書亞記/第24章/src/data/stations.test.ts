import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
import YAML from 'yaml';
import { layerPose, sampleStation, stations, stationsForBeat } from '../scene/stations';
import { FLIGHT_PX, stationReadPx } from './storytelling';
import rawSiteData from './site.json';
import type { SiteData } from './types';
import { setSiteData } from './site';
const siteData = setSiteData(rawSiteData as unknown as SiteData);

describe('第二幕十一站閘門', () => {
  it('十一站順序固定，紅海篇幅最長', () => {
    expect(stations.map(s => s.id)).toEqual(['beyond-river', 'ford', 'isaac', 'esau-jacob', 'egypt',
      'redsea', 'wilderness', 'east', 'moab', 'jordan', 'canaan']);
    const redsea = stations.find(s => s.id === 'redsea')!;
    expect(stations.filter(s => s.id !== 'redsea').every(s => s.weight < redsea.weight)).toBe(true);
    for (const s of stations) expect(siteData.places[s.place], s.place).toBeDefined();
  });
  it('每層 WebP 皆存在且圖層總量不超過 15 MB', () => {
    const files = new Set(stations.flatMap(s => s.layers.map(l => l.asset)));
    let total = 0;
    for (const file of files) {
      const path = `src/assets/stations/${file}`;
      expect(existsSync(path), path).toBe(true);
      expect(readFileSync(path).subarray(8, 12).toString()).toBe('WEBP');
      total += statSync(path).size;
    }
    expect(total).toBeLessThanOrEqual(15_000_000);
  });
  it('每站至少一層人物，棺材只在出埃及與抵達迦南兩站', () => {
    stations.forEach(s => {
      expect(s.layers.some(l => l.role === 'person' || l.role === 'coffin'), s.id).toBe(true);
      expect(s.layers.some(l => l.role === 'coffin'), s.id).toBe(['egypt', 'canaan'].includes(s.id));
    });
  });
  it('人物圖層依原定進度換姿勢，入場與退場有至少180px緩衝', () => {
    for (const station of stations) {
      for (const layer of station.layers.filter(l => l.role === 'person' || l.role === 'coffin')) {
        const opacityActions = layer.actions.filter(a => a.property === 'opacity');
        expect(opacityActions.every(a => a.step), `${station.id}/${layer.id}`).toBe(true);
      }
    }
    const jordan = stations.find(s => s.id === 'jordan')!;
    const crossing = jordan.layers.find(l => l.id === 'crossing')!;
    const swords = jordan.layers.find(l => l.id === 'swords-down')!;
    expect(layerPose(crossing, .49).opacity).toBe(1);
    expect(layerPose(crossing, .5).opacity).toBe(1);
    expect(layerPose(swords, .49).opacity).toBe(0);
    expect(layerPose(swords, .5).opacity).toBe(0);
    expect(layerPose(swords, .5 + 90 / 1400).opacity).toBeCloseTo(.5);
    expect(layerPose(swords, .5 + 180 / 1400).opacity).toBe(1);
    expect(layerPose(crossing, .5 + 180 / 1400).opacity).toBe(0);
  });
  it('約書亞與立石助手使用不同剪影', () => {
    const actors = JSON.parse(readFileSync('scripts/figure-sources.json', 'utf8')).actors;
    expect(actors.helper_1).not.toBe(actors.helper_2);
    expect(actors.helper_1).not.toBe(actors.joshua);
    expect(actors.helper_2).not.toBe(actors.joshua);
  });
  it('經節完全落在 story.yaml 的拍內，每拍經節聯集一致，文字使用正式經文', () => {
    const story = YAML.parse(readFileSync('data/story.yaml', 'utf8'));
    const beats = story.segments.flatMap((s: { beats: { id: string; verse?: string }[] }) => s.beats);
    for (const beatId of new Set(stations.map(s => s.beat))) {
      const beat = beats.find((b: { id: string }) => b.id === beatId)!;
      const original = siteData.verseBlocks[beat.verse!];
      const verses = [...new Set(stationsForBeat(beatId).flatMap(s => s.verses))].sort((a, b) => a - b);
      expect(verses).toEqual(original.lines.map(line => line.v));
      for (const verse of verses) expect(original.lines.find(l => l.v === verse)?.text.length).toBeGreaterThan(0);
    }
  });
  it('正捲倒捲及直接定位均命中相同站，過場中點完整顯示地圖', () => {
    for (const beat of new Set(stations.map(s => s.beat))) {
      const samples = Array.from({ length: 101 }, (_, i) => sampleStation(beat, i / 100));
      for (let i = 100; i >= 0; i--) expect(sampleStation(beat, i / 100)).toEqual(samples[i]);
      expect(sampleStation(beat, -1)?.station).toEqual(stationsForBeat(beat)[0]);
      expect(sampleStation(beat, 2)?.station).toEqual(stationsForBeat(beat).at(-1));
    }
    const list = stationsForBeat('beat-08-egypt');
    const total = list.reduce((sum, s) => sum + FLIGHT_PX + stationReadPx(s), 0);
    const sample = sampleStation('beat-08-egypt', (FLIGHT_PX + stationReadPx(list[0]) + FLIGHT_PX * .5) / total)!;
    expect(sample.station.id).toBe('redsea');
    expect(sample.flight).toBe(true);
    expect(sample.flightProgress).toBeCloseTo(.5);
  });
  it('紅海水牆合攏、追兵沉下並退場，固定構圖有合法進度', () => {
    const sea = stations.find(s => s.id === 'redsea')!;
    const left = sea.layers.find(l => l.id === 'water-left')!;
    const chariots = sea.layers.find(l => l.id === 'chariots')!;
    expect(layerPose(left, 1).x).toBeGreaterThan(layerPose(left, 0).x);
    expect(layerPose(chariots, 1).y).toBeGreaterThan(layerPose(chariots, 0).y);
    expect(layerPose(chariots, 1).opacity).toBe(0);
    for (const s of stations) expect(s.still >= 0 && s.still <= 1).toBe(true);
  });
});
