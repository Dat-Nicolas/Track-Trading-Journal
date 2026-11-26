import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AccountsModule } from './accounts/accounts.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AppController } from './app.controller';
import { CommonModule } from './common/common.module';
import { IngestionModule } from './ingestion/ingestion.module';
import { PrismaModule } from './prisma/prisma.module';
import { SoloModule } from './solo/solo.module';
import { TagsModule } from './tags/tags.module';
import { TradesModule } from './trades/trades.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    PrismaModule,
    CommonModule,
    AccountsModule,
    TagsModule,
    TradesModule,
    IngestionModule,
    AnalyticsModule,
    SoloModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
