import type { InputAdapter, InputContext, InputState } from '../types/input';
import { clampAxis, createInputState } from './InputState';

const edgeActions = ['interact', 'jump', 'toggleMap', 'toggleTour'] as const;

export class InputManager {
  readonly #state = createInputState();
  readonly #adapters: InputAdapter[];
  #context: InputContext = 'disabled';

  constructor(adapters: InputAdapter[] = []) { this.#adapters = adapters; }

  connect(): void { this.#adapters.forEach((adapter) => adapter.connect((patch) => this.write(patch))); }
  disconnect(): void { this.#adapters.forEach((adapter) => adapter.disconnect()); }
  setContext(context: InputContext): void { this.#context = context; this.#adapters.forEach((adapter) => adapter.setContext?.(context)); if (context !== 'walking') this.resetMovement(); }
  get context(): InputContext { return this.#context; }

  write(patch: Partial<InputState>): void {
    if (this.#context === 'disabled') return;
    Object.assign(this.#state, patch);
    this.#state.moveX = clampAxis(this.#state.moveX);
    this.#state.moveY = clampAxis(this.#state.moveY);
  }

  snapshot(): Readonly<InputState> { return { ...this.#state }; }
  endFrame(): void {
    this.#state.lookX = 0; this.#state.lookY = 0;
    edgeActions.forEach((action) => { this.#state[action] = false; });
    this.#adapters.forEach((adapter) => adapter.endFrame?.());
  }
  resetMovement(): void { this.#state.moveX = 0; this.#state.moveY = 0; this.#state.sprint = false; }
}
