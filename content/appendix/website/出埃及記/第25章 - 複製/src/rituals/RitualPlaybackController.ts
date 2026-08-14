import type { RitualPlaybackHooks, RitualPlaybackState } from '../types/rituals';
import { RitualRegistry } from './RitualRegistry';

export class RitualPlaybackController {
  #state: RitualPlaybackState = { ritualId: null, stepIndex: 0, status: 'idle' };
  constructor(readonly registry: RitualRegistry, readonly hooks: RitualPlaybackHooks = {}) {}
  get state(): Readonly<RitualPlaybackState> { return { ...this.#state }; }
  start(ritualId: string): void { this.#state = { ritualId, stepIndex: 0, status: 'playing' }; this.emitEnter(); this.emitState(); }
  pause(): void { if (this.#state.status === 'playing') { this.#state.status = 'paused'; this.emitState(); } }
  resume(): void { if (this.#state.status === 'paused') { this.#state.status = 'playing'; this.emitState(); } }
  next(): void {
    if (!this.#state.ritualId) return;
    const ritual = this.registry.require(this.#state.ritualId); const current = ritual.steps[this.#state.stepIndex];
    if (current) this.hooks.onStepExit?.(ritual, current);
    if (this.#state.stepIndex + 1 >= ritual.steps.length) this.#state.status = 'complete';
    else { this.#state.stepIndex += 1; this.emitEnter(); }
    this.emitState();
  }
  reset(): void { this.#state = { ritualId: null, stepIndex: 0, status: 'idle' }; this.emitState(); }
  private emitEnter(): void { if (!this.#state.ritualId) return; const ritual = this.registry.require(this.#state.ritualId); const step = ritual.steps[this.#state.stepIndex]; if (step) this.hooks.onStepEnter?.(ritual, step); }
  private emitState(): void { this.hooks.onStateChange?.(this.state); }
}
