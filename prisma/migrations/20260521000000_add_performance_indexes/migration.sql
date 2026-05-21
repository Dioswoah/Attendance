-- Add composite index on Notification(userId, createdAt) for notification bell queries
CREATE INDEX IF NOT EXISTS "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt" DESC);

-- Add index on Attendance(clockOut) for auto clock-out cleanup scan
CREATE INDEX IF NOT EXISTS "Attendance_clockOut_idx" ON "Attendance"("clockOut");

-- Replace separate ActivityLog(userId) and ActivityLog(createdAt) with composite
-- The common query is WHERE userId = X ORDER BY createdAt DESC
DROP INDEX IF EXISTS "ActivityLog_userId_idx";
DROP INDEX IF EXISTS "ActivityLog_createdAt_idx";
CREATE INDEX IF NOT EXISTS "ActivityLog_userId_createdAt_idx" ON "ActivityLog"("userId", "createdAt" DESC);
