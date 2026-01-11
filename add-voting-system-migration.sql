-- Migration to add downvotes and user vote tracking
-- This migration adds:
-- 1. downvotes column to watchlist_items
-- 2. watchlist_votes table to track individual user votes

-- Add downvotes column to watchlist_items
ALTER TABLE watchlist_items 
ADD COLUMN IF NOT EXISTS downvotes INTEGER DEFAULT 0;

-- Create watchlist_votes table to track individual user votes
CREATE TABLE IF NOT EXISTS watchlist_votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  watchlist_item_id UUID REFERENCES watchlist_items(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  vote_type TEXT NOT NULL CHECK (vote_type IN ('upvote', 'downvote')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(watchlist_item_id, user_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_watchlist_votes_item_user ON watchlist_votes(watchlist_item_id, user_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_votes_user ON watchlist_votes(user_id);

