-- Day-level manager validation moves to AttendanceSummary (unique per user+day).
-- IF NOT EXISTS keeps this idempotent — columns may already have been applied
-- manually via the Cloud SQL proxy before the migrate job runs.
ALTER TABLE "AttendanceSummary" ADD COLUMN IF NOT EXISTS "validationStatus" "ValidationStatus";
ALTER TABLE "AttendanceSummary" ADD COLUMN IF NOT EXISTS "validatedAt" TIMESTAMP(3);
