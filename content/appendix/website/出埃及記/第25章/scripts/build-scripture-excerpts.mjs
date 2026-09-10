import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const defaultSpecsPath = resolve(here, '../src/data/scripture-excerpt-specs.json');
const defaultOutputPath = resolve(here, '../src/data/scripture-excerpts.json');
const bookDirectories = { '出埃及記': '出埃及記', Exodus: '出埃及記', 利未記: '利未記', Leviticus: '利未記', 民數記: '民數記', Numbers: '民數記', 希伯來書: '希伯來書', Hebrews: '希伯來書' };

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function resolveRepoRoot(start) {
  let cursor = resolve(start);
  while (true) {
    try {
      await readdir(join(cursor, 'raw_scripture'));
      return cursor;
    } catch {
      const parent = resolve(cursor, '..');
      if (parent === cursor) throw new Error('找不到包含 raw_scripture 的專案根目錄，請傳入 --repo-root。');
      cursor = parent;
    }
  }
}

function parseBookPath(book, chapter, rawRoot) {
  const directory = bookDirectories[book];
  if (!directory) throw new Error(`不支援的書卷：${book}`);
  return join(rawRoot, directory, `第${chapter}章.txt`);
}

function validateRanges(spec) {
  if (!Array.isArray(spec.ranges) || spec.ranges.length === 0) throw new Error(`excerpt ${spec.id} 沒有 ranges`);
  for (const range of spec.ranges) {
    if (!Number.isInteger(range.startVerse) || !Number.isInteger(range.endVerse) || range.startVerse < 1 || range.endVerse < range.startVerse) {
      throw new Error(`excerpt ${spec.id} 的 verse range 無效`);
    }
  }
}

async function main() {
  const specsPath = resolve(argValue('--specs') ?? defaultSpecsPath);
  const outputPath = resolve(argValue('--output') ?? defaultOutputPath);
  const repoRoot = await resolveRepoRoot(argValue('--repo-root') ?? resolve(here, '../../../..'));
  const specsData = JSON.parse(await readFile(specsPath, 'utf8'));
  if (!Array.isArray(specsData.excerpts) || specsData.excerpts.length === 0) throw new Error('excerpt specs 必須包含至少一筆資料。');
  const ids = new Set();
  const excerpts = [];
  for (const spec of specsData.excerpts) {
    if (!spec.id || ids.has(spec.id)) throw new Error(`excerpt id 重複或空白：${spec.id}`);
    ids.add(spec.id);
    validateRanges(spec);
    const sourcePath = parseBookPath(spec.book, spec.chapter, join(repoRoot, 'raw_scripture'));
    const source = await readFile(sourcePath, 'utf8');
    const lines = source.replace(/^\uFEFF/, '').split(/\r?\n/);
    if (lines.at(-1) === '') lines.pop();
    if (lines.some((line) => line.trim().length === 0)) throw new Error(`來源含空白經文行：${sourcePath}`);
    const texts = [];
    let highestVerse = 0;
    for (const range of spec.ranges) {
      highestVerse = Math.max(highestVerse, range.endVerse);
      if (lines.length < range.endVerse) throw new Error(`${sourcePath} 不足第 ${range.endVerse} 節`);
      texts.push(...lines.slice(range.startVerse - 1, range.endVerse));
    }
    if (highestVerse === 0) throw new Error(`excerpt ${spec.id} 沒有有效 verse`);
    const sourceSha256 = createHash('sha256').update(source).digest('hex').toUpperCase();
    const reference = `${spec.book} ${spec.chapter}:${spec.ranges.map(({ startVerse, endVerse }) => startVerse === endVerse ? startVerse : `${startVerse}-${endVerse}`).join(',')}`;
    excerpts.push({ id: spec.id, book: bookDirectories[spec.book] === '出埃及記' ? 'Exodus' : bookDirectories[spec.book] === '利未記' ? 'Leviticus' : bookDirectories[spec.book] === '民數記' ? 'Numbers' : 'Hebrews', chapter: spec.chapter, ranges: spec.ranges, reference, text: texts.join('\n'), sourcePath: `raw_scripture/${bookDirectories[spec.book]}/第${spec.chapter}章.txt`, sourceSha256 });
  }
  const output = { version: 'r03', generatedAt: new Date().toISOString(), excerpts };
  JSON.parse(JSON.stringify(output));
  await mkdir(dirname(outputPath), { recursive: true });
  const tempPath = `${outputPath}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  await rename(tempPath, outputPath);
  console.log(`已建立 ${outputPath}（${excerpts.length} 段，來源根目錄 ${repoRoot}）`);
}

await main();
