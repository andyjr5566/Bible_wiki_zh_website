/** 3D 模型的署名。全部來自 Sketchfab，授權 CC BY-NC 4.0；本站為非商業研經用途。 */
export interface Credit {
  file: string;
  title: string;
  author: string;
  url: string;
  note?: string;
}

export const LICENSE = { name: 'CC BY-NC 4.0', url: 'https://creativecommons.org/licenses/by-nc/4.0/' };

export const CREDITS: Credit[] = [
  { file: 'tabernacle-main.glb', title: 'Biblical Tabernacle (Mishkan)', author: 'thedeserttabernacle',
    url: 'https://sketchfab.com/3d-models/biblical-tabernacle-mishkan-41d3c771c13a4cbcbc10353536ffec91' },
  { file: 'ark-alternative.glb', title: 'Ark of the Covenant (alternative)', author: 'thedeserttabernacle',
    url: 'https://sketchfab.com/3d-models/ark-of-the-covenant-alternative-48d613a98e964200932c1395c1d34f68',
    note: '本站把約櫃的材質統一成金色，因為出25:11 說「裡外包上精金」。' },
  { file: 'altar-burnt-offering.glb', title: 'Altar of Burnt Offering of the Tabernacle', author: 'thedeserttabernacle',
    url: 'https://sketchfab.com/3d-models/altar-of-burnt-offering-of-the-tabernacle-bf23feae192b4cd6a4e8d7ca74417099' },
  { file: 'table-shewbread.glb', title: 'Table of Shewbread of the Tabernacle', author: 'thedeserttabernacle',
    url: 'https://sketchfab.com/3d-models/table-of-shewbread-of-the-tabernacle-8464709d407f49f49c55415e246b6fe5' },
  { file: 'lampstand-menorah.glb', title: 'Lampstand (Menorah) of the Tabernacle', author: 'thedeserttabernacle',
    url: 'https://sketchfab.com/3d-models/lampstand-menorah-of-the-tabernacle-5a3ae34b9f744163bb63222577f5e238' },
];
