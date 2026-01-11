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
    `${TMDB_BASE_URL}/movie/${tmdbId}?api_key=${TMDB_API_KEY}`
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

