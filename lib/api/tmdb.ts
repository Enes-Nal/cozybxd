const TMDB_API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY || '';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

export interface TMDBMovie {
  id: number;
  title: string;
  overview: string;
  release_date: string;
  poster_path: string | null;
  backdrop_path: string | null;
  runtime: number | null;
  genre_ids: number[];
  vote_average: number;
}

export interface TMDBGenre {
  id: number;
  name: string;
}

export async function searchMovies(query: string): Promise<TMDBMovie[]> {
  if (!TMDB_API_KEY) {
    throw new Error('TMDB API key is not configured');
  }
  const response = await fetch(
    `${TMDB_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}`
  );
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.status_message || `Failed to search movies: ${response.status}`);
  }
  const data = await response.json();
  return data.results || [];
}

export async function getMovieDetails(tmdbId: number): Promise<TMDBMovie | null> {
  const response = await fetch(
    `${TMDB_BASE_URL}/movie/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`
  );
  if (!response.ok) return null;
  return response.json();
}

export async function getGenres(): Promise<TMDBGenre[]> {
  const response = await fetch(
    `${TMDB_BASE_URL}/genre/movie/list?api_key=${TMDB_API_KEY}`
  );
  const data = await response.json();
  return data.genres || [];
}

export function getPosterUrl(path: string | null): string {
  if (!path) return '';
  return `https://image.tmdb.org/t/p/w500${path}`;
}

export function getBackdropUrl(path: string | null): string {
  if (!path) return '';
  return `https://image.tmdb.org/t/p/w1280${path}`;
}

export async function getPopularMovies(page: number = 1): Promise<TMDBMovie[]> {
  if (!TMDB_API_KEY) {
    throw new Error('TMDB API key is not configured');
  }
  const response = await fetch(
    `${TMDB_BASE_URL}/movie/popular?api_key=${TMDB_API_KEY}&page=${page}`
  );
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.status_message || `Failed to fetch popular movies: ${response.status}`);
  }
  const data = await response.json();
  return data.results || [];
}

export async function getTrendingMovies(page: number = 1): Promise<TMDBMovie[]> {
  if (!TMDB_API_KEY) {
    throw new Error('TMDB API key is not configured');
  }
  const response = await fetch(
    `${TMDB_BASE_URL}/trending/movie/day?api_key=${TMDB_API_KEY}&page=${page}`
  );
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.status_message || `Failed to fetch trending movies: ${response.status}`);
  }
  const data = await response.json();
  return data.results || [];
}

export async function getNowPlayingMovies(page: number = 1): Promise<TMDBMovie[]> {
  if (!TMDB_API_KEY) {
    throw new Error('TMDB API key is not configured');
  }
  const response = await fetch(
    `${TMDB_BASE_URL}/movie/now_playing?api_key=${TMDB_API_KEY}&page=${page}`
  );
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.status_message || `Failed to fetch now playing movies: ${response.status}`);
  }
  const data = await response.json();
  return data.results || [];
}

export interface TMDBCastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
  order: number;
}

export interface TMDBCast {
  cast: TMDBCastMember[];
}

export interface TMDBCollection {
  id: number;
  name: string;
  poster_path: string | null;
  backdrop_path: string | null;
}

export interface TMDBMovieDetails extends TMDBMovie {
  belongs_to_collection: TMDBCollection | null;
  credits?: TMDBCast;
}

export async function getMovieCredits(tmdbId: number): Promise<TMDBCast | null> {
  if (!TMDB_API_KEY) {
    throw new Error('TMDB API key is not configured');
  }
  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/movie/${tmdbId}/credits?api_key=${TMDB_API_KEY}`
    );
    if (!response.ok) return null;
    return response.json();
  } catch (error) {
    console.error('Failed to fetch movie credits:', error);
    return null;
  }
}

export async function getMovieDetailsWithCredits(tmdbId: number): Promise<TMDBMovieDetails | null> {
  if (!TMDB_API_KEY) {
    throw new Error('TMDB API key is not configured');
  }
  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/movie/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=credits`
    );
    if (!response.ok) return null;
    return response.json();
  } catch (error) {
    console.error('Failed to fetch movie details:', error);
    return null;
  }
}

export function getProfileUrl(path: string | null): string {
  if (!path) return '';
  return `https://image.tmdb.org/t/p/w185${path}`;
}

export interface DiscoverOptions {
  contentType?: 'movie' | 'tv';
  genres?: number[];
  minRating?: number;
  maxRuntime?: number;
  sortBy?: 'popularity.desc' | 'vote_average.desc' | 'release_date.desc' | 'vote_count.desc';
  page?: number;
}

export async function discoverMovies(options: DiscoverOptions = {}): Promise<TMDBMovie[]> {
  if (!TMDB_API_KEY) {
    throw new Error('TMDB API key is not configured');
  }
  
  const contentType = options.contentType || 'movie';
  const params = new URLSearchParams();
  params.append('api_key', TMDB_API_KEY);
  params.append('page', (options.page || 1).toString());
  
  // Add genres
  if (options.genres && options.genres.length > 0) {
    params.append('with_genres', options.genres.join(','));
  }
  
  // Add rating
  if (options.minRating !== undefined) {
    params.append('vote_average.gte', options.minRating.toString());
  }
  
  // Add runtime (for movies only)
  if (contentType === 'movie' && options.maxRuntime !== undefined) {
    params.append('with_runtime.lte', options.maxRuntime.toString());
  }
  
  // Sort by
  if (options.sortBy) {
    params.append('sort_by', options.sortBy);
  } else if (options.minRating !== undefined && options.minRating >= 7) {
    // Default to vote average for high ratings
    params.append('sort_by', 'vote_average.desc');
  } else {
    params.append('sort_by', 'popularity.desc');
  }
  
  // For critically acclaimed, we want higher vote counts and ratings
  if (options.minRating !== undefined && options.minRating >= 7) {
    params.append('vote_count.gte', '100'); // At least 100 votes
  }
  
  const endpoint = contentType === 'tv' 
    ? `${TMDB_BASE_URL}/discover/tv`
    : `${TMDB_BASE_URL}/discover/movie`;
  
  const response = await fetch(`${endpoint}?${params.toString()}`);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.status_message || `Failed to discover ${contentType}: ${response.status}`);
  }
  const data = await response.json();
  return data.results || [];
}

