import type { ExperienceMode, UIState } from '../types/ui';
import { EventChannel, type Unsubscribe } from '../utils/EventChannel';

const initialState: UIState = {
  mode: 'overview', previousMode: null, selectedEntityId: null, activePanel: 'none', transitionReason: 'application-start',
};

export class UIStateManager {
  #state: UIState = { ...initialState };
  readonly #changes = new EventChannel<Readonly<UIState>>();

  get snapshot(): Readonly<UIState> { return { ...this.#state }; }
  subscribe(listener: (state: Readonly<UIState>) => void): Unsubscribe { listener(this.snapshot); return this.#changes.subscribe(listener); }

  transitionTo(mode: ExperienceMode, reason: string): void {
    if (mode === this.#state.mode) return;
    this.#state = { ...this.#state, previousMode: this.#state.mode, mode, transitionReason: reason };
    this.#changes.emit(this.snapshot);
  }

  returnToPrevious(reason = 'return-to-previous'): void {
    const target = this.#state.previousMode ?? 'overview';
    this.transitionTo(target, reason);
  }

  selectEntity(selectedEntityId: string | null, activePanel: UIState['activePanel'] = 'object'): void {
    this.#state = { ...this.#state, selectedEntityId, activePanel: selectedEntityId ? activePanel : 'none' };
    this.#changes.emit(this.snapshot);
  }
}
