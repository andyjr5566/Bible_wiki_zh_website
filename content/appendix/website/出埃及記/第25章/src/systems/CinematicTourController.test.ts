import { describe, expect, it } from 'vitest';
import { CinematicTourController, CINEMATIC_ACTS } from './CinematicTourController';

describe('CinematicTourController', () => {
  it('visits all six objects automatically with distinct moving camera endpoints', () => {
    expect(CINEMATIC_ACTS.map(({ id }) => id)).toEqual([
      'east-gate', 'burnt-altar', 'laver', 'holy-place',
      'holy-place-menorah', 'holy-place-shewbread', 'holy-place-incense', 'most-holy-place',
    ]);
    for (const act of CINEMATIC_ACTS) {
      expect(act.cameraStart.position).not.toEqual(act.cameraEnd.position);
      expect(act.scriptureText.length).toBeGreaterThan(0);
    }
  });
  it('initializes with the restored eight camera shots', () => {
    const controller = new CinematicTourController();
    expect(controller.snapshot.isPlaying).toBe(false);
    expect(controller.snapshot.isPaused).toBe(false);
    expect(controller.snapshot.currentActIndex).toBe(0);
    expect(controller.snapshot.currentAct.totalActs).toBe(8);
  });

  it('starts, pauses, resumes, and navigates acts', () => {
    const controller = new CinematicTourController();
    controller.start(0);
    expect(controller.snapshot.isPlaying).toBe(true);
    expect(controller.snapshot.isPaused).toBe(false);
    expect(controller.snapshot.currentAct.id).toBe('east-gate');

    controller.pause();
    expect(controller.snapshot.isPaused).toBe(true);

    controller.resume();
    expect(controller.snapshot.isPaused).toBe(false);

    controller.next();
    expect(controller.snapshot.currentActIndex).toBe(1);
    expect(controller.snapshot.currentAct.id).toBe('burnt-altar');

    controller.previous();
    expect(controller.snapshot.currentActIndex).toBe(0);

    controller.stop();
    expect(controller.snapshot.isPlaying).toBe(false);
  });

  it('toggles dimensions and dimension units', () => {
    const controller = new CinematicTourController();
    expect(controller.snapshot.showDimensions).toBe(false);
    expect(controller.snapshot.dimensionUnit).toBe('cubit');

    controller.toggleDimensions();
    expect(controller.snapshot.showDimensions).toBe(true);

    controller.setDimensionUnit('cm');
    expect(controller.snapshot.dimensionUnit).toBe('cm');
  });

  it('advances timeline on update and transitions to next act when duration completes', () => {
    const controller = new CinematicTourController();
    controller.start(0);
    const act1Duration = CINEMATIC_ACTS[0]!.durationSeconds;

    // Advance halfway
    controller.update(act1Duration * 0.5);
    expect(controller.snapshot.currentActIndex).toBe(0);
    expect(controller.snapshot.progressRatio).toBeCloseTo(0.5, 1);

    // Advance beyond duration
    controller.update(act1Duration * 0.6);
    expect(controller.snapshot.currentActIndex).toBe(1);
  });

  it('keeps the holy-place hotspot and its scripture source in sync', () => {
    const controller = new CinematicTourController();
    controller.start(3);
    expect(controller.snapshot.currentAct.id).toBe('holy-place');
    expect(controller.snapshot.currentAct.hotspots.map(({ id }) => id)).toEqual([
      'holy-place-menorah', 'holy-place-shewbread', 'holy-place-incense'
    ]);
    controller.selectHotspot('holy-place-incense');
    expect(controller.snapshot.currentAct.hotspotId).toBe('holy-place-incense');
    expect(controller.snapshot.currentAct.sourceReference).toBe(controller.snapshot.currentAct.scriptureReference);
    expect(controller.snapshot.currentAct.scriptureText).toContain('香');
  });

  it('replays, clamps speed, and exits without leaving playback active', () => {
    const controller = new CinematicTourController();
    controller.start(2);
    controller.update(3);
    controller.pause();
    controller.setSpeed(3);
    expect(controller.snapshot.playbackSpeed).toBe(2);
    controller.replay();
    expect(controller.snapshot.isPlaying).toBe(true);
    expect(controller.snapshot.isPaused).toBe(false);
    controller.stop();
    expect(controller.snapshot.isPlaying).toBe(false);
    expect(controller.snapshot.isPaused).toBe(false);
  });
});
