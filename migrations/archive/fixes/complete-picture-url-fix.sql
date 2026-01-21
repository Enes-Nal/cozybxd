-- Complete fix for picture_url column issue
-- Run this ENTIRE script in Supabase SQL Editor (click "Run" button)
-- This will: 1) Add the column, 2) Create a bypass function, 3) Refresh cache

-- Step 1: Add the picture_url column if it doesn't exist
ALTER TABLE teams ADD COLUMN IF NOT EXISTS picture_url TEXT;

-- Step 2: Create a PostgreSQL function to update team picture (bypasses schema cache)
CREATE OR REPLACE FUNCTION update_team_picture(
  team_id_param UUID,
  picture_url_param TEXT
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  invite_code TEXT,
  picture_url TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update the team (explicitly qualify column names to avoid ambiguity)
  UPDATE teams
  SET 
    picture_url = picture_url_param,
    updated_at = NOW()
  WHERE teams.id = team_id_param;
  
  -- Return the updated team
  RETURN QUERY
  SELECT 
    teams.id,
    teams.name,
    teams.description,
    teams.invite_code,
    teams.picture_url,
    teams.created_at,
    teams.updated_at
  FROM teams
  WHERE teams.id = team_id_param;
END;
$$;

-- Step 3: Grant execute permission
GRANT EXECUTE ON FUNCTION update_team_picture(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION update_team_picture(UUID, TEXT) TO service_role;

-- Step 4: Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- Step 5: Verify everything was created successfully
SELECT 
  'Column check' as check_type,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'teams' AND column_name = 'picture_url'
    ) THEN '✓ picture_url column exists'
    ELSE '✗ picture_url column missing'
  END as status
UNION ALL
SELECT 
  'Function check' as check_type,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public' AND p.proname = 'update_team_picture'
    ) THEN '✓ update_team_picture function exists'
    ELSE '✗ update_team_picture function missing'
  END as status;

