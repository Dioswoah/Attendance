-- AlterTable
ALTER TABLE "Attendance" ADD COLUMN "clockInLat"       DOUBLE PRECISION;
ALTER TABLE "Attendance" ADD COLUMN "clockInLng"       DOUBLE PRECISION;
ALTER TABLE "Attendance" ADD COLUMN "clockInAccuracy"  DOUBLE PRECISION;
ALTER TABLE "Attendance" ADD COLUMN "clockOutLat"      DOUBLE PRECISION;
ALTER TABLE "Attendance" ADD COLUMN "clockOutLng"      DOUBLE PRECISION;
ALTER TABLE "Attendance" ADD COLUMN "clockOutAccuracy" DOUBLE PRECISION;
