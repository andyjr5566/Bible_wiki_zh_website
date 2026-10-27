import { afterEach, describe, expect, it, vi } from 'vitest';
import { PLAYBACK_BASE, PLAYBACK_SPEEDS, paceRate, parsePlaybackRate, readPlaybackRate, savePlaybackRate, sentenceRevealSeconds, stepAutoplayFrame } from './playback-speed';

afterEach(() => vi.unstubAllGlobals());

describe('播放速度', () => {
  it('僅接受四檔，無效設定回到標準', () => {
    for (const { value } of PLAYBACK_SPEEDS) expect(parsePlaybackRate(String(value))).toBe(value);
    for (const value of [null, '', 'NaN', '3', '-1', '0']) expect(parsePlaybackRate(value)).toBe(1);
  });
  it('1× 等於原本的 1.5× 節奏', () => {
    expect(PLAYBACK_BASE).toBe(1.5);
    expect(paceRate(1)).toBe(1.5);
    expect(paceRate(0.5)).toBe(0.75);
  });
  it('記住設定，儲存空間無法讀寫也不影響播放', () => {
    const values = new Map<string, string>();
    vi.stubGlobal('window', { localStorage: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) } });
    expect(readPlaybackRate()).toBe(1);
    savePlaybackRate(1.5);
    expect(readPlaybackRate()).toBe(1.5);
    vi.stubGlobal('window', { get localStorage() { throw new Error('blocked'); } });
    expect(readPlaybackRate()).toBe(1);
    expect(() => savePlaybackRate(2)).not.toThrow();
  });
  it('前20秒距離隨速率成比例，換檔不跳位或倒退', () => {
    const distances = PLAYBACK_SPEEDS.map(({ value }) => {
      let frame = { position: 0, velocity: 0 };
      for (let i = 0; i < 1200; i++) frame = stepAutoplayFrame(frame.position, frame.velocity, 100, 1 / 60, paceRate(value));
      return frame.position;
    });
    const standard = distances[2];
    distances.forEach((distance, i) => expect(distance / standard).toBeCloseTo(PLAYBACK_SPEEDS[i].value, 1));
    let frame = { position: 500, velocity: 100 };
    for (const { value } of PLAYBACK_SPEEDS) {
      const next = stepAutoplayFrame(frame.position, frame.velocity, 100, 1 / 60, paceRate(value));
      expect(next.position).toBeGreaterThan(frame.position);
      expect(next.position - frame.position).toBeLessThan(4);
      frame = next;
    }
  });
  it('逐句浮現隨節奏縮放，至少0.3秒；標準檔即原本 1.5× 的 0.533 秒', () => {
    expect(PLAYBACK_SPEEDS.map(({ value }) => sentenceRevealSeconds(paceRate(value)))).toEqual([0.8 / .75, 0.8 / 1.125, 0.8 / 1.5, 0.8 / 2.25, .3]);
    expect(sentenceRevealSeconds(10)).toBe(.3);
  });
});
