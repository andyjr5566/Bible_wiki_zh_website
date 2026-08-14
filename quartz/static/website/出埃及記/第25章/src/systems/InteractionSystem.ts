import type { EntityId, Vector3Data } from '../types/core';
import { EventChannel, type Unsubscribe } from '../utils/EventChannel';

export interface InteractionCandidate { id: EntityId; position: Vector3Data; radius: number; enabled: boolean; }
export interface InteractionEvent { entityId: EntityId; source: 'player' | 'learning' | 'tour'; }

export class InteractionSystem {
  readonly #candidates = new Map<EntityId, InteractionCandidate>();
  readonly #events = new EventChannel<InteractionEvent>();
  register(candidate: InteractionCandidate): void { this.#candidates.set(candidate.id, candidate); }
  unregister(id: EntityId): void { this.#candidates.delete(id); }
  subscribe(listener: (event: InteractionEvent) => void): Unsubscribe { return this.#events.subscribe(listener); }
  trigger(entityId: EntityId, source: InteractionEvent['source'] = 'player'): void {
    if (!this.#candidates.get(entityId)?.enabled) throw new Error(`Interaction unavailable: ${entityId}`);
    this.#events.emit({ entityId, source });
  }
  nearest(position: Vector3Data): InteractionCandidate | null {
    let result: InteractionCandidate | null = null; let best = Number.POSITIVE_INFINITY;
    this.#candidates.forEach((candidate) => {
      if (!candidate.enabled) return;
      const distance = Math.hypot(candidate.position.x - position.x, candidate.position.z - position.z);
      if (distance <= candidate.radius && distance < best) { best = distance; result = candidate; }
    });
    return result;
  }
}
