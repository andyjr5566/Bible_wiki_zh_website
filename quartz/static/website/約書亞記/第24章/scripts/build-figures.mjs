// Python -I keeps user site packages and cwd imports out of the image pipeline.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
for (const script of ['slice_sheet.py', 'pack_figures.py']) {
  const r = spawnSync('python', ['-I', resolve(root, 'scripts', script)], { cwd: root, stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
