-- Add team invite codes table
-- Run this in Supabase SQL editor or via:
--   node scripts/run-migration.js migrations/add-team-invite-codes.sql

-- Ensure UUID extension exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create team invite codes table
CREATE TABLE IF NOT EXISTS team_invite_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ,
  max_uses INTEGER, -- NULL means unlimited
  current_uses INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_team_invite_codes_code ON team_invite_codes(code);
CREATE INDEX IF NOT EXISTS idx_team_invite_codes_team_id ON team_invite_codes(team_id);
CREATE INDEX IF NOT EXISTS idx_team_invite_codes_active ON team_invite_codes(is_active, expires_at);

-- Create function to check if invite code is valid
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

-- Create function to increment invite code use count
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

