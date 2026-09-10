import { z } from 'zod';
import { idSchema } from './shared';

const excerptSchema = z.object({
  id: idSchema,
  book: z.enum(['Exodus', 'Leviticus', 'Numbers', 'Hebrews']),
  chapter: z.number().int().positive(),
  ranges: z.array(z.object({ startVerse: z.number().int().positive(), endVerse: z.number().int().positive() })).min(1),
  reference: z.string().min(1),
  text: z.string().min(1),
  sourcePath: z.string().min(1),
  sourceSha256: z.string().regex(/^[A-Fa-f0-9]{64}$/),
});

export const scriptureExcerptsSchema = z.object({ version: z.string().min(1), generatedAt: z.string().min(1), excerpts: z.array(excerptSchema).min(1) });
