export type SearchAnnouncementKind = "exact" | "semantic" | "scripture";

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
    return count > 0 ? `找到 ${count} 筆結果` : "找不到相符的結果";
  }

  if (kind === "semantic") {
    const count = typeof value === "number" ? value : Number(value);
    return count > 0 ? `另外找到 ${count} 筆語意相關結果` : null;
  }

  return `可以跳到 ${String(value)}`;
}

/** Record an announcement once per query and report whether it should be spoken. */
export function shouldAnnounce(announcedMessages: Set<string>, message: string | null): boolean {
  if (!message || announcedMessages.has(message)) return false;
  announcedMessages.add(message);
  return true;
}
