import type { InputState } from '../types/input';

export const createInputState = (): InputState => ({
  moveX: 0, moveY: 0, lookX: 0, lookY: 0,
  interact: false, jump: false, sprint: false, toggleMap: false, toggleTour: false,
});

export const clampAxis = (value: number): number => Math.max(-1, Math.min(1, value));
