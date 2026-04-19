-- CreateEnum
CREATE TYPE "MarketContextRefreshSource" AS ENUM ('INITIAL', 'MANUAL', 'AUTO');

-- CreateTable
CREATE TABLE "MarketContextSnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "snapshotJson" JSONB NOT NULL,
    "snapshotAsOf" TEXT NOT NULL,
    "lastSuccessfulRefreshAt" TIMESTAMP(3),
    "lastRefreshAttemptAt" TIMESTAMP(3) NOT NULL,
    "lastRefreshError" TEXT,
    "lastRefreshSource" "MarketContextRefreshSource" NOT NULL,
    "lastAutoRefreshDate" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketContextSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MarketContextSnapshot_userId_key" ON "MarketContextSnapshot"("userId");

-- CreateIndex
CREATE INDEX "MarketContextSnapshot_lastAutoRefreshDate_updatedAt_idx" ON "MarketContextSnapshot"("lastAutoRefreshDate", "updatedAt");

-- AddForeignKey
ALTER TABLE "MarketContextSnapshot" ADD CONSTRAINT "MarketContextSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
