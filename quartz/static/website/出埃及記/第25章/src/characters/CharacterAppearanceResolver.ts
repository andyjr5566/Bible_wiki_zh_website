import type { CharacterDefinition, GarmentState, GarmentStateDefinition, RoleCostumeDefinition } from '../types/characters';

export interface CharacterAppearance {
  characterId: string;
  name: string;
  role: CharacterDefinition['role'];
  roleLabel: string;
  garmentState: GarmentState;
  garmentLabel: string;
  baseAssetId: string | null;
  visualPolicy: CharacterDefinition['visualPolicy'];
  parts: GarmentStateDefinition['parts'];
  responsibilities: string[];
  disclosure: string;
  valid: boolean;
  validationNotes: string[];
}

export class CharacterAppearanceResolver {
  readonly #characters: readonly CharacterDefinition[];
  readonly #garments: readonly GarmentStateDefinition[];
  readonly #roles: readonly RoleCostumeDefinition[];

  constructor(characters: readonly CharacterDefinition[], garments: readonly GarmentStateDefinition[], roles: readonly RoleCostumeDefinition[]) {
    this.#characters = characters;
    this.#garments = garments;
    this.#roles = roles;
  }

  resolve(characterId: string, requestedState?: GarmentState): CharacterAppearance {
    const character = this.#characters.find(({ id }) => id === characterId);
    if (!character) throw new Error(`Unknown character id: ${characterId}`);
    const role = this.#roles.find(({ role }) => role === character.role);
    if (!role) throw new Error(`Missing costume role config for ${character.role}`);
    const garmentState = requestedState ?? character.defaultGarmentState;
    const garment = this.#garments.find(({ id }) => id === garmentState);
    if (!garment) throw new Error(`Unknown garment state: ${garmentState}`);
    const valid = role.allowedGarmentStates.includes(garmentState) && !role.forbiddenGarmentStates.includes(garmentState) && (garment.role === character.role || garment.role === 'unspecified');
    const validationNotes = valid ? [] : [`${role.label} 不可使用「${garment.label}」；保留角色位置示意。`];
    return {
      characterId: character.id,
      name: character.name,
      role: character.role,
      roleLabel: role.label,
      garmentState,
      garmentLabel: garment.label,
      baseAssetId: character.baseAssetId,
      visualPolicy: valid ? role.visualPolicy : 'abstract-role-marker',
      parts: valid ? garment.parts : [],
      responsibilities: role.responsibilitySummary,
      disclosure: role.disclosure,
      valid,
      validationNotes,
    };
  }

  resolveForRole(roleName: CharacterDefinition['role'], requestedState: GarmentState): CharacterAppearance {
    const character = this.#characters.find(({ role }) => role === roleName);
    if (!character) throw new Error(`No character registered for role: ${roleName}`);
    return this.resolve(character.id, requestedState);
  }
}
