-- DropIndex
DROP INDEX "Attendance_userId_date_key";

-- CreateIndex
CREATE INDEX "Attendance_userId_date_idx" ON "Attendance"("userId", "date");
