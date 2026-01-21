-- Safe migration to fix voting system (first-time setup)
-- This migration:
-- 1. Adds downvotes column to watchlist_items (if not exists)
-- 2. Creates watchlist_votes table (if not exists)
-- 3. Sets up Row Level Security policies for watchlist_votes
-- 
-- NOTE: If policies already exist, you may get an error. In that case, use fix-voting-system-complete.sql instead.

-- Add downvotes column to watchlist_items
ALTER TABLE watchlist_items 
ADD COLUMN IF NOT EXISTS downvotes INTEGER DEFAULT 0;

-- Create watchlist_votes table to track individual user votes
CREATE TABLE IF NOT EXISTS watchlist_votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  watchlist_item_id UUID NOT NULL REFERENCES watchlist_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vote_type TEXT NOT NULL CHECK (vote_type IN ('upvote', 'downvote')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(watchlist_item_id, user_id)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_watchlist_votes_item_user ON watchlist_votes(watchlist_item_id, user_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_votes_user ON watchlist_votes(user_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_votes_item ON watchlist_votes(watchlist_item_id);

-- Enable Row Level Security on watchlist_votes
ALTER TABLE watchlist_votes ENABLE ROW LEVEL SECURITY;

-- Create policies (will fail if they already exist - that's okay, just means they're already set up)
DO $$
BEGIN
  -- Policy: Users can view their own votes
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'watchlist_votes' 
    AND policyname = 'Users can view their own votes'
  ) THEN
    CREATE POLICY "Users can view their own votes" ON watchlist_votes
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  -- Policy: Users can view votes for watchlist items in teams they belong to
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'watchlist_votes' 
    AND policyname = 'Users can view votes for watchlist items in their teams'
  ) THEN
    CREATE POLICY "Users can view votes for watchlist items in their teams" ON watchlist_votes
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM watchlist_items wi
          JOIN team_members tm ON tm.team_id = wi.team_id
          WHERE wi.id = watchlist_votes.watchlist_item_id
          AND tm.user_id = auth.uid()
        )
      );
  END IF;

  -- Policy: Users can insert their own votes
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'watchlist_votes' 
    AND policyname = 'Users can insert their own votes'
  ) THEN
    CREATE POLICY "Users can insert their own votes" ON watchlist_votes
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  -- Policy: Users can update their own votes
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'watchlist_votes' 
    AND policyname = 'Users can update their own votes'
  ) THEN
    CREATE POLICY "Users can update their own votes" ON watchlist_votes
      FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  -- Policy: Users can delete their own votes
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'watchlist_votes' 
    AND policyname = 'Users can delete their own votes'
  ) THEN
    CREATE POLICY "Users can delete their own votes" ON watchlist_votes
      FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Note: The API routes use the service role client which bypasses RLS,
-- but these policies ensure that if direct client access is used, it's secure.


