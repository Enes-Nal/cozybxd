import { NextResponse } from 'next/server';
import { getPopularMovies, getMovieDetails } from '@/lib/api/tmdb';
import { createServerClient } from '@/lib/supabase';

export async function GET() {
  try {
    const movies = await getPopularMovies(1);
    const supabase = createServerClient();
    
    // Enrich movies with runtime from database or fetch details
    const enrichedMovies = await Promise.all(
      movies.map(async (movie) => {
        // If runtime is already available, use it
        if (movie.runtime != null && movie.runtime > 0) {
          return movie;
        }
        
        // Check database first
        const { data: dbMedia } = await supabase
          .from('media')
          .select('runtime')
          .eq('tmdb_id', movie.id)
          .single();
        
        if (dbMedia?.runtime != null && dbMedia.runtime > 0) {
          return { ...movie, runtime: dbMedia.runtime };
        }
        
        // Fetch full details from TMDB (this includes runtime)
        try {
          const details = await getMovieDetails(movie.id);
          if (details?.runtime != null && details.runtime > 0) {
            return { ...movie, runtime: details.runtime };
          }
        } catch (error) {
          console.error(`Failed to fetch details for movie ${movie.id}:`, error);
        }
        
        return movie;
      })
    );
    
    return NextResponse.json({
      type: 'movie',
      results: enrichedMovies,
    });
  } catch (error) {
    console.error('Popular movies error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch popular movies';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

