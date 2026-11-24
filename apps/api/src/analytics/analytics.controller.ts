import { Controller, Get, Query } from '@nestjs/common';
import { AnalyticsFilterInput, AnalyticsFilterSchema } from '@trackdailytrade/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  getOverview(
    @Query(new ZodValidationPipe(AnalyticsFilterSchema)) filter: AnalyticsFilterInput,
  ) {
    return this.analyticsService.getOverview(filter);
  }

  @Get('equity-curve')
  getEquityCurve(
    @Query(new ZodValidationPipe(AnalyticsFilterSchema)) filter: AnalyticsFilterInput,
  ) {
    return this.analyticsService.getEquityCurve(filter);
  }

  @Get('calendar')
  getCalendar(
    @Query(new ZodValidationPipe(AnalyticsFilterSchema)) filter: AnalyticsFilterInput,
    @Query('month') month?: string,
  ) {
    return this.analyticsService.getCalendar(filter, month);
  }

  @Get('breakdowns')
  getBreakdowns(
    @Query(new ZodValidationPipe(AnalyticsFilterSchema)) filter: AnalyticsFilterInput,
  ) {
    return this.analyticsService.getBreakdowns(filter);
  }
}
