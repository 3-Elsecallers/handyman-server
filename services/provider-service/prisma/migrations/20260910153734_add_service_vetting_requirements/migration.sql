/*
  Warnings:

  - A unique constraint covering the columns `[providerId,serviceRequirementId]` on the table `ProviderAttestation` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[providerId,serviceQuestionId]` on the table `ProviderAttestation` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "ProviderAttestation" ADD COLUMN     "serviceQuestionId" TEXT,
ADD COLUMN     "serviceRequirementId" TEXT;

-- AlterTable
ALTER TABLE "ProviderDocument" ADD COLUMN     "serviceRequirementId" TEXT;

-- CreateTable
CREATE TABLE "ServiceVettingRequirement" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "type" "RequirementType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "acceptedMimeTypes" TEXT[],
    "maxFileSizeMb" INTEGER NOT NULL DEFAULT 10,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceVettingRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceQuestion" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "type" "QuestionType" NOT NULL,
    "options" TEXT[],
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServiceVettingRequirement_serviceId_idx" ON "ServiceVettingRequirement"("serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceVettingRequirement_serviceId_name_key" ON "ServiceVettingRequirement"("serviceId", "name");

-- CreateIndex
CREATE INDEX "ServiceQuestion_serviceId_idx" ON "ServiceQuestion"("serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderAttestation_providerId_serviceRequirementId_key" ON "ProviderAttestation"("providerId", "serviceRequirementId");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderAttestation_providerId_serviceQuestionId_key" ON "ProviderAttestation"("providerId", "serviceQuestionId");

-- CreateIndex
CREATE INDEX "ProviderDocument_providerId_serviceRequirementId_idx" ON "ProviderDocument"("providerId", "serviceRequirementId");

-- AddForeignKey
ALTER TABLE "ServiceVettingRequirement" ADD CONSTRAINT "ServiceVettingRequirement_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceQuestion" ADD CONSTRAINT "ServiceQuestion_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAttestation" ADD CONSTRAINT "ProviderAttestation_serviceRequirementId_fkey" FOREIGN KEY ("serviceRequirementId") REFERENCES "ServiceVettingRequirement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAttestation" ADD CONSTRAINT "ProviderAttestation_serviceQuestionId_fkey" FOREIGN KEY ("serviceQuestionId") REFERENCES "ServiceQuestion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderDocument" ADD CONSTRAINT "ProviderDocument_serviceRequirementId_fkey" FOREIGN KEY ("serviceRequirementId") REFERENCES "ServiceVettingRequirement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
