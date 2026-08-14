import { z } from 'zod';
import { confidenceSchema, idSchema, referenceSchema } from './shared';

const stepSchema = z.object({
  id: idSchema,
  order: z.number().int().positive(),
  title: z.string().min(1),
  instruction: z.string().min(1),
  confidence: confidenceSchema,
  objectIds: z.array(idSchema),
  characterIds: z.array(idSchema),
  scriptureReferences: z.array(referenceSchema),
  playbackHook: z.string().min(1),
  uiHook: z.string().min(1),
});

export const ritualSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  type: z.enum(['washing', 'burnt-offering', 'incense', 'lamp-care', 'shewbread', 'atonement-entry']),
  locationId: idSchema,
  confidence: confidenceSchema,
  trigger: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('interaction'), objectId: idSchema }),
    z.object({ kind: z.literal('learning-mode'), locationId: idSchema }),
  ]),
  steps: z.array(stepSchema).min(1),
});

export const ritualsSchema = z.object({ rituals: z.array(ritualSchema) });
