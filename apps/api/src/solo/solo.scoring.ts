import Decimal from 'decimal.js';

export interface ScoringTrade {
  closeTime: Date;
  netPnl: Decimal.Value;
}

export interface CurvePoint {
  unixTime: number;
  roiPct: number;
}

export interface ParticipantScore {
  netPnl: Decimal;
  roiPct: Decimal;
  tradeCount: number;
  winRate: number;
  maxDrawdownPct: number;
  curve: CurvePoint[];
}

/**
 * Điểm = (lãi/lỗ đã chốt + lãi/lỗ đang thả nổi) / vốn chung.
 * `floating` chỉ có khi kèo đang chạy; lúc chốt sổ mọi lệnh đã bị đóng nên floating = 0.
 */
export function scoreTrades(
  closed: ScoringTrade[],
  startingCapital: Decimal.Value,
  start: Date,
  floating?: { pnl: Decimal.Value; at: Date },
): ParticipantScore {
  const capital = new Decimal(startingCapital);
  const sorted = [...closed].sort((a, b) => a.closeTime.getTime() - b.closeTime.getTime());
  const roi = (pnl: Decimal) => pnl.div(capital).mul(100);

  let netPnl = new Decimal(0);
  let peak = capital;
  let maxDd = new Decimal(0);
  let wins = 0;
  const curve: CurvePoint[] = [{ unixTime: Math.floor(start.getTime() / 1000), roiPct: 0 }];

  const step = (pnlAfter: Decimal, at: Date) => {
    const equity = capital.plus(pnlAfter);
    if (equity.gt(peak)) peak = equity;
    const dd = peak.gt(0) ? peak.minus(equity).div(peak).mul(100) : new Decimal(0);
    if (dd.gt(maxDd)) maxDd = dd;
    curve.push({ unixTime: Math.floor(at.getTime() / 1000), roiPct: roi(pnlAfter).toDecimalPlaces(2).toNumber() });
  };

  for (const t of sorted) {
    const net = new Decimal(t.netPnl);
    if (net.gt(0)) wins += 1;
    netPnl = netPnl.plus(net);
    step(netPnl, t.closeTime);
  }

  const total = floating ? netPnl.plus(floating.pnl) : netPnl;
  if (floating) step(total, floating.at);

  return {
    netPnl: total,
    roiPct: roi(total).toDecimalPlaces(4),
    tradeCount: sorted.length,
    winRate: sorted.length ? Number(((wins / sorted.length) * 100).toFixed(2)) : 0,
    maxDrawdownPct: maxDd.toDecimalPlaces(2).toNumber(),
    curve,
  };
}

/** Trả về index người thắng (0/1) theo ROI%, null nếu hoà. */
export function pickWinner(a: ParticipantScore, b: ParticipantScore): 0 | 1 | null {
  const cmp = a.roiPct.comparedTo(b.roiPct);
  return cmp === 0 ? null : cmp > 0 ? 0 : 1;
}
