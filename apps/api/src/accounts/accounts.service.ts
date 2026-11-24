import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Platform, Prisma } from '@prisma/client';
import Decimal from 'decimal.js';
import { CreateAccountInput, UpdateAccountInput } from '@trackdailytrade/shared';
import { PrismaService } from '../prisma/prisma.service';
import { DefaultUserService } from '../common/default-user.service';
import { formatMoney } from '../common/decimal.util';

@Injectable()
export class AccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly defaultUser: DefaultUserService,
  ) {}

  async findAll() {
    const user = await this.defaultUser.getDefaultUser();
    const accounts = await this.prisma.tradingAccount.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' },
      include: {
        _count: {
          select: { trades: true },
        },
      },
    });

    const pnlAggs = await this.prisma.trade.groupBy({
      by: ['accountId'],
      where: { accountId: { in: accounts.map((a) => a.id) } },
      _sum: { netPnl: true },
    });

    const pnlByAccount = new Map(
      pnlAggs.map((row) => [
        row.accountId,
        new Decimal(row._sum.netPnl?.toString() ?? '0'),
      ]),
    );

    return accounts.map((acc) => {
      const initialBalance = new Decimal(acc.initialBalance.toString());
      const netPnl = pnlByAccount.get(acc.id) ?? new Decimal(0);
      const currentEquity = initialBalance.plus(netPnl);

      return {
        id: acc.id,
        name: acc.name,
        broker: acc.broker,
        platform: acc.platform,
        accountNumber: acc.accountNumber,
        currency: acc.currency,
        initialBalance: formatMoney(initialBalance),
        brokerTimezone: acc.brokerTimezone,
        displayTimezone: acc.displayTimezone,
        tradeCount: acc._count.trades,
        netPnl: formatMoney(netPnl),
        currentEquity: formatMoney(currentEquity),
        createdAt: acc.createdAt.toISOString(),
        updatedAt: acc.updatedAt.toISOString(),
      };
    });
  }

  async findOne(id: string) {
    const account = await this.prisma.tradingAccount.findUnique({
      where: { id },
      include: { _count: { select: { trades: true } } },
    });
    if (!account) {
      throw new NotFoundException(`TradingAccount ${id} not found`);
    }
    return {
      ...account,
      initialBalance: formatMoney(new Decimal(account.initialBalance.toString())),
      tradeCount: account._count.trades,
    };
  }

  async create(input: CreateAccountInput) {
    const user = await this.defaultUser.getDefaultUser();

    try {
      const created = await this.prisma.tradingAccount.create({
        data: {
          userId: user.id,
          name: input.name,
          broker: input.broker ?? null,
          platform: input.platform as Platform,
          accountNumber: input.accountNumber,
          currency: input.currency.toUpperCase(),
          initialBalance: new Prisma.Decimal(input.initialBalance),
          brokerTimezone: input.brokerTimezone,
          displayTimezone: input.displayTimezone,
        },
      });
      return {
        ...created,
        initialBalance: formatMoney(new Decimal(created.initialBalance.toString())),
      };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException(
          `Account ${input.platform} #${input.accountNumber} already exists`,
        );
      }
      throw err;
    }
  }

  async update(id: string, input: UpdateAccountInput) {
    await this.findOne(id);

    try {
      const updated = await this.prisma.tradingAccount.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.broker !== undefined ? { broker: input.broker } : {}),
          ...(input.platform !== undefined ? { platform: input.platform as Platform } : {}),
          ...(input.accountNumber !== undefined ? { accountNumber: input.accountNumber } : {}),
          ...(input.currency !== undefined ? { currency: input.currency.toUpperCase() } : {}),
          ...(input.initialBalance !== undefined
            ? { initialBalance: new Prisma.Decimal(input.initialBalance) }
            : {}),
          ...(input.brokerTimezone !== undefined ? { brokerTimezone: input.brokerTimezone } : {}),
          ...(input.displayTimezone !== undefined
            ? { displayTimezone: input.displayTimezone }
            : {}),
        },
      });

      return {
        ...updated,
        initialBalance: formatMoney(new Decimal(updated.initialBalance.toString())),
      };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Another account with this platform & accountNumber exists');
      }
      throw err;
    }
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.tradingAccount.delete({ where: { id } });
    return { deleted: true, id };
  }

  /**
   * Used by MT5 Webhook Adapter to resolve or auto-register an account by `accountNumber`.
   */
  async findOrCreateByMt5AccountNumber(params: {
    accountNumber: string;
    broker?: string;
    currency?: string;
    brokerTimezone?: string;
  }) {
    const user = await this.defaultUser.getDefaultUser();
    const existing = await this.prisma.tradingAccount.findUnique({
      where: {
        userId_platform_accountNumber: {
          userId: user.id,
          platform: Platform.MT5,
          accountNumber: params.accountNumber,
        },
      },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.tradingAccount.create({
      data: {
        userId: user.id,
        name: params.broker ? `${params.broker} #${params.accountNumber}` : `MT5 #${params.accountNumber}`,
        broker: params.broker ?? null,
        platform: Platform.MT5,
        accountNumber: params.accountNumber,
        currency: (params.currency ?? 'USD').toUpperCase(),
        initialBalance: new Prisma.Decimal('0'),
        brokerTimezone: params.brokerTimezone ?? 'Europe/Athens',
        displayTimezone: user.displayTimezone,
      },
    });
  }
}
