import assetsJson from './assets.json';
import charactersJson from './characters.json';
import garmentsJson from './garments.json';
import roleCostumesJson from './role-costumes.json';
import offeringsJson from './offerings.json';
import dimensionsJson from './dimensions.json';
import assetPartsJson from './asset-parts.json';
import evidenceJson from './evidence.json';
import locationsJson from './locations.json';
import objectDetailsJson from './object-details.json';
import ritualsJson from './rituals.json';
import scripturesJson from './scriptures.json';
import scriptureExcerptsJson from './scripture-excerpts.json';
import tabernacleJson from './tabernacle.json';
import toursJson from './tours.json';
import { assetsSchema } from './schemas/assets';
import { charactersSchema } from './schemas/characters';
import { garmentsSchema, roleCostumesSchema } from './schemas/garments';
import { offeringsSchema } from './schemas/offerings';
import { dimensionSpecsSchema } from './schemas/dimensions';
import { assetPartsSchema } from './schemas/assetParts';
import { evidenceSchema } from './schemas/evidence';
import { worldSchema } from './schemas/locations';
import { objectDetailsSchema } from './schemas/objectDetails';
import { ritualsSchema } from './schemas/rituals';
import { scripturesSchema } from './schemas/scriptures';
import { scriptureExcerptsSchema } from './schemas/scriptureEvidence';
import { tabernacleSchema } from './schemas/tabernacle';
import { toursSchema } from './schemas/tours';
import { assertProjectDataIntegrity } from './validateProjectData';

export function loadProjectData() {
  const data = {
    assets: assetsSchema.parse(assetsJson),
    characters: charactersSchema.parse(charactersJson),
    garments: garmentsSchema.parse(garmentsJson),
    roleCostumes: roleCostumesSchema.parse(roleCostumesJson),
    offerings: offeringsSchema.parse(offeringsJson),
    dimensions: dimensionSpecsSchema.parse(dimensionsJson),
    assetParts: assetPartsSchema.parse(assetPartsJson),
    evidence: evidenceSchema.parse(evidenceJson),
    world: worldSchema.parse(locationsJson),
    objectDetails: objectDetailsSchema.parse(objectDetailsJson),
    rituals: ritualsSchema.parse(ritualsJson),
    scriptures: scripturesSchema.parse(scripturesJson),
    scriptureExcerpts: scriptureExcerptsSchema.parse(scriptureExcerptsJson),
    tabernacle: tabernacleSchema.parse(tabernacleJson),
    tours: toursSchema.parse(toursJson),
  };
  assertProjectDataIntegrity(data);
  return data;
}

export type ProjectData = ReturnType<typeof loadProjectData>;
