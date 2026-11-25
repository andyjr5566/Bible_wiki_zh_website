/** 把排序後的列號合併成 [start, end]（含頭尾）區間；間隔 ≤ gap 列就合併。與前端 coalesceRanges 同一規則，供量測用。 */
export function coalesceRanges(sortedIdx, gap = 8) {
  const out = []
  for (const i of sortedIdx) {
    const last = out[out.length - 1]
    if (last && i - last[1] - 1 <= gap) last[1] = i
    else out.push([i, i])
  }
  return out
}
