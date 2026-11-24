import { getNoteRanges, type TextRange } from "./textMatcher";

const IGNORABLE = /^[\s，。；：？！、（）()【】〔〕[\]「」『』“”‘’"'—─…‧·﹕,.;:?!]$/u;

/**
 * 從依序排列的命中範圍中，取出屬於「第一處命中」的那幾段。
 * 相鄰兩段之間若只有譯註與標點／空白，視為同一處命中（例如「他（原文是我……）必按時」）；
 * 中間夾了一般文字就是另一處命中，不併入。
 */
export function firstHitRanges(text: string, ranges: readonly TextRange[]): TextRange[] {
  if (ranges.length === 0) return [];
  const notes = getNoteRanges(text);
  const inNote = (index: number) => notes.some((n) => index >= n.start && index < n.end);
  const gapIsIgnorable = (from: number, to: number) => {
    for (let i = from; i < to; i++) {
      if (inNote(i)) continue;
      if (!IGNORABLE.test(text[i]!)) return false;
    }
    return true;
  };
  const result: TextRange[] = [ranges[0]!];
  for (let i = 1; i < ranges.length; i++) {
    const prev = ranges[i - 1]!;
    const next = ranges[i]!;
    if (!gapIsIgnorable(prev.end, next.start)) break;
    result.push(next);
  }
  return result;
}
