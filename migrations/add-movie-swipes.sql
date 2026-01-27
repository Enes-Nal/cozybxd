-- Migration to add movie swipes functionality for Tinder-like movie discovery
-- Run this in your Supabase SQL Editor

-- Create movie_swipes table to track user swipes on movies per group
CREATE TABLE IF NOT EXISTS movie_swipes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  media_id UUID REFERENCES media(id) ON DELETE CASCADE,
  tmdb_id INTEGER, -- Store TMDB ID for movies not yet in database
  swipe_type TEXT NOT NULL CHECK (swipe_type IN ('like', 'dislike')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create unique constraints to prevent duplicate swipes
-- For movies with media_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_movie_swipes_unique_media ON movie_swipes(
  user_id, 
  team_id, 
  media_id
) WHERE media_id IS NOT NULL;

-- For movies with only tmdb_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_movie_swipes_unique_tmdb ON movie_swipes(
  user_id, 
  team_id, 
  tmdb_id
) WHERE tmdb_id IS NOT NULL AND media_id IS NULL;

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_movie_swipes_user_team ON movie_swipes(user_id, team_id);
CREATE INDEX IF NOT EXISTS idx_movie_swipes_team ON movie_swipes(team_id);
CREATE INDEX IF NOT EXISTS idx_movie_swipes_media ON movie_swipes(media_id);
CREATE INDEX IF NOT EXISTS idx_movie_swipes_tmdb ON movie_swipes(tmdb_id);

-- Enable Row Level Security
ALTER TABLE movie_swipes ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own swipes and swipes from teams they're members of
CREATE POLICY "Users can read swipes from their teams"
  ON movie_swipes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = movie_swipes.team_id
      AND team_members.user_id = auth.uid()
    )
  );

-- Policy: Users can insert their own swipes to teams they're members of
CREATE POLICY "Users can swipe on movies in their teams"
  ON movie_swipes
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = movie_swipes.team_id
      AND team_members.user_id = auth.uid()
    )
    AND user_id = auth.uid()
  );

-- Policy: Users can update their own swipes
CREATE POLICY "Users can update their own swipes"
  ON movie_swipes
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Policy: Users can delete their own swipes
CREATE POLICY "Users can delete their own swipes"
  ON movie_swipes
  FOR DELETE
  USING (user_id = auth.uid());

