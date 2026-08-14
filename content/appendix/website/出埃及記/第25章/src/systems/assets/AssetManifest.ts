import type { AssetDefinition, AssetProfile } from '../../types/assets';
import { Registry } from '../../utils/Registry';

export class AssetManifest extends Registry<AssetDefinition> {
  createLoadPlan(profile: AssetProfile): AssetDefinition[] {
    if (profile === 'fallback-low') return this.values().filter((asset) => asset.qualityTier === 'fallback');
    if (profile === 'desktop-structural') return this.values().filter((asset) => asset.qualityTier === 'structural');
    return this.values().filter((asset) => asset.qualityTier === 'hero' && asset.runtimePolicy === 'default');
  }
}
