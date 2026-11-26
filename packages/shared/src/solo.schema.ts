import { z } from 'zod';
import { DecimalStringSchema, NullableDecimalStringSchema } from './webhook.schema';

export const CreateSoloChallengeSchema = z.object({
  title: z.string().trim().max(100).optional(),
  hostName: z.string().trim().min(1).max(40),
  durationMinutes: z.coerce.number().int().min(5).max(60 * 24 * 30),
  startingCapital: DecimalStringSchema.refine((v) => Number(v) > 0, 'Vốn phải > 0'),
  stakeAmount: DecimalStringSchema.default('0'),
  stakeUnit: z.string().trim().min(1).max(20).default('đồng'),
});
export type CreateSoloChallengeInput = z.infer<typeof CreateSoloChallengeSchema>;

export const JoinSoloChallengeSchema = z.object({
  displayName: z.string().trim().min(1).max(40),
});
export type JoinSoloChallengeInput = z.infer<typeof JoinSoloChallengeSchema>;

export const SoloOrderSchema = z.object({
  side: z.enum(['BUY', 'SELL']),
  lots: DecimalStringSchema.refine((v) => Number(v) >= 0.01 && Number(v) <= 100, 'Lot từ 0.01 đến 100'),
  stopLoss: NullableDecimalStringSchema.optional(),
  takeProfit: NullableDecimalStringSchema.optional(),
});
export type SoloOrderInput = z.infer<typeof SoloOrderSchema>;
