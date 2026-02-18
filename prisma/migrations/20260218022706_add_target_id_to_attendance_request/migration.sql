-- AlterEnum
ALTER TYPE "WorkMode" ADD VALUE 'ONSITE';

-- AlterTable
ALTER TABLE "Attendance" ADD COLUMN     "breakLimitExceededSent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "breakWarningSent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "locationDetails" TEXT,
ADD COLUMN     "scheduledEnd" TIMESTAMP(3),
ADD COLUMN     "scheduledStart" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "AttendanceRequest" ADD COLUMN     "targetId" TEXT;

-- AlterTable
ALTER TABLE "Break" ADD COLUMN     "breakExpectedReturnEmailSent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "expectedReturnTime" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Department" ADD COLUMN     "shiftStartTime" TEXT DEFAULT '09:00';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "shiftEndTime" TEXT DEFAULT '17:00',
ADD COLUMN     "shiftStartTime" TEXT DEFAULT '09:00';

-- CreateTable
CREATE TABLE "WorkHoursChangeLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "attendanceId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "oldStart" TEXT,
    "oldEnd" TEXT,
    "newStart" TEXT NOT NULL,
    "newEnd" TEXT NOT NULL,
    "reason" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkHoursChangeLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkHoursChangeLog_userId_date_idx" ON "WorkHoursChangeLog"("userId", "date");

-- CreateIndex
CREATE INDEX "WorkHoursChangeLog_attendanceId_idx" ON "WorkHoursChangeLog"("attendanceId");

-- AddForeignKey
ALTER TABLE "WorkHoursChangeLog" ADD CONSTRAINT "WorkHoursChangeLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
