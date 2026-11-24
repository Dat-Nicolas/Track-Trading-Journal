# TrackDailyTrade — Phase 1 Handoff Summary

Toàn bộ **6 Milestones của MVP Phase 1** đã được hoàn thành và tự kiểm chứng đầy đủ (xem chi tiết từng mốc tại `PROGRESS.md`).

---

## 1. Danh sách tính năng đã hoàn thành

### Hạ tầng & Database (Milestones 1–2)
- **Monorepo**: `pnpm` workspaces (`pnpm@9.15.4`) + Turborepo gồm `apps/api` (NestJS), `apps/web` (Next.js 15 App Router), `packages/shared` (Zod schemas & TS types), `ea/` (MT5 MQL5 EA).
- **Docker Compose**: PostgreSQL 16 (`docker-compose.yml`, container `trackdailytrade-postgres` trên cổng `5432`).
- **Prisma Schema** (`apps/api/prisma/schema.prisma`):
  - 100% trường tài chính dùng `DECIMAL` (`@db.Decimal(18, 8)`, `@db.Decimal(18, 2)`, `@db.Decimal(10, 4)`), không dùng `Float`.
  - Hỗ trợ `externalId` (= MT5 `positionId`) với unique `(accountId, externalId)`.
  - Đầy đủ trường `initialStopLoss`, `initialRiskAmount`, `rMultiple`, `isManualRisk` (khóa bảo vệ rủi ro chỉnh tay).
  - Trường `brokerTimezone` (mặc định `Europe/Athens` DST GMT+2/GMT+3) và `displayTimezone` (mặc định `Asia/Ho_Chi_Minh`).
  - Bảng `Candle` tạo sẵn cho Phase 2 Trade Replay.
  - Seed dữ liệu mặc định (`apps/api/prisma/seed.ts`): Default User, 1 MT5 Account mẫu (`MT5-DEMO-001`, `initialBalance: 10000.00`), 5 Strategy Tags (`BB Tier 3`, `SMC MTF`, `Tier SSS`, `FOMO`, `News Event`).

### Backend Core, Auto-Sync Adapters & Analytics Engine (Milestones 3–4)
- **CRUD APIs**:
  - `/api/accounts` (kèm `tradeCount`, `netPnl`, `currentEquity`)
  - `/api/tags` (Tag phẳng + màu sắc + `tradeCount`)
  - `/api/trades` (lọc đa tiêu chí, tìm kiếm, phân trang, cập nhật `note`, gắn/gỡ `tagIds`, sửa tay `initialStopLoss`/`initialRiskAmount` tự bật `isManualRisk = true` & tính lại `rMultiple`).
- **Adapter Ingestion Layer**:
  - `Mt5WebhookAdapter` (`POST /api/webhooks/mt5/trade`, `POST /api/webhooks/mt5/batch`): nhận `openTimeServer` / `closeTimeServer` theo giờ server sàn và quy đổi bằng `account.brokerTimezone` → UTC (an toàn 100% khi backfill cuối tuần).
  - `Mt5StatementImportAdapter` (`POST /api/imports/mt5`, `GET /api/imports/logs`): tự nhận diện **UTF-16LE** & **UTF-8**, parse chuẩn bảng **Positions** trong MT5 HTML Report (lọc cột `hidden`, bỏ qua `balance`/`Orders`/`Deals`), hỗ trợ CSV fallback và chế độ `dryRun=true` để xem trước trước khi lưu.
  - `TradeIngestionService`: Upsert idempotent bảo toàn tuyệt đối `note`, `tags`, và `initialStopLoss`/`initialRiskAmount` khi `isManualRisk === true`, đồng thời ghi `SyncLog`.
- **Analytics Engine (`/api/analytics/*`)**:
  - `overview`: Net PnL, Win Rate, Profit Factor, Expectancy (`$` & `R`), Avg Win/Loss, Avg Holding Time, `startingEquity = initialBalance + SUM(netPnl where closeTime < from)` khi lọc theo `from`, Ending Equity, Max Drawdown (`$` và `%`).
  - `equity-curve`: Chuỗi equity & drawdown theo thời gian phục vụ TradingView Lightweight Charts.
  - `calendar?month=YYYY-MM`: Lời/lỗ gom theo từng ngày trong `displayTimezone`.
  - `breakdowns`: Phân tích theo Khung giờ (`00:00–23:00`), Ngày trong tuần (`Mon–Sun`), Thời gian giữ lệnh (`<5m`, `5m–15m`, `15m–1h`, `1h–4h`, `4h–24h`, `>24h`) và theo **Strategy Tag**.

### Frontend Dark-first Dashboard (Milestone 5)
- **`/` (Analytics Dashboard)**: Global Filter Bar (Account, Symbol, Strategy Tag, Date Range + presets `7D`/`30D`/`90D`/`YTD`/`All`, Timezone), 8 KPI cards, biểu đồ **Equity Curve** (TradingView Lightweight Charts có tooltip & baseline), biểu đồ **Performance Breakdowns** (Recharts + bảng xếp hạng Strategy Tags).
- **`/trades` (Trade Journal)**: Bảng lệnh phân trang, ô tìm kiếm, click bất kỳ lệnh nào để mở **Trade Detail Drawer** chỉnh sửa `note`, gắn/tạo nhanh Tag phẳng ngay tại chỗ, và chỉnh `initialStopLoss`/`initialRiskAmount` xem `rMultiple` cập nhật tức thì.
- **`/calendar` (Calendar PnL)**: Lịch tháng kiểu TradeZella có màu xanh/đỏ theo ngày và cột tổng kết từng tuần (`W1`–`W5`).
- **`/import` (Import & Sync Logs)**: Kéo thả MT5 HTML/CSV, chọn tài khoản & `brokerTimezone`, **Preview (Dry Run)** rồi xác nhận Import + bảng lịch sử `SyncLog`.
- **`/accounts` (Accounts & Tags)**: Thêm/xóa `TradingAccount`, sao chép nhanh Webhook URL cho MT5 EA, quản lý danh sách Strategy Tags.

