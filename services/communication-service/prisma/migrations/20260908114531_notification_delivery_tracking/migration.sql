-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('pending', 'delivered', 'failed');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'booking_started';
ALTER TYPE "NotificationType" ADD VALUE 'booking_reassigned';
ALTER TYPE "NotificationType" ADD VALUE 'payment_reminder';

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "deliveryAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastDeliveryAt" TIMESTAMP(3),
ADD COLUMN     "status" "NotificationStatus" NOT NULL DEFAULT 'pending';

-- CreateIndex
CREATE INDEX "Notification_status_createdAt_idx" ON "Notification"("status", "createdAt");
