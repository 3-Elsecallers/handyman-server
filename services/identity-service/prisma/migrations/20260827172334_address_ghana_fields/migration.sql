/*
  Warnings:

  - You are about to drop the column `city` on the `Address` table. All the data in the column will be lost.
  - You are about to drop the column `line1` on the `Address` table. All the data in the column will be lost.
  - You are about to drop the column `line2` on the `Address` table. All the data in the column will be lost.
  - You are about to drop the column `postalCode` on the `Address` table. All the data in the column will be lost.
  - You are about to drop the column `state` on the `Address` table. All the data in the column will be lost.
  - Added the required column `contactName` to the `Address` table without a default value. This is not possible if the table is not empty.
  - Added the required column `contactPhone` to the `Address` table without a default value. This is not possible if the table is not empty.
  - Added the required column `district` to the `Address` table without a default value. This is not possible if the table is not empty.
  - Added the required column `region` to the `Address` table without a default value. This is not possible if the table is not empty.
  - Added the required column `town` to the `Address` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Address" DROP COLUMN "city",
DROP COLUMN "line1",
DROP COLUMN "line2",
DROP COLUMN "postalCode",
DROP COLUMN "state",
ADD COLUMN     "addressType" TEXT NOT NULL DEFAULT 'home',
ADD COLUMN     "contactName" TEXT NOT NULL,
ADD COLUMN     "contactPhone" TEXT NOT NULL,
ADD COLUMN     "digitalAddress" TEXT,
ADD COLUMN     "directions" TEXT,
ADD COLUMN     "district" TEXT NOT NULL,
ADD COLUMN     "landmark" TEXT,
ADD COLUMN     "region" TEXT NOT NULL,
ADD COLUMN     "streetAndHouseNumber" TEXT,
ADD COLUMN     "town" TEXT NOT NULL,
ALTER COLUMN "country" SET DEFAULT 'GH';
