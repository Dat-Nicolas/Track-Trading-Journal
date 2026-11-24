import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module';
import { Mt5StatementImportAdapter } from './adapters/mt5-statement-import.adapter';
import { Mt5WebhookAdapter } from './adapters/mt5-webhook.adapter';
import { ImportsController } from './imports.controller';
import { TradeIngestionService } from './ingestion.service';
import { WebhooksController } from './webhooks.controller';

@Module({
  imports: [AccountsModule],
  controllers: [WebhooksController, ImportsController],
  providers: [Mt5WebhookAdapter, Mt5StatementImportAdapter, TradeIngestionService],
  exports: [TradeIngestionService, Mt5WebhookAdapter, Mt5StatementImportAdapter],
})
export class IngestionModule {}
