// 從章節 md「## 本章整理」底下的「### 標題（vX-Y）」抽出律法段落草稿，寫到 data/seed/<書名>.yaml。
//
//   node scripts/seed-sections.mjs 出埃及記 20 23    （書名、起訖章）
//
// 草稿只是起點，不會被網站讀取：本章整理的標題是散文用的，會有重疊、跳節（「v3, 7, 28」）
// 和不是律法的段落（敘事、勸勉）。整理成條文後，手動搬進 data/laws/<書名>.yaml。
// 讀的是渲染後的 md，不是 .tmp 的 chapter_content.yaml（那裡是一整段字串，舊章可能比 md 短）。
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import YAML from 'yaml';
import { BOOK_BY_NAME, SITE, chapterOrganization, chapterVerses, plainText } from './lib.mjs';

const [book, fromArg, toArg] = process.argv.slice(2);
if (!BOOK_BY_NAME[book]) {
  console.error('用法：node scripts/seed-sections.mjs <書名> [起章] [訖章]，書名是創世記／出埃及記／利未記／民數記／申命記');
  process.exit(1);
}
const from = Number(fromArg ?? 1);
const to = Number(toArg ?? fromArg ?? 200);

const chapters = [];
for (let ch = from; ch <= to; ch++) {
  const verses = chapterVerses(book, ch);
  if (!verses) break;
  const org = chapterOrganization(book, ch);
  const sections = [];
  for (const line of org.split(/\r?\n/)) {
    const m = /^###\s+(.+?)（v([\d\s,，、\-–]+)）\s*$/.exec(line);
    if (!m) continue;
    const title = plainText(m[1]).replace(/^[一二三四五六七八九十]+、/, '').trim();
    const spans = m[2].split(/[,，、]/).map((s) => s.trim()).filter(Boolean);
    sections.push({
      id: `TODO-${ch}-${sections.length + 1}`,
      title,
      verses: spans.length === 1 ? spans[0].replace('–', '-') : spans.join(','),
      laws: [],
      ...(spans.length > 1 ? { note: '本章整理用了不連續的節，請改成連續段落或拆開' } : {}),
    });
  }
  chapters.push({ chapter: ch, verse_count: verses.length, excluded: [], sections });
}

const outDir = resolve(SITE, 'data/seed');
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
const out = resolve(outDir, `${book}.yaml`);
const header = `# 段落草稿（自動產生，網站不讀）。整理後搬進 data/laws/${book}.yaml。\n`;
writeFileSync(out, header + YAML.stringify({ book, chapters }), 'utf8');
console.log(`已寫 ${out}：${chapters.length} 章、${chapters.reduce((n, c) => n + c.sections.length, 0)} 個段落草稿`);
