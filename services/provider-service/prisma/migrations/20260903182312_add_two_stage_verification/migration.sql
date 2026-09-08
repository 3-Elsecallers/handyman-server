-- CreateEnum
CREATE TYPE "IdentityStatus" AS ENUM ('not_submitted', 'pending_review', 'approved', 'rejected');

-- AlterTable
ALTER TABLE "ProviderAttestation" ADD COLUMN     "serviceId" TEXT;

-- AlterTable
ALTER TABLE "ProviderProfile" ADD COLUMN     "identityRejectionNote" TEXT,
ADD COLUMN     "identityStatus" "IdentityStatus" NOT NULL DEFAULT 'not_submitted',
ADD COLUMN     "identityVerified" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ProviderService" ADD COLUMN     "rejectionNote" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "status" "VerificationStatus" NOT NULL DEFAULT 'not_submitted',
ADD COLUMN     "submittedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "ProviderAttestation_serviceId_idx" ON "ProviderAttestation"("serviceId");

-- CreateIndex
CREATE INDEX "ProviderService_providerId_status_idx" ON "ProviderService"("providerId", "status");

-- AddForeignKey
ALTER TABLE "ProviderAttestation" ADD CONSTRAINT "ProviderAttestation_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "ProviderService"("id") ON DELETE SET NULL ON UPDATE CASCADE;
