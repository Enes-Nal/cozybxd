-- Create a PostgreSQL function to update team picture_url
-- This bypasses Supabase's schema cache issues
-- Run this in Supabase SQL Editor

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

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION update_team_picture(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION update_team_picture(UUID, TEXT) TO service_role;

