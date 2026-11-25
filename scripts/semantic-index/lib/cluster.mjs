// 可選的最佳化：用固定種子的 k-means 把相近頁面排在一起，讓 Range 重算時要抓的列比較集中。
// 只回傳「新順序」（原列號的排列），不動向量本身。

/** 固定種子的小型亂數（mulberry32），確保同一份資料每次排出同樣順序。 */
export function makeRng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * @param rows Int8Array，n × dim（列向量已近似正規化，內積當相似度）
 * @returns number[] 新順序：order[k] = 第 k 個位置放原本的第 order[k] 列
 */
export function clusterOrder(rows, n, dim, { k = 64, iters = 10, seed = 20261125 } = {}) {
  if (n <= 1) return Array.from({ length: n }, (_, i) => i)
  const kk = Math.min(k, n)
  const rng = makeRng(seed)
  const cent = new Float32Array(kk * dim)
  // 以固定種子挑不重複的列當初始中心
  const picked = new Set()
  while (picked.size < kk) picked.add(Math.floor(rng() * n))
  let c = 0
  for (const p of picked) {
    for (let d = 0; d < dim; d++) cent[c * dim + d] = rows[p * dim + d] / 127
    c++
  }
  const assign = new Int32Array(n)
  const sim = new Float32Array(n)
  for (let it = 0; it < iters; it++) {
    for (let i = 0; i < n; i++) {
      let best = -1
      let bestSim = -Infinity
      for (let j = 0; j < kk; j++) {
        let s = 0
        for (let d = 0; d < dim; d++) s += rows[i * dim + d] * cent[j * dim + d]
        if (s > bestSim) {
          bestSim = s
          best = j
        }
      }
      assign[i] = best
      sim[i] = bestSim
    }
    const sums = new Float32Array(kk * dim)
    const counts = new Int32Array(kk)
    for (let i = 0; i < n; i++) {
      counts[assign[i]]++
      for (let d = 0; d < dim; d++) sums[assign[i] * dim + d] += rows[i * dim + d] / 127
    }
    for (let j = 0; j < kk; j++) {
      if (counts[j] === 0) continue // 空群保留舊中心
      let norm = 0
      for (let d = 0; d < dim; d++) norm += sums[j * dim + d] ** 2
      norm = Math.sqrt(norm) || 1
      for (let d = 0; d < dim; d++) cent[j * dim + d] = sums[j * dim + d] / norm
    }
  }
  // 群號小到大；群內依與中心的相似度由高到低，同分依原列號（穩定）
  return Array.from({ length: n }, (_, i) => i).sort(
    (a, b) => assign[a] - assign[b] || sim[b] - sim[a] || a - b,
  )
}
