import { describe, expect, it } from 'vitest';
import { TourManager } from './TourManager';

const stops = [
  { id: 'one', locationId: 'east', objectId: null, title: 'One', scriptureReference: null },
  { id: 'two', locationId: 'court', objectId: 'altar', title: 'Two', scriptureReference: 'Exodus 27:1-8' },
] as const;

describe('TourManager', () => {
  it('supports deterministic play, pause, next, previous, and reset', () => {
    const tour = new TourManager(stops);
    tour.start(); expect(tour.playing).toBe(true);
    expect(tour.next()?.id).toBe('two');
    expect(tour.previous()?.id).toBe('one');
    tour.pause(); expect(tour.playing).toBe(false);
    tour.resume(); expect(tour.playing).toBe(true);
    tour.reset(); expect(tour.index).toBe(0); expect(tour.playing).toBe(false);
  });
});
