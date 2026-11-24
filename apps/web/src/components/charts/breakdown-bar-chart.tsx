'use client';

import * as React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { BreakdownBucket } from '@trackdailytrade/shared';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/format';

interface BreakdownBarChartProps {
  data: BreakdownBucket[];
  currency: string;
  hideZeroBuckets?: boolean;
  loading?: boolean;
}

export function BreakdownBarChart({
  data,
  currency,
  hideZeroBuckets = false,
  loading = false,
}: BreakdownBarChartProps) {
  const chartData = React.useMemo(() => {
    const filtered = hideZeroBuckets ? data.filter((d) => d.tradeCount > 0) : data;
    return filtered.map((d) => ({
      ...d,
      netPnlNum: Number(d.netPnl),
    }));
  }, [data, hideZeroBuckets]);

  if (loading) {
    return <Skeleton className="h-[260px] w-full rounded-lg" />;
  }

  if (chartData.length === 0 || chartData.every((d) => d.tradeCount === 0)) {
    return (
      <div className="flex h-[250px] items-center justify-center rounded-xl border border-dashed border-white/[0.08] bg-[#0B0C0F]/50 text-xs text-zinc-500">
        Chưa có dữ liệu giao dịch cho phân nhóm này.
      </div>
    );
  }

  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 10, right: 12, left: 0, bottom: 2 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(255, 255, 255, 0.05)"
            vertical={false}
          />
          <XAxis
            dataKey="label"
            tick={{ fill: '#71717A', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
            axisLine={{ stroke: 'rgba(255, 255, 255, 0.08)' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#71717A', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `$${v}`}
            width={58}
          />
          <ReferenceLine y={0} stroke="rgba(255, 255, 255, 0.16)" />
          <Tooltip
            cursor={{ fill: 'rgba(255, 255, 255, 0.04)' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const item = payload[0].payload as BreakdownBucket & { netPnlNum: number };
              return (
                <div className="rounded-xl border border-white/[0.1] bg-[#16181D] p-3 text-xs shadow-[0_12px_36px_rgba(0,0,0,0.65)]">
                  <p className="font-semibold text-zinc-100">{item.label}</p>
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-zinc-400">Net PnL</span>
                      <span
                        className={
                          item.netPnlNum >= 0
                            ? 'font-num font-semibold text-emerald-400'
                            : 'font-num font-semibold text-rose-400'
                        }
                      >
                        {formatCurrency(item.netPnl, currency, true)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-zinc-400">Số lệnh</span>
                      <span className="font-num text-zinc-200">
                        {item.tradeCount} ({item.winCount}W / {item.lossCount}L)
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-zinc-400">Win Rate</span>
                      <span className="font-num text-zinc-200">{item.winRate.toFixed(1)}%</span>
                    </div>
                    {item.avgR !== null && (
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-zinc-400">Avg R</span>
                        <span className="font-num text-zinc-200">
                          {item.avgR >= 0 ? `+${item.avgR}` : item.avgR}R
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            }}
          />
          <Bar dataKey="netPnlNum" radius={[4, 4, 0, 0]} maxBarSize={38}>
            {chartData.map((entry) => (
              <Cell
                key={entry.key}
                fill={entry.netPnlNum >= 0 ? '#10B981' : '#F43F5E'}
                fillOpacity={0.85}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
