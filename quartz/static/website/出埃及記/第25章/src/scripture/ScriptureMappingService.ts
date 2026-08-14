import type { EntityScriptureQuery, ScriptureLinks, ScripturePassage } from '../types/scripture';
import { ScriptureRegistry } from './ScriptureRegistry';

export class ScriptureMappingService {
  constructor(readonly registry: ScriptureRegistry) {}
  bibleTo3D(reference: string): Readonly<ScriptureLinks> { return this.registry.require(reference).links; }
  threeDToBible(query: EntityScriptureQuery): ScripturePassage[] {
    return this.registry.values().filter((passage) => passage.links[query.kind].includes(query.entityId));
  }
}
