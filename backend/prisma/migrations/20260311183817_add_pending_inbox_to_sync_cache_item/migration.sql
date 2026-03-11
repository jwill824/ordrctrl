-- AlterTable
ALTER TABLE "SyncCacheItem" ADD COLUMN     "pendingInbox" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "SyncCacheItem_userId_pendingInbox_idx" ON "SyncCacheItem"("userId", "pendingInbox");
