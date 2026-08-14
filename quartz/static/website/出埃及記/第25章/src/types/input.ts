export interface InputState {
  moveX: number;
  moveY: number;
  lookX: number;
  lookY: number;
  interact: boolean;
  jump: boolean;
  sprint: boolean;
  toggleMap: boolean;
  toggleTour: boolean;
}

export type InputAction = keyof InputState;
export type InputContext = 'walking' | 'ui' | 'disabled';

export interface InputAdapter {
  readonly id: string;
  connect(write: (patch: Partial<InputState>) => void): void;
  disconnect(): void;
  setContext?(context: InputContext): void;
  endFrame?(): void;
}
