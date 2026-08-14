import { describe, expect, it } from 'vitest';
import { BasicPlayerController } from './PlayerController';
import { createInputState } from './InputState';

describe('walking controller canonical heading', () => {
  it('moves forward from the east gate toward -Z at yaw zero', () => {
    const player = new BasicPlayerController(); player.spawn({ position: { x: 0, y: 1.7, z: 28 }, yaw: 0, pitch: 0 }); player.setEnabled(true);
    player.update(1, { ...createInputState(), moveY: 1 });
    expect(player.getPose().position.z).toBeLessThan(28);
  });
  it('rotates walking direction with the player yaw', () => {
    const player = new BasicPlayerController(); player.spawn({ position: { x: 0, y: 1.7, z: 0 }, yaw: Math.PI / 2, pitch: 0 }); player.setEnabled(true);
    player.update(1, { ...createInputState(), moveY: 1 });
    expect(player.getPose().position.x).toBeGreaterThan(0);
  });
});
