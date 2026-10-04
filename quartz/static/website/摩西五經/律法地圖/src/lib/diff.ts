/**
 * 兩段經文的字面差異（逐字 LCS）。這是機械比對：只說哪些字不同，不判斷意思有沒有不同。
 * 畫面上一定要標「字面差異（機械比對）」。
 */
export type DiffPart = { text: string; kind: 'same' | 'a' | 'b' };

export function charDiff(a: string, b: string): DiffPart[] {
  const A = [...a];
  const B = [...b];
  const n = A.length;
  const m = B.length;
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: DiffPart[] = [];
  const push = (text: string, kind: DiffPart['kind']) => {
    const last = out[out.length - 1];
    if (last && last.kind === kind) last.text += text;
    else out.push({ text, kind });
  };
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) { push(A[i], 'same'); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) push(A[i++], 'a');
    else push(B[j++], 'b');
  }
  while (i < n) push(A[i++], 'a');
  while (j < m) push(B[j++], 'b');
  return out;
}

/** 兩段相同字數的比例（0–1） */
export function similarity(parts: DiffPart[]): number {
  let same = 0;
  let total = 0;
  for (const p of parts) {
    const len = [...p.text].length;
    total += len;
    if (p.kind === 'same') same += len * 2;
  }
  return total ? same / (total + same / 2) : 1;
}
