import assetsJson from './assets.json';
import charactersJson from './characters.json';
import locationsJson from './locations.json';
import ritualsJson from './rituals.json';
import scripturesJson from './scriptures.json';
import tabernacleJson from './tabernacle.json';
import { assetsSchema } from './schemas/assets';
import { charactersSchema } from './schemas/characters';
import { worldSchema } from './schemas/locations';
import { ritualsSchema } from './schemas/rituals';
import { scripturesSchema } from './schemas/scriptures';
import { tabernacleSchema } from './schemas/tabernacle';

export function loadProjectData() {
  return {
    assets: assetsSchema.parse(assetsJson),
    characters: charactersSchema.parse(charactersJson),
    world: worldSchema.parse(locationsJson),
    rituals: ritualsSchema.parse(ritualsJson),
    scriptures: scripturesSchema.parse(scripturesJson),
    tabernacle: tabernacleSchema.parse(tabernacleJson),
  };
}

export type ProjectData = ReturnType<typeof loadProjectData>;
