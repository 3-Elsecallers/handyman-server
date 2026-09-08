-- CreateEnum
CREATE TYPE "RequirementType" AS ENUM ('document', 'attestation', 'certification');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('yes_no', 'text', 'single_choice', 'multiple_choice');

-- AlterTable: Add safetyRiskLevel to ServiceCategory
ALTER TABLE "ServiceCategory" ADD COLUMN "safetyRiskLevel" TEXT NOT NULL DEFAULT 'low';

-- AlterTable: Change ProviderDocument.category from enum to text, add requirementId
ALTER TABLE "ProviderDocument" ALTER COLUMN "category" DROP DEFAULT;
ALTER TABLE "ProviderDocument" ALTER COLUMN "category" TYPE TEXT;
ALTER TABLE "ProviderDocument" ADD COLUMN "requirementId" TEXT;

-- DropEnum
DROP TYPE "DocumentCategory";

-- CreateTable
CREATE TABLE "CategoryVettingRequirement" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "type" "RequirementType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "acceptedMimeTypes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "maxFileSizeMb" INTEGER NOT NULL DEFAULT 10,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CategoryVettingRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategoryQuestion" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "type" "QuestionType" NOT NULL,
    "options" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CategoryQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderAttestation" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "requirementId" TEXT,
    "questionId" TEXT,
    "answer" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderAttestation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CategoryVettingRequirement_categoryId_name_key" ON "CategoryVettingRequirement"("categoryId", "name");

-- CreateIndex
CREATE INDEX "CategoryVettingRequirement_categoryId_idx" ON "CategoryVettingRequirement"("categoryId");

-- CreateIndex
CREATE INDEX "CategoryQuestion_categoryId_idx" ON "CategoryQuestion"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderAttestation_providerId_requirementId_key" ON "ProviderAttestation"("providerId", "requirementId");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderAttestation_providerId_questionId_key" ON "ProviderAttestation"("providerId", "questionId");

-- CreateIndex
CREATE INDEX "ProviderAttestation_providerId_idx" ON "ProviderAttestation"("providerId");

-- CreateIndex
CREATE INDEX "ProviderDocument_providerId_requirementId_idx" ON "ProviderDocument"("providerId", "requirementId");

-- AddForeignKey
ALTER TABLE "CategoryVettingRequirement" ADD CONSTRAINT "CategoryVettingRequirement_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ServiceCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryQuestion" ADD CONSTRAINT "CategoryQuestion_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ServiceCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAttestation" ADD CONSTRAINT "ProviderAttestation_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "ProviderProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAttestation" ADD CONSTRAINT "ProviderAttestation_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "CategoryVettingRequirement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAttestation" ADD CONSTRAINT "ProviderAttestation_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "CategoryQuestion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderDocument" ADD CONSTRAINT "ProviderDocument_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "CategoryVettingRequirement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
