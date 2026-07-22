-- Admin-managed technicians: DB-driven membership for the Technicians board.
-- Additive only (nullable / defaulted columns) — safe on live data, no drops/renames.
ALTER TABLE "User" ADD COLUMN "isTechnician" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "technicianDisplayName" TEXT;
ALTER TABLE "User" ADD COLUMN "technicianArchivedAt" TIMESTAMP(3);
