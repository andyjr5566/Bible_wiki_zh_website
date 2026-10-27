import siteUrl from './site.json?url';
import type { SiteData } from './types';

export let siteData: SiteData;
export function setSiteData(data: SiteData): SiteData {
  siteData = data;
  return data;
}

export async function loadSiteData(): Promise<SiteData> {
  const response = await fetch(siteUrl);
  if (!response.ok) throw new Error(`Site data ${response.status}`);
  return setSiteData(await response.json() as SiteData);
}
