/*
  Warnings:

  - Added the required column `updatedAt` to the `SyncOverride` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "OverrideType" ADD VALUE 'DESCRIPTION_OVERRIDE';

-- AlterTable
ALTER TABLE "SyncCacheItem" ADD COLUMN     "body" TEXT,
ADD COLUMN     "url" TEXT;

-- AlterTable
ALTER TABLE "SyncOverride" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
ADD COLUMN     "value" TEXT;
