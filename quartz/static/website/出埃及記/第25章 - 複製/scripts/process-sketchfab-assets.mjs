import { copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const assets = [
  ['ark-of-the-covenant-alternative', 'ark_of_the_covenant_alternative.glb', 'ark-alternative.glb'],
  ['ten-commandments', 'the_ten_commandments_of_the_tabernacle.glb', 'ten-commandments.glb'],
  ['altar-of-burnt-offering', 'altar_of_burnt_offering_of_the_tabernacle.glb', 'altar-burnt-offering.glb'],
  ['table-of-shewbread', 'table_of_shewbread_of_the_tabernacle.glb', 'table-shewbread.glb'],
  ['altar-of-incense', 'altar_of_incense_of_the_tabernacle.glb', 'altar-incense.glb'],
  ['lampstand-menorah', 'lampstand_menorah_of_the_tabernacle.glb', 'lampstand-menorah.glb'],
  ['copper-laver', 'copper_laver_of_the_tabernacle.glb', 'copper-laver.glb'],
  ['arab-man-rigged', 'arab_man_rigged.glb', 'arab-man-rigged.glb'],
  ['basic-human-male', 'basic_human_male.glb', 'basic-human-male.glb'],
  ['medieval-peasant-outfit', 'medieval_peasant_outfit_free.glb', 'medieval-peasant-outfit.glb'],
  ['tunic-medieval-animation', 'tunic_medieval_for_animation.glb', 'tunic-medieval-animation.glb'],
  ['sheep', 'sheep.glb', 'sheep.glb'],
  ['cow-npc', 'cow_npc.glb', 'cow-npc.glb'],
  ['bull', 'bull.glb', 'bull.glb']
];

const root = path.resolve('.');
const cli = path.resolve('node_modules', '.bin', process.platform === 'win32' ? 'gltf-transform.cmd' : 'gltf-transform');
const commonArgs = [
  '--compress', 'quantize',
  '--flatten', 'false',
  '--instance', 'false',
  '--join', 'false',
  '--palette', 'false',
  '--simplify', 'false',
  '--texture-compress', 'false',
  '--texture-size', '2048'
];

for (const [folder, sourceName, outputName] of assets) {
  const input = path.join(root, 'assets', 'source', 'sketchfab', folder, sourceName);
  const processed = path.join(root, 'assets', 'processed', 'sketchfab', folder, outputName);
  const publicFile = path.join(root, 'public', 'models', outputName);
  await mkdir(path.dirname(processed), { recursive: true });
  await mkdir(path.dirname(publicFile), { recursive: true });
  const result = spawnSync(cli, ['optimize', ...commonArgs, input, processed], {
    stdio: 'inherit',
    shell: process.platform === 'win32'
  });
  if (result.status !== 0) throw new Error(`glTF Transform failed for ${folder}`);
  await copyFile(processed, publicFile);
}

console.log(`Processed ${assets.length} downloaded Sketchfab GLBs with hierarchy-preserving quantization.`);
