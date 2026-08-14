import type { AssetProfile } from '../types/assets';

export interface RuntimeConfig {
  assetProfile: AssetProfile;
  commercialUse: false;
  canonicalOrientation: { eastAxis: '+z'; upAxis: '+y' };
}

export const runtimeConfig = Object.freeze({
  assetProfile: 'desktop-high',
  commercialUse: false,
  canonicalOrientation: { eastAxis: '+z', upAxis: '+y' },
} satisfies RuntimeConfig);
