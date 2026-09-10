import { z } from 'zod';
import { idSchema, referenceSchema, vector3Schema } from './shared';

const cameraPoseSchema = z.object({ position: vector3Schema, target: vector3Schema, fov: z.number().positive() });
const hotspotSchema = z.object({
  id: idSchema,
  label: z.string().min(1),
  objectId: idSchema,
  scriptureReference: referenceSchema,
  excerptIds: z.array(idSchema).min(1),
  summary: z.string().min(1),
  cameraStart: cameraPoseSchema,
  cameraEnd: cameraPoseSchema,
  durationSeconds: z.number().positive().optional(),
  dimensionTargetId: idSchema.optional(),
});
const tourSchema = z.object({
  id: idSchema,
  order: z.number().int().positive(),
  title: z.string().min(1),
  subtitle: z.string().min(1),
  locationId: idSchema,
  objectId: idSchema.nullable(),
  scriptureReference: referenceSchema,
  excerptIds: z.array(idSchema).min(1),
  summary: z.string().min(1),
  durationSeconds: z.number().positive(),
  cameraStart: cameraPoseSchema,
  cameraEnd: cameraPoseSchema,
  dimensionTargetId: idSchema.optional(),
  peelRoof: z.boolean().optional(),
  hotspots: z.array(hotspotSchema).min(1).optional(),
});

export const toursSchema = z.object({ tours: z.array(tourSchema).min(1) });
