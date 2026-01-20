-- Migration to add banner_url column to users table
-- Run this in your Supabase SQL Editor

ALTER TABLE users ADD COLUMN IF NOT EXISTS banner_url TEXT;

-- Add comment to document the column
COMMENT ON COLUMN users.banner_url IS 'Profile banner image URL for user profiles';


