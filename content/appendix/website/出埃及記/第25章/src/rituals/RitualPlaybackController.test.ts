import { describe, expect, it, vi } from 'vitest';
import { loadProjectData } from '../data/loadProjectData';
import { RitualPlaybackController } from './RitualPlaybackController';
import { RitualRegistry } from './RitualRegistry';

describe('ritual playback contract', () => {
  it('invokes playback hooks and completes an ordered ritual', () => {
    const onStepEnter = vi.fn(); const controller = new RitualPlaybackController(new RitualRegistry(loadProjectData().rituals.rituals), { onStepEnter });
    controller.start('priestly-washing'); expect(onStepEnter).toHaveBeenCalledOnce(); controller.next(); expect(controller.state.status).toBe('complete');
  });
});
