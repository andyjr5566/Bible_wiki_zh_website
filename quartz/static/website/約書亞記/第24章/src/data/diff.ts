export interface DiffSegment {
  kind: 'same' | 'left-only' | 'right-only' | 'replace';
  leftText: string;
  rightText: string;
}

export interface AlignedVersePair {
  leftRef: string;
  rightRef: string;
  leftIndex: number;
  rightIndex: number;
  reordered: boolean;
  similarity: number;
  segments: DiffSegment[];
}

export interface UnmatchedRightVerse {
  ref: string;
  text: string;
  negatedEchoes: { word: string; negatedWord: string; leftRef: string }[];
}

export interface ParallelDiffResult {
  leftRefs: string[];
  rightRefs: string[];
  pairs: AlignedVersePair[];
  unmatchedRight: UnmatchedRightVerse[];
}

function bigrams(s: string): Set<string> {
  const clean = s.replace(/[，。；：！？「」『』（）─—、\s]/g, '');
  const out = new Set<string>();
  for (let i = 0; i + 1 < clean.length; i++) {
    out.add(clean.slice(i, i + 2));
  }
  return out;
}

function diceSimilarity(a: string, b: string): number {
  const ba = bigrams(a);
  const bb = bigrams(b);
  if (ba.size === 0 || bb.size === 0) return 0;
  let common = 0;
  for (const g of ba) {
    if (bb.has(g)) common++;
  }
  return (2 * common) / (ba.size + bb.size);
}

/** 字元級最長共同子序列（LCS），回傳成對的同／異片段 */
export function diffChars(left: string, right: string): DiffSegment[] {
  const a = Array.from(left);
  const b = Array.from(right);
  const n = a.length;
  const m = b.length;
  const dp: Uint16Array[] = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));

  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      if (a[i] === b[j]) {
        dp[i][j] = dp[i + 1][j + 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  const raw: { op: 'eq' | 'del' | 'ins'; ch: string }[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      raw.push({ op: 'eq', ch: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      raw.push({ op: 'del', ch: a[i] });
      i++;
    } else {
      raw.push({ op: 'ins', ch: b[j] });
      j++;
    }
  }
  while (i < n) raw.push({ op: 'del', ch: a[i++] });
  while (j < m) raw.push({ op: 'ins', ch: b[j++] });

  const segments: DiffSegment[] = [];
  let k = 0;
  while (k < raw.length) {
    if (raw[k].op === 'eq') {
      let s = '';
      while (k < raw.length && raw[k].op === 'eq') {
        s += raw[k].ch;
        k++;
      }
      segments.push({ kind: 'same', leftText: s, rightText: s });
    } else {
      let del = '';
      let ins = '';
      while (k < raw.length && raw[k].op !== 'eq') {
        if (raw[k].op === 'del') del += raw[k].ch;
        else ins += raw[k].ch;
        k++;
      }
      if (del && ins) {
        segments.push({ kind: 'replace', leftText: del, rightText: ins });
      } else if (del) {
        segments.push({ kind: 'left-only', leftText: del, rightText: '' });
      } else if (ins) {
        segments.push({ kind: 'right-only', leftText: '', rightText: ins });
      }
    }
  }
  return segments;
}

/**
 * 對兩段平行經文（書24:28-31 與 士2:6-10）做純程式比對：
 * 1. 以雙字詞相似度自動配對對應經節，偵測次序對調；
 * 2. 對配對成功的經節跑字元級 LCS，標出同字、單側字與替換字；
 * 3. 無左欄對應的右欄經節（士2:10）獨立列出，並自動找出「不＋X」對左欄「X」的呼應（如「知道」→「不知道」）。
 */
export function buildParallelDiff(
  verses: Record<string, string>,
  leftRefs: string[] = ['書24:28', '書24:29', '書24:30', '書24:31'],
  rightRefs: string[] = ['士2:6', '士2:7', '士2:8', '士2:9', '士2:10'],
): ParallelDiffResult {
  const usedRight = new Set<number>();
  const pairs: AlignedVersePair[] = [];

  for (let li = 0; li < leftRefs.length; li++) {
    const lRef = leftRefs[li];
    const lText = verses[lRef] ?? '';
    let bestRi = -1;
    let bestSim = 0;
    for (let ri = 0; ri < rightRefs.length; ri++) {
      if (usedRight.has(ri)) continue;
      const rText = verses[rightRefs[ri]] ?? '';
      const sim = diceSimilarity(lText, rText);
      if (sim > bestSim) {
        bestSim = sim;
        bestRi = ri;
      }
    }
    if (bestRi >= 0 && bestSim >= 0.45) {
      usedRight.add(bestRi);
      const rRef = rightRefs[bestRi];
      const rText = verses[rRef] ?? '';
      pairs.push({
        leftRef: lRef,
        rightRef: rRef,
        leftIndex: li,
        rightIndex: bestRi,
        reordered: li !== bestRi,
        similarity: Math.round(bestSim * 1000) / 1000,
        segments: diffChars(lText, rText),
      });
    }
  }

  const unmatchedRight: UnmatchedRightVerse[] = [];
  for (let ri = 0; ri < rightRefs.length; ri++) {
    if (usedRight.has(ri)) continue;
    const rRef = rightRefs[ri];
    const rText = verses[rRef] ?? '';
    const negatedEchoes: { word: string; negatedWord: string; leftRef: string }[] = [];
    const negMatches = rText.matchAll(/不([\u4e00-\u9fff]{2})/g);
    const seen = new Set<string>();
    for (const m of negMatches) {
      const word = m[1];
      const negatedWord = m[0];
      if (seen.has(negatedWord)) continue;
      for (const lRef of leftRefs) {
        const lText = verses[lRef] ?? '';
        if (lText.includes(word) && !lText.includes(negatedWord)) {
          seen.add(negatedWord);
          negatedEchoes.push({ word, negatedWord, leftRef: lRef });
          break;
        }
      }
    }
    unmatchedRight.push({ ref: rRef, text: rText, negatedEchoes });
  }

  return { leftRefs, rightRefs, pairs, unmatchedRight };
}
