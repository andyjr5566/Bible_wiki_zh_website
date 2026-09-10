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

  it('walks the five stations in both directions and keeps holy-place context', () => {
    const stations = [
      ...stops,
      { id: 'three', locationId: 'laver', objectId: 'laver', title: 'Three', scriptureReference: 'Exodus 30:17-21' },
      { id: 'four', locationId: 'holy', objectId: null, title: 'Four', scriptureReference: 'Exodus 26:1-14', hotspots: [
        { id: 'lamp', label: 'Lampstand', objectId: 'menorah', scriptureReference: 'Exodus 25:31-40', excerptIds: ['lamp'], summary: 'Lampstand', cameraStart: { position: { x: 1, y: 2, z: -2 }, target: { x: 0, y: 1, z: -3 }, fov: 40 }, cameraEnd: { position: { x: 1, y: 2, z: -3 }, target: { x: 0, y: 1, z: -3 }, fov: 38 } },
      ] },
      { id: 'five', locationId: 'most-holy', objectId: 'ark', title: 'Five', scriptureReference: 'Exodus 25:10-22' },
    ] as const;
    const tour = new TourManager(stations);
    tour.goTo(3);
    expect(tour.current?.id).toBe('four');
    expect(tour.selectHotspot('lamp')?.id).toBe('lamp');
    expect(tour.hotspotId).toBe('lamp');
    tour.next();
    expect(tour.current?.id).toBe('five');
    expect(tour.hotspotId).toBeNull();
    tour.previous();
    expect(tour.current?.id).toBe('four');
    tour.reset();
    expect(tour.current?.id).toBe('one');
  });
});
