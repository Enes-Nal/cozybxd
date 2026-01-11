# Migration from Prisma to Supabase

## What Changed

✅ **Removed Prisma** - No longer using Prisma ORM
✅ **Using Supabase Client** - Direct Supabase client for all database operations
✅ **OMDb API** - Still using OMDb API for IMDb/Rotten Tomatoes scores (already integrated)

## Database Setup

Since we're no longer using Prisma migrations, you need to create the tables directly in Supabase:

1. Go to your Supabase dashboard: https://supabase.com/dashboard
2. Navigate to SQL Editor
3. Run the SQL script below to create all tables

## SQL Migration Script

**Important:** Copy the SQL from `supabase-migration.sql` file (not from this markdown file) to avoid syntax errors.

Or use the SQL below:

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT,
  email TEXT UNIQUE,
  email_verified TIMESTAMPTZ,
  image TEXT,
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
  type TEXT, -- movie, tv, youtube, roblox, game
  poster_url TEXT,
  backdrop_url TEXT,
  overview TEXT,
  release_date TIMESTAMPTZ,
  runtime INTEGER, -- in minutes
  genres TEXT[], -- array of genre names
  imdb_rating FLOAT,
  rotten_tomatoes_score INTEGER,
  rotten_tomatoes_audience INTEGER,
  youtube_url TEXT,
  roblox_url TEXT,
  game_url TEXT,
  thumbnail_url TEXT,
  duration INTEGER, -- for YouTube videos in seconds
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
  rating INTEGER, -- 1-5 stars
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
  added_at TIMESTAMPTZ DEFAULT NOW()
);

-- View counts
CREATE TABLE IF NOT EXISTS view_counts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  media_id UUID REFERENCES media(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_view_counts_media_viewed ON view_counts(media_id, viewed_at);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_logs_team ON logs(team_id);
CREATE INDEX IF NOT EXISTS idx_logs_media ON logs(media_id);
```

## API Changes

All API routes now use Supabase client directly:

- `app/api/auth/[...nextauth]/route.ts` - Custom auth with Supabase
- `app/api/teams/route.ts` - Teams CRUD with Supabase
- `app/api/teams/[teamId]/route.ts` - Team details with Supabase
- `app/api/teams/[teamId]/logs/route.ts` - Logs with Supabase

## OMDb API

The OMDb API integration remains unchanged and is available in `lib/api/omdb.ts` for fetching IMDb and Rotten Tomatoes scores.

## Next Steps

1. Run the SQL script in Supabase SQL Editor
2. Test the API routes
3. Update any frontend code that might reference Prisma types
4. Remove Prisma-related files (prisma/ directory, prisma.config.ts)

