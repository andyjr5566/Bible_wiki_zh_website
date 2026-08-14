import { z } from 'zod';
import { confidenceSchema, idSchema, referenceSchema } from './shared';

export const characterSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  role: z.enum(['Priest', 'HighPriest', 'LeviteHelper']),
  baseAssetId: idSchema.nullable(),
  navigation: z.object({
    spawnLocationId: idSchema,
    routeLocationIds: z.array(idSchema),
    movementProfile: z.enum(['stationary', 'ritual-route', 'ambient-route']),
  }),
  animations: z.object({ idle: z.string(), walk: z.string(), ritual: z.record(z.string()) }),
  scriptureReferences: z.array(referenceSchema),
  garments: z.array(z.object({
    slot: z.enum(['Ephod', 'Breastpiece', 'TurbanMiter', 'Robe', 'Tunic', 'GoldPlate']),
    assetId: idSchema.nullable(),
    confidence: confidenceSchema,
  })),
});

export const charactersSchema = z.object({ characters: z.array(characterSchema) });
