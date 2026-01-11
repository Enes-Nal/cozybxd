# Supabase Setup Guide

## Database Connection

Your Supabase database is already configured! Here's what you need to know:

### Connection Details

- **Project URL**: https://fiiizwdfoayznrqlsoni.supabase.co
- **Database Host**: db.fiiizwdfoayznrqlsoni.supabase.co
- **Port**: 5432
- **Database**: postgres
- **User**: postgres
- **Password**: Kl5tgKbXxk85or

### Environment Variables

Create a `.env.local` file in the root directory with the following:

```env
# Supabase Database
DATABASE_URL="postgresql://postgres:Kl5tgKbXxk85or@db.fiiizwdfoayznrqlsoni.supabase.co:5432/postgres"
DIRECT_URL="postgresql://postgres:Kl5tgKbXxk85or@db.fiiizwdfoayznrqlsoni.supabase.co:5432/postgres"

# Supabase
NEXT_PUBLIC_SUPABASE_URL="https://fiiizwdfoayznrqlsoni.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpaWl6d2Rmb2F5em5ycWxzb25pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5MTgyNTYsImV4cCI6MjA4MzQ5NDI1Nn0.Nz3xo0BV01gg9XWnkXRqKcYY3MuwPAqd2bkd49-Ue1w"
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpaWl6d2Rmb2F5em5ycWxzb25pIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzkxODI1NiwiZXhwIjoyMDgzNDk0MjU2fQ.VajKkqmSnHuOijLhIWtdDzp43LjblTvwU2YQoOmfzl8"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="change-this-to-a-random-secret"

# OAuth Providers (add your credentials)
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
DISCORD_CLIENT_ID=""
DISCORD_CLIENT_SECRET=""

# API Keys (add your credentials)
NEXT_PUBLIC_TMDB_API_KEY=""
NEXT_PUBLIC_OMDB_API_KEY=""
NEXT_PUBLIC_YOUTUBE_API_KEY=""
```

## Running Migrations

After setting up your `.env.local` file, run the database migrations:

```bash
npx prisma migrate dev
```

This will create all the necessary tables in your Supabase database.

## Accessing Supabase Dashboard

1. Go to https://supabase.com/dashboard
2. Sign in to your account
3. Select your project: `fiiizwdfoayznrqlsoni`
4. You can view tables, run SQL queries, and manage your database from there

## Using Prisma Studio

To view and edit your database data:

```bash
npx prisma studio
```

This will open a web interface at http://localhost:5555 where you can browse and edit your data.

## Supabase Features Available

With Supabase, you also have access to:

- **Real-time subscriptions**: Subscribe to database changes
- **Storage**: File storage for images/media
- **Edge Functions**: Serverless functions
- **Row Level Security**: Database-level security policies

The Supabase client is already set up in `lib/supabase.ts` for future use.

## Troubleshooting

### Connection Issues

If you're having connection issues:

1. Check that your `.env.local` file exists and has the correct DATABASE_URL
2. Verify your Supabase project is active
3. Check Supabase dashboard for any connection pool limits

### Migration Issues

If migrations fail:

1. Make sure you're using the correct database password
2. Check that the database exists in Supabase
3. Try running `npx prisma db push` instead of `migrate dev` for initial setup

