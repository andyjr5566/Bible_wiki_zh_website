import { describe, expect, it } from 'vitest';
import { UIStateManager } from './UIStateManager';

describe('UIStateManager', () => {
  it('returns from learning to the previous overview mode', () => {
    const state = new UIStateManager(); state.transitionTo('learning', 'test-learning'); state.returnToPrevious('test-return');
    expect(state.snapshot).toMatchObject({ mode: 'overview', previousMode: 'learning', transitionReason: 'test-return' });
  });
  it('does not mutate mode when an entity is selected', () => {
    const state = new UIStateManager(); state.transitionTo('learning', 'test'); state.selectEntity('ark');
    expect(state.snapshot.mode).toBe('learning');
  });
  it('keeps ritual selection and playback owner in one state contract', () => {
    const state = new UIStateManager();
    state.transitionTo('learning', 'test-learning');
    state.transitionTo('ritual', 'test-ritual');
    state.selectRitual('incense-service', 'incense-daily', 'incense-morning');
    state.setPlaybackOwner('ritual');
    expect(state.snapshot).toMatchObject({ mode: 'ritual', selectedRitualId: 'incense-service', selectedBranchId: 'incense-daily', selectedStepId: 'incense-morning', playbackOwner: 'ritual' });
    state.returnToPrevious('test-close');
    expect(state.snapshot.mode).toBe('learning');
  });
});
