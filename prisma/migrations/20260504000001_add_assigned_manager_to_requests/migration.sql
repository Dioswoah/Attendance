-- Add assignedManagerId to LeaveRequest and AttendanceRequest for request reassignment

ALTER TABLE "LeaveRequest" ADD COLUMN "assignedManagerId" TEXT;
ALTER TABLE "AttendanceRequest" ADD COLUMN "assignedManagerId" TEXT;

ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_assignedManagerId_fkey"
  FOREIGN KEY ("assignedManagerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AttendanceRequest" ADD CONSTRAINT "AttendanceRequest_assignedManagerId_fkey"
  FOREIGN KEY ("assignedManagerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "LeaveRequest_assignedManagerId_idx" ON "LeaveRequest"("assignedManagerId");
CREATE INDEX "AttendanceRequest_assignedManagerId_idx" ON "AttendanceRequest"("assignedManagerId");
