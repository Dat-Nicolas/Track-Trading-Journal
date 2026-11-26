import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, SoloRole, SoloStatus, TradeDirection } from '@prisma/client';
import { randomBytes, randomInt } from 'crypto';
import Decimal from 'decimal.js';
import {
  CreateSoloChallengeInput,
  JoinSoloChallengeInput,
  SoloOrderInput,
} from '@trackdailytrade/shared';
import { formatMoney } from '../common/decimal.util';
import { PrismaService } from '../prisma/prisma.service';
import { getCandles, getGoldPrice, hitLevel, marginFor, positionPnl } from './gold';
import { pickWinner, scoreTrades } from './solo.scoring';

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

const withPlayers = {
  participants: { orderBy: { role: 'asc' }, include: { positions: { orderBy: { openTime: 'asc' } } } },
} satisfies Prisma.SoloChallengeInclude;

type Room = Prisma.SoloChallengeGetPayload<{ include: typeof withPlayers }>;
type Position = Room['participants'][number]['positions'][number];

const d = (v: Prisma.Decimal | null) => (v === null ? null : new Decimal(v.toString()));

@Injectable()
export class SoloService {
  /** Mốc đã quét nến SL/TP tới đâu cho từng phòng (mất khi restart thì quét lại từ đầu, vẫn đúng). */
  private candleCheckedUntil = new Map<string, number>();

  constructor(private readonly prisma: PrismaService) {}

  private newCode() {
    return Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');
  }

  private newToken() {
    return randomBytes(24).toString('hex');
  }

  private async load(code: string): Promise<Room> {
    const c = await this.prisma.soloChallenge.findUnique({ where: { code: code.toUpperCase() }, include: withPlayers });
    if (!c) throw new NotFoundException(`Không tìm thấy phòng ${code}`);
    return c;
  }

  private me(room: Room, token?: string) {
    const p = token ? room.participants.find((x) => x.token === token) : undefined;
    if (!p) throw new ForbiddenException('Bạn không phải người chơi trong phòng này');
    return p;
  }

