-- Migration to add interest level support to watchlist items
-- This allows storing interest levels (0-100) when users add movies to groups
-- Interest levels can be used for alternative sorting and prioritization

-- Add interest_level column to watchlist_items table
-- This stores the interest level set by the user who added the item (0-100)
ALTER TABLE watchlist_items 
ADD COLUMN IF NOT EXISTS interest_level INTEGER CHECK (interest_level IS NULL OR (interest_level >= 0 AND interest_level <= 100));

-- Create a junction table for multiple users to set interest levels per item
-- This allows each group member to express their interest level for each movie
CREATE TABLE IF NOT EXISTS watchlist_item_interest_levels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  watchlist_item_id UUID NOT NULL REFERENCES watchlist_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  interest_level INTEGER NOT NULL CHECK (interest_level >= 0 AND interest_level <= 100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(watchlist_item_id, user_id)
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_watchlist_item_interest_levels_item ON watchlist_item_interest_levels(watchlist_item_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_item_interest_levels_user ON watchlist_item_interest_levels(user_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_items_interest_level ON watchlist_items(interest_level) WHERE interest_level IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN watchlist_items.interest_level IS 'Interest level (0-100) set by the user who added the item. NULL if not set.';
COMMENT ON TABLE watchlist_item_interest_levels IS 'Stores interest levels (0-100) for each user per watchlist item. Allows multiple users to express interest.';

