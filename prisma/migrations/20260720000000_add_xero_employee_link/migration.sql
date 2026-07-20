-- Xero payroll integration: link RSA users to Xero employees for leave balance sync
ALTER TABLE "User" ADD COLUMN "xeroEmployeeId" TEXT;

CREATE UNIQUE INDEX "User_xeroEmployeeId_key" ON "User"("xeroEmployeeId");
