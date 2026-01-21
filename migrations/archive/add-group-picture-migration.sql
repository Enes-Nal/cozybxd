-- Add picture_url field to teams table
ALTER TABLE teams ADD COLUMN IF NOT EXISTS picture_url TEXT;

