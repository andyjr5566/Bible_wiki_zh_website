export type SearchAnnouncementKind =
  | "exact"
  | "semantic"
  | "scripture"
  | "scripture-missing"
  | "none";

/** Return the next visible option index, stopping at either end of the list. */
export function getNextVisibleIndex(
  currentIndex: number,
  direction: -1 | 1,
  visible: readonly boolean[],
): number {
  if (visible.length === 0) return -1;

  let index = currentIndex;
  if (index < 0 || index >= visible.length) {
    index = direction === 1 ? -1 : visible.length;
  }

  for (
    let nextIndex = index + direction;
    nextIndex >= 0 && nextIndex < visible.length;
    nextIndex += direction
  ) {
    if (visible[nextIndex]) return nextIndex;
  }

  if (currentIndex >= 0 && currentIndex < visible.length && visible[currentIndex]) {
    return currentIndex;
  }

  if (direction === 1) {
    return visible.findIndex(Boolean);
  }

  for (let lastIndex = visible.length - 1; lastIndex >= 0; lastIndex--) {
    if (visible[lastIndex]) return lastIndex;
  }
  return -1;
}

/** Build the announcement for a completed search update. */
export function getSearchAnnouncement(
  kind: SearchAnnouncementKind,
  value: number | string,
): string | null {
  if (kind === "exact") {
    const count = typeof value === "number" ? value : Number(value);
    // 精準結果是 0 筆時，語意結果可能還在路上、畫面上也可能有經文卡片，所以不能說「找不到」
    return count > 0 ? `找到 ${count} 筆結果` : "沒有完全相符的結果";
  }

  if (kind === "semantic") {
    const count = typeof value === "number" ? value : Number(value);
    return count > 0 ? `另外找到 ${count} 筆語意相關結果` : null;
  }

  if (kind === "none") return "找不到相符的結果";

  if (kind === "scripture-missing") return String(value);

  return `可以跳到 ${String(value)}`;
}

/** Record an announcement once per query and report whether it should be spoken. */
export function shouldAnnounce(announcedMessages: Set<string>, message: string | null): boolean {
  if (!message || announcedMessages.has(message)) return false;
  announcedMessages.add(message);
  return true;
}
