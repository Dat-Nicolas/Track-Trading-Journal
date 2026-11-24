import { Platform, Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const DEFAULT_USER_EMAIL = 'trader@trackdailytrade.local';

async function main() {
  const user = await prisma.user.upsert({
    where: { email: DEFAULT_USER_EMAIL },
    update: {},
    create: {
      email: DEFAULT_USER_EMAIL,
      name: 'Default Trader',
      displayTimezone: 'Asia/Ho_Chi_Minh',
    },
  });

  const defaultAccount = await prisma.tradingAccount.upsert({
    where: {
      userId_platform_accountNumber: {
        userId: user.id,
        platform: Platform.MT5,
        accountNumber: 'MT5-DEMO-001',
      },
    },
    update: {},
    create: {
      userId: user.id,
      name: 'MT5 Primary Account',
      broker: 'Default MT5 Broker',
      platform: Platform.MT5,
      accountNumber: 'MT5-DEMO-001',
      currency: 'USD',
      initialBalance: new Prisma.Decimal('10000.00'),
      brokerTimezone: 'Europe/Athens',
      displayTimezone: 'Asia/Ho_Chi_Minh',
    },
  });

  const sampleTags = [
    { name: 'BB Tier 3', color: '#3b82f6' },
    { name: 'SMC MTF', color: '#8b5cf6' },
    { name: 'Tier SSS', color: '#10b981' },
    { name: 'FOMO', color: '#ef4444' },
    { name: 'News Event', color: '#f59e0b' },
  ];

  for (const tag of sampleTags) {
    await prisma.tag.upsert({
      where: {
        userId_name: {
          userId: user.id,
          name: tag.name,
        },
      },
      update: { color: tag.color },
      create: {
        userId: user.id,
        name: tag.name,
        color: tag.color,
      },
    });
  }

  console.log('Seed completed:', {
    userId: user.id,
    email: user.email,
    defaultAccountId: defaultAccount.id,
    tagsSeeded: sampleTags.length,
  });
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
