import { describe, expect, it, vi } from 'vitest';
import { ExperiencePanel, renderEvidenceClaim } from './ExperiencePanel';
import type { EvidenceClaimView, ExperienceState } from '../types/experience';

const source = {
  id: 'S-EX25', title: '《出埃及記》第25章／和合本檔案', sourceType: 'scripture' as const,
  date: '2026-09-10', scope: '出25:10-22', url: 'https://www.sefaria.org/Exodus.25.10-22?lang=bi', attribution: '本地 raw_scripture 正式經文；外部連結供查閱。',
};

const claim = (sourceValue: typeof source | null): EvidenceClaimView => ({
  id: 'C-EX25-ARK-SPEC', statement: '約櫃以皂莢木製作。', kind: 'scripture', status: 'verified', limits: ['木芯比例未詳。'],
  references: [{ sourceId: sourceValue?.id ?? 'S-MISSING', locator: '出25:10-16', source: sourceValue }],
});

describe('R18 evidence drawer', () => {
  it('renders source metadata and an external link only for a known source', () => {
    const html = renderEvidenceClaim(claim(source));
    expect(html).toContain('C-EX25-ARK-SPEC');
    expect(html).toContain('出埃及記');
    expect(html).toContain('2026-09-10');
    expect(html).toContain('查閱來源');
    expect(html).toContain('限制：');
    expect(html).toMatch(/^<details class="evidence-card"/);
    expect(html).not.toContain('evidence-card" open');
  });

  it('fails closed when a claim references an unknown source', () => {
    const html = renderEvidenceClaim(claim(null));
    expect(html).toContain('來源未建檔，無法提供連結');
    expect(html).not.toContain('<a ');
  });

  it('rejects non-http source URLs even when a source record exists', () => {
    const html = renderEvidenceClaim(claim({ ...source, url: 'javascript:alert(1)' }));
    expect(html).toContain('離線來源摘要');
    expect(html).not.toContain('javascript:');
  });
});

describe('R18 panel interactions', () => {
  it('dispatches part selection and clear actions through the app port', () => {
    let listener: ((event: Event) => void) | undefined;
    const element = {
      addEventListener: (_type: string, callback: EventListenerOrEventListenerObject) => { listener = callback as (event: Event) => void; },
      removeEventListener: vi.fn(),
      querySelectorAll: () => [],
      innerHTML: '',
    } as unknown as HTMLElement;
    const panel = new ExperiencePanel(element);
    const selectLearningPart = vi.fn();
    panel.bind({ selectLearningPart } as never);
    const target = { dataset: { learningPart: 'altar-grating' }, closest: () => target };
    listener?.({ target } as unknown as Event);
    expect(selectLearningPart).toHaveBeenCalledWith('altar-grating');
    const clearTarget = { dataset: { learningPartClear: '' }, closest: () => clearTarget };
    listener?.({ target: clearTarget } as unknown as Event);
    expect(selectLearningPart).toHaveBeenCalledWith(null);
    panel.dispose();
  });

  it('renders all six available object switches in learning mode', () => {
    const element = { addEventListener: vi.fn(), removeEventListener: vi.fn(), querySelectorAll: () => [], innerHTML: '' } as unknown as HTMLElement;
    const panel = new ExperiencePanel(element);
    panel.render('learning', {
      learning: { objectId: 'ark', objectName: '約櫃', confidence: 'textual', locationName: '至聖所', availableObjects: [
        { id: 'ark', name: '約櫃' }, { id: 'shewbread-table', name: '陳設餅桌' }, { id: 'menorah', name: '金燈臺' }, { id: 'incense-altar', name: '香壇' }, { id: 'burnt-altar', name: '燔祭壇' }, { id: 'laver', name: '洗濯盆' },
      ], selectedPartId: null, evidence: [claim(source)], detail: { id: 'ark', summary: '皂莢木櫃。', dimensions: { status: 'verified', lengthCubits: 2.5, widthCubits: 1.5, heightCubits: 1.5, displayNote: '未詳', }, materials: ['皂莢木'], parts: [{ id: 'ark-body', label: '櫃體', claimIds: ['C-EX25-ARK-SPEC'], mappingStatus: 'unresolved', nodeNames: [] }] }, scriptureReferences: [], ritualIds: [], offeringBranches: [], offeringComparisons: [], characterIds: [] },
      tour: { playing: false, index: 0, total: 0, current: null }, ritual: { playback: { ritualId: null, status: 'idle', stepIndex: 0 }, stepIndex: 0, stepCount: 0, branchId: null, name: null, stepTitle: null, instruction: null, confidence: null, scriptureReferences: [], displayCue: null, unresolved: [] }, character: { id: 'serving-priest', name: '祭司', role: 'Priest', roleLabel: '祭司', garmentState: 'unspecified', garmentLabel: '未指定', status: 'study', visualPolicy: 'role-only', baseAssetId: null, position: null, responsibilities: [], parts: [], validationNotes: [], disclosure: '' }, creditsOpen: false, assetProfile: 'desktop-high',
    } as unknown as ExperienceState);
    expect((element as unknown as { innerHTML: string }).innerHTML.match(/data-learning-object=/g)).toHaveLength(6);
    panel.dispose();
  });
});
