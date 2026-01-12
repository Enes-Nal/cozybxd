-- Migration to add interest level voting enabled setting to teams table
-- This allows admins to enable/disable the interest level slider in SchedulingModal

ALTER TABLE teams 
ADD COLUMN IF NOT EXISTS interest_level_voting_enabled BOOLEAN DEFAULT FALSE;

