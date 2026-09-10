import { z } from 'zod';
import { confidenceSchema, idSchema, referenceSchema, vector3Schema } from './shared';

const dimensionsSchema = z.object({
  status: z.enum(['verified', 'unresolved']),
  lengthCubits: z.number().positive().nullable(),
  widthCubits: z.number().positive().nullable(),
  heightCubits: z.number().positive().nullable(),
  sourceClaimIds: z.array(z.string().regex(/^C-[A-Z0-9-]+$/)),
  displayNote: z.string().min(1),
});

export const objectDetailSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  locationId: idSchema,
  confidence: confidenceSchema,
  summary: z.string().min(1),
  dimensions: dimensionsSchema,
  materials: z.array(z.string().min(1)),
  parts: z.array(z.object({ id: idSchema, label: z.string().min(1), claimIds: z.array(z.string().regex(/^C-[A-Z0-9-]+$/)) })),
  claimIds: z.array(z.string().regex(/^C-[A-Z0-9-]+$/)).min(1),
  center: vector3Schema,
  scriptureReferences: z.array(referenceSchema).min(1),
});

export const objectDetailsSchema = z.object({ objects: z.array(objectDetailSchema).min(1) });
