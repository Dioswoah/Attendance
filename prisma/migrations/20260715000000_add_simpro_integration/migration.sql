-- simPRO integration: link RSA users to simPRO employees and tag attendance origin
CREATE TYPE "AttendanceSource" AS ENUM ('WEB', 'MANUAL', 'BIOMETRIC', 'SIMPRO');

ALTER TABLE "Attendance" ADD COLUMN "source" "AttendanceSource" NOT NULL DEFAULT 'WEB';

ALTER TABLE "User" ADD COLUMN "simproEmployeeId" INTEGER;

CREATE UNIQUE INDEX "User_simproEmployeeId_key" ON "User"("simproEmployeeId");
