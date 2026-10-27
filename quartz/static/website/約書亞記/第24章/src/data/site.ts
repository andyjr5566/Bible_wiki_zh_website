import siteUrl from './site.json?url';
import type { SiteData } from './types';

export let siteData: SiteData;
export function setSiteData(data: SiteData): SiteData {
  siteData = data;
  return data;
}

export async function loadSiteData(onProgress?: (fraction: number) => void): Promise<SiteData> {
  const response = await fetch(siteUrl);
  if (!response.ok) throw new Error(`Site data ${response.status}`);
  // 有長度資訊就邊下載邊回報進度（壓縮傳輸時長度不準，最多報到 95%）
  const length = Number(response.headers.get('content-length')) || 0;
  if (onProgress && response.body && length > 0 && !response.headers.get('content-encoding')) {
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      onProgress(Math.min(0.95, received / length));
    }
    const bytes = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    return setSiteData(JSON.parse(new TextDecoder().decode(bytes)) as SiteData);
  }
  return setSiteData(await response.json() as SiteData);
}