  async create(input: CreateSoloChallengeInput) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const token = this.newToken();
      try {
        const created = await this.prisma.soloChallenge.create({
          data: {
            code: this.newCode(),
            title: input.title || null,
            durationMinutes: input.durationMinutes,
            startingCapital: new Prisma.Decimal(input.startingCapital),
            stakeAmount: new Prisma.Decimal(input.stakeAmount),
            stakeUnit: input.stakeUnit,
            participants: { create: { displayName: input.hostName, role: SoloRole.HOST, token } },
          },
        });
        return { code: created.code, token };
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') continue;
        throw err;
      }
    }
    throw new ConflictException('Không sinh được mã phòng, thử lại');
  }

  /** Guest vào phòng → kèo bắt đầu tính giờ ngay. */
  async join(code: string, input: JoinSoloChallengeInput) {
    const c = await this.load(code);
    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + c.durationMinutes * 60_000);
    const token = this.newToken();
    // Điều kiện status = WAITING để 2 người join cùng lúc chỉ 1 người vào được.
    const ok = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.soloChallenge.updateMany({
        where: { id: c.id, status: SoloStatus.WAITING },
        data: { status: SoloStatus.ACTIVE, startTime, endTime },
      });
      if (count === 0) return false;
      await tx.soloParticipant.create({
        data: { challengeId: c.id, displayName: input.displayName, role: SoloRole.GUEST, token },
      });
      return true;
    });
    if (!ok) throw new BadRequestException('Phòng đã đủ người hoặc đã kết thúc');
    return { code: c.code, token };
  }

  async cancel(code: string, token?: string) {
    const c = await this.load(code);
    if (this.me(c, token).role !== SoloRole.HOST) throw new ForbiddenException('Chỉ host được huỷ phòng');
    if (c.status !== SoloStatus.WAITING) throw new BadRequestException('Chỉ huỷ được phòng đang chờ');
    await this.prisma.soloChallenge.delete({ where: { id: c.id } });
    return { deleted: true, code: c.code };
  }

  // ---------- Khớp lệnh ----------

  private async closePosition(p: Position, price: Decimal, at: Date, reason: string) {
    const pnl = positionPnl(p.side, p.lots.toString(), p.entryPrice.toString(), price);
    // closeTime: null trong where → không bao giờ đóng 1 lệnh 2 lần.
    await this.prisma.soloPosition.updateMany({
      where: { id: p.id, closeTime: null },
      data: { exitPrice: new Prisma.Decimal(price.toFixed(4)), closeTime: at, closeReason: reason, netPnl: new Prisma.Decimal(formatMoney(pnl)) },
    });
  }

  /**
   * Cập nhật trạng thái phòng: SL/TP theo nến 1 phút + giá hiện tại, cháy tài khoản, hết giờ thì đóng hết & chốt sổ.
   * Gọi ở mọi request đọc/ghi nên không cần cron.
   */
  private async sync(room: Room): Promise<{ room: Room; price: Decimal }> {
    const price = await getGoldPrice();
    if (room.status !== SoloStatus.ACTIVE || !room.endTime) return { room, price };

    const now = new Date();
    const expired = room.endTime <= now;
    const until = expired ? room.endTime : now;
    const open = room.participants.flatMap((p) => p.positions.filter((x) => !x.closeTime));

    // 1) SL/TP chạm trong lúc không ai mở web: quét nến 1 phút.
    const withLevels = open.filter((p) => p.stopLoss || p.takeProfit);
    const closedIds = new Set<string>();
    if (withLevels.length) {
      const from = Math.max(
        Math.min(...withLevels.map((p) => p.openTime.getTime())),
        this.candleCheckedUntil.get(room.id) ?? 0,
      );
      const candles = await getCandles(from, until.getTime());
      for (const p of withLevels) {
        // Bỏ nến chứa thời điểm vào lệnh: giá trước lúc vào không được tính.
        for (const k of candles) {
          if (k.openTime <= p.openTime.getTime()) continue;
          const hit = hitLevel({ side: p.side, stopLoss: d(p.stopLoss), takeProfit: d(p.takeProfit) }, k.high, k.low);
          if (hit) {
            await this.closePosition(p, hit.price, new Date(Math.min(k.openTime + 60_000, until.getTime())), hit.reason);
            closedIds.add(p.id);
            break;
          }
        }
      }
      // Nến cuối có thể chưa đóng → lần sau quét lại từ đầu nến đó.
      if (candles.length) this.candleCheckedUntil.set(room.id, candles[candles.length - 1].openTime);
    }

    // 2) Giá hiện tại chạm SL/TP (chỉ khi kèo còn chạy).
    if (!expired) {
      for (const p of withLevels) {
        if (closedIds.has(p.id)) continue;
        const hit = hitLevel({ side: p.side, stopLoss: d(p.stopLoss), takeProfit: d(p.takeProfit) }, price, price);
        if (hit) {
          await this.closePosition(p, hit.price, now, hit.reason);
          closedIds.add(p.id);
        }
      }
    }

    // 3) Hết giờ: đóng tất cả lệnh còn lại ở giá lúc endTime. 4) Equity <= 0: cháy tài khoản.
    let exitPrice = price;
    if (expired && now.getTime() - room.endTime.getTime() > 60_000) {
      const k = await getCandles(room.endTime.getTime() - 60_000, room.endTime.getTime());
      if (k.length) exitPrice = k[k.length - 1].close;
    }
    const capital = new Decimal(room.startingCapital.toString());
    for (const pl of room.participants) {
      const stillOpen = pl.positions.filter((x) => !x.closeTime && !closedIds.has(x.id));
      if (!stillOpen.length) continue;
      if (expired) {
        for (const p of stillOpen) await this.closePosition(p, exitPrice, room.endTime, 'TIME');
        continue;
      }
      const fresh = await this.prisma.soloPosition.findMany({ where: { participantId: pl.id, closeTime: { not: null } } });
      const realized = fresh.reduce((s, x) => s.plus(x.netPnl!.toString()), new Decimal(0));
      const floating = stillOpen.reduce((s, x) => s.plus(positionPnl(x.side, x.lots.toString(), x.entryPrice.toString(), price)), new Decimal(0));
      if (capital.plus(realized).plus(floating).lte(0)) {
        for (const p of stillOpen) await this.closePosition(p, price, now, 'STOP_OUT');
      }
    }

    if (expired) await this.settle(room.id);
    return { room: await this.load(room.code), price };
  }

  private async settle(challengeId: string) {
    const room = await this.prisma.soloChallenge.findUniqueOrThrow({ where: { id: challengeId }, include: withPlayers });
    if (room.status !== SoloStatus.ACTIVE || room.participants.length !== 2 || !room.startTime) return;
    const scores = room.participants.map((p) =>
      scoreTrades(
        p.positions.filter((x) => x.closeTime).map((x) => ({ closeTime: x.closeTime!, netPnl: x.netPnl!.toString() })),
        room.startingCapital.toString(),
        room.startTime!,
      ),
    );
    const w = pickWinner(scores[0], scores[1]);
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.soloChallenge.updateMany({
        where: { id: room.id, status: SoloStatus.ACTIVE },
        data: { status: SoloStatus.COMPLETED, settledAt: new Date(), winnerId: w === null ? null : room.participants[w].id },
      });
      if (count === 0) return; // request khác đã chốt rồi
      for (let i = 0; i < 2; i++) {
        await tx.soloParticipant.update({
          where: { id: room.participants[i].id },
          data: {
            finalNetPnl: new Prisma.Decimal(formatMoney(scores[i].netPnl)),
            finalRoiPct: new Prisma.Decimal(scores[i].roiPct.toFixed(4)),
          },
        });
      }
    });
    this.candleCheckedUntil.delete(room.id);
  }

  private accountState(room: Room, pl: Room['participants'][number], price: Decimal) {
    const capital = new Decimal(room.startingCapital.toString());
    let realized = new Decimal(0);
    let floating = new Decimal(0);
    let usedMargin = new Decimal(0);
    for (const x of pl.positions) {
      if (x.closeTime) realized = realized.plus(x.netPnl!.toString());
      else {
        floating = floating.plus(positionPnl(x.side, x.lots.toString(), x.entryPrice.toString(), price));
        usedMargin = usedMargin.plus(marginFor(x.lots.toString(), x.entryPrice.toString()));
      }
    }
    const equity = capital.plus(realized).plus(floating);
    return { realized, floating, equity, usedMargin, freeMargin: equity.minus(usedMargin) };
  }

  async placeOrder(code: string, token: string | undefined, input: SoloOrderInput) {
    const { room, price } = await this.sync(await this.load(code));
    const me = this.me(room, token);
    if (room.status !== SoloStatus.ACTIVE || !room.endTime || room.endTime <= new Date()) {
      throw new BadRequestException('Kèo chưa bắt đầu hoặc đã kết thúc');
    }
    const sl = input.stopLoss ? new Decimal(input.stopLoss) : null;
    const tp = input.takeProfit ? new Decimal(input.takeProfit) : null;
    const buy = input.side === 'BUY';
    if (sl && (buy ? sl.gte(price) : sl.lte(price))) throw new BadRequestException(`SL phải ${buy ? 'dưới' : 'trên'} giá hiện tại ${price.toFixed(2)}`);
    if (tp && (buy ? tp.lte(price) : tp.gte(price))) throw new BadRequestException(`TP phải ${buy ? 'trên' : 'dưới'} giá hiện tại ${price.toFixed(2)}`);

    const need = marginFor(input.lots, price);
    const { freeMargin } = this.accountState(room, me, price);
    if (need.gt(freeMargin)) {
      throw new BadRequestException(`Không đủ ký quỹ: cần $${need.toFixed(2)}, còn $${Decimal.max(freeMargin, 0).toFixed(2)}`);
    }
    await this.prisma.soloPosition.create({
      data: {
        participantId: me.id,
        side: input.side as TradeDirection,
        lots: new Prisma.Decimal(input.lots),
        entryPrice: new Prisma.Decimal(price.toFixed(4)),
        stopLoss: sl ? new Prisma.Decimal(sl.toFixed(4)) : null,
        takeProfit: tp ? new Prisma.Decimal(tp.toFixed(4)) : null,
      },
    });
    return this.scoreboard(code, token);
  }

  async closeManually(code: string, token: string | undefined, positionId: string) {
    const { room, price } = await this.sync(await this.load(code));
    const me = this.me(room, token);
    const p = me.positions.find((x) => x.id === positionId);
    if (!p) throw new NotFoundException('Không tìm thấy lệnh');
    if (!p.closeTime) await this.closePosition(p, price, new Date(), 'MANUAL');
    return this.scoreboard(code, token);
  }

  // ---------- Đọc ----------

  async scoreboard(code: string, token?: string) {
    const { room, price } = await this.sync(await this.load(code));
    const now = new Date();
    const live = room.status === SoloStatus.ACTIVE;

    const players = room.participants.map((pl) => {
      const st = this.accountState(room, pl, price);
      const score = scoreTrades(
        pl.positions.filter((x) => x.closeTime).map((x) => ({ closeTime: x.closeTime!, netPnl: x.netPnl!.toString() })),
        room.startingCapital.toString(),
        room.startTime ?? now,
        live && room.startTime ? { pnl: st.floating, at: now } : undefined,
      );
      return { pl, st, score };
    });
    const leader = players.length === 2 ? pickWinner(players[0].score, players[1].score) : null;

    return {
      code: room.code,
      title: room.title,
      status: room.status,
      durationMinutes: room.durationMinutes,
      startTime: room.startTime?.toISOString() ?? null,
      endTime: room.endTime?.toISOString() ?? null,
      serverTime: now.toISOString(),
      price: price.toFixed(2),
      startingCapital: formatMoney(new Decimal(room.startingCapital.toString())),
      stakeAmount: formatMoney(new Decimal(room.stakeAmount.toString())),
      stakeUnit: room.stakeUnit,
      winnerId: room.winnerId,
      leaderId: leader === null ? null : players[leader].pl.id,
      youId: room.participants.find((p) => token && p.token === token)?.id ?? null,
      participants: players.map(({ pl, st, score }) => ({
        id: pl.id,
        displayName: pl.displayName,
        role: pl.role,
        netPnl: formatMoney(score.netPnl),
        roiPct: score.roiPct.toDecimalPlaces(2).toNumber(),
        equity: formatMoney(st.equity),
        floatingPnl: formatMoney(st.floating),
        freeMargin: formatMoney(st.freeMargin),
        tradeCount: score.tradeCount,
        winRate: score.winRate,
        maxDrawdownPct: score.maxDrawdownPct,
        curve: score.curve,
        positions: pl.positions.map((x) => ({
          id: x.id,
          side: x.side,
          lots: x.lots.toString(),
          entryPrice: x.entryPrice.toFixed(2),
          stopLoss: x.stopLoss?.toFixed(2) ?? null,
          takeProfit: x.takeProfit?.toFixed(2) ?? null,
          openTime: x.openTime.toISOString(),
          exitPrice: x.exitPrice?.toFixed(2) ?? null,
          closeTime: x.closeTime?.toISOString() ?? null,
          closeReason: x.closeReason,
          netPnl: x.closeTime
            ? formatMoney(new Decimal(x.netPnl!.toString()))
            : formatMoney(positionPnl(x.side, x.lots.toString(), x.entryPrice.toString(), price)),
        })),
      })),
    };
  }

  async list() {
    const expired = await this.prisma.soloChallenge.findMany({
      where: { status: SoloStatus.ACTIVE, endTime: { lte: new Date() } },
      include: withPlayers,
    });
    for (const r of expired) await this.sync(r);

    const rows = await this.prisma.soloChallenge.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { participants: { orderBy: { role: 'asc' } } },
    });
    return rows.map((c) => ({
      code: c.code,
      title: c.title,
      status: c.status,
      startTime: c.startTime?.toISOString() ?? null,
      endTime: c.endTime?.toISOString() ?? null,
      startingCapital: formatMoney(new Decimal(c.startingCapital.toString())),
      stakeAmount: formatMoney(new Decimal(c.stakeAmount.toString())),
      stakeUnit: c.stakeUnit,
      winnerId: c.winnerId,
      participants: c.participants.map((p) => ({
        id: p.id,
        displayName: p.displayName,
        role: p.role,
        finalRoiPct: p.finalRoiPct?.toString() ?? null,
      })),
    }));
  }
}
