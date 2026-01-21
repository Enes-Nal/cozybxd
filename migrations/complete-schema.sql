-- Complete Database Schema for CozyBXD
-- This file contains the full schema including all features
-- Use this for setting up a new database from scratch
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- BASE TABLES
-- ============================================================================

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT,
  email TEXT UNIQUE,
  email_verified TIMESTAMPTZ,
  image TEXT,
  banner_url TEXT,
  username TEXT UNIQUE,
  status TEXT DEFAULT 'Offline',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Accounts table (for OAuth)
CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type TEXT,
  provider TEXT,
  provider_account_id TEXT,
  refresh_token TEXT,
  access_token TEXT,
  expires_at INTEGER,
  token_type TEXT,
  scope TEXT,
  id_token TEXT,
  session_state TEXT,
  UNIQUE(provider, provider_account_id)
);

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_token TEXT UNIQUE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  expires TIMESTAMPTZ
);

-- Verification tokens
CREATE TABLE IF NOT EXISTS verification_tokens (
  identifier TEXT,
  token TEXT UNIQUE,
  expires TIMESTAMPTZ,
  UNIQUE(identifier, token)
);

-- Teams table
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  invite_code TEXT UNIQUE,
  picture_url TEXT,
  interest_level_voting_enabled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Team members
CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, user_id)
);

-- Media table
CREATE TABLE IF NOT EXISTS media (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tmdb_id INTEGER UNIQUE,
  imdb_id TEXT,
  title TEXT NOT NULL,
  type TEXT,
  poster_url TEXT,
  backdrop_url TEXT,
  overview TEXT,
  release_date TIMESTAMPTZ,
  runtime INTEGER,
  genres TEXT[],
  imdb_rating FLOAT,
  rotten_tomatoes_score INTEGER,
  rotten_tomatoes_audience INTEGER,
  youtube_url TEXT,
  roblox_url TEXT,
  game_url TEXT,
  thumbnail_url TEXT,
  duration INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Logs table
CREATE TABLE IF NOT EXISTS logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  media_id UUID REFERENCES media(id) ON DELETE CASCADE,
  watched_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  is_roblox_night BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Log attendees
CREATE TABLE IF NOT EXISTS log_attendees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  log_id UUID REFERENCES logs(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  slept BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(log_id, user_id)
);

-- Reviews table
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  log_id UUID REFERENCES logs(id) ON DELETE CASCADE,
  media_id UUID REFERENCES media(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER,
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Watchlist items
CREATE TABLE IF NOT EXISTS watchlist_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  media_id UUID REFERENCES media(id) ON DELETE CASCADE,
  upvotes INTEGER DEFAULT 0,
  downvotes INTEGER DEFAULT 0,
  added_at TIMESTAMPTZ DEFAULT NOW()
);

-- View counts table
CREATE TABLE IF NOT EXISTS view_counts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  media_id UUID REFERENCES media(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- FRIENDS SYSTEM
-- ============================================================================

-- Friends table to track friend relationships
CREATE TABLE IF NOT EXISTS friends (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  friend_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, friend_id),
  CHECK (user_id != friend_id)
);

-- Friend requests table
CREATE TABLE IF NOT EXISTS friend_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(requester_id, recipient_id),
  CHECK (requester_id != recipient_id),
  CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled'))
);

-- ============================================================================
-- GROUP CHAT
-- ============================================================================

-- Group messages table
CREATE TABLE IF NOT EXISTS group_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- VOTING SYSTEM
-- ============================================================================

-- Watchlist votes table to track individual user votes
CREATE TABLE IF NOT EXISTS watchlist_votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  watchlist_item_id UUID NOT NULL REFERENCES watchlist_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vote_type TEXT NOT NULL CHECK (vote_type IN ('upvote', 'downvote')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(watchlist_item_id, user_id)
);

-- ============================================================================
-- TEMPORARY INVITE CODES
-- ============================================================================

-- Team invite codes table
CREATE TABLE IF NOT EXISTS team_invite_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ,
  max_uses INTEGER,
  current_uses INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Users indexes
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- Friends indexes
CREATE INDEX IF NOT EXISTS idx_friends_user_id ON friends(user_id);
CREATE INDEX IF NOT EXISTS idx_friends_friend_id ON friends(friend_id);

