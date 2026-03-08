-- CreateEnum
CREATE TYPE "OverrideType" AS ENUM ('REOPENED');

-- CreateTable
CREATE TABLE "SyncOverride" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "syncCacheItemId" TEXT NOT NULL,
    "overrideType" "OverrideType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SyncOverride_userId_idx" ON "SyncOverride"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SyncOverride_syncCacheItemId_overrideType_key" ON "SyncOverride"("syncCacheItemId", "overrideType");

-- AddForeignKey
ALTER TABLE "SyncOverride" ADD CONSTRAINT "SyncOverride_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncOverride" ADD CONSTRAINT "SyncOverride_syncCacheItemId_fkey" FOREIGN KEY ("syncCacheItemId") REFERENCES "SyncCacheItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
