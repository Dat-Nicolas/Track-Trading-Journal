'use client';

import * as React from 'react';
import { Check, Lock, Plus, Save, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import {
  Sheet,
  SheetCloseButton,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { api, type TagDto, type TradeDto } from '@/lib/api';
import {
  formatCurrency,
  formatDateTimeInTz,
  formatDuration,
  getShortTimezoneLabel,
  pnlColorClass,
} from '@/lib/format';
import { cn } from '@/lib/utils';

interface TradeDetailDrawerProps {
  trade: TradeDto | null;
  allTags: TagDto[];
  timezone: string;
  onClose: () => void;
  onUpdated: (updated: TradeDto) => void;
  onDeleted: (tradeId: string) => void;
  onTagCreated: () => Promise<void>;
}

const TAG_SWATCHES = ['#10B981', '#6366F1', '#8B5CF6', '#3B82F6', '#F59E0B', '#F43F5E', '#06B6D4'];

export function TradeDetailDrawer({
  trade,
  allTags,
  timezone,
  onClose,
  onUpdated,
  onDeleted,
  onTagCreated,
}: TradeDetailDrawerProps) {
  const [note, setNote] = React.useState('');
  const [selectedTagIds, setSelectedTagIds] = React.useState<string[]>([]);
  const [initialStopLoss, setInitialStopLoss] = React.useState('');
  const [initialRiskAmount, setInitialRiskAmount] = React.useState('');
  const [newTagName, setNewTagName] = React.useState('');
  const [newTagColor, setNewTagColor] = React.useState(TAG_SWATCHES[0]);
  const [saving, setSaving] = React.useState(false);
  const [creatingTag, setCreatingTag] = React.useState(false);
  const [statusMsg, setStatusMsg] = React.useState<string | null>(null);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!trade) return;
    setNote(trade.note ?? '');
    setSelectedTagIds(trade.tags.map((t) => t.id));
    setInitialStopLoss(trade.initialStopLoss ?? '');
    setInitialRiskAmount(trade.initialRiskAmount ?? '');
    setStatusMsg(null);
    setErrorMsg(null);
  }, [trade]);

  // Live instant R-Multiple preview while typing SL / 1R
  const previewR = React.useMemo(() => {
    if (!trade) return null;
    const net = Number(trade.netPnl);
    const gross = Number(trade.grossPnl);
    const open = Number(trade.openPrice);
    const close = Number(trade.closePrice);
    const riskNum = Number(initialRiskAmount);
    const slNum = Number(initialStopLoss);

    if (initialRiskAmount.trim() !== '' && Number.isFinite(riskNum) && riskNum > 0) {
      return net / riskNum;
    }

    if (initialStopLoss.trim() !== '' && Number.isFinite(slNum) && slNum > 0) {
      const riskDist = trade.direction === 'BUY' ? open - slNum : slNum - open;
      const pnlDist = trade.direction === 'BUY' ? close - open : open - close;
      if (riskDist > 0) {
        if (gross !== 0 && pnlDist !== 0) {
          const derivedRisk = riskDist * Math.abs(gross / pnlDist);
          if (derivedRisk > 0) return net / derivedRisk;
        }
        return pnlDist / riskDist;
      }
    }

    return trade.rMultiple ? Number(trade.rMultiple) : null;
  }, [trade, initialRiskAmount, initialStopLoss]);

  const toggleTag = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId],
    );
  };

  const handleQuickCreateTag = async () => {
    if (!newTagName.trim()) return;
    setCreatingTag(true);
    setErrorMsg(null);
    try {
      const created = await api.createTag({ name: newTagName.trim(), color: newTagColor });
      await onTagCreated();
      setSelectedTagIds((prev) => [...prev, created.id]);
      setNewTagName('');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Không thể tạo tag mới');
    } finally {
      setCreatingTag(false);
    }
  };

  const handleSave = async () => {
    if (!trade) return;
    setSaving(true);
    setStatusMsg(null);
    setErrorMsg(null);

    try {
      const payload: {
        note: string | null;
        tagIds: string[];
        initialStopLoss?: string | null;
        initialRiskAmount?: string | null;
      } = {
        note: note.trim() === '' ? null : note,
        tagIds: selectedTagIds,
      };

      const slChanged = (initialStopLoss.trim() || null) !== (trade.initialStopLoss || null);
      const riskChanged =
        (initialRiskAmount.trim() || null) !== (trade.initialRiskAmount || null);

      if (slChanged) payload.initialStopLoss = initialStopLoss.trim() || null;
      if (riskChanged) payload.initialRiskAmount = initialRiskAmount.trim() || null;

      const updated = await api.updateTradeJournal(trade.id, payload);
      onUpdated(updated);
      setStatusMsg('Đã lưu thay đổi nhật ký');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Không thể lưu nhật ký');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!trade) return;
    if (!window.confirm(`Xoá vĩnh viễn lệnh ${trade.symbol} (#${trade.externalId})?`)) return;
    try {
      await api.deleteTrade(trade.id);
      onDeleted(trade.id);
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Không thể xoá lệnh');
    }
  };

  const shortTz = getShortTimezoneLabel(timezone);

  return (
    <Sheet open={Boolean(trade)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent>
        {trade && (
          <>
            <SheetHeader>
              <div className="min-w-0">
                <div className="flex items-center gap-2.5">
                  <SheetTitle className="font-num text-lg font-bold tracking-tight text-white">
                    {trade.symbol}
                  </SheetTitle>
                  <Badge variant={trade.direction === 'BUY' ? 'profit' : 'loss'}>
                    {trade.direction}
                  </Badge>
                  <span className="font-num rounded bg-white/[0.05] px-1.5 py-0.5 text-[11px] text-zinc-400">
                    #{trade.externalId}
                  </span>
                </div>
                <SheetDescription className="mt-1">
                  {trade.accountName} · Nguồn{' '}
                  {trade.source === 'MT5_WEBHOOK' ? 'MT5 EA Realtime' : 'MT5 Statement Import'}
                </SheetDescription>
              </div>
              <SheetCloseButton />
            </SheetHeader>

            <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
              {/* Hero PnL & R-Multiple */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-white/[0.08] bg-[#16181D] p-4">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                    Net PnL
                  </p>
                  <p
                    className={`font-num mt-1.5 text-2xl font-bold tracking-tight ${pnlColorClass(trade.netPnl)}`}
                  >
                    {formatCurrency(trade.netPnl, trade.accountCurrency, true)}
                  </p>
                  <p className="font-num mt-1 text-[11px] text-zinc-500">
                    Gross {formatCurrency(trade.grossPnl, trade.accountCurrency, true)}
                  </p>
                </div>

                <div className="rounded-xl border border-white/[0.08] bg-[#16181D] p-4">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                    R-Multiple
                  </p>
                  <p
                    className={`font-num mt-1.5 text-2xl font-bold tracking-tight ${
                      previewR !== null ? pnlColorClass(previewR) : 'text-zinc-500'
                    }`}
                  >
                    {previewR !== null
                      ? `${previewR >= 0 ? '+' : ''}${previewR.toFixed(2)}R`
                      : '—'}
                  </p>
                  <p className="font-num mt-1 text-[11px] text-zinc-500">
                    Giữ lệnh {formatDuration(trade.holdingSeconds)}
                  </p>
                </div>
              </div>

              {/* 2-Column Telemetry Grid */}
              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                  <p className="text-[11px] text-zinc-500">Mở lệnh ({shortTz})</p>
                  <p className="font-num mt-1 font-medium text-zinc-200">
                    {formatDateTimeInTz(trade.openTime, timezone)}
                  </p>
                  <p className="font-num mt-0.5 text-[11px] text-zinc-400">
                    Entry: <span className="text-zinc-200">{trade.openPrice}</span>
                  </p>
                </div>
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                  <p className="text-[11px] text-zinc-500">Đóng lệnh ({shortTz})</p>
                  <p className="font-num mt-1 font-medium text-zinc-200">
                    {formatDateTimeInTz(trade.closeTime, timezone)}
                  </p>
                  <p className="font-num mt-0.5 text-[11px] text-zinc-400">
                    Exit: <span className="text-zinc-200">{trade.closePrice}</span>
                  </p>
                </div>
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                  <p className="text-[11px] text-zinc-500">Volume / SL / TP cuối</p>
                  <p className="font-num mt-1 text-zinc-200">
                    {trade.volume} lot
                  </p>
                  <p className="font-num mt-0.5 text-[11px] text-zinc-400">
                    SL {trade.stopLoss ?? '—'} · TP {trade.takeProfit ?? '—'}
                  </p>
                </div>
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                  <p className="text-[11px] text-zinc-500">Phí &amp; Swap</p>
                  <p className="font-num mt-1 text-zinc-200">
                    Comm: {formatCurrency(trade.commission, trade.accountCurrency)}
                  </p>
                  <p className="font-num mt-0.5 text-[11px] text-zinc-400">
                    Swap: {formatCurrency(trade.swap, trade.accountCurrency)}
                  </p>
                </div>
              </div>

              {/* Initial SL / Risk Editor */}
              <div className="space-y-3 rounded-xl border border-white/[0.08] bg-[#16181D]/60 p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-zinc-200">
                    Quản trị rủi ro (Initial SL &amp; 1R)
                  </span>
                  {trade.isManualRisk && (
                    <Badge variant="secondary">
                      <Lock className="h-3 w-3 text-indigo-400" />
                      Đã khoá thủ công
                    </Badge>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-zinc-400">Initial Stop Loss</label>
                    <Input
                      className="font-num mt-1 h-8 text-xs"
                      placeholder="vd: 2640.50"
                      value={initialStopLoss}
                      onChange={(e) => setInitialStopLoss(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-zinc-400">
                      Rủi ro 1R ({trade.accountCurrency})
                    </label>
                    <Input
                      className="font-num mt-1 h-8 text-xs"
                      placeholder="vd: 250.00"
                      value={initialRiskAmount}
                      onChange={(e) => setInitialRiskAmount(e.target.value)}
                    />
                  </div>
                </div>
                <p className="text-[11px] leading-relaxed text-zinc-500">
                  R-Multiple được xem trước tức thì khi bạn nhập. Lưu chỉnh sửa tay sẽ tự khoá để EA
                  không ghi đè khi chạy đồng bộ lại.
                </p>
              </div>

              {/* Visual Strategy Tag Picker */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-zinc-200">Tag chiến lược</h3>
                  <span className="text-[11px] text-zinc-500">
                    Đã chọn {selectedTagIds.length}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {allTags.map((tag) => {
                    const active = selectedTagIds.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => toggleTag(tag.id)}
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all',
                          active
                            ? 'border-indigo-500/50 bg-indigo-500/15 text-white shadow-[0_0_0_1px_rgba(99,102,241,0.2)]'
                            : 'border-white/[0.08] bg-[#16181D] text-zinc-400 hover:border-white/[0.16] hover:text-zinc-200',
                        )}
                      >
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: tag.color }}
                        />
                        {tag.name}
                        {active && <Check className="h-3 w-3 text-indigo-300" />}
                      </button>
                    );
                  })}
                </div>

                {/* Inline Quick Tag Creator */}
                <div className="rounded-lg border border-white/[0.07] bg-[#16181D]/50 p-2.5">
                  <div className="flex items-center gap-2">
                    <Input
                      className="h-8 flex-1 text-xs"
                      placeholder="Tạo nhanh tag mới (vd: BB Tier 3)..."
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          void handleQuickCreateTag();
                        }
                      }}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={creatingTag || !newTagName.trim()}
                      onClick={handleQuickCreateTag}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Tạo
                    </Button>
                  </div>
                  <div className="mt-2 flex items-center gap-1.5">
                    <span className="text-[11px] text-zinc-500">Màu:</span>
                    {TAG_SWATCHES.map((c) => (
                      <button
                        key={c}
                        type="button"
                        aria-label={`Chọn màu ${c}`}
                        onClick={() => setNewTagColor(c)}
                        className={cn(
                          'h-4 w-4 rounded-full transition-transform',
                          newTagColor === c ? 'scale-110 ring-2 ring-white ring-offset-1 ring-offset-[#16181D]' : 'opacity-70 hover:opacity-100',
                        )}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Journal Note */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-zinc-200">Ghi chú giao dịch</h3>
                <Textarea
                  rows={5}
                  placeholder="Ghi lại bối cảnh cấu trúc thị trường, điểm vào/thoát lệnh, cảm xúc lúc giao dịch và bài học cần cải thiện..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>

              {statusMsg && (
                <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
                  {statusMsg}
                </div>
              )}
              {errorMsg && (
                <div className="rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
                  {errorMsg}
                </div>
              )}
            </div>

            {/* Sticky Footer */}
            <div className="flex items-center justify-between border-t border-white/[0.08] bg-[#0B0C0F]/80 px-6 py-3.5">
              <Button type="button" size="sm" variant="destructive" onClick={handleDelete}>
                <Trash2 className="h-3.5 w-3.5" />
                Xoá lệnh
              </Button>
              <div className="flex items-center gap-2">
                <Button type="button" size="sm" variant="outline" onClick={onClose}>
                  Đóng
                </Button>
                <Button type="button" size="sm" disabled={saving} onClick={handleSave}>
                  <Save className="h-3.5 w-3.5" />
                  {saving ? 'Đang lưu...' : 'Lưu nhật ký'}
                </Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
