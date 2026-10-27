import { describe, expect, it } from 'vitest';
import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import site from '../data/site.json';
import { musicCue, REDSEA_WATER_CLOSES } from './audio';

const beats = site.segments.flatMap(segment => segment.beats.map(beat => ({ segment: segment.id, cue: beat.cue, id: beat.id })));
const pick = (id: string, ctx = {}) => { const b = beats.find(x => x.id === id)!; return musicCue(b.cue, b.segment, ctx); };
const at = (id: string, p: number, flight = false) => ({ station: { id, p, flight } });

describe('配樂安排', () => {
  it('第19節整個安靜，其餘拍都有曲子（第二幕依站決定）', () => {
    for (const beat of beats) {
      if (beat.segment === 'act-2') continue;
      expect(pick(beat.id).key === null, beat.id).toBe(beat.cue === 'cannot');
    }
    expect(pick('beat-18-cannot').fade).toBe('cut');
  });
  it('各幕用使用者選定的曲子', () => {
    expect(pick('beat-02-gather').key).toBe('ruins');
    expect(pick('beat-06-beyond-river', at('beyond-river', .5)).key).toBe('plains');
    expect(pick('beat-08-egypt', at('egypt', .5)).key).toBe('epic');
    expect(pick('beat-09-east', at('east', .5)).key).toBe('epic');
    expect(pick('beat-11-gifts', at('canaan', .5)).key).toBe('plains');
    expect(pick('beat-13-now').key).toBe('waiting');
    expect(pick('beat-17-answer-1').key).toBe('waiting');
    expect(pick('beat-25-write').key).toBe('firstlight');
    expect(pick('beat-30-joshua-dies').key).toBe('hope');
    expect(pick('beat-36-epilogue-stone').key).toBe('hope');
  });
  it('紅海：追兵時追擊曲，水牆合上時驟停，黑暗散去後史詩曲輕輕回來', () => {
    const chase = pick('beat-08-egypt', at('redsea', REDSEA_WATER_CLOSES - .05));
    expect(chase).toMatchObject({ key: 'pursuit', fade: 'fast' });
    expect(pick('beat-08-egypt', at('redsea', REDSEA_WATER_CLOSES + .01))).toMatchObject({ key: null, fade: 'cut' });
    const after = pick('beat-08-egypt', at('redsea', .9));
    expect(after.key).toBe('epic');
    expect(after.gain).toBeLessThan(1);
  });
  it('約但河：刀弓垂下時停約一屏，再從頭進場', () => {
    expect(pick('beat-10-jericho', at('jordan', .45)).key).toBe('epic');
    expect(pick('beat-10-jericho', { ...at('jordan', .55), jordanQuiet: .2 }).key).toBe(null);
    expect(pick('beat-10-jericho', { ...at('jordan', .75), jordanQuiet: .2 })).toMatchObject({ key: 'epic', startAt: 0 });
  });
  it('第四幕：第21節起 Unexplored Expansion 慢慢疊上來，第24節最滿', () => {
    const a2 = pick('beat-19-answer-2'), a3 = pick('beat-22-answer-3');
    expect(a2).toMatchObject({ key: 'expansion', fade: 'slow', startAt: 0 });
    expect(a3.key).toBe('expansion');
    expect(a3.gain).toBeGreaterThan(a2.gain);
  });
  it('立石：音樂照常，不靜音（2026-10-27 使用者改定）', () => {
    for (const id of ['beat-26-raise', 'beat-27-the-stone']) expect(pick(id).key).toBe('firstlight');
  });
  it('八首成品都在，每首不超過 1.5 MB', () => {
    for (const name of ['ruins', 'plains', 'epic', 'pursuit', 'waiting', 'expansion', 'firstlight', 'hope']) {
      const file = resolve('src/assets/music', `${name}.mp3`);
      expect(existsSync(file), name).toBe(true);
      expect(statSync(file).size, name).toBeLessThan(1_500_000);
    }
  });
});
