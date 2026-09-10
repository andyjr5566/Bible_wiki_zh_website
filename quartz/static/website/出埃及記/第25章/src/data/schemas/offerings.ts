import { z } from 'zod';
import { confidenceSchema, idSchema, referenceSchema } from './shared';

const animalSchema = z.object({
  id: idSchema,
  label: z.string().min(1),
  kind: z.enum(['cattle', 'sheep', 'goat', 'bird']),
  requiredSex: z.enum(['male', 'female', 'unspecified']),
  assetId: idSchema.nullable(),
  representation: z.enum(['model-with-label', 'symbol-with-label']),
  confidence: confidenceSchema,
  sourceClaimIds: z.array(z.string().regex(/^C-[A-Z0-9-]+$/)).min(1),
  scriptureReferences: z.array(referenceSchema).min(1),
  limitations: z.array(z.string().min(1)).min(1),
});

const branchSchema = z.object({
  id: idSchema,
  label: z.string().min(1),
  animalId: idSchema,
  ritualId: idSchema,
  branchKind: z.enum(['cattle', 'sheep', 'goat', 'bird']),
  actorRole: z.enum(['offering-person', 'priest']),
  sourceClaimIds: z.array(z.string().regex(/^C-[A-Z0-9-]+$/)).min(1),
  instruction: z.string().min(1),
});

const comparisonSchema = z.object({
  id: idSchema,
  label: z.string().min(1),
  materials: z.string().min(1),
  purpose: z.string().min(1),
  actorRole: z.enum(['offering-person', 'priest', 'both']),
  location: z.string().min(1),
  handling: z.string().min(1),
  scriptureReferences: z.array(referenceSchema).min(1),
  sourceClaimIds: z.array(z.string().regex(/^C-[A-Z0-9-]+$/)).min(1),
  limitations: z.array(z.string().min(1)).min(1),
});

export const offeringsSchema = z.object({ animals: z.array(animalSchema).min(1), branches: z.array(branchSchema).min(1), comparisons: z.array(comparisonSchema).length(5) });
