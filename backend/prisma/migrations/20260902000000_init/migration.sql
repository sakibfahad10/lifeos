CREATE SCHEMA IF NOT EXISTS "public";

CREATE TYPE "CalendarItemType" AS ENUM ('TASK', 'EVENT', 'REMINDER');
CREATE TYPE "CalendarItemStatus" AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED', 'OVERDUE');
CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');
CREATE TYPE "RecurrenceFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY', 'CUSTOM');
CREATE TYPE "NotificationType" AS ENUM ('REMINDER', 'OVERDUE', 'MISSED', 'SYSTEM', 'AI_IMPORT');
CREATE TYPE "AiImportStatus" AS ENUM ('PROCESSING', 'REVIEW', 'CONFIRMED', 'REJECTED', 'FAILED');

CREATE TABLE "User" (
  "id" UUID NOT NULL, "name" TEXT NOT NULL, "email" TEXT NOT NULL,
  "passwordHash" TEXT, "settings" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "CalendarItem" (
  "id" UUID NOT NULL, "userId" UUID NOT NULL, "title" TEXT NOT NULL, "description" TEXT,
  "type" "CalendarItemType" NOT NULL, "status" "CalendarItemStatus" NOT NULL DEFAULT 'PENDING',
  "priority" "Priority" NOT NULL DEFAULT 'MEDIUM', "category" TEXT, "startAt" TIMESTAMP(3) NOT NULL,
  "endAt" TIMESTAMP(3), "allDay" BOOLEAN NOT NULL DEFAULT false, "estimatedMinutes" INTEGER,
  "location" TEXT, "notes" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "CalendarItem_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "RecurrenceRule" (
  "id" UUID NOT NULL, "calendarItemId" UUID NOT NULL, "frequency" "RecurrenceFrequency" NOT NULL,
  "interval" INTEGER NOT NULL DEFAULT 1, "daysOfWeek" INTEGER[], "dayOfMonth" INTEGER,
  "startDate" TIMESTAMP(3) NOT NULL, "endDate" TIMESTAMP(3), "timezone" TEXT NOT NULL DEFAULT 'UTC',
  CONSTRAINT "RecurrenceRule_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Reminder" (
  "id" UUID NOT NULL, "userId" UUID NOT NULL, "calendarItemId" UUID NOT NULL,
  "offsetMinutes" INTEGER NOT NULL, "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Reminder_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Notification" (
  "id" UUID NOT NULL, "userId" UUID NOT NULL, "calendarItemId" UUID, "type" "NotificationType" NOT NULL,
  "title" TEXT NOT NULL, "message" TEXT NOT NULL, "scheduledAt" TIMESTAMP(3), "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "AiImportDraft" (
  "id" UUID NOT NULL, "userId" UUID NOT NULL, "sourceType" TEXT NOT NULL, "originalFileName" TEXT,
  "status" "AiImportStatus" NOT NULL DEFAULT 'PROCESSING', "rawResponse" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiImportDraft_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "AiImportItem" (
  "id" UUID NOT NULL, "draftId" UUID NOT NULL, "title" TEXT NOT NULL, "description" TEXT,
  "startAt" TIMESTAMP(3), "endAt" TIMESTAMP(3), "type" "CalendarItemType" NOT NULL DEFAULT 'EVENT',
  "category" TEXT, "priority" "Priority" NOT NULL DEFAULT 'MEDIUM', "recurrence" JSONB,
  "confidenceScore" DECIMAL(5,4), "selected" BOOLEAN NOT NULL DEFAULT true, "edited" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "AiImportItem_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Attachment" (
  "id" UUID NOT NULL, "userId" UUID NOT NULL, "calendarItemId" UUID, "fileName" TEXT NOT NULL,
  "fileType" TEXT NOT NULL, "fileSize" INTEGER NOT NULL, "storageKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "AuditLog" (
  "id" UUID NOT NULL, "userId" UUID NOT NULL, "action" TEXT NOT NULL, "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL, "metadata" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "CalendarItem_userId_idx" ON "CalendarItem"("userId");
CREATE INDEX "CalendarItem_startAt_idx" ON "CalendarItem"("startAt");
CREATE INDEX "CalendarItem_status_idx" ON "CalendarItem"("status");
CREATE INDEX "CalendarItem_category_idx" ON "CalendarItem"("category");
CREATE UNIQUE INDEX "RecurrenceRule_calendarItemId_key" ON "RecurrenceRule"("calendarItemId");
CREATE INDEX "Reminder_userId_idx" ON "Reminder"("userId");
CREATE INDEX "Reminder_calendarItemId_idx" ON "Reminder"("calendarItemId");
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");
CREATE INDEX "Notification_scheduledAt_idx" ON "Notification"("scheduledAt");
CREATE INDEX "Notification_readAt_idx" ON "Notification"("readAt");
CREATE INDEX "AiImportDraft_userId_idx" ON "AiImportDraft"("userId");
CREATE INDEX "AiImportDraft_status_idx" ON "AiImportDraft"("status");
CREATE INDEX "AiImportItem_draftId_idx" ON "AiImportItem"("draftId");
CREATE UNIQUE INDEX "Attachment_storageKey_key" ON "Attachment"("storageKey");
CREATE INDEX "Attachment_userId_idx" ON "Attachment"("userId");
CREATE INDEX "Attachment_calendarItemId_idx" ON "Attachment"("calendarItemId");
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

ALTER TABLE "CalendarItem" ADD CONSTRAINT "CalendarItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecurrenceRule" ADD CONSTRAINT "RecurrenceRule_calendarItemId_fkey" FOREIGN KEY ("calendarItemId") REFERENCES "CalendarItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_calendarItemId_fkey" FOREIGN KEY ("calendarItemId") REFERENCES "CalendarItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_calendarItemId_fkey" FOREIGN KEY ("calendarItemId") REFERENCES "CalendarItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AiImportDraft" ADD CONSTRAINT "AiImportDraft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiImportItem" ADD CONSTRAINT "AiImportItem_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "AiImportDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_calendarItemId_fkey" FOREIGN KEY ("calendarItemId") REFERENCES "CalendarItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
