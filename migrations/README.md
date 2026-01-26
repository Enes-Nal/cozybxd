# Database Migrations

This folder contains all database migration files for the CozyBXD project.

## Structure

- **`complete-schema.sql`** - Complete database schema with all features. Use this for setting up a new database from scratch.
- **`archive/`** - Historical migration files (kept for reference)
  - Individual feature migrations (friends, group chat, voting, etc.)
  - Base schema migrations
  - **`fixes/`** - One-time fix scripts that have already been applied

## Usage

### Setting up a new database

Run the complete schema file in your Supabase SQL Editor:

```sql
-- Copy and paste the contents of migrations/complete-schema.sql
-- into the Supabase SQL Editor and run it
```

### Running individual migrations

If you need to apply a specific migration from the archive:

```bash
node scripts/run-migration.js migrations/archive/your-migration-file.sql
```

## Migration History

The migrations in `archive/` were created incrementally as features were added:

1. **Base schema** - Core tables (users, teams, media, logs, etc.)
2. **Friends system** - Friends and friend requests tables
3. **Group chat** - Group messaging functionality
4. **Voting system** - Watchlist voting with upvotes/downvotes
5. **Profile features** - Banner images, usernames, status
6. **Group features** - Group pictures, interest level voting
7. **Invite codes** - Temporary invite code system

All of these are now consolidated into `complete-schema.sql` for easier setup.


