import { Prisma, SyncStatus, TradeDirection, TradeSource } from '@prisma/client';
import Decimal from 'decimal.js';
import { PrismaService } from '../prisma/prisma.service';
import { NormalizedTradeInput } from './interfaces/trade-ingestion-adapter.interface';
import { TradeIngestionService } from './ingestion.service';

describe('TradeIngestionService', () => {
  const buildNormalizedTrade = (overrides: Partial<NormalizedTradeInput> = {}): NormalizedTradeInput => ({
    externalId: 'pos-1001',
    symbol: 'XAUUSD',
    direction: TradeDirection.BUY,
    volume: new Decimal('1.00'),
    openTime: new Date('2026-05-10T08:00:00.000Z'),
    closeTime: new Date('2026-05-10T09:00:00.000Z'),
    holdingSeconds: 3600,
    openPrice: new Decimal('2500.00'),
    closePrice: new Decimal('2520.00'),
    stopLoss: new Decimal('2500.00'), // moved to BE
    takeProfit: new Decimal('2530.00'),
    initialStopLoss: new Decimal('2490.00'),
    initialRiskAmount: new Decimal('1000.00'),
    grossPnl: new Decimal('2000.00'),
    commission: new Decimal('-7.00'),
    swap: new Decimal('0.00'),
    netPnl: new Decimal('1993.00'),
    rawPayload: { test: true },
    ...overrides,
  });

  it('preserves user note, tags, and manual risk fields on idempotent re-sync', async () => {
    const updateCalls: Array<{ where: unknown; data: Record<string, unknown> }> = [];
    const createCalls: Array<{ data: Record<string, unknown> }> = [];

    const existingTrade = {
      id: 'trade-1',
      accountId: 'acc-1',
      externalId: 'pos-1001',
      isManualRisk: true,
      initialStopLoss: new Prisma.Decimal('2495.00000000'),
      initialRiskAmount: new Prisma.Decimal('500.00'),
      stopLoss: new Prisma.Decimal('2500.00000000'),
      takeProfit: new Prisma.Decimal('2530.00000000'),
      note: 'Tier SSS setup - clean liquidity sweep',
    };

    const mockTx = {
      trade: {
        create: jest.fn(async (args) => {
          createCalls.push(args);
          return args.data;
        }),
        update: jest.fn(async (args) => {
          updateCalls.push(args);
          return args.data;
        }),
      },
    };

    const mockPrisma = {
      trade: {
        findMany: jest.fn(async () => [existingTrade]),
      },
      $transaction: jest.fn(async (fn: (tx: typeof mockTx) => Promise<void>) => fn(mockTx)),
      syncLog: {
        create: jest.fn(async () => ({ id: 'log-1' })),
      },
    } as unknown as PrismaService;

    const service = new TradeIngestionService(mockPrisma);

    const summary = await service.ingestTrades([buildNormalizedTrade()], {
      accountId: 'acc-1',
      source: TradeSource.MT5_WEBHOOK,
    });

    expect(summary.status).toBe(SyncStatus.SUCCESS);
    expect(summary.insertedCount).toBe(0);
    expect(summary.updatedCount).toBe(1);
    expect(createCalls).toHaveLength(0);
    expect(updateCalls).toHaveLength(1);

    const updateData = updateCalls[0].data;
    // Must NEVER overwrite note, tags, or manual initialStopLoss / initialRiskAmount
    expect(updateData.note).toBeUndefined();
    expect(updateData.tags).toBeUndefined();
    expect(updateData.initialStopLoss).toBeUndefined();
    expect(updateData.initialRiskAmount).toBeUndefined();
    // Should recompute rMultiple using preserved manual initialRiskAmount (1993 / 500 = 3.9860)
    expect((updateData.rMultiple as Prisma.Decimal).toFixed(4)).toBe('3.9860');
  });

  it('inserts new trade with computed R-Multiple when externalId does not exist', async () => {
    const createCalls: Array<{ data: Record<string, unknown> }> = [];
    const mockTx = {
      trade: {
        create: jest.fn(async (args) => {
          createCalls.push(args);
          return args.data;
        }),
        update: jest.fn(),
      },
    };

    const mockPrisma = {
      trade: {
        findMany: jest.fn(async () => []),
      },
      $transaction: jest.fn(async (fn: (tx: typeof mockTx) => Promise<void>) => fn(mockTx)),
      syncLog: {
        create: jest.fn(async () => ({ id: 'log-2' })),
      },
    } as unknown as PrismaService;

    const service = new TradeIngestionService(mockPrisma);
    const summary = await service.ingestTrades([buildNormalizedTrade()], {
      accountId: 'acc-1',
      source: TradeSource.MT5_WEBHOOK,
    });

    expect(summary.insertedCount).toBe(1);
    expect(summary.updatedCount).toBe(0);
    expect(createCalls).toHaveLength(1);
    // 1993 / 1000 = 1.9930R
    expect((createCalls[0].data.rMultiple as Prisma.Decimal).toFixed(4)).toBe('1.9930');
  });
});
