import { z } from 'zod';
import { idSchema, vector3Schema } from './shared';

export const assetSchema = z.object({
  id: idSchema,
  kind: z.enum(['model', 'texture', 'audio', 'font']),
  qualityTier: z.enum(['hero', 'detail', 'structural', 'library', 'fallback']),
  runtimePolicy: z.enum(['default', 'on-demand', 'mode-only', 'deferred', 'manual-fallback']),
  usage: z.enum(['world', 'detail', 'structural', 'library', 'fallback']),
  historicalStatus: z.enum(['textual', 'reconstructed', 'illustrative', 'technical-base', 'reference-only']),
  url: z.string().min(1), author: z.string().min(1), sourceUrl: z.string().url(),
  runtimeFile: z.string().min(1), sourceFile: z.string().min(1), processedFile: z.string().min(1),
  license: z.string().min(1), licenseUrl: z.string().url(), downloadAvailable: z.literal(true),
  commercialUse: z.literal(false), downloadDate: z.string().min(10), sha256: z.string().length(64),
  triangleCount: z.number().int().nonnegative(), vertexCount: z.number().int().nonnegative(),
  attribution: z.string().min(1),
  transform: z.object({ position: vector3Schema, rotation: vector3Schema, scale: z.number().positive() }),
});

export const assetsSchema = z.object({ version: z.literal(2), assets: z.array(assetSchema) });
