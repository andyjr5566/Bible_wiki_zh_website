import { describe, expect, it } from 'vitest';
import { loadProjectData } from '../data/loadProjectData';
import { ScriptureMappingService } from './ScriptureMappingService';
import { ScriptureRegistry } from './ScriptureRegistry';

describe('Bible ↔ 3D mapping', () => {
  const data = loadProjectData(); const service = new ScriptureMappingService(new ScriptureRegistry(data.scriptures.passages));
  it('maps Bible passages to 3D entities', () => expect(service.bibleTo3D('Exodus 25:10-22').objectIds).toContain('ark'));
  it('maps 3D entities back to Bible passages', () => expect(service.threeDToBible({ kind: 'objectIds', entityId: 'ark' }).map(({ id }) => id)).toContain('Exodus 25:10-22'));
});
