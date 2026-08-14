import type { EntityId } from '../types/core';

export interface LearningContext { objectId: EntityId | null; ritualId: EntityId | null; scriptureReference: string | null; locationId: EntityId | null; characterId: EntityId | null; }
export class LearningModeManager {
  #context: LearningContext = { objectId: null, ritualId: null, scriptureReference: null, locationId: null, characterId: null };
  get context(): Readonly<LearningContext> { return { ...this.#context }; }
  open(context: Partial<LearningContext>): void { this.#context = { ...this.#context, ...context }; }
  clear(): void { this.#context = { objectId: null, ritualId: null, scriptureReference: null, locationId: null, characterId: null }; }
}
