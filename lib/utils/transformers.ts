// Utility functions to transform database models to front-end types

import { Movie, User, Group } from '@/lib/types';
import { TMDBMovie, getPosterUrl, getGenres } from '@/lib/api/tmdb';

export function transformMediaToMovie(media: any, watchlistItem?: any, logs?: any[]): Movie {
  const runtime = (media.runtime != null && media.runtime > 0) 
    ? (() => {
        const hours = Math.floor(media.runtime / 60);
        const minutes = media.runtime % 60;
        if (hours === 0) return `${minutes}m`;
        if (minutes === 0) return `${hours}h`;
        return `${hours}h ${minutes}m`;
      })()
    : '';
  
  // Handle both snake_case (Supabase) and camelCase (Prisma) formats
  const releaseDate = media.releaseDate || media.release_date;
  const year = releaseDate ? new Date(releaseDate).getFullYear() : new Date().getFullYear();
  
  // Determine status based on logs
  let status: 'Watchlist' | 'Ongoing' | 'Seen' = 'Watchlist';
  if (logs && logs.length > 0) {
    const hasRecentLog = logs.some(log => {
      const logDate = new Date(log.watched_at || log.created_at);
      const daysSince = (Date.now() - logDate.getTime()) / (1000 * 60 * 60 * 24);
      return daysSince < 7; // Ongoing if watched in last 7 days
    });
    status = hasRecentLog ? 'Ongoing' : 'Seen';
  }

  // Get seenBy from logs
  const seenBy = logs?.flatMap(log => 
    log.log_attendees?.map((attendee: any) => attendee.user_id) || []
  ) || [];

  // Priority based on upvotes
  let priority: 'High' | 'Medium' | 'Low' = 'Low';
  const upvotes = watchlistItem?.upvotes || 0;
  const downvotes = watchlistItem?.downvotes || 0;
  if (upvotes >= 5) priority = 'High';
  else if (upvotes >= 2) priority = 'Medium';

  // If media has tmdb_id, use tmdb-{id} format for consistency with grid movies
  // Otherwise use the UUID
  // Handle both snake_case (Supabase) and camelCase (Prisma) formats
  const tmdbId = media.tmdb_id || media.tmdbId;
  const movieId = tmdbId ? `tmdb-${tmdbId}` : media.id;
  
  // Handle both snake_case (Supabase) and camelCase (Prisma) formats for poster URLs
  const poster = media.posterUrl || media.poster_url || media.thumbnailUrl || media.thumbnail_url || '';
  
  // Handle both snake_case (Supabase) and camelCase (Prisma) formats for IMDB rating
  const imdbRating = media.imdbRating || media.imdb_rating || undefined;
  
  // Get user vote from watchlistItem if provided
  const userVote = watchlistItem?.userVote || null;
  
  return {
    id: movieId,
    title: media.title,
    poster,
    year,
    runtime,
    genre: media.genres || [],
    description: media.description || media.overview || undefined,
    priority,
    status,
    votes: upvotes - downvotes, // Net votes
    upvotes,
    downvotes,
    userVote,
    seenBy: [...new Set(seenBy)],
    availability: [],
    imdbRating,
  };
}

