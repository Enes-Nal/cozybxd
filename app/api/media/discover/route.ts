import { NextRequest, NextResponse } from 'next/server';
import { discoverMovies } from '@/lib/api/tmdb';

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
    
    // Apply additional client-side filtering if needed
    let filteredMovies = movies;
    
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

