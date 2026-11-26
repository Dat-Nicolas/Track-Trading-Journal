import Decimal from 'decimal.js';
import { hitLevel, marginFor, positionPnl } from './gold';
import { pickWinner, scoreTrades } from './solo.scoring';

describe('solo gold', () => {
  const start = new Date('2026-11-26T00:00:00Z');
  const at = (h: number) => new Date(start.getTime() + h * 3600_000);

  it('PnL vàng: 1 lot = 100 oz, SELL ngược dấu, margin theo đòn bẩy 1:100', () => {
    expect(positionPnl('BUY', '0.1', '3500', '3510').toFixed(2)).toBe('100.00');
    expect(positionPnl('SELL', '0.1', '3500', '3510').toFixed(2)).toBe('-100.00');
    expect(marginFor('0.1', '3500').toFixed(2)).toBe('350.00');
  });

  it('SL/TP: BUY chạm SL khi low <= SL, SELL chạm TP khi low <= TP, chạm cả 2 → SL', () => {
    const buy = { side: 'BUY' as const, stopLoss: new Decimal(3490), takeProfit: new Decimal(3520) };
    expect(hitLevel(buy, new Decimal(3505), new Decimal(3495))).toBeNull();
    expect(hitLevel(buy, new Decimal(3505), new Decimal(3489))?.reason).toBe('SL');
    expect(hitLevel(buy, new Decimal(3525), new Decimal(3500))?.reason).toBe('TP');
    expect(hitLevel(buy, new Decimal(3525), new Decimal(3480))?.reason).toBe('SL');
    const sell = { side: 'SELL' as const, stopLoss: null, takeProfit: new Decimal(3480) };
    expect(hitLevel(sell, new Decimal(3500), new Decimal(3479))?.price.toNumber()).toBe(3480);
  });

  it('ROI tính cả lệnh thả nổi, chọn đúng người thắng', () => {
    const dat = scoreTrades(
      [
        { closeTime: at(2), netPnl: '200' },
        { closeTime: at(4), netPnl: '-58' },
      ],
      '1000',
      start,
    );
    expect(dat.roiPct.toFixed(2)).toBe('14.20');
    expect(dat.winRate).toBe(50);
    expect(dat.curve).toHaveLength(3);

    const qa = scoreTrades([{ closeTime: at(1), netPnl: '68' }], '1000', start, { pnl: '-20', at: at(5) });
    expect(qa.netPnl.toFixed(2)).toBe('48.00');
    expect(qa.curve).toHaveLength(3);
    expect(pickWinner(dat, qa)).toBe(0);
    expect(pickWinner(qa, qa)).toBeNull();
  });
});
