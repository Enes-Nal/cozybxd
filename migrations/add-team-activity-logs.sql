-- Migration to add team activity logs
-- Run this in your Supabase SQL Editor

-- Create team_activity_logs table
CREATE TABLE IF NOT EXISTS team_activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL, -- 'member_joined', 'member_left', 'movie_added', 'movie_removed', 'movie_upvoted', 'movie_downvoted'
  media_id UUID REFERENCES media(id) ON DELETE CASCADE,
  metadata JSONB, -- Additional data like movie title, etc.
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_team_activity_logs_team_id ON team_activity_logs(team_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_activity_logs_user_id ON team_activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_team_activity_logs_media_id ON team_activity_logs(media_id);

-- Enable Row Level Security
ALTER TABLE team_activity_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read activity logs from teams they're members of
CREATE POLICY "Users can read activity logs from their teams"
  ON team_activity_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = team_activity_logs.team_id
      AND team_members.user_id = auth.uid()
    )
  );

-- Policy: System can insert activity logs (users can't directly insert, only through API)
-- We'll use service role for inserts, but allow authenticated users to insert for their own actions
CREATE POLICY "Users can insert activity logs for their teams"
  ON team_activity_logs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = team_activity_logs.team_id
      AND team_members.user_id = auth.uid()
    )
    AND user_id = auth.uid()
  );

-- Enable realtime for team_activity_logs (optional, for live updates)
ALTER PUBLICATION supabase_realtime ADD TABLE team_activity_logs;

