import { z } from 'zod';

export const PlatformEnum = z.enum(['MT5', 'BINANCE', 'BYBIT']);
export type Platform = z.infer<typeof PlatformEnum>;

export const TradeDirectionEnum = z.enum(['BUY', 'SELL']);
export type TradeDirection = z.infer<typeof TradeDirectionEnum>;

export const TradeSourceEnum = z.enum(['MT5_WEBHOOK', 'MT5_IMPORT', 'MANUAL']);
export type TradeSource = z.infer<typeof TradeSourceEnum>;

export const SyncStatusEnum = z.enum(['SUCCESS', 'PARTIAL', 'FAILED']);
export type SyncStatus = z.infer<typeof SyncStatusEnum>;
