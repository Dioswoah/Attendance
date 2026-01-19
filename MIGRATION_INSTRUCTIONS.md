
/**
 * MIGRATION INSTRUCTIONS
 * ======================
 * 
 * The schema has been updated to support multiple roles per user.
 * To apply this change to the database:
 * 
 * 1. Stop the dev server (npm run dev)
 *    - Press Ctrl+C in the terminal.
 * 
 * 2. Run the migration command:
 *    npx prisma migrate dev --name add_multiple_roles_support
 * 
 * 3. Restart the dev server:
 *    npm run dev
 * 
 * IMPORTANT WARNING:
 * ------------------
 * This migration changes the `role` column to `roles`.
 * Existing data in the `role` column might be lost (reset to default [USER]).
 * 
 * IF YOU GET LOCKED OUT (Admin access lost):
 * You may need to manually update your user record in the database to restore ADMIN access.
 * SQL Example: UPDATE "User" SET "roles" = ARRAY['ADMIN']::"Role"[] WHERE email = 'your@email.com';
 * 
 * This update also ensures:
 * - All staff (including Admins/Managers) can have an assigned Manager.
 * - Multi-role selection is enabled in the Admin Portal.
 */
