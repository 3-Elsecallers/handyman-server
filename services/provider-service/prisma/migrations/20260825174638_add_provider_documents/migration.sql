-- CreateEnum
CREATE TYPE "DocumentCategory" AS ENUM ('selfie', 'ghana_card', 'additional');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('uploaded', 'pending_review', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('not_submitted', 'pending_review', 'approved', 'rejected');

-- AlterTable
ALTER TABLE "ProviderProfile" ADD COLUMN     "rejectionNote" TEXT,
ADD COLUMN     "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'not_submitted';

-- CreateTable
CREATE TABLE "ProviderDocument" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "category" "DocumentCategory" NOT NULL,
    "s3Key" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'uploaded',
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProviderDocument_providerId_category_idx" ON "ProviderDocument"("providerId", "category");

-- CreateIndex
CREATE INDEX "ProviderDocument_providerId_status_idx" ON "ProviderDocument"("providerId", "status");

-- AddForeignKey
ALTER TABLE "ProviderDocument" ADD CONSTRAINT "ProviderDocument_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "ProviderProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
