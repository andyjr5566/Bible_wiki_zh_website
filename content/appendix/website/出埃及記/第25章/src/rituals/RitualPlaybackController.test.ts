import { describe, expect, it, vi } from 'vitest';
import { loadProjectData } from '../data/loadProjectData';
import { RitualPlaybackController } from './RitualPlaybackController';
import { RitualRegistry } from './RitualRegistry';

describe('ritual playback contract', () => {
  it('invokes playback hooks and completes an ordered ritual', () => {
    const onStepEnter = vi.fn(); const controller = new RitualPlaybackController(new RitualRegistry(loadProjectData().rituals.rituals), { onStepEnter });
    controller.start('priestly-washing'); expect(onStepEnter).toHaveBeenCalledOnce();
    controller.next(); expect(controller.state.stepIndex).toBe(1);
    controller.pause(); controller.previous(); expect(controller.state.stepIndex).toBe(0);
    controller.seek(2); expect(controller.state.stepIndex).toBe(2); expect(controller.state.status).toBe('paused');
    controller.replay(); expect(controller.state.stepIndex).toBe(0); expect(controller.state.status).toBe('playing');
    controller.next(); controller.next(); controller.next(); expect(controller.state.status).toBe('complete');
  });

  it('rejects out-of-range seek and does not silently ignore an idle seek', () => {
    const controller = new RitualPlaybackController(new RitualRegistry(loadProjectData().rituals.rituals));
    expect(() => controller.seek(0)).toThrow('idle');
    controller.start('incense-service');
    expect(() => controller.seek(3)).toThrow('Invalid ritual step index');
  });

  it('plays the three-step lampstand care sequence and reaches the light cue', () => {
    const controller = new RitualPlaybackController(new RitualRegistry(loadProjectData().rituals.rituals));
    controller.start('lampstand-care');
    expect(controller.state.stepIndex).toBe(0);
    controller.next(); expect(controller.state.stepIndex).toBe(1);
    controller.next(); expect(controller.state.stepIndex).toBe(2);
    controller.next(); expect(controller.state.status).toBe('complete');
  });

  it('keeps the four-step shewbread sequence in graph order', () => {
    const controller = new RitualPlaybackController(new RitualRegistry(loadProjectData().rituals.rituals));
    controller.start('shewbread-service');
    expect(controller.registry.get('shewbread-service')?.steps).toHaveLength(4);
    controller.next(); controller.next(); controller.next();
    expect(controller.state.stepIndex).toBe(3);
    expect(controller.state.status).toBe('playing');
    controller.next(); expect(controller.state.status).toBe('complete');
  });

  it('keeps burnt-offering animal branches isolated and reversible', () => {
    const registry = new RitualRegistry(loadProjectData().rituals.rituals);
    const controller = new RitualPlaybackController(registry);
    controller.start('burnt-offering-service');
    controller.next(); expect(controller.state.stepIndex).toBe(1);
    controller.next(); expect(controller.state.stepIndex).toBe(2);
    controller.next(); expect(controller.state.status).toBe('complete');
    controller.previous(); expect(controller.state.stepIndex).toBe(1); expect(controller.state.status).toBe('paused');

    const sheep = registry.require('burnt-offering-sheep-service');
    expect(sheep.steps.map(({ branchId }) => branchId)).toEqual(['burnt-sheep', 'burnt-sheep', 'burnt-sheep']);
    expect(sheep.steps[1]?.instruction).toContain('北邊');
    const bird = registry.require('burnt-offering-bird-service');
    expect(bird.steps[1]?.actorRole).toBe('priest');
    expect(bird.steps[1]?.scriptureReferences).toContain('Leviticus 1:15-17');
  });

  it('walks the complete atonement path and restores a paused prior step', () => {
    const controller = new RitualPlaybackController(new RitualRegistry(loadProjectData().rituals.rituals));
    controller.start('atonement-entry');
    expect(controller.registry.get('atonement-entry')?.steps).toHaveLength(14);
    for (let index = 0; index < 7; index += 1) controller.next();
    expect(controller.state.stepIndex).toBe(7);
    controller.pause();
    controller.previous();
    expect(controller.state.stepIndex).toBe(6);
    expect(controller.state.status).toBe('paused');
    controller.seek(10);
    expect(controller.state.stepIndex).toBe(10);
    controller.next();
    expect(controller.state.status).toBe('paused');
  });
});
