import { describe, expect, it } from 'vitest';
import rawSiteData from './site.json';
import type { SiteData } from './types';
import { setSiteData } from './site';
const siteData = setSiteData(rawSiteData as unknown as SiteData);
import { beatReadPx, ENTER_PX, FLIGHT_PX, splitSentences, stationLayouts, stationReadPx, verseLayouts, voiceWeights } from './storytelling';
import { stations } from '../scene/stations';
import { readingSeconds } from '../story/autoplay';
import { beatRhythm, primaryRefOf, stationRhythm, storyLines, validateStoryContent } from './story-content.mjs';

describe('說書式經文與節奏閘門', () => {
  it('36 拍與十一站都有可用的經文擺放設定', () => {
    for (const beat of siteData.segments.flatMap(s => s.beats)) {
      expect(verseLayouts[beat.cue], beat.id).toBeDefined();
      expect(verseLayouts[beat.cue].mobileWidth).toBeGreaterThan(0);
      expect(beatReadPx(beat, siteData), beat.id).toBeGreaterThanOrEqual(600);
    }
    for (const station of stations) expect(stationLayouts[station.id], station.id).toBeDefined();
  });
  it('每格採樣都保持短註與經文互斥，空拍後才有短註', () => {
    for (let index = 0; index <= 10000; index++) {
      const weights = voiceWeights(index / 10000, true);
      expect(weights.verse * weights.note).toBe(0);
    }
    expect(voiceWeights(.78, true)).toEqual({ verse: 0, note: 0 });
  });
  it('切句保留原文、標點及次序', () => {
    for (const seg of siteData.segments) for (const beat of seg.beats) {
      if (!beat.verse) continue;
      for (const line of siteData.verseBlocks[beat.verse].lines)
        expect(splitSentences(line.text).join('')).toBe(line.text);
    }
  });
  it('經文字碼保留 U+70BA，不因字體外觀改成 U+7232', () => {
    expect(siteData.verses['書24:15']).toContain('\u70BA不好');
    for (const block of Object.values(siteData.verseBlocks)) for (const line of block.lines)
      expect(line.text).not.toContain('\u7232');
  });
  it('地圖每次飛行至少八格、紅海最長、進場至少一格半', () => {
    expect(FLIGHT_PX).toBeGreaterThanOrEqual(800);
    expect(ENTER_PX).toBeGreaterThanOrEqual(150);
    const sea = stations.find(s => s.id === 'redsea')!;
    expect(stations.filter(s => s !== sea).every(s => stationReadPx(s) < stationReadPx(sea))).toBe(true);
    for (const station of stations) expect(stationReadPx(station)).toBeGreaterThanOrEqual(600);
  });
  it('故事每節每句只打出一次，而且全部句段依原次序完整保留', () => {
    expect(validateStoryContent(siteData, stations)).toMatchObject({ verses: 35, duplicates: 0 });
    const invalid = structuredClone(siteData);
    invalid.segments[0].beats.push({ ...invalid.segments[1].beats[0], id: 'duplicate-gather' });
    expect(() => validateStoryContent(invalid, stations)).toThrow(/重複打出/);
    const incomplete = structuredClone(siteData);
    incomplete.segments[1].beats = incomplete.segments[1].beats.filter(b => b.cue !== 'gather');
    expect(() => validateStoryContent(incomplete, stations)).toThrow(/句段缺漏或次序改變/);
    const reordered = structuredClone(siteData);
    [reordered.segments[1].beats[0], reordered.segments[1].beats[1]] =
      [reordered.segments[1].beats[1], reordered.segments[1].beats[0]];
    expect(() => validateStoryContent(reordered, stations)).toThrow(/句段缺漏或次序改變/);
  });
  it('24:1 三拍接續，分站也不重打3、7節，終幕只留短註', () => {
    const beats = siteData.segments.flatMap(s => s.beats);
    const text = (cue: string) => storyLines(beats.find(b => b.cue === cue)!, siteData).map(l => l.text).join('');
    expect(text('gather')).toBe('約書亞將以色列的眾支派聚集在示劍，');
    expect(text('leaders')).toBe('召了以色列的長老、族長、審判官，並官長來，');
    expect(text('before-god')).toBe('他們就站在神面前。');
    expect(primaryRefOf(beats.at(-1)!)).toBeUndefined();
    for (const [ref, ids] of [['書24:3', ['ford', 'isaac']], ['書24:7', ['redsea', 'wilderness']]] as const) {
      const joined = ids.map(id => {
        const station = stations.find(s => s.id === id)!;
        return storyLines(beats.find(b => b.id === station.beat)!, siteData, station)
          .filter(l => l.v === Number(ref.split(':')[1])).map(l => l.text).join('');
      }).join('');
      expect(joined).toBe(siteData.verses[ref]);
    }
  });
  it('短句縮到約600px（另加組尾停留）；字數、停留、動作與進出場同時驅動捲動和播放', () => {
    const beats = siteData.segments.flatMap(s => s.beats);
    const short = beatRhythm(beats.find(b => b.cue === 'before-god')!, siteData);
    expect(short.px).toBeLessThanOrEqual(720); // 600 起跳，另加一組的停留
    expect(short.seconds).toBeLessThan(8);
    for (const rhythm of [...beats.map(b => beatRhythm(b, siteData)), ...stations.map(s => stationRhythm(s, siteData))]) {
      expect(rhythm.readingPx).toBeCloseTo((rhythm.characters + rhythm.noteCharacters + rhythm.holdCharacters) / 7 * 100);
      expect(rhythm.px).toBeGreaterThanOrEqual(rhythm.readingPx + rhythm.actionPx + rhythm.transitionPx);
    }
  });
  it('自動播放隨字數延長，採每秒六字並預留動作時間', () => {
    expect(readingSeconds('人'.repeat(60), 6)).toBe(16);
    expect(readingSeconds('人'.repeat(120), 6)).toBe(26);
  });
  it('女兒的更多小卡含新增兩段經文與全文', () => {
    const beat = siteData.segments.flatMap(s => s.beats).find(b => b.cue === 'family-2')!;
    for (const ref of ['民14:29-31', '申11:7']) {
      expect(beat.daughterQA?.verses).toContain(ref);
      expect(siteData.verseBlocks[ref].lines.length).toBeGreaterThan(0);
    }
  });
});
