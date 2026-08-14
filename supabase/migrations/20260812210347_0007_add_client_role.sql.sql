/*
# Add 'client' role to user_role enum

1. Changes
- Adds 'client' value to the existing user_role enum type.
- This allows auth.users (profiles) to have role = 'client', so clients can log in
  and see the accompaniment screen.
2. Security
- No RLS changes. Existing policies remain unchanged.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'user_role' AND e.enumlabel = 'client'
  ) THEN
    ALTER TYPE user_role ADD VALUE 'client';
  END IF;
END $$;
