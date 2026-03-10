-- AlterEnum
ALTER TYPE "OverrideType" ADD VALUE 'DISMISSED';

-- AlterTable
ALTER TABLE "NativeTask" ADD COLUMN     "dismissed" BOOLEAN NOT NULL DEFAULT false;
