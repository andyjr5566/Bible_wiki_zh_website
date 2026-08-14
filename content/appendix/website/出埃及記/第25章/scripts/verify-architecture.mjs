import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../src/', import.meta.url));
const files = [];
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await walk(path);
    else if (['.ts', '.tsx'].includes(extname(entry.name))) files.push(path);
  }
}
await walk(root);

const violations = [];
for (const file of files) {
  const source = await readFile(file, 'utf8');
  const name = relative(root, file).replaceAll('\\', '/');
  if (name.startsWith('scene/') && /from ['"]\.\.\/ui\//.test(source)) violations.push(`${name}: scene must not import UI`);
  if (name.startsWith('components/') && /from ['"].*scene\//.test(source)) violations.push(`${name}: components must not import concrete scene`);
  if (/TabernacleApp|TabernacleScene/.test(source)) violations.push(`${name}: old God Object name remains`);
}
if (violations.length) throw new Error(`Architecture boundary violations:\n${violations.join('\n')}`);
console.log(`Architecture boundaries verified across ${files.length} TypeScript modules.`);
