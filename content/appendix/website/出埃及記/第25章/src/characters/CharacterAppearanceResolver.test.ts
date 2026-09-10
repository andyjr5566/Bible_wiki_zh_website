import { describe, expect, it } from 'vitest';
import { CharacterAppearanceResolver } from './CharacterAppearanceResolver';
import { loadProjectData } from '../data/loadProjectData';

describe('CharacterAppearanceResolver', () => {
  const data = loadProjectData();
  const resolver = new CharacterAppearanceResolver(data.characters.characters, data.garments.states, data.roleCostumes.roles);

  it('keeps daily priest and high priest responsibilities distinct', () => {
    const priest = resolver.resolve('serving-priest');
    const highPriest = resolver.resolve('aaron-high-priest');
    expect(priest.garmentState).toBe('daily-priest');
    expect(highPriest.garmentState).toBe('daily-high-priest');
    expect(priest.responsibilities).toContain('料理燈、陳設餅與日常獻香');
    expect(highPriest.responsibilities).toContain('贖罪日穿細麻衣進入聖所與至聖所');
  });

  it('allows linen only for the high priest and exposes its four claimed parts', () => {
    const appearance = resolver.resolve('aaron-high-priest', 'atonement-linen');
    expect(appearance.valid).toBe(true);
    expect(appearance.parts.map(({ id }) => id)).toEqual(['atonement-tunic', 'atonement-breeches', 'atonement-sash', 'atonement-turban']);
    expect(() => resolver.resolve('serving-priest', 'atonement-linen')).not.toThrow();
    expect(resolver.resolve('serving-priest', 'atonement-linen').valid).toBe(false);
  });

  it('fails closed to a role marker for levite clothing and unresolved appearance', () => {
    const appearance = resolver.resolve('levite-helper');
    expect(appearance.valid).toBe(true);
    expect(appearance.visualPolicy).toBe('abstract-role-marker');
    expect(appearance.parts).toHaveLength(0);
    expect(resolver.resolve('levite-helper', 'daily-priest').valid).toBe(false);
  });
});
