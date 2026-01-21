-- Fix picture_url column and refresh Supabase schema cache
-- Run this ENTIRE script in Supabase SQL Editor (click "Run" button)

-- Step 1: Ensure the column exists
ALTER TABLE teams ADD COLUMN IF NOT EXISTS picture_url TEXT;

-- Step 2: Verify the column was created
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'teams' AND column_name = 'picture_url'
  ) THEN
    RAISE EXCEPTION 'Column picture_url was not created successfully';
  END IF;
END $$;

-- Step 3: Refresh PostgREST schema cache
-- This tells Supabase to reload its schema cache immediately
NOTIFY pgrst, 'reload schema';

-- Step 4: Confirm the column exists (you should see a row returned)
SELECT 
  column_name, 
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'teams' AND column_name = 'picture_url';

