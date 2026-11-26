'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ColorType,
  createChart,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts';
import { AlertTriangle, Copy, Timer, Trophy, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { api, soloToken, type SoloParticipantDto, type SoloScoreboardDto } from '@/lib/api';
import { formatCurrency, formatDateTimeInTz, pnlColorClass } from '@/lib/format';
import { cn } from '@/lib/utils';

const COLORS = ['#10B981', '#8B5CF6'];
const POLL_LIVE_MS = 3_000;
const POLL_IDLE_MS = 10_000;
const KLINES_URL = 'https://data-api.binance.vision/api/v3/klines?symbol=PAXGUSDT&interval=1m&limit=240';
const REASON: Record<string, string> = { MANUAL: 'Đóng tay', SL: 'Chạm SL', TP: 'Chạm TP', TIME: 'Hết giờ', STOP_OUT: 'Cháy TK' };

const chartBase = {
  layout: { background: { type: ColorType.Solid, color: '#111216' }, textColor: '#71717A', fontSize: 11 },
  grid: {
    vertLines: { color: 'rgba(255,255,255,0.05)', style: LineStyle.Dashed },
    horzLines: { color: 'rgba(255,255,255,0.05)', style: LineStyle.Dashed },
  },
  rightPriceScale: { borderColor: 'rgba(255,255,255,0.08)' },
  timeScale: { borderColor: 'rgba(255,255,255,0.08)', timeVisible: true },
};

function useChart(ref: React.RefObject<HTMLDivElement | null>, height: number) {
  const [chart, setChart] = React.useState<IChartApi | null>(null);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const c = createChart(el, { ...chartBase, width: el.clientWidth, height });
    const ro = new ResizeObserver(([e]) => e.contentRect.width > 0 && c.applyOptions({ width: e.contentRect.width }));
    ro.observe(el);
    setChart(c);
    return () => {
      ro.disconnect();
      c.remove();
      setChart(null);
    };
  }, [ref, height]);
  return chart;
}

