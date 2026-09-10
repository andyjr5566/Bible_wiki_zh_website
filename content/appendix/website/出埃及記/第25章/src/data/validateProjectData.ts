import type { ProjectData } from './loadProjectData';

/**
 * Cross-file checks which cannot be expressed by the individual Zod schemas.
 * Keep this validator deterministic and side-effect free so fixtures can use it
 * without constructing the renderer.
 */
export function findProjectDataIntegrityIssues(data: ProjectData): string[] {
  const issues: string[] = [];
  const report = (message: string): void => { issues.push(message); };
  const unique = (label: string, values: readonly string[]): Set<string> => {
    const seen = new Set<string>();
    values.forEach((value) => {
      if (seen.has(value)) report(`${label} duplicate id: ${value}`);
      seen.add(value);
    });
    return seen;
  };
  const requireRef = (label: string, value: string, known: ReadonlySet<string>): void => {
    if (!known.has(value)) report(`${label} dangling reference: ${value}`);
  };
  const requireClaims = (label: string, values: readonly string[], claims: ReadonlySet<string>): void => values.forEach((id) => requireRef(label, id, claims));

  const assetIds = unique('asset', data.assets.assets.map(({ id }) => id));
  const characterIds = unique('character', data.characters.characters.map(({ id }) => id));
  const garmentIds = unique('garment state', data.garments.states.map(({ id }) => id));
  const roleIds = unique('role costume', data.roleCostumes.roles.map(({ id }) => id));
  const animalIds = unique('offering animal', data.offerings.animals.map(({ id }) => id));
  const branchIds = unique('offering branch', data.offerings.branches.map(({ id }) => id));
  const comparisonIds = unique('offering comparison', data.offerings.comparisons.map(({ id }) => id));
  const locationIds = unique('location', data.world.locations.map(({ id }) => id));
  const objectIds = unique('tabernacle object', data.tabernacle.objects.map(({ id }) => id));
  const detailIds = unique('object detail', data.objectDetails.objects.map(({ id }) => id));
  const ritualIds = unique('ritual', data.rituals.rituals.map(({ id }) => id));
  const passageIds = unique('scripture passage', data.scriptures.passages.map(({ id }) => id));
  const excerptIds = unique('scripture excerpt', data.scriptureExcerpts.excerpts.map(({ id }) => id));
  const sourceIds = unique('evidence source', data.evidence.sources.map(({ id }) => id));
  const claimIds = unique('evidence claim', data.evidence.claims.map(({ id }) => id));
  const dimensionIds = unique('dimension', data.dimensions.specs.map(({ id }) => id));
  const knownEntityIds = new Set([...objectIds, ...locationIds, ...characterIds, ...ritualIds, ...assetIds, ...dimensionIds,
    'tabernacle-main', 'outer-court', 'priest', 'burnt-offering', 'five-sacrifices', 'day-of-atonement', 'divine-presence-event', 'dimension-system']);

  requireRef('world spawnLocationId', data.world.spawnLocationId, locationIds);
  if (data.world.bounds.minX >= data.world.bounds.maxX) report('world bounds minX must be less than maxX');
  if (data.world.bounds.minZ >= data.world.bounds.maxZ) report('world bounds minZ must be less than maxZ');

  data.tabernacle.objects.forEach((object) => {
    requireRef(`object ${object.id}.locationId`, object.locationId, locationIds);
    if (object.assetId) requireRef(`object ${object.id}.assetId`, object.assetId, assetIds);
  });
  data.objectDetails.objects.forEach((detail) => {
    requireRef(`detail ${detail.id}`, detail.id, objectIds);
    requireRef(`detail ${detail.id}.locationId`, detail.locationId, locationIds);
    unique(`detail ${detail.id} part`, detail.parts.map(({ id }) => id));
    requireClaims(`detail ${detail.id}.claimIds`, detail.claimIds, claimIds);
    requireClaims(`detail ${detail.id}.dimension.sourceClaimIds`, detail.dimensions.sourceClaimIds, claimIds);
    detail.parts.forEach((part) => requireClaims(`detail part ${part.id}.claimIds`, part.claimIds, claimIds));
  });

  data.evidence.claims.forEach((claim) => {
    requireRef(`claim ${claim.id}.entityId`, claim.entityId, knownEntityIds);
    claim.references.forEach((reference) => requireRef(`claim ${claim.id}.sourceId`, reference.sourceId, sourceIds));
  });
  data.characters.characters.forEach((character) => {
    if (character.baseAssetId) requireRef(`character ${character.id}.baseAssetId`, character.baseAssetId, assetIds);
    requireRef(`character ${character.id}.garment`, character.defaultGarmentState, garmentIds);
    requireRef(`character ${character.id}.spawnLocationId`, character.navigation.spawnLocationId, locationIds);
    character.navigation.routeLocationIds.forEach((id) => requireRef(`character ${character.id}.routeLocationIds`, id, locationIds));
    requireClaims(`character ${character.id}.responsibilityClaimIds`, character.responsibilityClaimIds, claimIds);
    character.garments.forEach((garment) => { if (garment.assetId) requireRef(`character ${character.id}.garment.assetId`, garment.assetId, assetIds); });
    if (!data.roleCostumes.roles.some((role) => role.role === character.role)) report(`character ${character.id} has no role costume for ${character.role}`);
  });
  data.garments.states.forEach((state) => {
    if (state.role !== 'unspecified' && !data.roleCostumes.roles.some((role) => role.role === state.role)) report(`garment ${state.id} has no role costume for ${state.role}`);
    requireClaims(`garment ${state.id}.sourceClaimIds`, state.sourceClaimIds, claimIds);
    unique(`garment ${state.id} part`, state.parts.map(({ id }) => id));
    state.parts.forEach((part) => {
      requireClaims(`garment part ${part.id}.sourceClaimIds`, part.sourceClaimIds, claimIds);
      if (part.assetId) requireRef(`garment part ${part.id}.assetId`, part.assetId, assetIds);
    });
  });
  data.roleCostumes.roles.forEach((role) => {
    requireRef(`role ${role.id}.defaultGarmentState`, role.defaultGarmentState, garmentIds);
    role.allowedGarmentStates.forEach((state) => requireRef(`role ${role.id}.allowedGarmentStates`, state, garmentIds));
    role.forbiddenGarmentStates.forEach((state) => requireRef(`role ${role.id}.forbiddenGarmentStates`, state, garmentIds));
    if (!role.allowedGarmentStates.includes(role.defaultGarmentState)) report(`role ${role.id} default garment is not allowed`);
    if (role.allowedGarmentStates.some((state) => role.forbiddenGarmentStates.includes(state))) report(`role ${role.id} has garment state both allowed and forbidden`);
    requireClaims(`role ${role.id}.sourceClaimIds`, role.sourceClaimIds, claimIds);
  });

  data.offerings.animals.forEach((animal) => {
    if (animal.assetId) requireRef(`animal ${animal.id}.assetId`, animal.assetId, assetIds);
    if (animal.representation === 'symbol-with-label' && animal.assetId !== null) report(`animal ${animal.id} symbol representation has an asset`);
    requireClaims(`animal ${animal.id}.sourceClaimIds`, animal.sourceClaimIds, claimIds);
  });
  data.offerings.branches.forEach((branch) => {
    requireRef(`branch ${branch.id}.animalId`, branch.animalId, animalIds);
    requireRef(`branch ${branch.id}.ritualId`, branch.ritualId, ritualIds);
    requireClaims(`branch ${branch.id}.sourceClaimIds`, branch.sourceClaimIds, claimIds);
    const animal = data.offerings.animals.find(({ id }) => id === branch.animalId);
    if (animal && animal.kind !== branch.branchKind) report(`branch ${branch.id} branchKind does not match animal ${animal.id}`);
  });
  data.offerings.comparisons.forEach((comparison) => requireClaims(`comparison ${comparison.id}.sourceClaimIds`, comparison.sourceClaimIds, claimIds));

  data.assetParts.mappings.forEach((mapping) => {
    requireRef(`asset mapping ${mapping.assetId}.assetId`, mapping.assetId, assetIds);
    requireRef(`asset mapping ${mapping.assetId}.objectId`, mapping.objectId, objectIds);
    unique(`asset mapping ${mapping.assetId} part`, mapping.parts.map(({ partId }) => partId));
    // A mapping may describe technical mesh groups which are intentionally
    // omitted from the reader-facing detail list (for example altar utensils).
    // The authoritative cross-reference is asset/object; part IDs are local to
    // that mapping and are checked for uniqueness above.
  });
  unique('asset mapping asset', data.assetParts.mappings.map(({ assetId }) => assetId));

  data.rituals.rituals.forEach((ritual) => {
    requireRef(`ritual ${ritual.id}.locationId`, ritual.locationId, locationIds);
    unique(`ritual ${ritual.id} step`, ritual.steps.map(({ id }) => id));
    const steps = new Set(ritual.steps.map(({ id }) => id));
    const stepOrders = ritual.steps.map(({ order }) => order).sort((a, b) => a - b);
    stepOrders.forEach((order, index) => { if (order !== index + 1) report(`ritual ${ritual.id} step order is not contiguous`); });
    ritual.steps.forEach((step) => {
      requireRef(`step ${step.id}.locationId`, step.locationId, locationIds);
      step.objectIds.forEach((id) => requireRef(`step ${step.id}.objectId`, id, objectIds));
      step.characterIds.forEach((id) => requireRef(`step ${step.id}.characterId`, id, characterIds));
      step.nextStepIds.forEach((id) => requireRef(`step ${step.id}.nextStepId`, id, steps));
      requireClaims(`step ${step.id}.actionClaimIds`, step.actionClaimIds, claimIds);
      if (step.id.startsWith('atonement-') && step.characterIds.length > 0 && step.id === 'atonement-empty-room') report(`step ${step.id} must omit characters`);
    });
    const reachable = new Set<string>();
    const visiting = new Set<string>();
    const visit = (id: string): void => {
      if (visiting.has(id)) { report(`ritual ${ritual.id} cyclic nextStepIds at: ${id}`); return; }
      if (reachable.has(id)) return;
      visiting.add(id); reachable.add(id);
      ritual.steps.find(({ id: stepId }) => stepId === id)?.nextStepIds.forEach(visit);
      visiting.delete(id);
    };
    if (ritual.steps[0]) visit(ritual.steps[0].id);
    ritual.steps.forEach((step) => { if (!reachable.has(step.id)) report(`ritual ${ritual.id} unreachable step: ${step.id}`); });
    const trigger = ritual.trigger;
    if (trigger.kind === 'interaction') requireRef(`ritual ${ritual.id}.trigger.objectId`, trigger.objectId, objectIds);
    else requireRef(`ritual ${ritual.id}.trigger.locationId`, trigger.locationId, locationIds);
  });

  data.scriptures.passages.forEach((passage) => {
    passage.links.objectIds.forEach((id) => requireRef(`passage ${passage.id}.objectId`, id, objectIds));
    passage.links.ritualIds.forEach((id) => requireRef(`passage ${passage.id}.ritualId`, id, ritualIds));
    passage.links.locationIds.forEach((id) => requireRef(`passage ${passage.id}.locationId`, id, locationIds));
    passage.links.characterIds.forEach((id) => requireRef(`passage ${passage.id}.characterId`, id, characterIds));
  });
  data.tours.tours.forEach((tour) => {
    requireRef(`tour ${tour.id}.locationId`, tour.locationId, locationIds);
    if (tour.objectId) requireRef(`tour ${tour.id}.objectId`, tour.objectId, objectIds);
    tour.excerptIds.forEach((id) => requireRef(`tour ${tour.id}.excerptId`, id, excerptIds));
    if (tour.dimensionTargetId) requireRef(`tour ${tour.id}.dimensionTargetId`, tour.dimensionTargetId, dimensionIds);
    const hotspots = tour.hotspots ?? [];
    unique(`tour ${tour.id} hotspot`, hotspots.map(({ id }) => id));
    hotspots.forEach((hotspot) => {
      requireRef(`hotspot ${hotspot.id}.objectId`, hotspot.objectId, objectIds);
      hotspot.excerptIds.forEach((id) => requireRef(`hotspot ${hotspot.id}.excerptId`, id, excerptIds));
      if (hotspot.dimensionTargetId) requireRef(`hotspot ${hotspot.id}.dimensionTargetId`, hotspot.dimensionTargetId, dimensionIds);
    });
  });
  data.dimensions.specs.forEach((spec) => { if (!knownEntityIds.has(spec.id)) report(`dimension ${spec.id} has no known entity`); });
  data.scriptureExcerpts.excerpts.forEach((excerpt) => {
    excerpt.ranges.forEach((range) => { if (range.startVerse > range.endVerse) report(`excerpt ${excerpt.id} has reversed verse range`); });
    if (!excerpt.text.trim()) report(`excerpt ${excerpt.id} has empty text`);
  });

  // Keep these sets intentionally referenced so a fixture that duplicates one
  // of the comparison/branch records is still reported even when no UI reads it.
  void branchIds; void comparisonIds; void passageIds; void detailIds;
  return issues;
}

export function assertProjectDataIntegrity(data: ProjectData): void {
  const issues = findProjectDataIntegrityIssues(data);
  if (issues.length) throw new Error(`Project data integrity failed (${issues.length}):\n${issues.join('\n')}`);
}
