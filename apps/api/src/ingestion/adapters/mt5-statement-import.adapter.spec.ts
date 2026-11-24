import { TradeDirection } from '@prisma/client';
import { Mt5StatementImportAdapter } from './mt5-statement-import.adapter';

const SAMPLE_MT5_HTML = `<!DOCTYPE html>
<html>
<head><title>Trade History Report</title></head>
<body>
<table>
  <tr><th colspan="14"><b>Positions</b></th></tr>
  <tr>
    <td>Time</td>
    <td>Position</td>
    <td>Symbol</td>
    <td>Type</td>
    <td class="hidden">Comment</td>
    <td>Volume</td>
    <td>Price</td>
    <td>S / L</td>
    <td>T / P</td>
    <td>Time</td>
    <td>Price</td>
    <td>Commission</td>
    <td>Swap</td>
    <td>Profit</td>
  </tr>
  <tr>
    <td>2026.01.15 10:00:00</td>
    <td>100001</td>
    <td>XAUUSD</td>
    <td>buy</td>
    <td class="hidden">ea_comment</td>
    <td>0.50 / 0.50</td>
    <td>2650.50</td>
    <td>2640.50</td>
    <td>2680.50</td>
    <td>2026.01.15 11:30:00</td>
    <td>2675.50</td>
    <td>-3.50</td>
    <td>0.00</td>
    <td>1 250.00</td>
  </tr>
  <tr>
    <td>2026.07.15 10:00:00</td>
    <td>100002</td>
    <td>EURUSD</td>
    <td>sell</td>
    <td class="hidden"></td>
    <td>1.00</td>
    <td>1.09500</td>
    <td>1.09800</td>
    <td>1.08900</td>
    <td>2026.07.15 10:10:00</td>
    <td>1.09700</td>
    <td>-7.00</td>
    <td>-1.25</td>
    <td>-200.00</td>
  </tr>
  <tr>
    <td>2026.07.15 12:00:00</td>
    <td>100003</td>
    <td></td>
    <td>balance</td>
    <td class="hidden"></td>
    <td></td>
    <td></td>
    <td></td>
    <td></td>
    <td></td>
    <td></td>
    <td></td>
    <td></td>
    <td>5000.00</td>
  </tr>
  <tr><th colspan="14"><b>Orders</b></th></tr>
  <tr>
    <td>2026.07.16 09:00:00</td>
    <td>999999</td>
    <td>GBPUSD</td>
    <td>buy</td>
    <td>1.00</td>
    <td>1.30000</td>
    <td>0</td>
    <td>0</td>
    <td>2026.07.16 10:00:00</td>
    <td>1.30500</td>
    <td>0</td>
    <td>0</td>
    <td>500.00</td>
  </tr>
</table>
</body>
</html>`;

describe('Mt5StatementImportAdapter', () => {
  const adapter = new Mt5StatementImportAdapter();

  it('parses UTF-16LE (with BOM) MT5 HTML Positions table with DST Europe/Athens timezone conversion', async () => {
    const utf16Payload = Buffer.concat([
      Buffer.from([0xff, 0xfe]),
      Buffer.from(SAMPLE_MT5_HTML, 'utf16le'),
    ]);

    const result = await adapter.parse(
      { buffer: utf16Payload, fileName: 'ReportHistory-12345.html' },
      { brokerTimezone: 'Europe/Athens' },
    );

    // Should parse only the 2 buy/sell positions, skip balance row, and stop before Orders section
    expect(result.trades).toHaveLength(2);
    expect(result.skippedRows).toBe(1);

    const winterTrade = result.trades[0];
    expect(winterTrade.externalId).toBe('100001');
    expect(winterTrade.symbol).toBe('XAUUSD');
    expect(winterTrade.direction).toBe(TradeDirection.BUY);
    expect(winterTrade.volume.toFixed(2)).toBe('0.50');
    // Jan 15 in Europe/Athens is UTC+2 -> 10:00 local == 08:00Z
    expect(winterTrade.openTime.toISOString()).toBe('2026-01-15T08:00:00.000Z');
    expect(winterTrade.closeTime.toISOString()).toBe('2026-01-15T09:30:00.000Z');
    expect(winterTrade.holdingSeconds).toBe(5400);
    expect(winterTrade.grossPnl.toFixed(2)).toBe('1250.00');
    expect(winterTrade.commission.toFixed(2)).toBe('-3.50');
    expect(winterTrade.netPnl.toFixed(2)).toBe('1246.50');

    const summerTrade = result.trades[1];
    expect(summerTrade.externalId).toBe('100002');
    expect(summerTrade.symbol).toBe('EURUSD');
    expect(summerTrade.direction).toBe(TradeDirection.SELL);
    // Jul 15 in Europe/Athens is UTC+3 -> 10:00 local == 07:00Z
    expect(summerTrade.openTime.toISOString()).toBe('2026-07-15T07:00:00.000Z');
    expect(summerTrade.closeTime.toISOString()).toBe('2026-07-15T07:10:00.000Z');
    expect(summerTrade.netPnl.toFixed(2)).toBe('-208.25');
  });

  it('parses UTF-8 HTML report with fixed broker offset UTC+2', async () => {
    const utf8Buffer = Buffer.from(SAMPLE_MT5_HTML, 'utf-8');

    const result = await adapter.parse(
      { buffer: utf8Buffer, fileName: 'report.htm' },
      { brokerTimezone: 'UTC+2' },
    );

    expect(result.trades).toHaveLength(2);
    // Fixed UTC+2 does not apply DST on Jul 15 -> 10:00 local == 08:00Z
    expect(result.trades[1].openTime.toISOString()).toBe('2026-07-15T08:00:00.000Z');
  });

  it('parses CSV fallback with exact Decimal values', async () => {
    const csv = [
      'Position,Symbol,Type,Volume,Open Time,Close Time,Open Price,Close Price,S/L,T/P,Commission,Swap,Profit',
      '55501,BTCUSD,buy,0.10,2026.05.01 14:00:00,2026.05.01 15:00:00,65000.50,66000.50,64500.50,67000.50,-5.00,0,100.00',
    ].join('\n');

    const result = await adapter.parse(
      { buffer: Buffer.from(csv, 'utf-8'), fileName: 'mt5_trades.csv' },
      { brokerTimezone: 'UTC+3' },
    );

    expect(result.trades).toHaveLength(1);
    expect(result.trades[0].externalId).toBe('55501');
    expect(result.trades[0].openTime.toISOString()).toBe('2026-05-01T11:00:00.000Z');
    expect(result.trades[0].netPnl.toFixed(2)).toBe('95.00');
  });
});
