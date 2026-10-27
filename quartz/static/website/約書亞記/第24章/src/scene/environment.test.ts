import { describe, expect, it } from 'vitest';
import { readFileSync, statSync } from 'node:fs';
import { createInitialState } from '../story/state';
import {
  ShechemEnvironmentCrossfader,
  environmentNightMix,
  shechemEnvironmentAt,
  panoramaPreloads,
} from './environment';

describe('Shechem environment timing', () => {
  it('keeps later panoramas out of the opening and preloads before the next time of day', () => {
    const state = createInitialState();
    expect(panoramaPreloads(state)).toEqual(['dawn']);
    state.segment = 'act-1';
    expect(panoramaPreloads(state)).toEqual(['dawn']);
    state.segment = 'act-2'; state.cue = 'gifts';
    expect(panoramaPreloads(state)).toContain('morning');
    state.segment = 'act-4'; state.cue = 'family-4';
    expect(panoramaPreloads(state)).toContain('afternoon');
    state.segment = 'act-5'; state.cue = 'raise';
    expect(panoramaPreloads(state)).toContain('dusk');
    state.segment = 'act-6'; state.cue = 'joshua-dies';
    expect(panoramaPreloads(state)).toContain('night');
  });
  it('ships all five 4096 panoramas within the 5 MB environment budget', () => {
    const root='src/assets/shechem-env/';
    const manifest=JSON.parse(readFileSync(root+'manifest.json','utf8'));
    let bytes=statSync(root+'manifest.json').size;
    for(const [name,item] of Object.entries(manifest.assets) as [string,{size:number[];bytes:number}][]){
      const actual=statSync(root+name).size;
      expect(actual).toBe(item.bytes);
      bytes+=actual;
    }
    for(const time of ['dawn','morning','afternoon','dusk','night']){
      expect(manifest.assets[time+'.webp'].size).toEqual([4096,2048]);
      const webp=readFileSync(root+time+'.webp');
      expect(webp.toString('ascii',0,4)).toBe('RIFF');
      expect(webp.toString('ascii',8,12)).toBe('WEBP');
      expect(webp.toString('ascii',12,16)).toBe('VP8 ');
      expect([webp.readUInt16LE(26)&0x3fff,webp.readUInt16LE(28)&0x3fff]).toEqual([4096,2048]);
    }
    expect(bytes).toBeLessThanOrEqual(5_000_000);
  });
  it('uses dawn for the prologue and first act, then morning for acts three and four', () => {
    const state = createInitialState();
    expect(shechemEnvironmentAt(state, 0).from).toBe('dawn');
    state.segment = 'act-3';
    expect(shechemEnvironmentAt(state, 0).from).toBe('morning');
    state.segment = 'act-4';
    expect(shechemEnvironmentAt(state, 0).from).toBe('morning');
  });

  it('moves the fifth act from afternoon to dusk at verse 28', () => {
    const state = createInitialState();
    state.segment = 'act-5';
    state.cue = 'covenant';
    expect(shechemEnvironmentAt(state, 0).from).toBe('afternoon');
    state.cue = 'dismiss';
    expect(shechemEnvironmentAt(state, 0).from).toBe('dusk');
  });

  it('cycles afternoon, dusk, and night with the elders orbit', () => {
    const state = createInitialState();
    state.segment = 'act-6';
    state.cue = 'elders';
    state.motionOff = true;
    state.beatProgress = 0;
    expect(shechemEnvironmentAt(state, 0).from).toBe('afternoon');
    state.beatProgress = 0.12;
    expect(shechemEnvironmentAt(state, 0).from).toBe('dusk');
    state.beatProgress = 0.24;
    const night = shechemEnvironmentAt(state, 0);
    expect(night.from).toBe('night');
    expect(environmentNightMix(night)).toBeGreaterThan(0.5);
  });

  it('fades between fixed times over 900 ms', () => {
    const fade = new ShechemEnvironmentCrossfader();
    fade.update({ from: 'dawn', to: 'dawn', amount: 0 }, 0);
    const start = fade.update({ from: 'morning', to: 'morning', amount: 0 }, 100);
    expect(start.from).toBe('dawn');
    expect(start.to).toBe('morning');
    expect(start.amount).toBe(0);
    expect(fade.update({ from: 'morning', to: 'morning', amount: 0 }, 550).amount).toBeGreaterThan(0);
    expect(fade.update({ from: 'morning', to: 'morning', amount: 0 }, 1000).amount).toBe(1);
  });
});
