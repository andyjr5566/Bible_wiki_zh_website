import { describe, expect, it } from 'vitest';
import { InteractionSystem } from './InteractionSystem';

describe('InteractionSystem', () => {
  it('uses ground-plane distance for an eye-height player near an object anchor', () => {
    const interactions = new InteractionSystem();
    interactions.register({ id: 'altar', position: { x: 0, y: 0, z: 9 }, radius: 2.9, enabled: true });
    expect(interactions.nearest({ x: 0, y: 1.7, z: 11.5 })?.id).toBe('altar');
  });
});
