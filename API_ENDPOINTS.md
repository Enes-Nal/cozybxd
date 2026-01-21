# API Endpoints Documentation

This document describes all the backend API endpoints available for the cozybxd application.

## Authentication

All endpoints (except public media endpoints) require authentication via NextAuth session.

## Media Endpoints

### GET `/api/media/search`
Search for media (movies, YouTube videos, etc.)

**Query Parameters:**
- `q` (required): Search query
- `type` (optional): Type of media to search (default: 'all')

**Response:**
```json
{
  "type": "movie" | "youtube",
  "results": [...]
}
```

### GET `/api/media/popular`
Get popular movies from TMDB

**Response:**
```json
{
  "type": "movie",
  "results": [...]
}
```

### GET `/api/media/trending`
Get trending media based on view counts or TMDB trending

**Response:**
```json
{
  "type": "media" | "tmdb",
  "results": [...]
}
```

### GET `/api/media/[mediaId]`
Get detailed information about a specific media item

**Response:**
```json
{
  "id": "...",
  "title": "...",
  "poster": "...",
  "year": 2024,
  "runtime": "2h 30m",
  "genre": [...],
  "priority": "High" | "Medium" | "Low",
  "status": "Watchlist" | "Ongoing" | "Seen",
  "votes": 5,
  "seenBy": [...],
  "availability": [...],
  "reviews": [...],
  "logs": [...],
  "watchlistItem": {...}
}
```

### POST `/api/media/sync`
Sync a TMDB movie to the database

**Body:**
```json
{
  "tmdbId": 12345,
  "type": "movie"
}
```

## Watchlist Endpoints

### GET `/api/watchlist`
Get watchlist items (personal or team)

**Query Parameters:**
- `teamId` (optional): Get team watchlist
- `userId` (optional): Get user's personal watchlist (defaults to current user)

**Response:**
```json
[
  {
    "id": "...",
    "title": "...",
    "poster": "...",
    ...
  }
]
```

### POST `/api/watchlist`
Add item to watchlist

**Body:**
```json
{
  "mediaId": "...",
  "teamId": "..." // optional, for team watchlist
}
```

### DELETE `/api/watchlist`
Remove item from watchlist

**Query Parameters:**
- `mediaId` (required)
- `teamId` (optional): For team watchlist

### POST `/api/watchlist/[mediaId]/upvote`
Upvote a watchlist item

**Query Parameters:**
- `teamId` (optional): For team watchlist

**Response:**
```json
{
  "upvotes": 6
}
```

### GET `/api/teams/[teamId]/watchlist`
Get team watchlist (alternative endpoint)

## History Endpoints

### GET `/api/history`
Get viewing history

**Query Parameters:**
- `teamId` (optional): Get team history
- `userId` (optional): Get user history (defaults to current user)

**Response:**
```json
[
  {
    "id": "...",
    "title": "...",
    "watchedAt": "2024-01-15T...",
    "notes": "...",
    "attendees": [...],
    "reviews": [...]
  }
]
```

## User Endpoints

### GET `/api/users/me`
Get current user's profile

**Response:**
```json
{
  "id": "...",
  "name": "...",
  "avatar": "...",
  "status": "Online" | "Ready" | "Offline",
  "role": "Admin" | "Editor" | "Viewer",
  "stats": {
    "watched": 42,
    "reviews": 15,
    "groups": 3
  },
  "teams": [...],
  "recentReviews": [...]
}
```

### GET `/api/users/[userId]`
Get user profile by ID

**Response:** Same as `/api/users/me`

### GET `/api/friends`
Get list of friends (users in shared teams)

**Response:**
```json
[
  {
    "id": "...",
    "name": "...",
    "avatar": "...",
    "status": "...",
    "role": "...",
    "sharedTeams": [...]
  }
]
```

## Team Endpoints

### GET `/api/teams`
Get all teams the user is a member of

**Response:**
```json
[
  {
    "id": "...",
    "name": "...",
    "description": "...",
    "invite_code": "...",
    "members": [...],
    "_count": {
      "logs": 42
    }
  }
]
```

### POST `/api/teams`
Create a new team

**Body:**
```json
{
  "name": "Team Name",
  "description": "Optional description"
}
```

### GET `/api/teams/[teamId]`
Get team details with logs and watchlist

**Response:**
```json
{
  "id": "...",
  "name": "...",
  "members": [...],
  "logs": [...],
  "watchlist": [...]
}
```

### POST `/api/teams/[teamId]/logs`
Create a viewing log

**Body:**
```json
{
  "mediaId": "...",
  "attendees": ["user1", "user2"],
  "notes": "Optional notes",
  "isRobloxNight": false,
  "watchedAt": "2024-01-15T..." // optional, defaults to now
}
```

### POST `/api/teams/join`
Join a team by invite code

**Body:**
```json
{
  "inviteCode": "ABC123XY"
}
```

## Review Endpoints

### GET `/api/reviews`
Get reviews

**Query Parameters:**
- `mediaId` (optional): Filter by media
- `userId` (optional): Filter by user

**Response:**
```json
[
  {
    "id": "...",
    "user_id": "...",
    "media_id": "...",
    "rating": 5,
    "comment": "...",
    "users": {...},
    "media": {...}
  }
]
```

### POST `/api/reviews`
Create or update a review

**Body:**
```json
{
  "mediaId": "...",
  "rating": 5, // 1-5
  "comment": "Optional comment",
  "logId": "..." // optional, link to a log
}
```

## Review Reply Endpoints

### GET `/api/reviews/[reviewId]/replies`
Get replies for a review (includes author `users(*)`).

### POST `/api/reviews/[reviewId]/replies`
Create a reply to a review (must be signed in, cannot reply to your own review).

Request body:

```json
{
  "comment": "string (required)",
  "rating": 1
}
```

- `rating` is **optional**. If provided, it must be an integer **1–5**.

**Response:**
```json
{
  "id": "...",
  "rating": 5,
  "comment": "...",
  "users": {...},
  "media": {...}
}
```

## Data Transformations

The backend automatically transforms database models to match the front-end types:

- **Media** → **Movie**: Converts database media records to the front-end Movie interface
- **User** → **User**: Transforms user records with team membership context
- **Team** → **Group**: Converts teams to groups with calculated budget hours

All transformations are handled in `lib/utils/transformers.ts`.


