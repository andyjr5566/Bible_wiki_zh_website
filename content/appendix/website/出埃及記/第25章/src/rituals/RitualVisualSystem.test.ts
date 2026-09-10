import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { loadProjectData } from '../data/loadProjectData';
import { RitualVisualSystem } from './RitualVisualSystem';

describe('RitualVisualSystem step cues', () => {
  it('hides daily incense smoke at the boundary step', () => {
    const parent = new THREE.Group();
    const visuals = new RitualVisualSystem(parent);
    const ritual = loadProjectData().rituals.rituals.find(({ id }) => id === 'incense-service');
    if (!ritual) throw new Error('Missing incense fixture');
    const firstStep = ritual.steps[0];
    const boundaryStep = ritual.steps[2];
    if (!firstStep || !boundaryStep) throw new Error('Incomplete incense fixture');
    const incenseGroup = parent.getObjectByName('ritual-incense');
    visuals.play(ritual.id, firstStep);
    expect(incenseGroup?.visible).toBe(true);
    visuals.setStep(boundaryStep);
    expect(incenseGroup?.visible).toBe(false);
    visuals.dispose();
  });
});