-- Friend requests indexes
CREATE INDEX IF NOT EXISTS idx_friend_requests_requester_id ON friend_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_recipient_id ON friend_requests(recipient_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_status ON friend_requests(status);

-- Group messages indexes
CREATE INDEX IF NOT EXISTS idx_group_messages_team_id ON group_messages(team_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_group_messages_user_id ON group_messages(user_id);

-- Watchlist votes indexes
CREATE INDEX IF NOT EXISTS idx_watchlist_votes_item_user ON watchlist_votes(watchlist_item_id, user_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_votes_user ON watchlist_votes(user_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_votes_item ON watchlist_votes(watchlist_item_id);

-- Team invite codes indexes
CREATE INDEX IF NOT EXISTS idx_team_invite_codes_code ON team_invite_codes(code);
CREATE INDEX IF NOT EXISTS idx_team_invite_codes_team_id ON team_invite_codes(team_id);
CREATE INDEX IF NOT EXISTS idx_team_invite_codes_active ON team_invite_codes(is_active, expires_at);

-- Other indexes
CREATE INDEX IF NOT EXISTS idx_view_counts_media_viewed ON view_counts(media_id, viewed_at);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_logs_team ON logs(team_id);
CREATE INDEX IF NOT EXISTS idx_logs_media ON logs(media_id);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to update friend_requests updated_at timestamp
CREATE OR REPLACE FUNCTION update_friend_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to check if invite code is valid
CREATE OR REPLACE FUNCTION is_invite_code_valid(
  p_code TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_code_record RECORD;
BEGIN
  SELECT * INTO v_code_record
  FROM team_invite_codes
  WHERE code = UPPER(p_code)
    AND is_active = TRUE
    AND (expires_at IS NULL OR expires_at > NOW())
    AND (max_uses IS NULL OR current_uses < max_uses);
  
  RETURN v_code_record.id IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to increment invite code use count
CREATE OR REPLACE FUNCTION increment_invite_code_uses(
  p_code TEXT
) RETURNS UUID AS $$
DECLARE
  v_team_id UUID;
  v_code_record RECORD;
BEGIN
  SELECT * INTO v_code_record
  FROM team_invite_codes
  WHERE code = UPPER(p_code)
    AND is_active = TRUE
    AND (expires_at IS NULL OR expires_at > NOW())
    AND (max_uses IS NULL OR current_uses < max_uses)
  FOR UPDATE;
  
  IF v_code_record.id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired invite code';
  END IF;
  
  UPDATE team_invite_codes
  SET current_uses = current_uses + 1,
      updated_at = NOW()
  WHERE id = v_code_record.id;
  
  RETURN v_code_record.team_id;
END;
$$ LANGUAGE plpgsql;

-- Function to update team picture (bypasses Supabase schema cache)
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
  UPDATE teams
  SET 
    picture_url = picture_url_param,
    updated_at = NOW()
  WHERE teams.id = team_id_param;
  
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

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger to automatically update friend_requests updated_at
CREATE TRIGGER update_friend_requests_updated_at
  BEFORE UPDATE ON friend_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_friend_requests_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on group_messages
ALTER TABLE group_messages ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read messages from teams they're members of
CREATE POLICY "Users can read messages from their teams"
  ON group_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = group_messages.team_id
      AND team_members.user_id = auth.uid()
    )
  );

-- Policy: Users can send messages to teams they're members of
CREATE POLICY "Users can send messages to their teams"
  ON group_messages
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = group_messages.team_id
      AND team_members.user_id = auth.uid()
    )
    AND user_id = auth.uid()
  );

-- Policy: Users can update their own messages
CREATE POLICY "Users can update their own messages"
  ON group_messages
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Policy: Users can delete their own messages
CREATE POLICY "Users can delete their own messages"
  ON group_messages
  FOR DELETE
  USING (user_id = auth.uid());

-- Enable RLS on watchlist_votes
ALTER TABLE watchlist_votes ENABLE ROW LEVEL SECURITY;

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

-- ============================================================================
-- PERMISSIONS
-- ============================================================================

-- Grant execute permission on functions
GRANT EXECUTE ON FUNCTION update_team_picture(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION update_team_picture(UUID, TEXT) TO service_role;

-- ============================================================================
-- REALTIME
-- ============================================================================

-- Enable realtime for group_messages
ALTER PUBLICATION supabase_realtime ADD TABLE group_messages;

-- ============================================================================
-- INITIAL DATA SETUP
-- ============================================================================

-- Update existing users to have 'Offline' status if null
UPDATE users SET status = 'Offline' WHERE status IS NULL;

-- Add comment to document banner_url column
COMMENT ON COLUMN users.banner_url IS 'Profile banner image URL for user profiles';

