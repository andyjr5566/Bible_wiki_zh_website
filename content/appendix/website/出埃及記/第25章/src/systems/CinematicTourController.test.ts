import { describe, expect, it } from 'vitest';
import { CinematicTourController, CINEMATIC_ACTS } from './CinematicTourController';

describe('CinematicTourController', () => {
  it('initializes with default state and 8 acts', () => {
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
    expect(controller.snapshot.currentAct.id).toBe('act-1-overview');

    controller.pause();
    expect(controller.snapshot.isPaused).toBe(true);

    controller.resume();
    expect(controller.snapshot.isPaused).toBe(false);

    controller.next();
    expect(controller.snapshot.currentActIndex).toBe(1);
    expect(controller.snapshot.currentAct.id).toBe('act-2-burnt-altar');

    controller.previous();
    expect(controller.snapshot.currentActIndex).toBe(0);

    controller.stop();
    expect(controller.snapshot.isPlaying).toBe(false);
  });

  it('toggles dimensions and dimension units', () => {
    const controller = new CinematicTourController();
    expect(controller.snapshot.showDimensions).toBe(true);
    expect(controller.snapshot.dimensionUnit).toBe('cubit');

    controller.toggleDimensions();
    expect(controller.snapshot.showDimensions).toBe(false);

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
});
