import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ParticleEffects } from './ParticleEffects';

describe('ParticleEffects cue policy', () => {
  it('keeps narrative smoke and fire hidden until a cue is enabled', () => {
    const parent = new THREE.Group();
    const effects = new ParticleEffects(parent);

    expect(effects.root.getObjectByName('cue-menorah-flames')?.visible).toBe(false);
    expect(effects.root.getObjectByName('cue-incense-smoke')?.visible).toBe(false);
    expect(effects.root.getObjectByName('cue-burnt-offering-fire')?.visible).toBe(false);

    effects.setCue('incense-smoke');
    expect(effects.root.getObjectByName('cue-incense-smoke')?.visible).toBe(true);

    effects.setLearningDetailFocus(true);
    expect(effects.root.getObjectByName('cue-incense-smoke')?.visible).toBe(false);

    effects.setLearningDetailFocus(false);
    effects.setCue('incense-smoke', false);
    expect(effects.root.getObjectByName('cue-incense-smoke')?.visible).toBe(false);
    effects.dispose();
  });
});
