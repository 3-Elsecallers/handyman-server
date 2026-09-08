-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('online', 'cash');

-- Extend PayoutStatus
ALTER TYPE "PayoutStatus" ADD VALUE IF NOT EXISTS 'reversed';

-- CreateEnum
CREATE TYPE "PayoutRequestStatus" AS ENUM ('pending', 'processing', 'processed', 'failed', 'reversed');

-- CreateEnum
CREATE TYPE "PayoutMedium" AS ENUM ('mobile_money', 'bank');

-- CreateEnum
CREATE TYPE "LedgerAccountType" AS ENUM ('collected', 'provider_wallet', 'platform_fee', 'reserve');

-- CreateEnum
CREATE TYPE "LedgerEntryType" AS ENUM ('payment_allocated', 'platform_fee', 'cash_fee', 'hold', 'release', 'tip', 'payout', 'refund', 'company_withdrawal', 'adjustment');

-- AlterTable
ALTER TABLE "Payment"
  ADD COLUMN "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'online',
  ADD COLUMN "providerConfirmedAt" TIMESTAMP(3),
  ADD COLUMN "providerConfirmedById" TEXT,
  ADD COLUMN "cashCollectedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "LedgerAccount" (
  "id" TEXT NOT NULL,
  "type" "LedgerAccountType" NOT NULL,
  "ownerId" TEXT,
  "currency" TEXT NOT NULL DEFAULT 'GHS',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LedgerAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerEntry" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "counterpartyId" TEXT,
  "type" "LedgerEntryType" NOT NULL,
  "credit" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "debit" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'GHS',
  "refType" TEXT,
  "refId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayoutMethod" (
  "id" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "providerUserId" TEXT NOT NULL,
  "medium" "PayoutMedium" NOT NULL,
  "network" TEXT,
  "accountName" TEXT,
  "accountNumberEncrypted" TEXT NOT NULL,
  "bankCode" TEXT,
  "bankName" TEXT,
  "recipientCode" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PayoutMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayoutRequest" (
  "id" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "providerUserId" TEXT NOT NULL,
  "medium" "PayoutMedium" NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "fee" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "netAmount" DOUBLE PRECISION NOT NULL,
  "status" "PayoutRequestStatus" NOT NULL DEFAULT 'pending',
  "paystackRef" TEXT,
  "transferCode" TEXT,
  "recipientCode" TEXT,
  "initiatedById" TEXT,
  "scheduledAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "reversedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PayoutRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LedgerAccount_type_ownerId_key" ON "LedgerAccount"("type", "ownerId");

-- CreateIndex
CREATE INDEX "LedgerAccount_type_idx" ON "LedgerAccount"("type");

-- CreateIndex
CREATE INDEX "LedgerAccount_ownerId_idx" ON "LedgerAccount"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerEntry_refType_refId_type_accountId_key" ON "LedgerEntry"("refType", "refId", "type", "accountId");

-- CreateIndex
CREATE INDEX "LedgerEntry_accountId_idx" ON "LedgerEntry"("accountId");

-- CreateIndex
CREATE INDEX "LedgerEntry_counterpartyId_idx" ON "LedgerEntry"("counterpartyId");

-- CreateIndex
CREATE INDEX "LedgerEntry_refType_refId_idx" ON "LedgerEntry"("refType", "refId");

-- CreateIndex
CREATE INDEX "LedgerEntry_createdAt_idx" ON "LedgerEntry"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PayoutMethod_providerId_key" ON "PayoutMethod"("providerId");

-- CreateIndex
CREATE INDEX "PayoutMethod_providerId_idx" ON "PayoutMethod"("providerId");

-- CreateIndex
CREATE INDEX "PayoutMethod_isActive_idx" ON "PayoutMethod"("isActive");

-- CreateIndex
CREATE INDEX "PayoutRequest_providerId_idx" ON "PayoutRequest"("providerId");

-- CreateIndex
CREATE INDEX "PayoutRequest_providerUserId_idx" ON "PayoutRequest"("providerUserId");

-- CreateIndex
CREATE INDEX "PayoutRequest_status_idx" ON "PayoutRequest"("status");

-- CreateIndex
CREATE INDEX "PayoutRequest_paystackRef_idx" ON "PayoutRequest"("paystackRef");

-- Seed ledger accounts (idempotent)
INSERT INTO "LedgerAccount" ("id", "type", "currency", "createdAt", "updatedAt")
SELECT 'collected', 'collected', 'GHS', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "LedgerAccount" WHERE "type" = 'collected' AND "ownerId" IS NULL);

INSERT INTO "LedgerAccount" ("id", "type", "currency", "createdAt", "updatedAt")
SELECT 'platform_fee', 'platform_fee', 'GHS', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "LedgerAccount" WHERE "type" = 'platform_fee' AND "ownerId" IS NULL);

INSERT INTO "LedgerAccount" ("id", "type", "currency", "createdAt", "updatedAt")
SELECT 'reserve', 'reserve', 'GHS', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "LedgerAccount" WHERE "type" = 'reserve' AND "ownerId" IS NULL);
