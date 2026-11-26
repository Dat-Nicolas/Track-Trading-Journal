'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogIn, Plus, Swords, Trophy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { api, soloToken, type SoloListItemDto } from '@/lib/api';
import { cn } from '@/lib/utils';

const DURATIONS = [
  { label: '15p', minutes: 15 },
  { label: '1h', minutes: 60 },
  { label: '4h', minutes: 240 },
  { label: '1 ngày', minutes: 1440 },
  { label: '3 ngày', minutes: 4320 },
  { label: '7 ngày', minutes: 10080 },
];

const STATUS_LABEL = { WAITING: 'Đang chờ', ACTIVE: 'Đang đấu', COMPLETED: 'Đã chốt' } as const;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-zinc-400">{label}</span>
      {children}
    </label>
  );
}

export default function SoloPage() {
  const router = useRouter();
  const [list, setList] = React.useState<SoloListItemDto[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [joinCode, setJoinCode] = React.useState('');
  const [form, setForm] = React.useState({
    hostName: '',
    title: '',
    durationMinutes: 60,
    startingCapital: '1000',
    stakeAmount: '2',
    stakeUnit: 'đồng',
  });

  React.useEffect(() => {
    api.getSoloList().then(setList, (e: Error) => setError(e.message));
  }, []);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { code, token } = await api.createSolo(form);
      soloToken.set(code, token);
      router.push(`/solo/${code}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (code.length === 6) router.push(`/solo/${code}`);
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-white">
          <Swords className="h-5 w-5 text-indigo-400" /> Solo Trading 1v1
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Đánh vàng (XAU/USD) giá thật realtime bằng tiền demo, cùng vốn, cùng khung giờ — ai % ROI cao hơn thì thắng kèo. App chỉ ghi sổ cược.
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
          {error}
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <Card>
          <CardHeader>
            <CardTitle>Tạo kèo mới</CardTitle>
            <CardDescription>Tạo xong gửi mã 6 ký tự cho bạn. Bạn vào phòng là bắt đầu tính giờ, hết giờ tự đóng hết lệnh.</CardDescription>
          </CardHeader>
          <CardContent>
              <form onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-2">
                <Field label="Biệt danh">
                  <Input required maxLength={40} value={form.hostName} onChange={(e) => set('hostName', e.target.value)} placeholder="VD: Đạt" />
                </Field>
                <Field label="Tên kèo (tuỳ chọn)">
                  <Input maxLength={100} value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="VD: Kèo vàng tối thứ 6" />
                </Field>
                <Field label="Vốn demo mỗi người (USD)">
                  <Input required inputMode="decimal" value={form.startingCapital} onChange={(e) => set('startingCapital', e.target.value)} />
                </Field>
                <div className="space-y-1.5 sm:col-span-2">
                  <span className="text-xs font-medium text-zinc-400">Thời gian đấu</span>
                  <div className="flex flex-wrap gap-2">
                    {DURATIONS.map((d) => (
                      <button
                        key={d.minutes}
                        type="button"
                        aria-pressed={form.durationMinutes === d.minutes}
                        onClick={() => set('durationMinutes', d.minutes)}
                        className={cn(
                          'h-8 rounded-md border px-3 text-xs font-medium transition-colors',
                          form.durationMinutes === d.minutes
                            ? 'border-indigo-500/50 bg-indigo-500/15 text-indigo-200'
                            : 'border-white/[0.08] text-zinc-400 hover:text-white',
                        )}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>
                <Field label="Mức cược">
                  <Input required inputMode="decimal" value={form.stakeAmount} onChange={(e) => set('stakeAmount', e.target.value)} />
                </Field>
                <Field label="Đơn vị cược">
                  <Input required maxLength={20} value={form.stakeUnit} onChange={(e) => set('stakeUnit', e.target.value)} />
                </Field>
                <div className="sm:col-span-2">
                  <Button type="submit" disabled={busy}>
                    <Plus className="h-4 w-4" /> Tạo phòng
                  </Button>
                </div>
              </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Vào phòng bằng mã</CardTitle>
            <CardDescription>Nhập mã 6 ký tự bạn bè gửi.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleJoin} className="flex gap-2">
              <Input
                aria-label="Mã phòng"
                maxLength={6}
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="XK92A4"
                className="font-num tracking-[0.3em]"
              />
              <Button type="submit" disabled={joinCode.trim().length !== 6}>
                <LogIn className="h-4 w-4" /> Vào
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Các kèo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {list.length === 0 && <p className="text-sm text-zinc-500">Chưa có kèo nào.</p>}
          {list.map((c) => {
            const winner = c.participants.find((p) => p.id === c.winnerId);
            return (
              <Link
                key={c.code}
                href={`/solo/${c.code}`}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-white/[0.06] px-3 py-2.5 text-sm hover:border-white/[0.14]"
              >
                <span className="font-num font-semibold text-white">#{c.code}</span>
                <Badge variant={c.status === 'ACTIVE' ? 'profit' : 'secondary'}>{STATUS_LABEL[c.status]}</Badge>
                <span className="text-zinc-300">{c.participants.map((p) => p.displayName).join(' vs ') || '—'}</span>
                <span className="text-zinc-500">Vốn ${Number(c.startingCapital).toLocaleString()} · Cược {Number(c.stakeAmount)} {c.stakeUnit}</span>
                {c.status === 'COMPLETED' && (
                  <span className="ml-auto flex items-center gap-1 text-amber-300">
                    <Trophy className="h-3.5 w-3.5" /> {winner ? winner.displayName : 'Hoà'}
                  </span>
                )}
              </Link>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
