/**
 * 網站資料：src/data/site.json 由 scripts/build-data.mjs 讀 data/*.yaml 與 vault 產生（npm run data），
 * 不手改。這裡只負責附上型別。
 */
import data from './site.json';
import type { SiteData } from './types';

export const SITE = data as SiteData;
