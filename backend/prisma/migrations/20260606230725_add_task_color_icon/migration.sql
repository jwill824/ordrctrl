-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OverrideType" ADD VALUE 'COLOR_OVERRIDE';
ALTER TYPE "OverrideType" ADD VALUE 'ICON_OVERRIDE';

-- AlterTable
ALTER TABLE "NativeTask" ADD COLUMN     "color" TEXT,
ADD COLUMN     "icon" TEXT,
ADD COLUMN     "isAllDay" BOOLEAN NOT NULL DEFAULT false;
