-- Add OPERATIONS to the Role enum: ops staff who can view the Technicians
-- field-status board in the user portal (read-only, no admin access).
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'OPERATIONS';
