import { z } from 'zod';

export const idSchema = z.string().min(1).regex(/^[a-z0-9][a-z0-9-]*$/);
export const referenceSchema = z.string().min(3);
export const confidenceSchema = z.enum(['textual', 'strong-inference', 'reconstructed', 'illustrative']);
export const vector3Schema = z.object({ x: z.number(), y: z.number(), z: z.number() });