export function transformUserToFrontend(user: any, teamMembership?: any): User {
  // Get status from database, default to 'Offline' if not set
  // Preserve the original database status values
  // Database: 'Online', 'Idle', 'Do Not Disturb', 'Offline'
  // Frontend: 'Online', 'Idle', 'Do Not Disturb', 'Offline' (same values)
  let status: 'Online' | 'Idle' | 'Do Not Disturb' | 'Offline' = 'Offline';
  
  // Debug: log the user status to help diagnose issues
  if (typeof window === 'undefined' && user?.id) {
    console.log(`[TRANSFORM] User ${user.id} (${user.name}) status:`, user.status);
  }
  
  if (user.status) {
    // Preserve the original status from database
    if (user.status === 'Online' || user.status === 'Idle' || user.status === 'Do Not Disturb' || user.status === 'Offline') {
      status = user.status;
    } else {
      // Unknown status value - log it and default to Offline
      console.warn(`[TRANSFORM] Unknown status value for user ${user.id}:`, user.status);
      status = 'Offline';
    }
  } else {
    // No status set - this is expected for new users
    if (typeof window === 'undefined' && user?.id) {
      console.log(`[TRANSFORM] User ${user.id} has no status set, defaulting to Offline`);
    }
  }
  
  // Role from team membership or default
  const role = teamMembership?.role === 'admin' ? 'Admin' : 
               teamMembership?.role === 'editor' ? 'Editor' : 'Viewer';

  return {
    id: user.id,
    name: user.name || 'Unknown',
    avatar: user.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}`,
    status,
    role,
  };
}

export function transformTeamToGroup(team: any): Group {
  const members = (team.team_members || []).map((tm: any) => 
    transformUserToFrontend(tm.users || tm.user, tm)
  );

  // Calculate budget hours (default 40 hours per month)
  const budgetHours = 40;
  
  // Calculate used hours from logs
  const usedHours = (team.logs || []).reduce((total: number, log: any) => {
    const media = log.media || log;
    const runtime = media.runtime || 0; // in minutes
    return total + (runtime / 60);
  }, 0);

  return {
    id: team.id,
    name: team.name,
    members,
    budgetHours,
    usedHours: Math.round(usedHours * 10) / 10,
    pictureUrl: team.picture_url || team.pictureUrl,
    inviteCode: team.invite_code || team.inviteCode,
    description: team.description,
  };
}

// Genre cache to avoid repeated API calls
let genreCache: Map<number, string> | null = null;

async function getGenreMap(): Promise<Map<number, string>> {
  if (genreCache) return genreCache;
  
  try {
    const genres = await getGenres();
    genreCache = new Map(genres.map(g => [g.id, g.name]));
    return genreCache;
  } catch (error) {
    console.error('Failed to fetch genres:', error);
    return new Map();
  }
}

export async function transformTMDBMovieToMovie(tmdbMovie: TMDBMovie, watchlistItem?: any, logs?: any[]): Promise<Movie> {
  const genreMap = await getGenreMap();
  const genres = tmdbMovie.genre_ids.map(id => genreMap.get(id) || 'Unknown').filter(Boolean);
  
  const runtime = (tmdbMovie.runtime != null && tmdbMovie.runtime > 0)
    ? (() => {
        const hours = Math.floor(tmdbMovie.runtime / 60);
        const minutes = tmdbMovie.runtime % 60;
        if (hours === 0) return `${minutes}m`;
        if (minutes === 0) return `${hours}h`;
        return `${hours}h ${minutes}m`;
      })()
    : '';
  
  const year = tmdbMovie.release_date 
    ? new Date(tmdbMovie.release_date).getFullYear() 
    : new Date().getFullYear();
  
  // Determine status based on logs
  let status: 'Watchlist' | 'Ongoing' | 'Seen' = 'Watchlist';
  if (logs && logs.length > 0) {
    const hasRecentLog = logs.some(log => {
      const logDate = new Date(log.watched_at || log.created_at);
      const daysSince = (Date.now() - logDate.getTime()) / (1000 * 60 * 60 * 24);
      return daysSince < 7; // Ongoing if watched in last 7 days
    });
    status = hasRecentLog ? 'Ongoing' : 'Seen';
  }

  // Get seenBy from logs
  const seenBy = logs?.flatMap(log => 
    log.log_attendees?.map((attendee: any) => attendee.user_id) || []
  ) || [];

  // Priority based on upvotes
  let priority: 'High' | 'Medium' | 'Low' = 'Low';
  const upvotes = watchlistItem?.upvotes || 0;
  const downvotes = watchlistItem?.downvotes || 0;
  if (upvotes >= 5) priority = 'High';
  else if (upvotes >= 2) priority = 'Medium';

  // Get user vote from watchlistItem if provided
  const userVote = watchlistItem?.userVote || null;

  return {
    id: `tmdb-${tmdbMovie.id}`,
    title: tmdbMovie.title,
    poster: getPosterUrl(tmdbMovie.poster_path),
    year,
    runtime,
    genre: genres.length > 0 ? genres : ['Unknown'],
    description: tmdbMovie.overview || undefined,
    priority,
    status,
    votes: upvotes - downvotes, // Net votes
    upvotes,
    downvotes,
    userVote,
    seenBy: [...new Set(seenBy)],
    availability: [],
  };
}

// Synchronous version for when genres are already known
export function transformTMDBMovieToMovieSync(tmdbMovie: TMDBMovie, genreMap: Map<number, string>, watchlistItem?: any, logs?: any[]): Movie {
  const genres = tmdbMovie.genre_ids.map(id => genreMap.get(id) || 'Unknown').filter(Boolean);
  
  const runtime = (tmdbMovie.runtime != null && tmdbMovie.runtime > 0)
    ? (() => {
        const hours = Math.floor(tmdbMovie.runtime / 60);
        const minutes = tmdbMovie.runtime % 60;
        if (hours === 0) return `${minutes}m`;
        if (minutes === 0) return `${hours}h`;
        return `${hours}h ${minutes}m`;
      })()
    : '';
  
  const year = tmdbMovie.release_date 
    ? new Date(tmdbMovie.release_date).getFullYear() 
    : new Date().getFullYear();
  
  // Determine status based on logs
  let status: 'Watchlist' | 'Ongoing' | 'Seen' = 'Watchlist';
  if (logs && logs.length > 0) {
    const hasRecentLog = logs.some(log => {
      const logDate = new Date(log.watched_at || log.created_at);
      const daysSince = (Date.now() - logDate.getTime()) / (1000 * 60 * 60 * 24);
      return daysSince < 7; // Ongoing if watched in last 7 days
    });
    status = hasRecentLog ? 'Ongoing' : 'Seen';
  }

  // Get seenBy from logs
  const seenBy = logs?.flatMap(log => 
    log.log_attendees?.map((attendee: any) => attendee.user_id) || []
  ) || [];

  // Priority based on upvotes
  let priority: 'High' | 'Medium' | 'Low' = 'Low';
  const upvotes = watchlistItem?.upvotes || 0;
  const downvotes = watchlistItem?.downvotes || 0;
  if (upvotes >= 5) priority = 'High';
  else if (upvotes >= 2) priority = 'Medium';

  // Get user vote from watchlistItem if provided
  const userVote = watchlistItem?.userVote || null;

  return {
    id: `tmdb-${tmdbMovie.id}`,
    title: tmdbMovie.title,
    poster: getPosterUrl(tmdbMovie.poster_path),
    year,
    runtime,
    genre: genres.length > 0 ? genres : ['Unknown'],
    description: tmdbMovie.overview || undefined,
    priority,
    status,
    votes: upvotes - downvotes, // Net votes
    upvotes,
    downvotes,
    userVote,
    seenBy: [...new Set(seenBy)],
    availability: [],
  };
}

