import type { CharacterRuntimeHooks } from '../types/characters';
import type { EntityId } from '../types/core';
import { CharacterRegistry } from './CharacterRegistry';

export class CharacterSystem {
  constructor(readonly registry: CharacterRegistry, readonly hooks: CharacterRuntimeHooks = {}) {}
  spawn(id: EntityId): void { this.hooks.onSpawn?.(this.registry.require(id)); }
  navigate(id: EntityId, locationId: EntityId): void { this.registry.require(id); this.hooks.onNavigate?.(id, locationId); }
  playAnimation(id: EntityId, clip: string): void { this.registry.require(id); this.hooks.onAnimation?.(id, clip); }
}
