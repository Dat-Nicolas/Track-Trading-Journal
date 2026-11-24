'use client';

import * as React from 'react';
import { Globe, RefreshCw, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { SegmentedControl } from '@/components/ui/segmented-control';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DISPLAY_TIMEZONE_PRESETS,
  formatCompactCurrency,
  getShortTimezoneLabel,
} from '@/lib/format';
import { cn } from '@/lib/utils';
import { type DatePreset, useGlobalFilters } from './filter-context';

const ALL_ACCOUNTS_VAL = '__all__';

const PRESET_OPTIONS: Array<{ value: Exclude<DatePreset, 'custom'>; label: string }> = [
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
  { value: '90d', label: '90D' },
  { value: 'ytd', label: 'YTD' },
  { value: 'all', label: 'All' },
];

export function GlobalTopbar() {
  const {
    accounts,
    filters,
    datePreset,
    isRefreshing,
    setFilters,
    applyDatePreset,
    setCustomDateRange,
    triggerGlobalRefresh,
    selectedAccount,
    activeAccountCurrency,
    totalPortfolioEquity,
  } = useGlobalFilters();

  const currentAccountVal = filters.accountId || ALL_ACCOUNTS_VAL;
  const activeTimezone = filters.timezone || 'Asia/Ho_Chi_Minh';
  const shortTz = getShortTimezoneLabel(activeTimezone);

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-white/[0.08] bg-[#09090B]/90 px-4 backdrop-blur-md lg:px-6">
      {/* Left: Global Account Switcher */}
      <div className="flex min-w-0 items-center gap-2.5">
        <Select
          value={currentAccountVal}
          onValueChange={(val) =>
            setFilters((prev) => ({
              ...prev,
              accountId: val === ALL_ACCOUNTS_VAL ? '' : val,
            }))
          }
        >
          <SelectTrigger
            aria-label="Chọn tài khoản giao dịch"
            className="h-8 w-[210px] sm:w-[245px]"
          >
            <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-1.5">
                <Wallet className="h-3.5 w-3.5 shrink-0 text-indigo-400" />
                <span className="truncate text-[12.5px] font-medium text-zinc-100">
                  {selectedAccount
                    ? selectedAccount.name
                    : `Tất cả tài khoản (${accounts.length})`}
                </span>
              </span>
              <span className="font-num shrink-0 rounded bg-white/[0.06] px-1.5 py-0.5 text-[11px] text-zinc-300">
                {formatCompactCurrency(
                  selectedAccount ? selectedAccount.currentEquity : totalPortfolioEquity,
                  activeAccountCurrency,
                )}
              </span>
            </div>
          </SelectTrigger>
          <SelectContent className="w-[290px]">
            <SelectItem value={ALL_ACCOUNTS_VAL}>
              <div className="flex w-full items-center justify-between gap-3">
                <span className="font-medium">Tất cả tài khoản ({accounts.length})</span>
                <span className="font-num text-[11px] text-zinc-400">
                  {formatCompactCurrency(totalPortfolioEquity, activeAccountCurrency)}
                </span>
              </div>
            </SelectItem>
            {accounts.length > 0 && <SelectSeparator />}
            {accounts.map((acc) => (
              <SelectItem key={acc.id} value={acc.id}>
                <div className="flex w-full items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-zinc-100">{acc.name}</p>
                    <p className="font-num text-[10.5px] text-zinc-500">#{acc.accountNumber}</p>
                  </div>
                  <span className="font-num shrink-0 text-[11.5px] text-zinc-300">
                    {formatCompactCurrency(acc.currentEquity, acc.currency)}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Right: Single-row Date Presets + Custom Range + Timezone + Refresh */}
      <div className="flex shrink-0 items-center gap-2 overflow-x-auto">
        <SegmentedControl
          options={PRESET_OPTIONS}
          value={datePreset === 'custom' ? ('all' as Exclude<DatePreset, 'custom'>) : datePreset}
          onChange={applyDatePreset}
          className={cn(datePreset === 'custom' && '[&_button]:text-zinc-400 [&_button]:bg-transparent [&_button]:shadow-none')}
        />

        <DateRangePicker
          from={filters.from ?? ''}
          to={filters.to ?? ''}
          onChange={setCustomDateRange}
        />

        <Select
          value={activeTimezone}
          onValueChange={(val) => setFilters((prev) => ({ ...prev, timezone: val }))}
        >
          <SelectTrigger aria-label="Múi giờ hiển thị" className="h-8 w-[96px] shrink-0">
            <div className="flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
              <SelectValue>{shortTz}</SelectValue>
            </div>
          </SelectTrigger>
          <SelectContent className="w-[195px]" align="end">
            {DISPLAY_TIMEZONE_PRESETS.map((tz) => (
              <SelectItem key={tz.value} value={tz.value}>
                <div className="flex w-full items-center justify-between gap-2">
                  <span>{tz.label}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="secondary"
              aria-label="Làm mới dữ liệu"
              onClick={() => void triggerGlobalRefresh()}
            >
              <RefreshCw
                className={cn('h-3.5 w-3.5 text-zinc-300', isRefreshing && 'animate-spin text-indigo-400')}
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Làm mới dữ liệu</TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
}
