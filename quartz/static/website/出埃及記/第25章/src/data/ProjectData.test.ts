import { describe, expect, it } from 'vitest';
import { loadProjectData } from './loadProjectData';

describe('project data contracts', () => {
  const data = loadProjectData();
  it('contains unique ids and valid cross references', () => {
    const assertUnique = (ids: string[]) => expect(new Set(ids).size).toBe(ids.length);
    const locations = new Set(data.world.locations.map(({ id }) => id));
    const objects = new Set(data.tabernacle.objects.map(({ id }) => id));
    const characters = new Set(data.characters.characters.map(({ id }) => id));
    const rituals = new Set(data.rituals.rituals.map(({ id }) => id));
    const assets = new Set(data.assets.assets.map(({ id }) => id));
    [locations, objects, characters, rituals].forEach((set) => assertUnique([...set]));
    data.tabernacle.objects.forEach((object) => { expect(locations.has(object.locationId)).toBe(true); if (object.assetId) expect(assets.has(object.assetId)).toBe(true); });
    data.rituals.rituals.forEach((ritual) => {
      expect(locations.has(ritual.locationId)).toBe(true);
      ritual.steps.forEach((step) => { step.objectIds.forEach((id) => expect(objects.has(id)).toBe(true)); step.characterIds.forEach((id) => expect(characters.has(id)).toBe(true)); });
    });
    data.scriptures.passages.forEach((passage) => {
      expect(passage.originalText.length).toBeGreaterThan(0);
      passage.links.objectIds.forEach((id) => expect(objects.has(id)).toBe(true));
      passage.links.ritualIds.forEach((id) => expect(rituals.has(id)).toBe(true));
      passage.links.locationIds.forEach((id) => expect(locations.has(id)).toBe(true));
      passage.links.characterIds.forEach((id) => expect(characters.has(id)).toBe(true));
    });
  });
  it('defines all required high-priest garment slots', () => {
    const highPriest = data.characters.characters.find(({ role }) => role === 'HighPriest');
    expect(highPriest?.garments.map(({ slot }) => slot)).toEqual(expect.arrayContaining(['Ephod', 'Breastpiece', 'TurbanMiter', 'Robe', 'Tunic', 'GoldPlate']));
  });
});
