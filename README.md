![cozybxd](https://media.discordapp.net/attachments/885574523796197397/1467010102476275742/Make_your_README.png?ex=697ed320&is=697d81a0&hm=3b961e7b6e51e54c88a4ca4312571884715d0dfa9ce0706068e01036281e7987&=&format=webp&quality=lossless&width=2344&height=1198)

# Cozybxd

**What did we watch?** - A social tracking platform for group movie nights and digital hangouts.

## Overview

Cozybxd shifts the focus from "What did I watch?" to "What did we watch?". It solves the fragmentation of group movie nights where friends struggle to remember what they've seen together, what's on their shared wishlist, and who was actually present for the viewing.

## Features

### Core Features

- **Squad System**: Create teams, track attendance, and see who was actually there for each viewing
- **Unified Media Search**: Movies (TMDB), YouTube videos, and Roblox games all in one place
- **Shared Watchlist (The Nest)**: Collaborative watchlist with voting and "seen by" badges
- **Group Reviews**: Multi-rating system where each attendee can rate and comment
- **Attendance Tracking**: Mark who was present, who slept, and calculate squad averages

### Design System

- **Dark Mode Minimalist UI**: Deep charcoal backgrounds with subtle borders
- **Layered Elevation**: Visual hierarchy through background colors
- **Smooth Transitions**: 200ms ease-in-out animations throughout
- **Dotted Separators**: Subtle section breaks using dotted borders

## Tech Stack

- **Frontend**: Next.js 16, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Supabase Client
- **Database**: Supabase (PostgreSQL)
- **Authentication**: NextAuth.js with Supabase (Google/Discord OAuth)
- **APIs**: TMDB, OMDb (IMDb/Rotten Tomatoes), YouTube Data API
- **State Management**: TanStack Query (React Query)

## Getting Started

### Prerequisites

- Node.js 18+ 
- PostgreSQL database
- API keys for TMDB, OMDb, and YouTube (optional)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd cozybxd
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
node scripts/setup-env.js
```

This will create a `.env.local` file with your Supabase credentials. Then edit `.env.local` to add:
- OAuth credentials (Google/Discord)
- API keys for TMDB, OMDb, and YouTube
- A random `NEXTAUTH_SECRET` (generate with: `openssl rand -base64 32`)

4. Set up the database:
```bash
npx prisma generate
npx prisma db push
```

5. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Supabase Setup

This project uses Supabase as the database. The connection is already configured. See [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) for detailed information.

## Project Structure

```
cozybxd/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   ├── teams/             # Team pages
│   ├── discovery/         # Media search
│   ├── vault/             # Personal history
│   └── layout.tsx         # Root layout
├── components/
│   ├── ui/                # Reusable UI components
│   └── providers.tsx      # React Query & Auth providers
├── lib/
│   ├── api/               # External API clients
│   ├── prisma.ts          # Prisma client
│   └── utils.ts           # Utility functions
└── prisma/
    └── schema.prisma      # Database schema
```

## Database Schema

- **Users**: User accounts with OAuth integration
- **Teams**: Groups/squads for collaborative tracking
- **Media**: Movies, YouTube videos, games
- **Logs**: Watch sessions with attendance
- **Reviews**: Individual ratings and comments
- **WatchlistItems**: Shared and personal watchlists

## API Routes

- `GET/POST /api/teams` - List/create teams
- `GET /api/teams/[teamId]` - Get team details
- `POST /api/teams/[teamId]/logs` - Create a watch log
- `GET /api/media/search` - Search for media

## Design Tokens

The design system uses CSS variables defined in `app/globals.css`:

- `--bg-void`: #101213 (App background)
- `--bg-surface`: #1A1C1E (Cards/Modals)
- `--bg-highlight`: #2D2F31 (Hover states)
- `--border-color`: #36393C (Borders)
- `--text-primary`: #FFFFFF (Primary text)
- `--text-secondary`: #94969C (Secondary text)

## Development

### Running Prisma Studio

```bash
npx prisma studio
```

### Database Migrations

```bash
# Create a new migration
npx prisma migrate dev --name migration-name

# Apply migrations
npx prisma migrate deploy
```

## Roadmap

- [ ] Complete logging UI with media search
- [ ] Watchlist voting system
- [ ] "Who Slept?" feature
- [ ] Drinking game/Bingo integration
- [ ] "Vibe" filter for watchlist
- [ ] Trending algorithm implementation
- [ ] Mobile responsive improvements

## License

MIT
