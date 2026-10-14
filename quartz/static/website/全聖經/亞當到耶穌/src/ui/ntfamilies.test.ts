import { describe, expect, it } from 'vitest';
import type { Person } from '../data/types';
import { layoutFamilyGraph } from './ntfamilies';

describe('layoutFamilyGraph', () => {
  it('places a child with two listed parents once and connects both parent nodes', () => {
    const people: Person[] = [
      { id: 'joseph', name: '約瑟', spouses: [{ id: 'mary' }] },
      { id: 'mary', name: '馬利亞', spouses: [{ id: 'joseph' }] },
      { id: 'jesus', name: '耶穌', parents: [{ id: 'joseph' }, { id: 'mary' }, { id: 'mary' }, { id: 'mary' }] },
    ];

    const layout = layoutFamilyGraph(people);
    const ids = layout.nodes.map((node) => node.person.id);

    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(ids.length);
    expect(layout.parentEdges).toEqual([
      { from: 'joseph', to: 'jesus' },
      { from: 'mary', to: 'jesus' },
    ]);
    expect(layout.spouseEdges).toHaveLength(1);

    const joseph = layout.nodes.find((node) => node.person.id === 'joseph')!;
    const mary = layout.nodes.find((node) => node.person.id === 'mary')!;
    expect(joseph.depth).toBe(mary.depth);
    expect(Math.abs(joseph.x - mary.x)).toBeLessThan((joseph.width + mary.width) / 2 + 20);
  });
});
