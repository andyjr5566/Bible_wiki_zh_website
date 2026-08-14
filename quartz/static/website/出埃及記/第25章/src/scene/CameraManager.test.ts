import { describe, expect, it } from 'vitest';
import { CameraManager } from './CameraManager';

describe('CameraManager', () => {
  it('uses distinct overview, tour, and learning rigs', () => {
    const camera = new CameraManager(16 / 9);
    const poses = ['overview', 'tour', 'learning'].map((mode) => {
      camera.applyMode(mode as 'overview' | 'tour' | 'learning');
      return camera.pose.position;
    });
    expect(new Set(poses.map((pose) => JSON.stringify(pose))).size).toBe(3);
  });

  it('focuses from a tour-specific angle without changing its mode', () => {
    const camera = new CameraManager(1);
    camera.applyMode('tour');
    camera.focus({ x: 0, y: 0, z: 9 }, 6);
    expect(camera.pose.mode).toBe('tour');
    expect(camera.pose.fov).toBe(46);
  });

  it('uses explicit object rigs for interior furniture', () => {
    const camera = new CameraManager(1);
    camera.applyMode('learning');
    camera.focusObject('menorah', { x: -1.2, y: 0, z: -4.35 });
    expect(camera.pose.position).toEqual({ x: 0.28, y: 1.5, z: -2.45 });
    expect(camera.pose.fov).toBe(40);
  });
});
