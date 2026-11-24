import { Injectable } from '@nestjs/common';
import { Prisma, TradeDirection, TradeSource } from '@prisma/client';
import Decimal from 'decimal.js';
import { Mt5WebhookTrade } from '@trackdailytrade/shared';
import { toDecimal, toDecimalOrZero } from '../../common/decimal.util';
import { parseBrokerTimeToUtc } from '../../common/timezone.util';
import {
  AdapterContext,
  AdapterParseResult,
  ITradeIngestionAdapter,
  NormalizedTradeInput,
} from '../interfaces/trade-ingestion-adapter.interface';

@Injectable()
export class Mt5WebhookAdapter implements ITradeIngestionAdapter<Mt5WebhookTrade[]> {
  readonly source = TradeSource.MT5_WEBHOOK;

  async parse(
    input: Mt5WebhookTrade[],
    context: AdapterContext,
  ): Promise<AdapterParseResult> {
    const trades: NormalizedTradeInput[] = [];
    const warnings: string[] = [];
    let skippedRows = 0;

    for (const item of input) {
      try {
        const openTime = parseBrokerTimeToUtc(item.openTimeServer, context.brokerTimezone);
        const closeTime = parseBrokerTimeToUtc(item.closeTimeServer, context.brokerTimezone);
        const holdingSeconds = Math.max(
          0,
          Math.floor((closeTime.getTime() - openTime.getTime()) / 1000),
        );

        const volume = toDecimalOrZero(item.volume);
        if (volume.lessThanOrEqualTo(0)) {
          skippedRows += 1;
          warnings.push(`Skipped position ${item.positionId}: non-positive volume`);
          continue;
        }

        const openPrice = toDecimalOrZero(item.openPrice);
        const closePrice = toDecimalOrZero(item.closePrice);
        const stopLoss = toDecimal(item.stopLoss);
        const takeProfit = toDecimal(item.takeProfit);
        const initialStopLoss = toDecimal(item.initialStopLoss);
        const initialRiskAmount = toDecimal(item.initialRiskAmount);

        const grossPnl = toDecimalOrZero(item.grossPnl);
        const commission = toDecimalOrZero(item.commission);
        const swap = toDecimalOrZero(item.swap);
        const netPnl = item.netPnl
          ? toDecimalOrZero(item.netPnl)
          : grossPnl.plus(commission).plus(swap);

        trades.push({
          externalId: item.positionId,
          symbol: item.symbol.toUpperCase(),
          direction: item.direction as TradeDirection,
          volume,
          openTime,
          closeTime,
          holdingSeconds,
          openPrice,
          closePrice,
          stopLoss: stopLoss && !stopLoss.isZero() ? stopLoss : null,
          takeProfit: takeProfit && !takeProfit.isZero() ? takeProfit : null,
          initialStopLoss:
            initialStopLoss && !initialStopLoss.isZero() ? initialStopLoss : null,
          initialRiskAmount:
            initialRiskAmount && initialRiskAmount.greaterThan(0)
              ? initialRiskAmount.abs()
              : null,
          grossPnl,
          commission,
          swap,
          netPnl,
          rawPayload: item as unknown as Prisma.InputJsonValue,
        });
      } catch (err) {
        skippedRows += 1;
        warnings.push(
          `Skipped position ${item.positionId}: ${err instanceof Error ? err.message : 'parse error'}`,
        );
      }
    }

    return { trades, skippedRows, warnings };
  }
}
