import { z } from 'zod';
import { idSchema } from './shared';

const mappingSchema = z.object({
  assetId: idSchema,
  objectId: idSchema,
  parts: z.array(z.object({ partId: idSchema, nodeNames: z.array(z.string().min(1)), status: z.enum(['verified', 'unresolved']) })).min(1),
});
export const assetPartsSchema = z.object({ mappings: z.array(mappingSchema).min(1) });
