-- Solo chuyển sang đánh vàng giả lập trên web: bỏ liên kết MT5, thêm token người chơi + bảng lệnh.
-- Kèo cũ (gắn tài khoản MT5) không tương thích nên xoá.
DELETE FROM "SoloChallenge";

-- DropForeignKey
ALTER TABLE "SoloParticipant" DROP CONSTRAINT "SoloParticipant_accountId_fkey";

-- DropIndex
DROP INDEX "SoloParticipant_challengeId_accountId_key";

-- AlterTable
ALTER TABLE "SoloParticipant" DROP COLUMN "accountId",
ADD COLUMN     "token" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "SoloPosition" (
    "id" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "side" "TradeDirection" NOT NULL,
    "lots" DECIMAL(10,2) NOT NULL,
    "entryPrice" DECIMAL(18,4) NOT NULL,
    "stopLoss" DECIMAL(18,4),
    "takeProfit" DECIMAL(18,4),
    "openTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "exitPrice" DECIMAL(18,4),
    "closeTime" TIMESTAMP(3),
    "closeReason" TEXT,
    "netPnl" DECIMAL(18,2),

    CONSTRAINT "SoloPosition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SoloPosition_participantId_idx" ON "SoloPosition"("participantId");

-- AddForeignKey
ALTER TABLE "SoloPosition" ADD CONSTRAINT "SoloPosition_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "SoloParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
