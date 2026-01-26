-- Migration: Add user action cooldowns table for anti-spam protection
-- This table tracks the last time a user performed specific actions to enforce cooldowns

CREATE TABLE IF NOT EXISTS user_action_cooldowns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  last_action_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, action_type)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_action_cooldowns_user_action 
  ON user_action_cooldowns(user_id, action_type);

-- Create index for cleanup of old records
CREATE INDEX IF NOT EXISTS idx_user_action_cooldowns_last_action 
  ON user_action_cooldowns(last_action_at);

-- Add comment
COMMENT ON TABLE user_action_cooldowns IS 'Tracks user action timestamps to enforce cooldowns and prevent spam';

