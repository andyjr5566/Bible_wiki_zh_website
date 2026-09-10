import { afterEach, describe, expect, it, vi } from 'vitest';
import { Group } from 'three';
import { DimensionVisualizer } from './DimensionVisualizer';
import { loadProjectData } from '../data/loadProjectData';

afterEach(() => vi.unstubAllGlobals());

describe('dimension rendering during camera playback', () => {
  it('reuses geometry and labels between frames, but rebuilds after a unit change', () => {
    vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => null }) });
    const visualizer = new DimensionVisualizer(new Group(), loadProjectData().dimensions.specs);
    visualizer.showObjectDimensions('ark');
    const labels = visualizer.root.children[1]!;
    const label = labels.children[0]!;
    expect(label).toBeDefined();
    for (let frame = 0; frame < 120; frame += 1) {
      visualizer.setUnit('cubit');
      visualizer.showObjectDimensions('ark');
    }
    expect(labels.children[0]).toBe(label);
    visualizer.setUnit('cm');
    expect(labels.children[0]).not.toBe(label);
    expect(labels.children).toHaveLength(3);
    visualizer.clear();
    expect(labels.children).toHaveLength(0);
    visualizer.dispose();
  });
});
