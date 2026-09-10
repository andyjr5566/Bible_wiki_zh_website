import type { RitualPlaybackHooks, RitualPlaybackState } from '../types/rituals';
import { RitualRegistry } from './RitualRegistry';

export class RitualPlaybackController {
  #state: RitualPlaybackState = { ritualId: null, stepIndex: 0, status: 'idle' };
  constructor(readonly registry: RitualRegistry, readonly hooks: RitualPlaybackHooks = {}) {}
  get state(): Readonly<RitualPlaybackState> { return { ...this.#state }; }
  start(ritualId: string): void { this.#state = { ritualId, stepIndex: 0, status: 'playing' }; this.emitEnter(); this.emitState(); }
  replay(): void { if (this.#state.ritualId) this.start(this.#state.ritualId); }
  pause(): void { if (this.#state.status === 'playing') { this.#state.status = 'paused'; this.emitState(); } }
  resume(): void { if (this.#state.status === 'paused') { this.#state.status = 'playing'; this.emitState(); } }
  next(): void {
    if (!this.#state.ritualId || this.#state.status === 'idle' || this.#state.status === 'complete') return;
    const ritual = this.registry.require(this.#state.ritualId); const current = ritual.steps[this.#state.stepIndex];
    if (current) this.hooks.onStepExit?.(ritual, current);
    const nextId = current?.nextStepIds[0];
    const nextIndex = nextId ? ritual.steps.findIndex((step) => step.id === nextId) : this.#state.stepIndex + 1;
    if (nextIndex < 0 || nextIndex >= ritual.steps.length) this.#state.status = 'complete';
    else { this.#state.stepIndex = nextIndex; this.emitEnter(); }
    this.emitState();
  }
  previous(): void {
    if (!this.#state.ritualId || this.#state.status === 'idle') return;
    const ritual = this.registry.require(this.#state.ritualId);
    if (this.#state.stepIndex <= 0) return;
    const current = ritual.steps[this.#state.stepIndex];
    if (current) this.hooks.onStepExit?.(ritual, current);
    this.#state.stepIndex -= 1;
    if (this.#state.status === 'complete') this.#state.status = 'paused';
    this.emitEnter();
    this.emitState();
  }
  seek(stepIndex: number): void {
    if (!this.#state.ritualId) throw new Error('Cannot seek an idle ritual.');
    const ritual = this.registry.require(this.#state.ritualId);
    if (!Number.isInteger(stepIndex) || stepIndex < 0 || stepIndex >= ritual.steps.length) throw new Error(`Invalid ritual step index: ${stepIndex}`);
    const current = ritual.steps[this.#state.stepIndex];
    if (current) this.hooks.onStepExit?.(ritual, current);
    this.#state.stepIndex = stepIndex;
    if (this.#state.status === 'complete') this.#state.status = 'paused';
    this.emitEnter();
    this.emitState();
  }
  reset(): void { this.#state = { ritualId: null, stepIndex: 0, status: 'idle' }; this.emitState(); }
  private emitEnter(): void { if (!this.#state.ritualId) return; const ritual = this.registry.require(this.#state.ritualId); const step = ritual.steps[this.#state.stepIndex]; if (step) this.hooks.onStepEnter?.(ritual, step); }
  private emitState(): void { this.hooks.onStateChange?.(this.state); }
}
