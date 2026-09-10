import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { KHRONOS_EXTENSIONS } from '@gltf-transform/extensions';

const project = resolve(fileURLToPath(new URL('..', import.meta.url)));
const readJson = async (path) => JSON.parse(await readFile(resolve(project, path), 'utf8'));
const sha256 = async (path) => createHash('sha256').update(await readFile(resolve(project, path))).digest('hex');
const bytes = async (path) => (await readFile(resolve(project, path))).byteLength;
const baseline = await readJson('docs/qa/revamp/BASELINE_ASSETS.json');
const baselineByPath = new Map(baseline.rows.map((row) => [row.path.replaceAll('\\', '/'), row]));
const typed = await readJson('src/data/assets.json');
const publicManifest = await readJson('public/models/manifest.json');
const publicById = new Map((publicManifest.models ?? []).map((asset) => [asset.id, asset]));
const io = new NodeIO().registerExtensions(KHRONOS_EXTENSIONS);
const failures = [];
const entries = [];

for (const asset of typed.assets) {
  const sourcePath = asset.sourceFile.replaceAll('\\', '/');
  const processedPath = asset.processedFile.replaceAll('\\', '/');
  const runtimePath = asset.runtimeFile.replaceAll('\\', '/');
  const publicAsset = publicById.get(asset.id);
  try {
    const sourceDigest = await sha256(sourcePath);
    if (sourceDigest !== asset.sha256.toLowerCase()) failures.push(`${asset.id}: source hash differs from typed manifest`);
    await access(resolve(project, processedPath));
    await access(resolve(project, runtimePath));
    const processedDigest = await sha256(processedPath);
    const runtimeDigest = await sha256(runtimePath);
    if (processedDigest !== runtimeDigest) failures.push(`${asset.id}: processed/runtime bytes differ`);
    if (publicAsset?.sha256?.toLowerCase() !== asset.sha256.toLowerCase()) failures.push(`${asset.id}: public/source hash differs`);

    const stageManifestPath = asset.id === 'tabernacle-ark-alternative'
      ? 'assets/staging/blender/r07/tabernacle-ark-alternative.r07-manifest.json'
      : `assets/staging/blender/r10/${asset.id}/${asset.id}.r10-manifest.json`;
    let stageManifest = null;
    try { stageManifest = await readJson(stageManifestPath); } catch { /* unchanged assets have no R07/R10 stage */ }
    const document = await io.read(resolve(project, processedPath));
    const root = document.getRoot();
    const triangleCount = root.listMeshes().reduce((sum, mesh) => sum + mesh.listPrimitives().reduce((primitiveSum, primitive) => {
      const indices = primitive.getIndices();
      const positions = primitive.getAttribute('POSITION');
      return primitiveSum + Math.floor((indices?.getCount() ?? positions?.getCount() ?? 0) / 3);
    }, 0), 0);
    const baselineRow = baselineByPath.get(processedPath);
    const expectedTriangles = stageManifest ? undefined : baselineRow?.triangles;
    if (expectedTriangles !== undefined && triangleCount !== expectedTriangles) failures.push(`${asset.id}: triangle count differs from registered metric (${triangleCount} vs ${expectedTriangles})`);
    if (stageManifest?.optimized?.sha256 && stageManifest.optimized.sha256 !== processedDigest) failures.push(`${asset.id}: stage optimized hash differs from processed`);
    const derivedBytes = await bytes(processedPath);
    entries.push({
      assetId: asset.id,
      source: { path: sourcePath, sha256: sourceDigest, bytes: await bytes(sourcePath) },
      derived: { path: processedPath, sha256: processedDigest, bytes: derivedBytes },
      runtime: { path: runtimePath, sha256: runtimeDigest },
      reimport: {
        status: 'passed',
        meshCount: root.listMeshes().length,
        objectCount: root.listNodes().filter((node) => node.getMesh()).length,
        triangleCount,
        materialCount: root.listMaterials().length,
        textureCount: root.listTextures().length,
        animationCount: root.listAnimations().length,
        axes: stageManifest?.axes ?? { forward: '-Z', up: 'Y', source: 'existing manifest' },
        units: stageManifest?.units ?? { system: 'METRIC', scaleLength: 1, source: 'existing manifest' },
        bounds: baselineRow?.bounds ?? null,
      },
      registeredStageMetrics: stageManifest ? { build: stageManifest.buildMetrics, reimport: stageManifest.reimportMetrics } : null,
      gpuUploadEstimateBytes: derivedBytes,
      nodeMapVersion: stageManifest?.schemaVersion ?? 'baseline-v1',
      blenderVersion: stageManifest?.blenderVersion ?? 'unchanged processed asset',
      optimizer: stageManifest ? 'glTF Transform 4.4.2' : 'existing processed asset (no R12 re-export)',
    });
  } catch (error) {
    failures.push(`${asset.id}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const output = {
  schemaVersion: 'r12',
  generatedAt: new Date().toISOString(),
  sourceHashMeaning: 'source.sha256 always hashes sourceFile; derived.sha256 hashes processedFile; runtime.sha256 hashes runtimeFile.',
  measurementNotes: {
    gpuUploadEstimateBytes: 'conservative lower-bound estimate equal to derived GLB bytes; no GPU profiler claim',
    bounds: 'asset-local baseline geometry bounds; not biblical dimensions',
    reimport: 'NodeIO parser successfully read each processed GLB; unchanged assets compare to the baseline, while R07/R10 stage metrics are retained separately because Blender counts instanced objects',
  },
  entries,
};
const outputPaths = ['assets/derived/r12-derived-assets.json', 'public/models/derived-manifest.json'];
for (const path of outputPaths) {
  await mkdir(resolve(project, dirname(path)), { recursive: true });
  await writeFile(resolve(project, path), `${JSON.stringify(output, null, 2)}\n`, 'utf8');
}
if (failures.length) throw new Error(`Derived asset verification failed:\n${failures.join('\n')}`);
console.log(`Derived asset verification passed for ${entries.length} assets; source hashes unchanged and processed/runtime pairs match.`);
