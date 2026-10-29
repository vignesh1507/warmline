-- AlterTable
ALTER TABLE "User" ADD COLUMN     "autoAcceptEvents" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "monitorAllChats" BOOLEAN NOT NULL DEFAULT false;
