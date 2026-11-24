import { Body, Controller, Delete, Get, Param, Patch, Query } from '@nestjs/common';
import {
  TradeQueryInput,
  TradeQuerySchema,
  UpdateTradeJournalInput,
  UpdateTradeJournalSchema,
} from '@trackdailytrade/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { TradesService } from './trades.service';

@Controller('trades')
export class TradesController {
  constructor(private readonly tradesService: TradesService) {}

  @Get()
  findAll(@Query(new ZodValidationPipe(TradeQuerySchema)) query: TradeQueryInput) {
    return this.tradesService.findAll(query);
  }

  @Get('symbols')
  getSymbols(@Query('accountId') accountId?: string) {
    return this.tradesService.getDistinctSymbols(accountId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tradesService.findOne(id);
  }

  @Patch(':id')
  updateJournal(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateTradeJournalSchema)) body: UpdateTradeJournalInput,
  ) {
    return this.tradesService.updateJournal(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.tradesService.remove(id);
  }
}
