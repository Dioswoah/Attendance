-- AlterTable
ALTER TABLE "Attendance" ADD COLUMN     "summaryId" TEXT;

-- CreateTable
CREATE TABLE "AttendanceSummary" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "clockIn" TIMESTAMP(3),
    "clockOut" TIMESTAMP(3),
    "totalWorkDuration" INTEGER NOT NULL DEFAULT 0,
    "totalBreakDuration" INTEGER NOT NULL DEFAULT 0,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'ABSENT',
    "mode" "WorkMode" NOT NULL DEFAULT 'OFFICE',
    "isManualOverride" BOOLEAN NOT NULL DEFAULT false,
    "overriddenById" TEXT,
    "overrideReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "details" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AttendanceSummary_userId_date_idx" ON "AttendanceSummary"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceSummary_userId_date_key" ON "AttendanceSummary"("userId", "date");

-- CreateIndex
CREATE INDEX "ActivityLog_userId_idx" ON "ActivityLog"("userId");

-- CreateIndex
CREATE INDEX "ActivityLog_action_idx" ON "ActivityLog"("action");

-- CreateIndex
CREATE INDEX "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt");

-- CreateIndex
CREATE INDEX "AttendanceRequest_userId_status_idx" ON "AttendanceRequest"("userId", "status");

-- CreateIndex
CREATE INDEX "AttendanceRequest_date_idx" ON "AttendanceRequest"("date");

-- CreateIndex
CREATE INDEX "Department_managerId_idx" ON "Department"("managerId");

-- CreateIndex
CREATE INDEX "Leave_userId_startDate_endDate_idx" ON "Leave"("userId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "Leave_status_idx" ON "Leave"("status");

-- CreateIndex
CREATE INDEX "LeaveRequest_userId_status_idx" ON "LeaveRequest"("userId", "status");

-- CreateIndex
CREATE INDEX "LeaveRequest_startTime_endTime_idx" ON "LeaveRequest"("startTime", "endTime");

-- CreateIndex
CREATE INDEX "Team_departmentId_idx" ON "Team"("departmentId");

-- CreateIndex
CREATE INDEX "Team_leaderId_idx" ON "Team"("leaderId");

-- CreateIndex
CREATE INDEX "User_departmentId_idx" ON "User"("departmentId");

-- CreateIndex
CREATE INDEX "User_teamId_idx" ON "User"("teamId");

-- CreateIndex
CREATE INDEX "User_managerId_idx" ON "User"("managerId");

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_summaryId_fkey" FOREIGN KEY ("summaryId") REFERENCES "AttendanceSummary"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceSummary" ADD CONSTRAINT "AttendanceSummary_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceSummary" ADD CONSTRAINT "AttendanceSummary_overriddenById_fkey" FOREIGN KEY ("overriddenById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
