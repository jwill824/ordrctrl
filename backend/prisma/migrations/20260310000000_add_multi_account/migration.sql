-- Step 1: Add nullable columns
ALTER TABLE "Integration" ADD COLUMN "accountIdentifier" TEXT;
ALTER TABLE "Integration" ADD COLUMN "label" TEXT;
ALTER TABLE "Integration" ADD COLUMN "paused" BOOLEAN NOT NULL DEFAULT false;

-- Step 2: Backfill placeholder for existing rows (real backfill done by backfill.ts)
UPDATE "Integration" SET "accountIdentifier" = 'unknown@' || "serviceId"::text WHERE "accountIdentifier" IS NULL;

-- Step 3: Set NOT NULL
ALTER TABLE "Integration" ALTER COLUMN "accountIdentifier" SET NOT NULL;

-- Step 4: Drop old unique constraint, add new one
DROP INDEX IF EXISTS "Integration_userId_serviceId_key";
CREATE UNIQUE INDEX "Integration_userId_serviceId_accountIdentifier_key" ON "Integration"("userId", "serviceId", "accountIdentifier");