function formatCountdown(ms: number) {
  if (ms <= 0) return '00:00:00';
  const s = Math.floor(ms / 1000);
  const days = Math.floor(s / 86400);
  const hh = String(Math.floor((s % 86400) / 3600)).padStart(2, '0');
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${days > 0 ? `${days}d ` : ''}${hh}:${mm}:${ss}`;
}

/** Nến vàng 1 phút: tải lịch sử từ Binance, nến cuối cập nhật theo giá server mỗi lần poll. */
function GoldChart({ price, me }: { price: number; me?: SoloParticipantDto }) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const chart = useChart(ref, 340);
  const series = React.useRef<ISeriesApi<'Candlestick'> | null>(null);
  const last = React.useRef<{ time: number; open: number; high: number; low: number; close: number } | null>(null);

  React.useEffect(() => {
    if (!chart) return;
    const s = chart.addCandlestickSeries({
      upColor: '#10B981', downColor: '#F43F5E', borderVisible: false, wickUpColor: '#10B981', wickDownColor: '#F43F5E',
    });
    series.current = s;
    fetch(KLINES_URL)
      .then((r) => r.json())
      .then((rows: Array<[number, string, string, string, string]>) => {
        const data = rows.map((r) => ({ time: r[0] / 1000, open: +r[1], high: +r[2], low: +r[3], close: +r[4] }));
        s.setData(data.map((x) => ({ ...x, time: x.time as UTCTimestamp })));
        last.current = data[data.length - 1] ?? null;
        chart.timeScale().scrollToRealTime();
      })
      .catch(() => undefined);
    return () => {
      series.current = null;
    };
  }, [chart]);

  React.useEffect(() => {
    const s = series.current;
    if (!s || !price) return;
    const minute = Math.floor(Date.now() / 60_000) * 60;
    const prev = last.current;
    const bar =
      prev && prev.time === minute
        ? { ...prev, high: Math.max(prev.high, price), low: Math.min(prev.low, price), close: price }
        : { time: minute, open: prev?.close ?? price, high: price, low: price, close: price };
    if (prev && minute < prev.time) return;
    last.current = bar;
    s.update({ ...bar, time: bar.time as UTCTimestamp });
  }, [price]);

  // Vẽ đường Entry / SL / TP của lệnh đang mở của mình.
  React.useEffect(() => {
    const s = series.current;
    if (!s || !me) return;
    const lines = me.positions
      .filter((p) => !p.closeTime)
      .flatMap((p) => [
        s.createPriceLine({ price: +p.entryPrice, color: '#60A5FA', lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: true, title: `${p.side} ${p.lots}` }),
        ...(p.stopLoss ? [s.createPriceLine({ price: +p.stopLoss, color: '#F43F5E', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: 'SL' })] : []),
        ...(p.takeProfit ? [s.createPriceLine({ price: +p.takeProfit, color: '#10B981', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: 'TP' })] : []),
      ]);
    return () => lines.forEach((l) => s.removePriceLine(l));
  }, [me, chart]);

  return <div ref={ref} className="w-full overflow-hidden rounded-lg" aria-label="Biểu đồ nến giá vàng 1 phút" />;
}

function DualCurve({ players }: { players: SoloParticipantDto[] }) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const chart = useChart(ref, 260);

  React.useEffect(() => {
    if (!chart) return;
    const created = players.map((p, i) => {
      const s = chart.addLineSeries({
        color: COLORS[i],
        lineWidth: 2,
        title: p.displayName,
        priceFormat: { type: 'custom', formatter: (v: number) => `${v.toFixed(2)}%` },
      });
      let prev = 0; // time phải tăng dần nghiêm ngặt
      s.setData(
        p.curve.map((pt) => {
          const t = pt.unixTime <= prev ? prev + 1 : pt.unixTime;
          prev = t;
          return { time: t as UTCTimestamp, value: pt.roiPct };
        }),
      );
      return s;
    });
    chart.timeScale().fitContent();
    return () => created.forEach((s) => chart.removeSeries(s));
  }, [chart, players]);

  return <div ref={ref} className="w-full overflow-hidden rounded-lg" aria-label="Biểu đồ % ROI của 2 người chơi" />;
}

function PlayerCard({ p, color, badge, isYou }: { p: SoloParticipantDto; color: string; badge?: React.ReactNode; isYou: boolean }) {
  return (
    <div className="rounded-xl border bg-[#111216] p-4" style={{ borderColor: `${color}55` }}>
      <div className="flex items-center justify-between gap-2">
        <p className="truncate font-semibold text-white">
          {p.displayName}{' '}
          <span className="text-xs font-normal text-zinc-500">({p.role === 'HOST' ? 'Host' : 'Guest'}{isYou ? ' · Bạn' : ''})</span>
        </p>
        {badge}
      </div>
      <p className="font-num mt-3 text-3xl font-semibold" style={{ color }}>
        {p.roiPct > 0 ? '+' : ''}{p.roiPct.toFixed(2)}%
      </p>
      <p className="font-num text-sm text-zinc-300">
        Equity {formatCurrency(p.equity)} · <span className={pnlColorClass(p.netPnl)}>{formatCurrency(p.netPnl, 'USD', true)}</span>
      </p>
      <div className="mt-3 grid grid-cols-4 gap-2 text-xs">
        <div><p className="text-zinc-500">Thả nổi</p><p className={cn('font-num', pnlColorClass(p.floatingPnl))}>{formatCurrency(p.floatingPnl, 'USD', true)}</p></div>
        <div><p className="text-zinc-500">Lệnh đóng</p><p className="font-num text-zinc-200">{p.tradeCount}</p></div>
        <div><p className="text-zinc-500">Win rate</p><p className="font-num text-zinc-200">{p.winRate}%</p></div>
        <div><p className="text-zinc-500">Max DD</p><p className="font-num text-rose-400">{p.maxDrawdownPct}%</p></div>
      </div>
    </div>
  );
}

function OrderPanel({ code, data, me, onUpdate, onError }: {
  code: string;
  data: SoloScoreboardDto;
  me: SoloParticipantDto;
  onUpdate: (d: SoloScoreboardDto) => void;
  onError: (m: string | null) => void;
}) {
  const [lots, setLots] = React.useState('0.10');
  const [sl, setSl] = React.useState('');
  const [tp, setTp] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const price = Number(data.price);
  const margin = (Number(lots) || 0) * price; // 100 oz / đòn bẩy 100 = lots * giá

  async function send(side: 'BUY' | 'SELL') {
    setBusy(true);
    onError(null);
    try {
      onUpdate(await api.soloOrder(code, { side, lots, stopLoss: sl || undefined, takeProfit: tp || undefined }));
      setSl('');
      setTp('');
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between">
          <span>Đặt lệnh XAU/USD</span>
          <span className="font-num text-lg text-amber-300">{price.toFixed(2)}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <label className="block space-y-1">
          <span className="text-xs text-zinc-400">Khối lượng (lot · 1 lot = 100 oz)</span>
          <Input inputMode="decimal" value={lots} onChange={(e) => setLots(e.target.value)} />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block space-y-1">
            <span className="text-xs text-zinc-400">Stop Loss</span>
            <Input inputMode="decimal" value={sl} onChange={(e) => setSl(e.target.value)} placeholder="Tuỳ chọn" />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-zinc-400">Take Profit</span>
            <Input inputMode="decimal" value={tp} onChange={(e) => setTp(e.target.value)} placeholder="Tuỳ chọn" />
          </label>
        </div>
        <p className="text-xs text-zinc-500">
          Ký quỹ ~{formatCurrency(margin)} · Còn trống {formatCurrency(me.freeMargin)} · Đòn bẩy 1:100
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Button disabled={busy} onClick={() => send('BUY')} className="bg-emerald-600 hover:bg-emerald-500">BUY</Button>
          <Button disabled={busy} onClick={() => send('SELL')} className="bg-rose-600 hover:bg-rose-500">SELL</Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SoloRoomPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const [data, setData] = React.useState<SoloScoreboardDto | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [now, setNow] = React.useState(() => Date.now());
  const [clockSkew, setClockSkew] = React.useState(0);
  const [joinName, setJoinName] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const apply = React.useCallback((res: SoloScoreboardDto) => {
    setData(res);
    setClockSkew(new Date(res.serverTime).getTime() - Date.now());
  }, []);

  const load = React.useCallback(async () => {
    try {
      apply(await api.getSolo(code));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [code, apply]);

  const status = data?.status;
  React.useEffect(() => {
    void load();
    const poll = setInterval(load, status === 'ACTIVE' ? POLL_LIVE_MS : POLL_IDLE_MS);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [load, status]);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { token } = await api.joinSolo(code, { displayName: joinName });
      soloToken.set(code, token);
      await load();
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel() {
    if (!confirm('Huỷ phòng này?')) return;
    try {
      await api.cancelSolo(code);
      router.push('/solo');
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function closePosition(id: string) {
    try {
      apply(await api.soloClose(code, id));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (!data) return <p className="text-sm text-zinc-400">{error ?? 'Đang tải phòng…'}</p>;

  const [a, b] = data.participants;
  const me = data.participants.find((p) => p.id === data.youId);
  const winner = data.participants.find((p) => p.id === data.winnerId);
  const loser = data.participants.find((p) => p.id !== data.winnerId);
  const stake = `${Number(data.stakeAmount)} ${data.stakeUnit}`;
  const remaining = data.endTime ? new Date(data.endTime).getTime() - (now + clockSkew) : 0;
  const live = data.status === 'ACTIVE';
  const playersKey = data.participants.map((p) => p.curve.map((c) => c.roiPct).join(',')).join('|');

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold tracking-tight text-white">Solo Vàng #{data.code}</h1>
        <Badge variant={live ? 'profit' : 'secondary'}>
          {data.status === 'WAITING' ? 'Chờ đối thủ' : live ? 'LIVE' : 'Đã chốt'}
        </Badge>
        {data.title && <span className="text-sm text-zinc-400">{data.title}</span>}
        <div className="ml-auto flex flex-wrap items-center gap-2 text-xs">
          {live && (
            <span className="font-num flex items-center gap-1 rounded-md border border-white/[0.08] px-2 py-1 text-zinc-200">
              <Timer className="h-3.5 w-3.5" /> {formatCountdown(remaining)}
            </span>
          )}
          <span className="rounded-md border border-white/[0.08] px-2 py-1 text-zinc-300">Vốn {formatCurrency(data.startingCapital)}</span>
          <span className="rounded-md border border-white/[0.08] px-2 py-1 text-indigo-300">Cược {stake}</span>
        </div>
      </div>

      {error && (
        <p role="alert" className="flex items-center justify-between gap-2 rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
          {error}
          <button type="button" aria-label="Đóng thông báo" onClick={() => setError(null)}><X className="h-4 w-4" /></button>
        </p>
      )}

      {data.status === 'WAITING' && (
        <Card>
          <CardHeader>
            <CardTitle>Đang chờ đối thủ — {a?.displayName} đã sẵn sàng</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {me ? (
              <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-400">
                Gửi mã <span className="font-num rounded bg-white/[0.06] px-2 py-0.5 tracking-[0.3em] text-white">{data.code}</span> hoặc link cho bạn.
                <Button size="sm" variant="secondary" onClick={() => navigator.clipboard?.writeText(window.location.href)}>
                  <Copy className="h-3.5 w-3.5" /> Copy link
                </Button>
                <Button size="sm" variant="destructive" onClick={handleCancel}>Huỷ phòng</Button>
              </div>
            ) : (
              <form onSubmit={handleJoin} className="flex flex-wrap gap-2">
                <Input required maxLength={40} value={joinName} onChange={(e) => setJoinName(e.target.value)} placeholder="Biệt danh của bạn, VD: Quang Anh" className="max-w-xs" />
                <Button type="submit" disabled={busy}>Vào kèo & bắt đầu</Button>
              </form>
            )}
            <p className="text-xs text-zinc-500">
              Mỗi người {formatCurrency(data.startingCapital)} tiền demo, đánh vàng giá thật trong {data.durationMinutes} phút. Hết giờ tự đóng hết lệnh, ai % ROI cao hơn thắng.
            </p>
          </CardContent>
        </Card>
      )}

      {data.status === 'COMPLETED' && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-amber-100">
          <Trophy className="h-5 w-5 shrink-0 text-amber-300" />
          {winner && loser ? (
            <p><b>{winner.displayName}</b> thắng {loser.displayName} ({winner.roiPct.toFixed(2)}% vs {loser.roiPct.toFixed(2)}%) → <b>+{stake}</b></p>
          ) : (
            <p>Hoà — không ai mất cược.</p>
          )}
        </div>
      )}

      {live && !me && (
        <p className="flex items-center gap-2 text-xs text-amber-300/90">
          <AlertTriangle className="h-3.5 w-3.5" /> Bạn đang xem với tư cách khán giả (trình duyệt này không phải người chơi).
        </p>
      )}

      {data.status !== 'WAITING' && (
        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          <Card>
            <CardHeader className="pb-2"><CardTitle>XAU/USD · 1 phút</CardTitle></CardHeader>
            <CardContent><GoldChart price={Number(data.price)} me={me} /></CardContent>
          </Card>
          {live && me ? (
            <OrderPanel code={code} data={data} me={me} onUpdate={apply} onError={setError} />
          ) : (
            <Card><CardContent className="p-5 text-sm text-zinc-400">Giá vàng hiện tại: <span className="font-num text-amber-300">{Number(data.price).toFixed(2)}</span></CardContent></Card>
          )}
        </div>
      )}

      {a && b && (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            {[a, b].map((p, i) => (
              <PlayerCard
                key={p.id}
                p={p}
                color={COLORS[i]}
                isYou={p.id === data.youId}
                badge={(data.winnerId ?? data.leaderId) === p.id ? <Badge variant="profit">{data.status === 'COMPLETED' ? 'WINNER' : 'DẪN'}</Badge> : undefined}
              />
            ))}
          </div>

          <Card>
            <CardHeader><CardTitle>Dual Equity Curve (% ROI)</CardTitle></CardHeader>
            <CardContent>
              {/* key theo dữ liệu đường cong để không vẽ lại chart mỗi lần poll nếu không đổi */}
              <DualCurve key={playersKey} players={[a, b]} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Lệnh trong kèo</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead className="text-zinc-500">
                  <tr>
                    <th className="py-2 font-medium">Người chơi</th>
                    <th className="font-medium">Chiều</th>
                    <th className="font-medium">Lot</th>
                    <th className="font-medium">Vào</th>
                    <th className="font-medium">SL / TP</th>
                    <th className="font-medium">Ra</th>
                    <th className="font-medium">Trạng thái</th>
                    <th className="text-right font-medium">PnL</th>
                    <th />
                  </tr>
                </thead>
                <tbody className="font-num">
                  {[a, b]
                    .flatMap((p, i) => p.positions.map((t) => ({ ...t, who: p, color: COLORS[i] })))
                    .sort((x, y) => (x.closeTime ? 1 : 0) - (y.closeTime ? 1 : 0) || y.openTime.localeCompare(x.openTime))
                    .map((t) => (
                      <tr key={t.id} className="border-t border-white/[0.05]">
                        <td className="py-2" style={{ color: t.color }}>{t.who.displayName}</td>
                        <td className={t.side === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}>{t.side}</td>
                        <td className="text-zinc-300">{Number(t.lots)}</td>
                        <td className="text-zinc-200">{t.entryPrice}</td>
                        <td className="text-zinc-400">{t.stopLoss ?? '—'} / {t.takeProfit ?? '—'}</td>
                        <td className="text-zinc-200">{t.exitPrice ?? '—'}</td>
                        <td className="text-zinc-400">
                          {t.closeTime ? `${REASON[t.closeReason ?? ''] ?? t.closeReason} · ${formatDateTimeInTz(t.closeTime)}` : <span className="text-sky-300">Đang mở</span>}
                        </td>
                        <td className={cn('text-right', pnlColorClass(t.netPnl))}>{formatCurrency(t.netPnl, 'USD', true)}</td>
                        <td className="pl-2 text-right">
                          {!t.closeTime && live && t.who.id === data.youId && (
                            <Button size="sm" variant="destructive" onClick={() => closePosition(t.id)}>Đóng</Button>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
              {a.positions.length + b.positions.length === 0 && <p className="py-4 text-center text-sm text-zinc-500">Chưa có lệnh nào.</p>}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
