-- AlterTable
ALTER TABLE "Integration" ADD COLUMN     "importEverything" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "selectedSubSourceIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
