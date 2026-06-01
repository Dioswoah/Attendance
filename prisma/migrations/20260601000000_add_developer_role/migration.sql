-- Add DEVELOPER to the Role enum
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'DEVELOPER';

-- Assign DEVELOPER role to marcr@redadair.com.au
UPDATE "User"
SET roles = array_append(
    array_remove(roles, 'DEVELOPER'::"Role"),
    'DEVELOPER'::"Role"
)
WHERE email = 'marcr@redadair.com.au';
