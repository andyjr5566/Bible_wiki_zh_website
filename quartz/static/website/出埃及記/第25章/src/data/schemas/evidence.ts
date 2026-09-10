import { z } from 'zod';
import { idSchema } from './shared';

const claimIdSchema = z.string().regex(/^C-[A-Z0-9-]+$/);
const sourceIdSchema = z.string().regex(/^S-[A-Z0-9-]+$/);
const evidenceSourceSchema = z.object({
  id: sourceIdSchema,
  title: z.string().min(1),
  sourceType: z.enum(['scripture', 'commentary', 'archaeology', 'asset', 'engineering']),
  date: z.string().min(1),
  scope: z.string().min(1),
  url: z.string().url().nullable(),
  attribution: z.string().min(1),
});
const evidenceClaimSchema = z.object({
  id: claimIdSchema,
  entityId: idSchema,
  statement: z.string().min(1),
  kind: z.enum(['scripture', 'commentary', 'archaeology', 'asset', 'engineering']),
  status: z.enum(['verified', 'unresolved', 'rejected']),
  references: z.array(z.object({ sourceId: sourceIdSchema, locator: z.string().min(1) })).min(1),
  limits: z.array(z.string().min(1)),
});

export const evidenceSchema = z.object({ sources: z.array(evidenceSourceSchema).min(1), claims: z.array(evidenceClaimSchema).min(1) });
