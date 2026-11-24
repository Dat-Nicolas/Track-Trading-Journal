'use client';

import * as React from 'react';
import {
  CheckCircle2,
  FileSpreadsheet,
  RefreshCw,
  Upload,
  X,
} from 'lucide-react';
import { useGlobalFilters } from '@/components/layout/filter-context';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { api, type ImportResultDto, type SyncLogDto } from '@/lib/api';
import {
  BROKER_TIMEZONE_PRESETS,
  formatCurrency,
  formatDateTimeInTz,
  getShortTimezoneLabel,
  pnlColorClass,
} from '@/lib/format';
import { cn } from '@/lib/utils';

export default function ImportPage() {
  const { accounts, filters, refreshTick, refreshReferences } = useGlobalFilters();
  const [accountId, setAccountId] = React.useState('');
  const [brokerTimezone, setBrokerTimezone] = React.useState('Europe/Athens');
  const [file, setFile] = React.useState<File | null>(null);
  const [dragActive, setDragActive] = React.useState(false);
  const [preview, setPreview] = React.useState<ImportResultDto | null>(null);
  const [finalResult, setFinalResult] = React.useState<ImportResultDto | null>(null);
  const [logs, setLogs] = React.useState<SyncLogDto[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const tz = filters.timezone ?? 'Asia/Ho_Chi_Minh';
  const shortTz = getShortTimezoneLabel(tz);

  React.useEffect(() => {
    if (!accountId && accounts.length > 0) {
      setAccountId(accounts[0].id);
      setBrokerTimezone(accounts[0].brokerTimezone);
    }
  }, [accounts, accountId]);

  const loadLogs = React.useCallback(async () => {
    try {
      const data = await api.getSyncLogs();
      setLogs(data);
    } catch (err) {
      console.error('Failed to fetch sync logs:', err);
    }
  }, []);

  React.useEffect(() => {
    void loadLogs();
  }, [loadLogs, refreshTick]);

  const handleAccountChange = (nextId: string) => {
    setAccountId(nextId);
    const acc = accounts.find((a) => a.id === nextId);
    if (acc) setBrokerTimezone(acc.brokerTimezone);
    setPreview(null);
    setFinalResult(null);
  };

  const acceptFile = (incoming: File | null) => {
    if (!incoming) return;
    setFile(incoming);
    setPreview(null);
    setFinalResult(null);
    setError(null);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const dropped = e.dataTransfer.files?.[0] ?? null;
    acceptFile(dropped);
  };

  const handlePreview = async () => {
    if (!file || !accountId) return;
    setBusy(true);
    setError(null);
    setFinalResult(null);
    try {
      const res = await api.importMt5Statement({
        file,
        accountId,
        brokerTimezone,
        dryRun: true,
      });
      setPreview(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể đọc tệp báo cáo MT5');
      setPreview(null);
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!file || !accountId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.importMt5Statement({
        file,
        accountId,
        brokerTimezone,
        dryRun: false,
      });
      setFinalResult(res);
      setPreview(null);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await Promise.all([loadLogs(), refreshReferences()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import thất bại');
    } finally {
      setBusy(false);
    }
  };

  const selectedAccount = accounts.find((a) => a.id === accountId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-white">Nhập dữ liệu &amp; Đồng bộ</h1>
        <p className="mt-0.5 text-xs text-zinc-400">
          Tải lên MT5 Trade History Report (.html / .htm UTF-16LE &amp; UTF-8 hoặc .csv). Hệ thống tự
          chống trùng lặp theo Position ID và bảo toàn ghi chú, Tag đã gắn.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Import báo cáo MT5</CardTitle>
          <CardDescription>
            Chọn tài khoản đích và đúng múi giờ server sàn MT5 để quy đổi chuẩn về UTC.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-400">Tài khoản giao dịch</label>
              <Select value={accountId} onValueChange={handleAccountChange}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Chọn tài khoản..." />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.name} (#{acc.accountNumber} · {acc.currency})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-400">
                Múi giờ server sàn (Broker Timezone)
              </label>
              <Select value={brokerTimezone} onValueChange={setBrokerTimezone}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BROKER_TIMEZONE_PRESETS.map((preset) => (
                    <SelectItem key={preset.value} value={preset.value}>
                      {preset.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Drag & Drop Zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'group relative flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-6 py-9 text-center transition-all duration-150',
              dragActive
                ? 'border-indigo-400 bg-indigo-500/[0.08] shadow-[0_0_0_4px_rgba(99,102,241,0.12)]'
                : file
                  ? 'border-emerald-500/35 bg-emerald-500/[0.04]'
                  : 'border-white/[0.12] bg-[#0B0C0F]/60 hover:border-white/[0.22] hover:bg-[#16181D]/60',
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".html,.htm,.csv,text/html,text/csv"
              className="hidden"
              onChange={(e) => acceptFile(e.target.files?.[0] ?? null)}
            />
            <div
              className={cn(
                'flex h-11 w-11 items-center justify-center rounded-full border transition-colors',
                dragActive
                  ? 'border-indigo-400/50 bg-indigo-500/20 text-indigo-300'
                  : file
                    ? 'border-emerald-500/35 bg-emerald-500/15 text-emerald-400'
                    : 'border-white/[0.1] bg-white/[0.03] text-zinc-400 group-hover:text-zinc-200',
              )}
            >
              <FileSpreadsheet className="h-5 w-5" />
            </div>

            {file ? (
              <div className="mt-3 space-y-1">
                <div className="flex items-center justify-center gap-2">
                  <p className="font-num text-sm font-medium text-white">{file.name}</p>
                  <button
                    type="button"
                    aria-label="Gỡ tệp"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                      setPreview(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="rounded p-0.5 text-zinc-400 hover:bg-white/10 hover:text-white"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="font-num text-xs text-zinc-400">
                  {(file.size / 1024).toFixed(1)} KB · Nhấn &ldquo;Xem trước&rdquo; để kiểm tra dữ
                  liệu trước khi lưu
                </p>
              </div>
            ) : (
              <>
                <p className="mt-3 text-sm font-medium text-zinc-200">
                  Kéo thả tệp báo cáo MT5 vào đây, hoặc{' '}
                  <span className="text-indigo-400 underline underline-offset-4">chọn từ máy</span>
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  Hỗ trợ tệp .html / .htm (UTF-16LE mặc định của MetaTrader 5 và UTF-8) và .csv
                </p>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button disabled={!file || !accountId || busy} onClick={handlePreview}>
              <Upload className="h-3.5 w-3.5" />
              {busy ? 'Đang phân tích...' : 'Xem trước (Dry Run)'}
            </Button>
            {preview && (
              <Button variant="secondary" disabled={busy} onClick={handleConfirmImport}>
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                Xác nhận Import ({preview.insertedCount} mới · {preview.updatedCount} cập nhật)
              </Button>
            )}
          </div>

          {error && (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-300">
              {error}
            </div>
          )}

          {finalResult && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-3 text-xs text-emerald-300">
              Import hoàn tất! Đã thêm mới{' '}
              <strong className="font-num">{finalResult.insertedCount}</strong> lệnh, cập nhật{' '}
              <strong className="font-num">{finalResult.updatedCount}</strong> lệnh (bỏ qua{' '}
              <span className="font-num">{finalResult.skippedCount}</span> dòng không phải giao
              dịch).
            </div>
          )}

          {/* Dry Run Preview */}
          {preview && preview.preview && (
            <div className="space-y-3 rounded-xl border border-white/[0.08] bg-[#0B0C0F]/80 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-medium text-zinc-200">
                  Xem trước: <span className="font-num text-white">{preview.totalParsed}</span> lệnh
                  hợp lệ (
                  <span className="font-num text-emerald-400">+{preview.insertedCount} mới</span> ·{' '}
                  <span className="font-num text-zinc-300">~{preview.updatedCount} cập nhật</span>)
                </span>
                <span className="font-num text-zinc-500">
                  {brokerTimezone} → {shortTz}
                </span>
              </div>

              {preview.warnings.length > 0 && (
                <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
                  {preview.warnings.slice(0, 5).join(' · ')}
                </div>
              )}

              <div className="max-h-72 overflow-auto rounded-lg border border-white/[0.06]">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 border-b border-white/[0.08] bg-[#16181D] text-[11px] text-zinc-400">
                    <tr>
                      <th className="px-3 py-2">Trạng thái</th>
                      <th className="px-3 py-2">Position ID</th>
                      <th className="px-3 py-2">Symbol</th>
                      <th className="px-3 py-2">Loại</th>
                      <th className="px-3 py-2 text-right">Volume</th>
                      <th className="px-3 py-2">Đóng lệnh ({shortTz})</th>
                      <th className="px-3 py-2 text-right">Net PnL</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.05]">
                    {preview.preview.slice(0, 50).map((row) => (
                      <tr key={row.externalId} className="hover:bg-white/[0.02]">
                        <td className="px-3 py-2">
                          <Badge variant={row.action === 'INSERT' ? 'profit' : 'secondary'}>
                            {row.action === 'INSERT' ? 'MỚI' : 'CẬP NHẬT'}
                          </Badge>
                        </td>
                        <td className="font-num px-3 py-2 text-zinc-300">{row.externalId}</td>
                        <td className="font-num px-3 py-2 font-semibold text-white">{row.symbol}</td>
                        <td className="px-3 py-2">
                          <Badge variant={row.direction === 'BUY' ? 'profit' : 'loss'}>
                            {row.direction}
                          </Badge>
                        </td>
                        <td className="font-num px-3 py-2 text-right text-zinc-300">{row.volume}</td>
                        <td className="font-num px-3 py-2 text-zinc-400">
                          {formatDateTimeInTz(row.closeTime, tz)}
                        </td>
                        <td
                          className={`font-num px-3 py-2 text-right font-semibold ${pnlColorClass(row.netPnl)}`}
                        >
                          {formatCurrency(row.netPnl, selectedAccount?.currency ?? 'USD', true)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sync Logs */}
      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Lịch sử đồng bộ</CardTitle>
            <CardDescription>
              Nhật ký mọi phiên đồng bộ từ MT5 EA Webhook và Import báo cáo
            </CardDescription>
          </div>
          <Button size="sm" variant="secondary" onClick={() => void loadLogs()}>
            <RefreshCw className="h-3.5 w-3.5" />
            Làm mới
          </Button>
        </CardHeader>
        <div className="overflow-x-auto border-t border-white/[0.08]">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-white/[0.08] bg-[#16181D]/70 text-[11px] font-medium text-zinc-400">
              <tr>
                <th className="px-4 py-2.5">Thời gian ({shortTz})</th>
                <th className="px-3 py-2.5">Tài khoản</th>
                <th className="px-3 py-2.5">Nguồn</th>
                <th className="px-3 py-2.5">Trạng thái</th>
                <th className="px-3 py-2.5">Tệp báo cáo</th>
                <th className="px-4 py-2.5 text-right">Mới / Cập nhật / Bỏ qua</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-zinc-500">
                    Chưa có lịch sử đồng bộ nào.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-white/[0.025]">
                    <td className="font-num whitespace-nowrap px-4 py-2.5 text-zinc-400">
                      {formatDateTimeInTz(log.createdAt, tz)}
                    </td>
                    <td className="px-3 py-2.5 font-medium text-zinc-200">
                      {log.account?.name ?? log.accountId}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge variant="secondary">
                        {log.source === 'MT5_WEBHOOK' ? 'MT5 Webhook' : 'MT5 Import'}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge
                        variant={
                          log.status === 'SUCCESS'
                            ? 'profit'
                            : log.status === 'FAILED'
                              ? 'loss'
                              : 'default'
                        }
                      >
                        {log.status === 'SUCCESS'
                          ? 'Thành công'
                          : log.status === 'FAILED'
                            ? 'Thất bại'
                            : 'Một phần'}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 text-zinc-400">{log.fileName ?? '—'}</td>
                    <td className="font-num whitespace-nowrap px-4 py-2.5 text-right">
                      <span className="text-emerald-400">+{log.insertedCount}</span>
                      <span className="mx-1.5 text-zinc-600">/</span>
                      <span className="text-zinc-200">~{log.updatedCount}</span>
                      <span className="mx-1.5 text-zinc-600">/</span>
                      <span className="text-zinc-500">{log.skippedCount}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