### MT5 Expert Advisor (Milestone 6)
- **`ea/TrackDailyTrade.mq5`**: MQL5 thuần không thư viện ngoài, triển khai đầy đủ:
  - Chống miss lệnh: realtime `OnTradeTransaction` + backfill tự động `InpBackfillDays` ngày khi khởi chạy `OnInit()` + nút **`Sync Now (7d)`** ngay trên chart (`OnChartEvent`).
  - Partial close aggregation theo `positionId` (chỉ bắn khi `remainingVolume == 0`, tự tính giá mở/đóng trung bình gia quyền & tổng PnL/commission/fee/swap).
  - Bắt `initialStopLoss` & `initialRiskAmount` (qua `OrderCalcProfit`) ở cả `DEAL_ENTRY_IN` lẫn `TRADE_TRANSACTION_POSITION` (khi mở lệnh SL = 0 rồi mới kéo SL lần đầu), khóa cứng và lưu file `MQL5/Files/TrackDailyTrade_risk_<Login>.csv` để không bị ghi đè khi dời SL về BE/trailing.
  - Gửi `openTimeServer` / `closeTimeServer` theo giờ server sàn để Backend quy đổi UTC.
- **`ea/README.md`**: Hướng dẫn từng bước compile trong MetaEditor và bật `Allow WebRequest`.

---

## 2. Kết quả Build & Test

| Kiểm tra | Kết quả | Chi tiết |
|---|---|---|
| `pnpm test` | **PASS (100%)** | 3/3 Jest test suites (8/8 tests): UTF-16LE/UTF-8 MT5 HTML & CSV import + DST `Europe/Athens`, idempotent upsert bảo toàn `note`/`tags`/`isManualRisk`, Analytics KPIs + `startingEquity` khi có `from` + UTC+7 bucketing. |
| `pnpm typecheck` | **PASS (100%)** | 4/4 workspace tasks (`shared`, `api`, `web`), 0 lỗi TypeScript. |
| `pnpm build` | **PASS (100%)** | 3/3 packages (`tsc`, `nest build`, `next build` 8/8 routes). |
| Live API + DB Smoke Test | **PASS (100%)** | Test trực tiếp trên PostgreSQL 16: Webhook batch → DST conversion → PATCH Journal → Re-sync backfill idempotency → Analytics APIs (đã dọn sạch dữ liệu test). |
| Live Web Routes Check | **PASS (100%)** | Cả 5 route `/`, `/trades`, `/calendar`, `/import`, `/accounts` đều trả HTTP `200`, API `/api/health` trả HTTP `200`. |

---

## 3. Lệnh chạy ứng dụng ngay

```bash
# 1. Đảm bảo PostgreSQL 16 đang chạy (nếu bạn vừa restart máy)
pnpm db:up

# 2. Chạy song song Backend API (port 3001) và Frontend Web (port 3000)
pnpm dev
```

Sau đó mở trình duyệt tại:
- **Web App**: http://localhost:3000
- **API Health**: http://localhost:3001/api/health
- **Prisma Studio** *(tùy chọn, xem trực tiếp DB)*: `pnpm db:studio`

---

## 4. Các điểm cần kiểm tra thủ công

1. **Compile `ea/TrackDailyTrade.mq5` trên MetaEditor 5**:
   - Do môi trường macOS hiện tại không cài sẵn MetaEditor/MT5 terminal, file `.mq5` đã được rà soát kỹ cú pháp MQL5 `#property strict` (forward declarations, `StringToCharArray` loại bỏ byte NUL cuối chuỗi cho JSON, 2-pass `HistorySelect` + `HistorySelectByPosition`, không dùng thư viện ngoài).
   - Bạn copy `ea/TrackDailyTrade.mq5` vào `MQL5/Experts/`, bấm `F7` trên MetaEditor để compile sang `.ex5`, bật `Allow WebRequest` cho `http://127.0.0.1:3001` theo hướng dẫn trong `ea/README.md` và bấm thử nút **Sync Now (7d)** trên chart MT5.
2. **Import thử file MT5 HTML Report thật của sàn bạn đang trade**:
   - Vào http://localhost:3000/import, chọn đúng `Broker Server Timezone` của sàn (mặc định `Europe/Athens`), chạy **Preview (Dry Run)** để đối chiếu giờ mở/đóng lệnh sau khi đổi sang `UTC+7` rồi bấm xác nhận Import.
3. **Định hướng Phase 2 (khi bạn sẵn sàng)**:
   - Bổ sung đẩy nến M1/M5 từ MT5 EA vào bảng `Candle` (đã tạo sẵn trong DB) và dựng màn hình **Trade Replay** bằng TradingView Lightweight Charts.
   - Mở rộng thêm Adapter cho **Binance / Bybit API** dựa trên interface `ITradeIngestionAdapter`.
   - Bật xác thực `webhookSecret` và Login/JWT khi deploy lên server/VPS.
