-- CreateEnum
CREATE TYPE "GmailCompletionMode" AS ENUM ('inbox_removal', 'read');

-- AlterTable
ALTER TABLE "Integration" ADD COLUMN     "gmailCompletionMode" "GmailCompletionMode";

-- AlterTable
ALTER TABLE "SyncCacheItem" ADD COLUMN     "completedAtSource" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "SyncCacheItem_integrationId_completedAtSource_idx" ON "SyncCacheItem"("integrationId", "completedAtSource");
