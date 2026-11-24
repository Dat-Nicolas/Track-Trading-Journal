import { Controller, Get } from '@nestjs/common';
import { PlatformEnum } from '@trackdailytrade/shared';
import { PrismaService } from './prisma/prisma.service';

@Controller('health')
export class AppController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async getHealth() {
    const [accountCount, tagCount, tradeCount] = await Promise.all([
      this.prisma.tradingAccount.count(),
      this.prisma.tag.count(),
      this.prisma.trade.count(),
    ]);

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      supportedPlatforms: PlatformEnum.options,
      db: {
        accounts: accountCount,
        tags: tagCount,
        trades: tradeCount,
      },
    };
  }
}
