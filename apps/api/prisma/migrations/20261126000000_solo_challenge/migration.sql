-- CreateEnum
CREATE TYPE "SoloStatus" AS ENUM ('WAITING', 'ACTIVE', 'COMPLETED');

-- CreateEnum
CREATE TYPE "SoloRole" AS ENUM ('HOST', 'GUEST');

-- CreateTable
CREATE TABLE "SoloChallenge" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT,
    "status" "SoloStatus" NOT NULL DEFAULT 'WAITING',
    "durationMinutes" INTEGER NOT NULL,
    "startingCapital" DECIMAL(18,2) NOT NULL,
    "stakeAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "stakeUnit" TEXT NOT NULL DEFAULT 'đồng',
    "startTime" TIMESTAMP(3),
    "endTime" TIMESTAMP(3),
    "winnerId" TEXT,
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SoloChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SoloParticipant" (
    "id" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "role" "SoloRole" NOT NULL,
    "finalNetPnl" DECIMAL(18,2),
    "finalRoiPct" DECIMAL(10,4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SoloParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SoloChallenge_code_key" ON "SoloChallenge"("code");

-- CreateIndex
CREATE UNIQUE INDEX "SoloParticipant_challengeId_role_key" ON "SoloParticipant"("challengeId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "SoloParticipant_challengeId_accountId_key" ON "SoloParticipant"("challengeId", "accountId");

-- AddForeignKey
ALTER TABLE "SoloParticipant" ADD CONSTRAINT "SoloParticipant_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "SoloChallenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SoloParticipant" ADD CONSTRAINT "SoloParticipant_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "TradingAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
