-- Complete migration to fix voting system
-- This migration:
-- 1. Adds downvotes column to watchlist_items (if not exists)
-- 2. Creates watchlist_votes table (if not exists)
-- 3. Sets up Row Level Security policies for watchlist_votes

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

-- Drop existing policies if they exist (to allow re-running this migration)
DROP POLICY IF EXISTS "Users can view their own votes" ON watchlist_votes;
DROP POLICY IF EXISTS "Users can view votes for watchlist items in their teams" ON watchlist_votes;
DROP POLICY IF EXISTS "Users can insert their own votes" ON watchlist_votes;
DROP POLICY IF EXISTS "Users can update their own votes" ON watchlist_votes;
DROP POLICY IF EXISTS "Users can delete their own votes" ON watchlist_votes;

-- Policy: Users can view their own votes
CREATE POLICY "Users can view their own votes" ON watchlist_votes
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can view votes for watchlist items in teams they belong to
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

-- Policy: Users can insert their own votes
CREATE POLICY "Users can insert their own votes" ON watchlist_votes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own votes
CREATE POLICY "Users can update their own votes" ON watchlist_votes
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own votes
CREATE POLICY "Users can delete their own votes" ON watchlist_votes
  FOR DELETE
  USING (auth.uid() = user_id);

-- Note: The API routes use the service role client which bypasses RLS,
-- but these policies ensure that if direct client access is used, it's secure.


