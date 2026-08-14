import type { InputAdapter, InputContext, InputState } from '../types/input';

const movementCodes = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight']);

export class DesktopInputAdapter implements InputAdapter {
  readonly id = 'desktop-keyboard-pointer';
  readonly #pressed = new Set<string>();
  #write: ((patch: Partial<InputState>) => void) | null = null;
  #target: Window | null = null;
  #context: InputContext = 'disabled';

  constructor(readonly pointerTarget: HTMLElement) {}

  connect(write: (patch: Partial<InputState>) => void): void {
    this.#write = write; this.#target = window;
    window.addEventListener('keydown', this.#onKeyDown);
    window.addEventListener('keyup', this.#onKeyUp);
    window.addEventListener('blur', this.#onBlur);
    window.addEventListener('mousemove', this.#onMouseMove);
    this.pointerTarget.addEventListener('pointerdown', this.#onPointerDown);
  }
  disconnect(): void {
    this.#target?.removeEventListener('keydown', this.#onKeyDown);
    this.#target?.removeEventListener('keyup', this.#onKeyUp);
    this.#target?.removeEventListener('blur', this.#onBlur);
    this.#target?.removeEventListener('mousemove', this.#onMouseMove);
    this.pointerTarget.removeEventListener('pointerdown', this.#onPointerDown);
    this.#pressed.clear(); this.#target = null; this.#write = null;
  }
  setContext(context: InputContext): void { this.#context = context; if (context !== 'walking' && document.pointerLockElement === this.pointerTarget) void document.exitPointerLock(); }
  readonly #emitMovement = (): void => this.#write?.({
    moveX: Number(this.#pressed.has('KeyD') || this.#pressed.has('ArrowRight')) - Number(this.#pressed.has('KeyA') || this.#pressed.has('ArrowLeft')),
    moveY: Number(this.#pressed.has('KeyW') || this.#pressed.has('ArrowUp')) - Number(this.#pressed.has('KeyS') || this.#pressed.has('ArrowDown')),
    sprint: this.#pressed.has('ShiftLeft') || this.#pressed.has('ShiftRight'),
  });
  readonly #onKeyDown = (event: KeyboardEvent): void => {
    this.#pressed.add(event.code); if (movementCodes.has(event.code)) event.preventDefault();
    this.#emitMovement();
    if (!event.repeat) this.#write?.({ interact: event.code === 'KeyE', jump: event.code === 'Space', toggleMap: event.code === 'KeyM', toggleTour: event.code === 'KeyT' });
  };
  readonly #onKeyUp = (event: KeyboardEvent): void => {
    const code = event.code;
    requestAnimationFrame(() => { this.#pressed.delete(code); this.#emitMovement(); });
  };
  readonly #onBlur = (): void => { this.#pressed.clear(); this.#emitMovement(); };
  readonly #onPointerDown = (event: PointerEvent): void => { if (this.#context === 'walking' && event.button === 0) void this.pointerTarget.requestPointerLock(); };
  readonly #onMouseMove = (event: MouseEvent): void => {
    if (this.#context !== 'walking' || document.pointerLockElement !== this.pointerTarget) return;
    this.#write?.({ lookX: event.movementX * 0.0022, lookY: event.movementY * 0.0022 });
  };
}
