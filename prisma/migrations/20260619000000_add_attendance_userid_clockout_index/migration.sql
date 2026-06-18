-- Add composite index on (userId, clockOut) for faster current-session lookups
-- Queries filtering WHERE userId = ? AND clockOut IS NULL now use this index
-- instead of scanning the single-column clockOut index
CREATE INDEX IF NOT EXISTS "Attendance_userId_clockOut_idx" ON "Attendance"("userId", "clockOut");
