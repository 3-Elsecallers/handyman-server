-- AlterEnum
-- Add new values to BookingPaymentStatus (additive; existing records valid)
ALTER TYPE "BookingPaymentStatus" ADD VALUE IF NOT EXISTS 'accepted';
ALTER TYPE "BookingPaymentStatus" ADD VALUE IF NOT EXISTS 'in_progress';
ALTER TYPE "BookingPaymentStatus" ADD VALUE IF NOT EXISTS 'cash_outstanding';
ALTER TYPE "BookingPaymentStatus" ADD VALUE IF NOT EXISTS 'cash_collected';
ALTER TYPE "BookingPaymentStatus" ADD VALUE IF NOT EXISTS 'confirmed';

-- CreateEnum
CREATE TYPE "BookingPaymentMethod" AS ENUM ('online', 'cash');

-- AlterTable
ALTER TABLE "Booking"
  ADD COLUMN "paymentMethod" "BookingPaymentMethod" NOT NULL DEFAULT 'online',
  ADD COLUMN "paymentConfirmedById" TEXT,
  ADD COLUMN "paymentConfirmedAt" TIMESTAMP(3),
  ADD COLUMN "paymentAmountExpected" DOUBLE PRECISION,
  ADD COLUMN "paymentDueAt" TIMESTAMP(3);
