-- Migration to add group chat functionality
-- Run this in your Supabase SQL Editor

-- Create group_messages table
CREATE TABLE IF NOT EXISTS group_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_group_messages_team_id ON group_messages(team_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_group_messages_user_id ON group_messages(user_id);

-- Enable Row Level Security
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

-- Policy: Users can insert messages to teams they're members of
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

-- Enable realtime for group_messages
ALTER PUBLICATION supabase_realtime ADD TABLE group_messages;

