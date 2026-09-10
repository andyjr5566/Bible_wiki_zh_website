import { z } from 'zod';
import { idSchema, vector3Schema } from './shared';

const specSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  status: z.enum(['verified', 'unresolved']),
  center: vector3Schema,
  sizeCubits: z.object({ x: z.number().positive(), y: z.number().positive(), z: z.number().positive() }).nullable(),
  customLabels: z.object({ length: z.string().min(1).optional(), height: z.string().min(1).optional(), width: z.string().min(1).optional() }).optional(),
});
export const dimensionSpecsSchema = z.object({ specs: z.array(specSchema).min(1) });
