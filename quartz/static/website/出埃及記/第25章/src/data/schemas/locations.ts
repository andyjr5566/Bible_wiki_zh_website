import { z } from 'zod';
import { idSchema, vector3Schema } from './shared';

export const locationSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  zone: z.enum(['outer-court', 'holy-place', 'most-holy-place', 'camp']),
  position: vector3Schema,
  facingRadians: z.number(),
  mapPoint: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }),
});

export const worldSchema = z.object({
  orientation: z.object({ eastAxis: z.literal('+z'), upAxis: z.literal('+y'), unit: z.literal('meter') }),
  bounds: z.object({ minX: z.number(), maxX: z.number(), minZ: z.number(), maxZ: z.number() }),
  spawnLocationId: idSchema,
  locations: z.array(locationSchema).min(1),
});
