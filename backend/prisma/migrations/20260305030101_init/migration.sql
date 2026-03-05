-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('email', 'google', 'apple');

-- CreateEnum
CREATE TYPE "ServiceId" AS ENUM ('gmail', 'apple_reminders', 'microsoft_tasks', 'apple_calendar');

-- CreateEnum
CREATE TYPE "IntegrationStatus" AS ENUM ('connected', 'error', 'disconnected');

-- CreateEnum
CREATE TYPE "GmailSyncMode" AS ENUM ('all_unread', 'starred_only');

-- CreateEnum
CREATE TYPE "ItemType" AS ENUM ('task', 'event', 'message');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "authProvider" "AuthProvider" NOT NULL,
    "providerAccountId" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "emailVerifyToken" TEXT,
    "passwordResetToken" TEXT,
    "passwordResetExpiry" TIMESTAMP(3),
    "loginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Integration" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "serviceId" "ServiceId" NOT NULL,
    "status" "IntegrationStatus" NOT NULL DEFAULT 'connected',
    "encryptedAccessToken" TEXT NOT NULL,
    "encryptedRefreshToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "gmailSyncMode" "GmailSyncMode",
    "lastSyncAt" TIMESTAMP(3),
    "lastSyncError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Integration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncCacheItem" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemType" "ItemType" NOT NULL,
    "externalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3),
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "completedInOrdrctrl" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "rawPayload" JSONB NOT NULL,

    CONSTRAINT "SyncCacheItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NativeTask" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "dueAt" TIMESTAMP(3),
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NativeTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "Integration_userId_idx" ON "Integration"("userId");

-- CreateIndex
CREATE INDEX "Integration_status_idx" ON "Integration"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Integration_userId_serviceId_key" ON "Integration"("userId", "serviceId");

-- CreateIndex
CREATE INDEX "SyncCacheItem_userId_idx" ON "SyncCacheItem"("userId");

-- CreateIndex
CREATE INDEX "SyncCacheItem_userId_completedInOrdrctrl_idx" ON "SyncCacheItem"("userId", "completedInOrdrctrl");

-- CreateIndex
CREATE INDEX "SyncCacheItem_expiresAt_idx" ON "SyncCacheItem"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "SyncCacheItem_integrationId_externalId_key" ON "SyncCacheItem"("integrationId", "externalId");

-- CreateIndex
CREATE INDEX "NativeTask_userId_idx" ON "NativeTask"("userId");

-- CreateIndex
CREATE INDEX "NativeTask_userId_completed_idx" ON "NativeTask"("userId", "completed");

-- AddForeignKey
ALTER TABLE "Integration" ADD CONSTRAINT "Integration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncCacheItem" ADD CONSTRAINT "SyncCacheItem_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NativeTask" ADD CONSTRAINT "NativeTask_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
