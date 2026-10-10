/**
 * 徽章貼在把手旁。順序：右側 → 正上方（水平置中於把手）→ 正下方 → 左側；
 * 第一個「不出畫面、也不壓到任何固定介面」的位置就用它。塗血與搖禾捆共用。
 */
export function placeBadge(badge: HTMLElement, r: DOMRect, avoid: readonly DOMRect[]): void {
  const size = badge.offsetWidth || 88;
  const gap = 10;
  const W = window.innerWidth;
  const H = window.innerHeight;
  const pad = 8;
  const cx = r.left + r.width / 2 - size / 2;
  const cy = r.top + r.height / 2 - size / 2;
  const cands: [number, number][] = [
    [r.right + gap, cy],
    [cx, r.top - size - gap],
    [cx, r.bottom + gap],
    [r.left - size - gap, cy],
  ];
  const hits = (x: number, y: number) => {
    for (const a of avoid) {
      if (a.width <= 0 || a.height <= 0) continue;
      if (x < a.right + pad && x + size > a.left - pad && y < a.bottom + pad && y + size > a.top - pad) return true;
    }
    return false;
  };
  let pick = cands[1];
  for (const [x, y] of cands) {
    if (x < pad || y < pad || x + size > W - pad || y + size > H - pad) continue;
    if (hits(x, y)) continue;
    pick = [x, y];
    break;
  }
  const x = Math.min(Math.max(pick[0], pad), W - size - pad);
  const y = Math.min(Math.max(pick[1], pad), H - size - pad);
  // 用 left/top 擺位：脈動動畫用的是獨立的 scale 屬性，和 transform 的位移疊在一起會把位置放大（偏移上百 px）
  badge.style.left = `${x.toFixed(1)}px`;
  badge.style.top = `${y.toFixed(1)}px`;
}
