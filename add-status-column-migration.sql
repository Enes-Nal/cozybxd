-- Migration to add status column to users table

-- Add status column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Offline';

-- Create index on status for faster queries
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- Update existing users to have 'Offline' status if null
UPDATE users SET status = 'Offline' WHERE status IS NULL;

