# TrackDailyTrade — Phase 1 Progress

- [x] **Milestone 1**: Setup Monorepo (`pnpm` workspaces + Turborepo), `docker-compose.yml` (PostgreSQL 16), `@trackdailytrade/shared`, scaffold `apps/api` & `apps/web`.
- [x] **Milestone 2**: Prisma Schema (100% `Decimal` cho trường tài chính, `initialStopLoss`/`initialRiskAmount`/`rMultiple`/`isManualRisk`, `brokerTimezone`, `Candle` sẵn cho Phase 2), migration `20261123235124_init` và `seed.ts`.
- [x] **Milestone 3**: Backend Core APIs (`Accounts`, `Tags`, `Trades` journal & manual risk override) + Adapter Ingestion (`Mt5WebhookAdapter` server-time → UTC, `Mt5StatementImportAdapter` HTML UTF-16LE/UTF-8 `Positions` & CSV, `TradeIngestionService` idempotent upsert).
- [x] **Milestone 4**: Backend Analytics Engine (`overview`, `equity-curve`, `calendar`, `breakdowns` với `Decimal` + `Luxon` + `startingEquity` cộng dồn trước `from`) & Jest Unit Tests (3 suites / 8 tests pass + live integration smoke test pass).
- [x] **Milestone 5**: Frontend Trading Journal & Analytics Dashboard (`apps/web`: Dark-first UI, KPIs, TradingView Lightweight Charts Equity Curve, Recharts Breakdowns, Calendar PnL, Trade Detail Drawer, MT5 Import Preview & Accounts/Tags management).
- [x] **Milestone 6**: MT5 MQL5 Expert Advisor (`ea/TrackDailyTrade.mq5` — partial close aggregation, `DEAL_ENTRY_IN` + `TRADE_TRANSACTION_POSITION` initial SL capture, server-time JSON, startup backfill + chart Sync button) & `ea/README.md`.
