-- AlterTable
ALTER TABLE "User" ADD COLUMN     "location" TEXT,
ADD COLUMN     "selectedTimezone" TEXT DEFAULT 'UTC',
ADD COLUMN     "useCurrentTimezone" BOOLEAN NOT NULL DEFAULT true;
