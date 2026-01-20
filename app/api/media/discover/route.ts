import { NextRequest, NextResponse } from 'next/server';
import { discoverMovies, getMovieDetails, TMDBMovie } from '@/lib/api/tmdb';
import { createServerClient } from '@/lib/supabase';

// Helper function to enrich TMDB movies with runtime
async function enrichMoviesWithRuntime(movies: TMDBMovie[], supabase: any): Promise<TMDBMovie[]> {
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
  const moviesToEnrich: Array<{ movie: TMDBMovie; index: number }> = [];
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
  
  return enrichedMovies;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    const contentType = (searchParams.get('contentType') || 'movie') as 'movie' | 'tv';
    const maxRuntimeParam = searchParams.get('maxRuntime');
    const maxRuntime = maxRuntimeParam ? parseInt(maxRuntimeParam) : undefined;
    // Treat 240 as "no filter" (max value)
    const maxRuntimeFilter = maxRuntime !== undefined && maxRuntime < 240 ? maxRuntime : undefined;
    
    const minRatingParam = searchParams.get('minRating');
    const minRating = minRatingParam ? parseFloat(minRatingParam) : undefined;
    // Treat 0 as "no filter"
    const minRatingFilter = minRating !== undefined && minRating > 0 ? minRating : undefined;
    
    const genresParam = searchParams.get('genres');
    const genres = genresParam ? genresParam.split(',').map(id => parseInt(id)).filter(id => !isNaN(id)) : undefined;
    const criticallyAcclaimed = searchParams.get('criticallyAcclaimed') === 'true';
    const nicheExperimental = searchParams.get('nicheExperimental') === 'true';
    
    // Build discover options
    const discoverOptions: any = {
      contentType,
      genres,
      minRating: minRatingFilter,
      maxRuntime: maxRuntimeFilter,
    };
    
    // Adjust sort based on discovery logic
    if (criticallyAcclaimed) {
      discoverOptions.sortBy = 'vote_average.desc';
      // Ensure minimum vote count for critically acclaimed
      if (!minRatingFilter || minRatingFilter < 7) {
        discoverOptions.minRating = 7;
      }
    } else {
      discoverOptions.sortBy = 'popularity.desc';
    }
    
    // For niche/experimental, we might want to filter by lower popularity
    // but TMDB doesn't have a direct way to do this, so we'll just use the filters we have
    
    const movies = await discoverMovies(discoverOptions);
    const supabase = createServerClient();
    
    // Enrich movies with runtime
    const enrichedMovies = await enrichMoviesWithRuntime(movies, supabase);
    
    // Apply additional client-side filtering if needed
    let filteredMovies = enrichedMovies;
    
    // Filter by runtime (runtime is in minutes in TMDB)
    // Note: TMDB discover results may not include runtime, so we filter on server
    // but also do client-side filtering as a fallback
    if (maxRuntimeFilter !== undefined && contentType === 'movie') {
      filteredMovies = filteredMovies.filter(movie => {
        // Runtime might not be available in discover results
        // If runtime is null/undefined, we include it and let client-side handle it
        if (movie.runtime === null || movie.runtime === undefined) {
          return true;
        }
        return movie.runtime <= maxRuntimeFilter;
      });
    }
    
    // Filter by rating
    if (minRatingFilter !== undefined) {
      filteredMovies = filteredMovies.filter(movie => 
        movie.vote_average >= minRatingFilter
      );
    }
    
    return NextResponse.json({
      type: 'movie',
      results: filteredMovies,
    });
  } catch (error) {
    console.error('Discover error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to discover media';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

