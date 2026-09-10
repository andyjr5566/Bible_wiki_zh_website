import { z } from 'zod';
import { confidenceSchema, idSchema, referenceSchema } from './shared';

export const characterSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  role: z.enum(['Priest', 'HighPriest', 'LeviteHelper']),
  baseAssetId: idSchema.nullable(),
  defaultGarmentState: z.enum(['daily-priest', 'daily-high-priest', 'atonement-linen', 'post-atonement-garments', 'unspecified']),
  visualPolicy: z.enum(['technical-base-with-label', 'abstract-role-marker']),
  responsibilitySummary: z.array(z.string().min(1)).min(1),
  responsibilityClaimIds: z.array(z.string().regex(/^C-[A-Z0-9-]+$/)).min(1),
  navigation: z.object({
    spawnLocationId: idSchema,
    routeLocationIds: z.array(idSchema),
    movementProfile: z.enum(['stationary', 'ritual-route', 'ambient-route']),
  }),
  animations: z.object({ idle: z.string(), walk: z.string(), ritual: z.record(z.string()) }),
  scriptureReferences: z.array(referenceSchema),
  garments: z.array(z.object({
    slot: z.enum(['Ephod', 'Breastpiece', 'TurbanMiter', 'Robe', 'Tunic', 'GoldPlate', 'Sash', 'LinenBreeches', 'Headdress']),
    assetId: idSchema.nullable(),
    confidence: confidenceSchema,
  })),
});

export const charactersSchema = z.object({ characters: z.array(characterSchema) });
