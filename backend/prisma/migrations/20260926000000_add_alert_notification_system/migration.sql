-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "AlertSeverity" AS ENUM ('NORMAL', 'IMPORTANT', 'CRITICAL');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "AlertTriggerType" AS ENUM ('OFFSET_BEFORE', 'EXACT_TIME');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'SKIPPED_QUIET_HOURS', 'SNOOZED', 'DISMISSED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "severity" "AlertSeverity" NOT NULL DEFAULT 'NORMAL';
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "channels" TEXT[] NOT NULL DEFAULT ARRAY['IN_APP']::TEXT[];
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "soundName" TEXT;
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "soundVolume" INTEGER DEFAULT 80;
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "soundRepeat" INTEGER DEFAULT 1;
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "snoozedUntil" TIMESTAMP(3);
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "status" "DeliveryStatus" NOT NULL DEFAULT 'SENT';
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "alertId" UUID;
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "metadata" JSONB;

-- CreateTable
CREATE TABLE IF NOT EXISTS "Alert" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "calendarItemId" UUID,
    "title" TEXT,
    "triggerType" "AlertTriggerType" NOT NULL DEFAULT 'OFFSET_BEFORE',
    "offsetMinutes" INTEGER DEFAULT 15,
    "exactTime" TIMESTAMP(3),
    "channels" TEXT[] NOT NULL DEFAULT ARRAY['IN_APP', 'BROWSER']::TEXT[],
    "severity" "AlertSeverity" NOT NULL DEFAULT 'NORMAL',
    "soundName" TEXT DEFAULT 'REMINDER',
    "soundVolume" INTEGER NOT NULL DEFAULT 80,
    "soundRepeat" INTEGER NOT NULL DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "escalationStep" INTEGER,
    "lastTriggeredAt" TIMESTAMP(3),
    "snoozedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AlertDelivery" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "alertId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "channel" TEXT NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "error" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Alert_userId_idx" ON "Alert"("userId");
CREATE INDEX IF NOT EXISTS "Alert_calendarItemId_idx" ON "Alert"("calendarItemId");
CREATE INDEX IF NOT EXISTS "Alert_enabled_idx" ON "Alert"("enabled");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AlertDelivery_alertId_idx" ON "AlertDelivery"("alertId");
CREATE INDEX IF NOT EXISTS "AlertDelivery_userId_idx" ON "AlertDelivery"("userId");
CREATE INDEX IF NOT EXISTS "AlertDelivery_status_idx" ON "AlertDelivery"("status");
CREATE INDEX IF NOT EXISTS "AlertDelivery_scheduledFor_idx" ON "AlertDelivery"("scheduledFor");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Notification_status_idx" ON "Notification"("status");
CREATE INDEX IF NOT EXISTS "Notification_severity_idx" ON "Notification"("severity");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "Alert" ADD CONSTRAINT "Alert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Alert" ADD CONSTRAINT "Alert_calendarItemId_fkey" FOREIGN KEY ("calendarItemId") REFERENCES "CalendarItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "AlertDelivery" ADD CONSTRAINT "AlertDelivery_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "Alert"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Notification" ADD CONSTRAINT "Notification_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "Alert"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
