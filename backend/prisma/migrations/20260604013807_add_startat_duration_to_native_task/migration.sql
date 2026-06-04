-- AlterTable
ALTER TABLE "NativeTask" ADD COLUMN     "duration" INTEGER,
ADD COLUMN     "startAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "NativeTask_userId_startAt_idx" ON "NativeTask"("userId", "startAt");
