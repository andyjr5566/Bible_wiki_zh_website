import type { Law } from '../data/types';

const cell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** 研究層的資料下載：條文清單 */
export function lawsCsv(laws: Law[], refText: (l: Law) => string, topicName: (id: string) => string): string {
  const head = ['id', '書卷', '章', '經文', '標題', '子題', '白話說明', '依據節'];
  const rows = laws.map((l) => [l.id, l.book, String(l.chapter), refText(l), l.title, l.topics.map(topicName).join('；'), l.summary, l.basis.join('、')]);
  return '﻿' + [head, ...rows].map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
}

export function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
