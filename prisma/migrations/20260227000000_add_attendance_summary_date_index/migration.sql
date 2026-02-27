-- Add standalone index on AttendanceSummary.date
-- This allows the dashboard query (WHERE date >= yesterday) to use an index scan
-- instead of a full table scan, which is critical for load time as data grows.
CREATE INDEX IF NOT EXISTS "AttendanceSummary_date_idx" ON "AttendanceSummary"("date");