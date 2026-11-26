import { ServiceUnavailableException } from '@nestjs/common';
import Decimal from 'decimal.js';

// ponytail: PAXG (1 token = 1 oz vàng) bám sát XAU spot, miễn phí 24/7, không cần API key.
// Muốn giá XAUUSD của sàn thì thay nguồn ở file này.
const BINANCE = 'https://data-api.binance.vision/api/v3';
const SYMBOL = 'PAXGUSDT';

export const CONTRACT_OZ = 100; // 1 lot XAUUSD = 100 oz, giống MT5
export const LEVERAGE = 100;

export type Side = 'BUY' | 'SELL';

export interface Candle {
  openTime: number;
  high: Decimal;
  low: Decimal;
  close: Decimal;
}

let cache: { price: Decimal; at: number } | null = null;

async function binance<T>(path: string): Promise<T> {
  try {
    const res = await fetch(`${BINANCE}${path}`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(String(res.status));
    return (await res.json()) as T;
  } catch {
    throw new ServiceUnavailableException('Không lấy được giá vàng, thử lại sau vài giây');
  }
}

export async function getGoldPrice(): Promise<Decimal> {
  if (cache && Date.now() - cache.at < 1000) return cache.price;
  const { price } = await binance<{ price: string }>(`/ticker/price?symbol=${SYMBOL}`);
  cache = { price: new Decimal(price), at: Date.now() };
  return cache.price;
}

/** Nến 1 phút trong [fromMs, toMs], tự phân trang 1000 nến/lần. */
export async function getCandles(fromMs: number, toMs: number): Promise<Candle[]> {
  const out: Candle[] = [];
  let start = fromMs;
  while (start <= toMs) {
    const rows = await binance<Array<[number, string, string, string, string]>>(
      `/klines?symbol=${SYMBOL}&interval=1m&startTime=${start}&endTime=${toMs}&limit=1000`,
    );
    for (const r of rows) {
      out.push({ openTime: r[0], high: new Decimal(r[2]), low: new Decimal(r[3]), close: new Decimal(r[4]) });
    }
    if (rows.length < 1000) break;
    start = rows[rows.length - 1][0] + 60_000;
  }
  return out;
}

export function positionPnl(side: Side, lots: Decimal.Value, entry: Decimal.Value, exit: Decimal.Value): Decimal {
  const diff = new Decimal(exit).minus(entry);
  return (side === 'BUY' ? diff : diff.neg()).mul(lots).mul(CONTRACT_OZ).toDecimalPlaces(2);
}

export function marginFor(lots: Decimal.Value, price: Decimal.Value): Decimal {
  return new Decimal(lots).mul(price).mul(CONTRACT_OZ).div(LEVERAGE);
}

export interface TriggerCheck {
  side: Side;
  stopLoss: Decimal | null;
  takeProfit: Decimal | null;
}

/** Giá có chạm SL/TP không? Cùng 1 nến chạm cả 2 → tính SL (bảo thủ). */
export function hitLevel(p: TriggerCheck, high: Decimal, low: Decimal): { price: Decimal; reason: 'SL' | 'TP' } | null {
  const buy = p.side === 'BUY';
  if (p.stopLoss && (buy ? low.lte(p.stopLoss) : high.gte(p.stopLoss))) return { price: p.stopLoss, reason: 'SL' };
  if (p.takeProfit && (buy ? high.gte(p.takeProfit) : low.lte(p.takeProfit))) return { price: p.takeProfit, reason: 'TP' };
  return null;
}
