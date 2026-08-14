import { z } from 'zod';
import { idSchema, referenceSchema } from './shared';

export const scriptureSchema = z.object({
  id: referenceSchema,
  book: z.enum(['Exodus', 'Leviticus', 'Numbers', 'Hebrews']),
  chapter: z.number().int().positive(),
  verses: z.string().min(1),
  summary: z.string().min(1),
  annotation: z.string().min(1),
  originalText: z.string().min(1),
  context: z.enum(['design', 'construction', 'placement', 'service', 'reflection']),
  sourceUrl: z.string().url(),
  links: z.object({
    objectIds: z.array(idSchema),
    ritualIds: z.array(idSchema),
    locationIds: z.array(idSchema),
    characterIds: z.array(idSchema),
  }),
});

export const scripturesSchema = z.object({ passages: z.array(scriptureSchema) });
