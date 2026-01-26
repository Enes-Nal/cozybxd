-- Add read_at field to friend_requests table to track when notifications are read
ALTER TABLE friend_requests 
ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

-- Create index for read_at queries
CREATE INDEX IF NOT EXISTS idx_friend_requests_read_at ON friend_requests(recipient_id, read_at);


