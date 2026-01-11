# Cozybxd Setup Guide

## Quick Start

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Set Up Environment Variables**
   ```bash
   npm run setup
   ```
   
   This creates a `.env.local` file with your Supabase credentials. Then edit `.env.local` to add:
   - OAuth provider credentials (Google/Discord)
   - API keys (TMDB, OMDb, YouTube - optional)
   - A random `NEXTAUTH_SECRET` (generate with: `openssl rand -base64 32`)

3. **Set Up Database**
   ```bash
   # Generate Prisma Client
   npm run db:generate
   
   # Push schema to Supabase
   npm run db:push
   ```

4. **Run Development Server**
   ```bash
   npm run dev
   ```

## Getting API Keys

### TMDB (The Movie Database)
1. Go to https://www.themoviedb.org/
2. Create an account
3. Go to Settings > API
4. Request an API key
5. Add to `.env` as `NEXT_PUBLIC_TMDB_API_KEY`

### OMDb (for IMDb/Rotten Tomatoes scores)
1. Go to http://www.omdbapi.com/apikey.aspx
2. Request a free API key
3. Add to `.env` as `NEXT_PUBLIC_OMDB_API_KEY`

### YouTube Data API (optional)
1. Go to https://console.cloud.google.com/
2. Create a project
3. Enable YouTube Data API v3
4. Create credentials (API key)
5. Add to `.env` as `NEXT_PUBLIC_YOUTUBE_API_KEY`

### OAuth Providers

#### Google OAuth
1. Go to https://console.cloud.google.com/
2. Create OAuth 2.0 credentials
3. Add authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
4. Add to `.env`:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`

#### Discord OAuth
1. Go to https://discord.com/developers/applications
2. Create a new application
3. Go to OAuth2 section
4. Add redirect URI: `http://localhost:3000/api/auth/callback/discord`
5. Add to `.env`:
   - `DISCORD_CLIENT_ID`
   - `DISCORD_CLIENT_SECRET`

## Database Setup

### Supabase (Already Configured)

This project uses Supabase as the database. The connection is already configured in the setup script.

1. Run `npm run setup` to create `.env.local` with Supabase credentials
2. Run `npm run db:push` to create all tables in Supabase
3. Access your database at: https://supabase.com/dashboard

See [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) for detailed Supabase information.

## Project Status

### ✅ Completed
- Next.js 16 setup with TypeScript
- Dark mode minimalist design system
- Core UI components (Button, Input, Modal, Navbar)
- Database schema (Prisma)
- Authentication setup (NextAuth.js)
- Team/Squad management API
- Media search API (TMDB, YouTube)
- Basic pages (Home, Teams, Discovery, Vault)
- Team detail page with logs display

### 🚧 In Progress / TODO
- Complete logging UI with media search integration
- Watchlist voting system
- Individual review submission after group watch
- "Who Slept?" toggle feature
- Invite system for teams
- Personal vault/watchlist
- Trending algorithm
- Mobile responsive improvements

## Development Tips

### Prisma Studio
View and edit your database:
```bash
npx prisma studio
```

### Database Migrations
Create a new migration:
```bash
npx prisma migrate dev --name your-migration-name
```

### Type Generation
After schema changes:
```bash
npx prisma generate
```

## Troubleshooting

### Prisma Client Not Found
Run: `npx prisma generate`

### Database Connection Issues
- Check your DATABASE_URL in `.env`
- Ensure PostgreSQL is running
- Verify database exists

### OAuth Not Working
- Check redirect URIs match exactly
- Verify client IDs and secrets in `.env`
- Check NextAuth URL configuration

## Next Steps

1. Complete the logging modal with full media search
2. Implement watchlist with voting
3. Add review submission flow
4. Build invite system
5. Add "Who Slept?" feature
6. Implement trending/popularity algorithm

