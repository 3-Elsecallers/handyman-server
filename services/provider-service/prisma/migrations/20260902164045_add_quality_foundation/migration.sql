-- AlterTable
ALTER TABLE "ProviderProfile" ADD COLUMN     "competencyTier" TEXT NOT NULL DEFAULT 'apprentice',
ADD COLUMN     "flaggedConditions" JSONB,
ADD COLUMN     "joinedAt" TIMESTAMP(3),
ADD COLUMN     "lastQualityReview" TIMESTAMP(3),
ADD COLUMN     "probationaryBookingsRemaining" INTEGER,
ADD COLUMN     "probationaryEndDate" TIMESTAMP(3),
ADD COLUMN     "qualityGrade" TEXT NOT NULL DEFAULT 'bronze',
ADD COLUMN     "suspendedAt" TIMESTAMP(3),
ADD COLUMN     "suspendedReason" TEXT;

-- CreateTable
CREATE TABLE "ProviderQualityFlag" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'warning',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderQualityFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderBookingWindow" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderBookingWindow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProviderQualityFlag_providerId_active_idx" ON "ProviderQualityFlag"("providerId", "active");

-- CreateIndex
CREATE INDEX "ProviderQualityFlag_code_idx" ON "ProviderQualityFlag"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderBookingWindow_bookingId_key" ON "ProviderBookingWindow"("bookingId");

-- CreateIndex
CREATE INDEX "ProviderBookingWindow_providerId_createdAt_idx" ON "ProviderBookingWindow"("providerId", "createdAt");

-- CreateIndex
CREATE INDEX "ProviderBookingWindow_providerId_outcome_idx" ON "ProviderBookingWindow"("providerId", "outcome");

-- CreateIndex
CREATE INDEX "ProviderProfile_competencyTier_idx" ON "ProviderProfile"("competencyTier");

-- CreateIndex
CREATE INDEX "ProviderProfile_qualityGrade_idx" ON "ProviderProfile"("qualityGrade");

-- AddForeignKey
ALTER TABLE "ProviderQualityFlag" ADD CONSTRAINT "ProviderQualityFlag_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "ProviderProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderBookingWindow" ADD CONSTRAINT "ProviderBookingWindow_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "ProviderProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
