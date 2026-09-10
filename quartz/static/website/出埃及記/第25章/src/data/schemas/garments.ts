import { z } from 'zod';
import { confidenceSchema, idSchema, referenceSchema } from './shared';

const garmentStateSchema = z.enum(['daily-priest', 'daily-high-priest', 'atonement-linen', 'post-atonement-garments', 'unspecified']);
const roleSchema = z.enum(['Priest', 'HighPriest', 'LeviteHelper']);

const partSchema = z.object({
  id: idSchema,
  label: z.string().min(1),
  claimedMaterials: z.array(z.string().min(1)).min(1),
  quantity: z.string().min(1),
  function: z.string().min(1),
  sourceClaimIds: z.array(z.string().regex(/^C-[A-Z0-9-]+$/)).min(1),
  scriptureReferences: z.array(referenceSchema).min(1),
  confidence: confidenceSchema,
  assetId: idSchema.nullable(),
  visualPolicy: z.enum(['text-label', 'abstract-marker', 'technical-overlay']),
  unknowns: z.array(z.string().min(1)).min(1),
});

const stateSchema = z.object({
  id: garmentStateSchema,
  label: z.string().min(1),
  role: roleSchema.or(z.literal('unspecified')),
  parts: z.array(partSchema),
  sourceClaimIds: z.array(z.string().regex(/^C-[A-Z0-9-]+$/)).min(1),
  scriptureReferences: z.array(referenceSchema).min(1),
  transitionNote: z.string().min(1),
  unknowns: z.array(z.string().min(1)).min(1),
});

export const garmentsSchema = z.object({ states: z.array(stateSchema).min(1) });

export const roleCostumeSchema = z.object({
  id: idSchema,
  role: roleSchema,
  label: z.string().min(1),
  defaultGarmentState: garmentStateSchema,
  allowedGarmentStates: z.array(garmentStateSchema).min(1),
  forbiddenGarmentStates: z.array(garmentStateSchema),
  responsibilitySummary: z.array(z.string().min(1)).min(1),
  sourceClaimIds: z.array(z.string().regex(/^C-[A-Z0-9-]+$/)).min(1),
  visualPolicy: z.enum(['technical-base-with-label', 'abstract-role-marker']),
  disclosure: z.string().min(1),
});

export const roleCostumesSchema = z.object({ roles: z.array(roleCostumeSchema).min(1) });
