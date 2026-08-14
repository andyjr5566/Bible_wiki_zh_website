import { describe, expect, it } from 'vitest';
import { loadProjectData } from '../../data/loadProjectData';
import { AssetManifest } from './AssetManifest';

describe('high-fidelity asset policy', () => {
  const manifest = new AssetManifest(loadProjectData().assets.assets);
  it('uses the hero model for desktop high', () => expect(manifest.createLoadPlan('desktop-high').map(({ id }) => id)).toEqual(['tabernacle-main']));
  it('reserves lowpoly for explicit fallback', () => { expect(manifest.createLoadPlan('desktop-high').map(({ id }) => id)).not.toContain('tabernacle-lowpoly'); expect(manifest.createLoadPlan('fallback-low').map(({ id }) => id)).toContain('tabernacle-lowpoly'); });
  it('keeps all downloaded assets typed and excludes reference-only entries', () => {
    expect(manifest.values()).toHaveLength(17);
    expect(manifest.values().every((asset) => asset.downloadAvailable && asset.sourceFile && asset.processedFile && asset.runtimeFile)).toBe(true);
    expect(manifest.values().some((asset) => asset.historicalStatus === 'reference-only')).toBe(false);
    expect(manifest.get('tabernacle-law-tablets-library')?.runtimePolicy).toBe('deferred');
    expect(manifest.get('priest-arab-man-library')?.historicalStatus).toBe('technical-base');
    expect(manifest.values().filter((asset) => asset.qualityTier === 'detail' && asset.runtimePolicy === 'on-demand')).toHaveLength(6);
  });
});
