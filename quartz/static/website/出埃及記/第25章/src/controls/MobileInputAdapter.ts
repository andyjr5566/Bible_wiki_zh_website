import type { InputAdapter, InputState } from '../types/input';

export class MobileInputAdapter implements InputAdapter {
  readonly id = 'mobile-controls';
  #write: ((patch: Partial<InputState>) => void) | null = null;
  connect(write: (patch: Partial<InputState>) => void): void { this.#write = write; }
  disconnect(): void { this.#write = null; }
  setMove(moveX: number, moveY: number): void { this.#write?.({ moveX, moveY }); }
  setLook(lookX: number, lookY: number): void { this.#write?.({ lookX, lookY }); }
  trigger(action: 'interact' | 'jump' | 'toggleMap' | 'toggleTour'): void { this.#write?.({ [action]: true }); }
}
