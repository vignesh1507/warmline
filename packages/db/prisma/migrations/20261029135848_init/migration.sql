-- CreateEnum
CREATE TYPE "EventKind" AS ENUM ('CELEBRATION', 'MILESTONE', 'CATCHUP', 'APOLOGY', 'CONDOLENCE', 'FAVOUR', 'OTHER');

-- CreateEnum
CREATE TYPE "Source" AS ENUM ('MANUAL', 'CHAT', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "NoteKind" AS ENUM ('PREFERENCE', 'MEMORY', 'POST_EVENT', 'IDEA');

-- CreateEnum
CREATE TYPE "SuggestionKind" AS ENUM ('GIFT', 'CHECKLIST', 'TOPIC', 'DRAFT', 'ECHO', 'REHEARSAL');

-- CreateEnum
CREATE TYPE "SuggestionStatus" AS ENUM ('NEW', 'KEPT', 'DISMISSED');

-- CreateEnum
CREATE TYPE "LoopDirection" AS ENUM ('I_OWE', 'THEY_OWE');

-- CreateEnum
CREATE TYPE "LoopStatus" AS ENUM ('OPEN', 'DONE', 'DROPPED');

-- CreateEnum
CREATE TYPE "InboxType" AS ENUM ('EVENT', 'OPEN_LOOP', 'CONTACT_PING');

-- CreateEnum
CREATE TYPE "InboxStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "BridgeStatus" AS ENUM ('DISCONNECTED', 'QR_PENDING', 'AUTHENTICATING', 'CONNECTED', 'ERROR');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT 'me',
    "reminderOffsetsDefault" INTEGER[] DEFAULT ARRAY[7, 1]::INTEGER[],
    "defaultCadenceDays" INTEGER NOT NULL DEFAULT 30,
    "aiProvider" TEXT NOT NULL DEFAULT 'aistudio',
    "aiModel" TEXT NOT NULL DEFAULT 'gemma-4-31b-it',
    "storeSnippets" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "relationship" TEXT,
    "cadenceDays" INTEGER NOT NULL DEFAULT 30,
    "lastContactAt" TIMESTAMP(3),
    "whatsappChatId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "recurring" BOOLEAN NOT NULL DEFAULT false,
    "kind" "EventKind" NOT NULL DEFAULT 'OTHER',
    "details" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "source" "Source" NOT NULL DEFAULT 'MANUAL',
    "followedUpAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "eventId" TEXT,
    "body" TEXT NOT NULL,
    "kind" "NoteKind" NOT NULL DEFAULT 'MEMORY',
    "source" "Source" NOT NULL DEFAULT 'MANUAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Suggestion" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "kind" "SuggestionKind" NOT NULL,
    "content" JSONB NOT NULL,
    "groundedNoteIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "assumptions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "SuggestionStatus" NOT NULL DEFAULT 'NEW',
    "model" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Suggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reminder" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "offsetDays" INTEGER NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "readAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),

    CONSTRAINT "Reminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpenLoop" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "direction" "LoopDirection" NOT NULL,
    "dueAt" TIMESTAMP(3),
    "status" "LoopStatus" NOT NULL DEFAULT 'OPEN',
    "quote" TEXT,
    "sourceMsgHash" TEXT,
    "nudgeAfterDays" INTEGER NOT NULL DEFAULT 7,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "OpenLoop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsappChat" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isGroup" BOOLEAN NOT NULL DEFAULT false,
    "monitored" BOOLEAN NOT NULL DEFAULT false,
    "consentAt" TIMESTAMP(3),
    "lastMessageAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsappChat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboxItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "InboxType" NOT NULL,
    "payload" JSONB NOT NULL,
    "snippet" TEXT,
    "chatName" TEXT,
    "msgHash" TEXT NOT NULL,
    "status" "InboxStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "InboxItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BridgeState" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "status" "BridgeStatus" NOT NULL DEFAULT 'DISCONNECTED',
    "qrDataUrl" TEXT,
    "phoneHint" TEXT,
    "lastSeenAt" TIMESTAMP(3),
    "lastError" TEXT,
    "fake" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BridgeState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Person_userId_idx" ON "Person"("userId");

-- CreateIndex
CREATE INDEX "Person_userId_name_idx" ON "Person"("userId", "name");

-- CreateIndex
CREATE INDEX "Event_userId_date_idx" ON "Event"("userId", "date");

-- CreateIndex
CREATE INDEX "Event_personId_idx" ON "Event"("personId");

-- CreateIndex
CREATE INDEX "Note_personId_createdAt_idx" ON "Note"("personId", "createdAt");

-- CreateIndex
CREATE INDEX "Note_eventId_idx" ON "Note"("eventId");

-- CreateIndex
CREATE INDEX "Suggestion_eventId_kind_status_idx" ON "Suggestion"("eventId", "kind", "status");

-- CreateIndex
CREATE INDEX "Reminder_dueAt_idx" ON "Reminder"("dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "Reminder_eventId_offsetDays_key" ON "Reminder"("eventId", "offsetDays");

-- CreateIndex
CREATE INDEX "OpenLoop_userId_status_idx" ON "OpenLoop"("userId", "status");

-- CreateIndex
CREATE INDEX "WhatsappChat_userId_monitored_idx" ON "WhatsappChat"("userId", "monitored");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsappChat_userId_chatId_key" ON "WhatsappChat"("userId", "chatId");

-- CreateIndex
CREATE INDEX "InboxItem_userId_status_createdAt_idx" ON "InboxItem"("userId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "InboxItem_userId_msgHash_key" ON "InboxItem"("userId", "msgHash");

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Suggestion" ADD CONSTRAINT "Suggestion_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpenLoop" ADD CONSTRAINT "OpenLoop_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpenLoop" ADD CONSTRAINT "OpenLoop_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsappChat" ADD CONSTRAINT "WhatsappChat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxItem" ADD CONSTRAINT "InboxItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
