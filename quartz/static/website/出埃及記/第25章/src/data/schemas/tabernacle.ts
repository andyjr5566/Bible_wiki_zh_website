import { z } from 'zod';
import { confidenceSchema, idSchema, referenceSchema, vector3Schema } from './shared';

export const tabernacleSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  purpose: z.string().min(1),
  objects: z.array(z.object({
    id: idSchema,
    name: z.string().min(1),
    locationId: idSchema,
    assetId: idSchema.nullable(),
    interactionPosition: vector3Schema,
    confidence: confidenceSchema,
    scriptureReferences: z.array(referenceSchema),
    interactable: z.boolean(),
  })),
});
