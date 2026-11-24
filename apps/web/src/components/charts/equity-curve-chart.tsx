'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  ColorType,
  createChart,
  LineStyle,
  type IChartApi,
  type UTCTimestamp,
} from 'lightweight-charts';
import { TrendingUp, Upload, Wallet } from 'lucide-react';
import type { EquityCurvePoint } from '@trackdailytrade/shared';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, formatDateTimeInTz, pnlColorClass } from '@/lib/format';

interface EquityCurveChartProps {
  startingEquity: string;
  points: EquityCurvePoint[];
  currency: string;
  timezone: string;
  loading?: boolean;
}

export function EquityCurveChart({
  startingEquity,
  points,
  currency,
  timezone,
  loading = false,
}: EquityCurveChartProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [hovered, setHovered] = React.useState<EquityCurvePoint | null>(null);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el || points.length === 0) return;

    const chart: IChartApi = createChart(el, {
      layout: {
        background: { type: ColorType.Solid, color: '#111216' },
        textColor: '#71717A',
        fontFamily: '"JetBrains Mono", ui-monospace, SFMono-Regular, monospace',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.05)', style: LineStyle.Dashed },
        horzLines: { color: 'rgba(255, 255, 255, 0.05)', style: LineStyle.Dashed },
      },
      crosshair: {
        vertLine: {
          color: 'rgba(99, 102, 241, 0.5)',
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: '#16181D',
        },
        horzLine: {
          color: 'rgba(99, 102, 241, 0.5)',
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: '#16181D',
        },
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.08)',
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.08)',
        timeVisible: true,
        secondsVisible: false,
      },
      width: el.clientWidth,
      height: 310,
    });

    const lastEquity = Number(points[points.length - 1].equity);
    const startEq = Number(startingEquity);
    const isPositive = lastEquity >= startEq;

    const series = chart.addAreaSeries({
      lineColor: isPositive ? '#10B981' : '#F43F5E',
      topColor: isPositive ? 'rgba(16, 185, 129, 0.24)' : 'rgba(244, 63, 94, 0.24)',
      bottomColor: isPositive ? 'rgba(16, 185, 129, 0.0)' : 'rgba(244, 63, 94, 0.0)',
      lineWidth: 2,
      priceFormat: {
        type: 'price',
        precision: 2,
        minMove: 0.01,
      },
    });

    const timeToPoint = new Map<number, EquityCurvePoint>();
    let prevTs = 0;
    const seriesData = points.map((p) => {
      let ts = p.unixTime;
      if (ts <= prevTs) ts = prevTs + 1;
      prevTs = ts;
      timeToPoint.set(ts, p);
      return {
        time: ts as UTCTimestamp,
        value: Number(p.equity),
      };
    });

    series.setData(seriesData);

    series.createPriceLine({
      price: startEq,
      color: 'rgba(255, 255, 255, 0.22)',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: 'Khởi đầu',
    });

    chart.timeScale().fitContent();

    chart.subscribeCrosshairMove((param) => {
      if (!param.time || typeof param.time !== 'number') {
        setHovered(null);
        return;
      }
      setHovered(timeToPoint.get(param.time) ?? null);
    });

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          chart.applyOptions({ width: entry.contentRect.width });
        }
      }
    });
    resizeObserver.observe(el);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
  }, [points, startingEquity]);

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="flex gap-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-28" />
        </div>
        <Skeleton className="h-[310px] w-full rounded-lg" />
      </div>
    );
  }

  if (points.length === 0) {
    return (
      <div className="flex h-[310px] flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.1] bg-[#0B0C0F]/60 px-6 text-center">
        <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03] text-zinc-400">
          <TrendingUp className="h-5 w-5" />
        </div>
        <p className="mt-3 text-sm font-medium text-zinc-200">
          Chưa có dữ liệu Equity Curve trong giai đoạn này
        </p>
        <p className="mt-1 max-w-md text-xs text-zinc-500">
          Nhập báo cáo lịch sử MT5 hoặc kết nối EA Webhook để tự động vẽ biểu đồ tăng trưởng vốn và
          theo dõi Drawdown theo thời gian thực.
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <Link href="/import">
            <Button size="sm">
              <Upload className="h-3.5 w-3.5" />
              Import báo cáo MT5
            </Button>
          </Link>
          <Link href="/accounts">
            <Button size="sm" variant="secondary">
              <Wallet className="h-3.5 w-3.5" />
              Quản lý tài khoản
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const activePoint = hovered ?? points[points.length - 1];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 rounded-lg border border-white/[0.06] bg-[#16181D]/60 px-3.5 py-2 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="text-zinc-500">Thời điểm</span>
          <span className="font-num text-zinc-200">
            {formatDateTimeInTz(activePoint.timestamp, timezone)}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-zinc-500">Equity</span>
          <span className="font-num font-semibold text-white">
            {formatCurrency(activePoint.equity, currency)}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-zinc-500">Lệnh</span>
          <span className={`font-num font-semibold ${pnlColorClass(activePoint.netPnl)}`}>
            {formatCurrency(activePoint.netPnl, currency, true)}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-zinc-500">Drawdown</span>
          <span className="font-num text-rose-400">
            -{formatCurrency(activePoint.drawdownUsd, currency)} ({activePoint.drawdownPct.toFixed(2)}%)
          </span>
        </div>
      </div>
      <div ref={containerRef} className="w-full overflow-hidden rounded-lg" />
    </div>
  );
}
