import { access, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const project = resolve(fileURLToPath(new URL('..', import.meta.url)));
const manifest = JSON.parse(await readFile(resolve(project, 'src/data/assets.json'), 'utf8'));
const publicManifest = JSON.parse(await readFile(resolve(project, 'public/models/manifest.json'), 'utf8'));
const errors = [];
if (manifest.version !== 2 || !Array.isArray(manifest.assets)) errors.push('typed asset manifest must be version 2 with an assets array');
const ids = new Set();
const publicById = new Map((publicManifest.models ?? []).map((asset) => [asset.id, asset]));
for (const asset of manifest.assets) {
  if (ids.has(asset.id)) errors.push(`duplicate asset id: ${asset.id}`);
  ids.add(asset.id);
  for (const field of ['id', 'author', 'sourceUrl', 'license', 'downloadDate', 'sha256', 'attribution']) if (!asset[field]) errors.push(`${asset.id ?? 'unknown'} missing ${field}`);
  if (asset.commercialUse !== false) errors.push(`${asset.id} must be non-commercial`);
  if (asset.downloadAvailable !== true) errors.push(`${asset.id} must record live download availability`);
  const publicAsset = publicById.get(asset.id);
  if (!publicAsset) errors.push(`${asset.id} missing from public/models/manifest.json`);
  else {
    for (const field of ['url', 'author', 'sourceUrl', 'license', 'sourceFile', 'processedFile', 'sha256']) {
      if (publicAsset[field] !== (field === 'url' ? asset.url : asset[field])) errors.push(`${asset.id} typed/public manifest mismatch: ${field}`);
    }
  }
  for (const [label, relativePath] of [['source', asset.sourceFile], ['processed', asset.processedFile], ['runtime', asset.runtimeFile]]) {
    try { await access(resolve(project, relativePath)); } catch { errors.push(`${asset.id} ${label} file missing: ${relativePath}`); }
  }
  try {
    const source = await readFile(resolve(project, asset.sourceFile));
    const digest = createHash('sha256').update(source).digest('hex').toUpperCase();
    if (digest !== asset.sha256.toUpperCase()) errors.push(`${asset.id} source sha256 mismatch`);
  } catch { /* the missing-file error above is more actionable */ }
}
for (const publicAsset of (publicManifest.models ?? [])) if (!ids.has(publicAsset.id)) errors.push(`${publicAsset.id} exists only in public manifest, not typed manifest`);
const defaults = manifest.assets.filter((asset) => asset.runtimePolicy === 'default');
if (!defaults.some((asset) => asset.qualityTier === 'hero')) errors.push('desktop default hero is missing');
if (defaults.some((asset) => asset.qualityTier === 'fallback')) errors.push('fallback must not be a default asset');
if (manifest.assets.filter((asset) => asset.qualityTier === 'hero').length !== 1) errors.push('manifest must have exactly one hero asset');
if (manifest.assets.filter((asset) => asset.qualityTier === 'fallback').some((asset) => asset.runtimePolicy !== 'manual-fallback')) errors.push('fallback assets must use manual-fallback policy');
if (manifest.assets.some((asset) => asset.historicalStatus === 'reference-only')) errors.push('reference-only assets cannot enter downloaded runtime manifest');
if (errors.length) throw new Error(`Asset verification failed:\n${errors.join('\n')}`);
console.log(`Asset strategy verified for ${manifest.assets.length} assets across source, processed, and runtime layers.`);
