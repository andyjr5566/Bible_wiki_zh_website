import { describe, expect, it } from 'vitest';
import { InputManager } from './InputManager';

describe('InputManager', () => {
  it('normalizes the shared input contract and resets edge actions', () => {
    const manager = new InputManager(); manager.setContext('walking');
    manager.write({ moveX: 9, moveY: -9, lookX: 2, interact: true, toggleMap: true });
    expect(manager.snapshot()).toMatchObject({ moveX: 1, moveY: -1, lookX: 2, interact: true, toggleMap: true });
    manager.endFrame();
    expect(manager.snapshot()).toMatchObject({ moveX: 1, moveY: -1, lookX: 0, interact: false, toggleMap: false });
  });
  it('clears movement whenever walking context is left', () => {
    const manager = new InputManager(); manager.setContext('walking'); manager.write({ moveY: 1, sprint: true }); manager.setContext('ui');
    expect(manager.snapshot()).toMatchObject({ moveX: 0, moveY: 0, sprint: false });
  });
});
