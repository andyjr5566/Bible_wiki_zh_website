import type { ExperienceMode, UIState } from '../types/ui';
import { EventChannel, type Unsubscribe } from '../utils/EventChannel';

const initialState: UIState = {
  mode: 'overview', previousMode: null, selectedEntityId: null, activePanel: 'none', transitionReason: 'application-start', selectedRitualId: null, selectedBranchId: null, selectedStepId: null, overlay: 'none', playbackOwner: 'none',
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

  selectRitual(selectedRitualId: string | null, selectedBranchId: string | null = null, selectedStepId: string | null = null): void {
    this.#state = { ...this.#state, selectedRitualId, selectedBranchId, selectedStepId, activePanel: selectedRitualId ? 'ritual' : this.#state.activePanel };
    this.#changes.emit(this.snapshot);
  }

  setPlaybackOwner(playbackOwner: UIState['playbackOwner']): void { this.#state = { ...this.#state, playbackOwner }; this.#changes.emit(this.snapshot); }
  setOverlay(overlay: UIState['overlay']): void { this.#state = { ...this.#state, overlay }; this.#changes.emit(this.snapshot); }
}
