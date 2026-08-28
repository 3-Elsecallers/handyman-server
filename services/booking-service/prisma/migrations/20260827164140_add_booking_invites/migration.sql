-- CreateEnum
CREATE TYPE "InviteStatus" AS ENUM ('pending', 'accepted', 'declined', 'expired');

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "scheduledWindowEnd" TIMESTAMP(3),
ALTER COLUMN "providerId" DROP NOT NULL,
ALTER COLUMN "providerUserId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "BookingInvite" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "providerUserId" TEXT NOT NULL,
    "status" "InviteStatus" NOT NULL DEFAULT 'pending',
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BookingInvite_bookingId_idx" ON "BookingInvite"("bookingId");

-- CreateIndex
CREATE INDEX "BookingInvite_providerId_status_idx" ON "BookingInvite"("providerId", "status");

-- AddForeignKey
ALTER TABLE "BookingInvite" ADD CONSTRAINT "BookingInvite_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
