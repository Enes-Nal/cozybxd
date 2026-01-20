import { NextResponse } from 'next/server';
import { getNowPlayingMovies, getMovieDetails } from '@/lib/api/tmdb';
import { createServerClient } from '@/lib/supabase';

export async function GET() {
  try {
    const movies = await getNowPlayingMovies(1);
    const supabase = createServerClient();
    
    // Batch fetch all runtimes from database at once
    const tmdbIds = movies.map(m => m.id);
    const { data: dbMediaList } = await supabase
      .from('media')
      .select('tmdb_id, runtime')
      .in('tmdb_id', tmdbIds);
    
    // Create a map for quick lookup
    const runtimeMap = new Map<number, number>();
    dbMediaList?.forEach((media: any) => {
      if (media.runtime != null && media.runtime > 0) {
        runtimeMap.set(media.tmdb_id, media.runtime);
      }
    });
    
    // Enrich movies with runtime - use database first, then fetch details for missing ones
    const moviesToEnrich: Array<{ movie: any; index: number }> = [];
    const enrichedMovies = movies.map((movie, index) => {
      // If runtime is already available, use it
      if (movie.runtime != null && movie.runtime > 0) {
        return movie;
      }
      
      // Check database map
      const dbRuntime = runtimeMap.get(movie.id);
      if (dbRuntime != null && dbRuntime > 0) {
        return { ...movie, runtime: dbRuntime };
      }
      
      // Mark for enrichment
      moviesToEnrich.push({ movie, index });
      return movie;
    });
    
    // Fetch details for movies not in database (with small delay to avoid rate limits)
    for (let i = 0; i < moviesToEnrich.length; i++) {
      const { movie, index } = moviesToEnrich[i];
      try {
        const details = await getMovieDetails(movie.id);
        if (details?.runtime != null && details.runtime > 0) {
          enrichedMovies[index] = { ...movie, runtime: details.runtime };
        }
        // Small delay to avoid rate limits (TMDB allows 40 requests per 10 seconds)
        if (i < moviesToEnrich.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (error) {
        console.error(`Failed to fetch details for movie ${movie.id}:`, error);
      }
    }
    
    return NextResponse.json({
      type: 'movie',
      results: enrichedMovies,
    });
  } catch (error) {
    console.error('New releases error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch new releases';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

