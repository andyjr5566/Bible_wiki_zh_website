export interface AssetPartMapping {
  assetId: string;
  objectId: string;
  parts: Array<{ partId: string; nodeNames: string[]; status: 'verified' | 'unresolved' }>;
}
export interface AssetPartsData { mappings: AssetPartMapping[]; }
