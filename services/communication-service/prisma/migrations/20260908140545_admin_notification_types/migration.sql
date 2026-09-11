-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'admin_new_signup';
ALTER TYPE "NotificationType" ADD VALUE 'admin_identity_verification_request';
ALTER TYPE "NotificationType" ADD VALUE 'admin_service_verification_request';
