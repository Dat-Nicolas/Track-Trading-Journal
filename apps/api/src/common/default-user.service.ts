import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export const DEFAULT_USER_EMAIL = 'trader@trackdailytrade.local';

@Injectable()
export class DefaultUserService {
  constructor(private readonly prisma: PrismaService) {}

  async getDefaultUser(): Promise<User> {
    return this.prisma.user.upsert({
      where: { email: DEFAULT_USER_EMAIL },
      update: {},
      create: {
        email: DEFAULT_USER_EMAIL,
        name: 'Default Trader',
        displayTimezone: 'Asia/Ho_Chi_Minh',
      },
    });
  }
}
