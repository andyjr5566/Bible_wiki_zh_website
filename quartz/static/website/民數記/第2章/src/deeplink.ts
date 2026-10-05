import { CAMPS, TRIBES } from './data/tribes';
import { CLANS } from './data/levites';
import type { MarchMode } from './data/march';
import type { Selection } from './store';

/**
 * 可分享的網址：
 *   #judah         選猶大支派
 *   #camp-judah    選整個猶大營
 *   #clan-kohath   選哥轄族
 *   #tabernacle    選會幕
 *   #march         開到拔營，使用民10 次序
 *   #march-10 / #march-2   開到拔營，選好次序版本
 * 支派 id 與各區的錨點（#map、#march…）不重名。
 */
export function selToHash(sel: Selection): string {
  if (!sel) return '#map';
  switch (sel.kind) {
    case 'tribe': return `#${sel.id}`;
    case 'camp': return `#camp-${sel.id}`;
    case 'clan': return `#clan-${sel.id}`;
    case 'tabernacle': return '#tabernacle';
  }
}

export type Deeplink = { sel: Selection } | { march: MarchMode } | null;

export function parseHash(hash: string): Deeplink {
  const k = decodeURIComponent(hash.replace(/^#/, ''));
  if (!k) return null;
  if (k === 'tabernacle') return { sel: { kind: 'tabernacle' } };
  if (k === 'march') return { march: 'num10' };
  if (k === 'march-10') return { march: 'num10' };
  if (k === 'march-2') return { march: 'num2' };
  const tribe = TRIBES.find((t) => t.id === k);
  if (tribe) return { sel: { kind: 'tribe', id: tribe.id } };
  const camp = CAMPS.find((c) => `camp-${c.id}` === k);
  if (camp) return { sel: { kind: 'camp', id: camp.id } };
  const clan = CLANS.find((c) => `clan-${c.id}` === k);
  if (clan) return { sel: { kind: 'clan', id: clan.id } };
  return null;
}

export const linkFor = (hash: string) => `${location.href.split('#')[0]}${hash}`;
