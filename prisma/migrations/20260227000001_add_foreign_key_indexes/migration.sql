-- Add foreign key indexes
-- Without these, Prisma's nested querying causes full table sequential scans
CREATE INDEX IF NOT EXISTS "Attendance_summaryId_idx" ON "Attendance"("summaryId");
CREATE INDEX IF NOT EXISTS "Break_attendanceId_idx" ON "Break"("attendanceId");