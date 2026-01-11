#!/usr/bin/env node

/**
 * Setup script to create .env.local with Supabase credentials
 */

const fs = require('fs');
const path = require('path');

const envContent = `# Supabase Database
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
`;

const envPath = path.join(process.cwd(), '.env.local');

if (fs.existsSync(envPath)) {
  console.log('⚠️  .env.local already exists. Skipping creation.');
  console.log('   If you want to regenerate it, delete .env.local first.');
} else {
  fs.writeFileSync(envPath, envContent);
  console.log('✅ Created .env.local with Supabase credentials');
  console.log('📝 Next steps:');
  console.log('   1. Add your OAuth credentials (Google/Discord)');
  console.log('   2. Add your API keys (TMDB, OMDb, YouTube)');
  console.log('   3. Generate a random NEXTAUTH_SECRET');
  console.log('   4. Run: npx prisma db push');
}

