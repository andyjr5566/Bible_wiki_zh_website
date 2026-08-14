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
});
