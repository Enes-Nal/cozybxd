import { NextRequest, NextResponse } from 'next/server';
import { getMovieDetails } from '@/lib/api/tmdb';
import { getIMDbRatingsBatch } from '@/lib/api/imdbapi';

/**
 * Fetch IMDb ratings for multiple TMDB movies
 * POST /api/media/imdb-ratings
 * Body: { tmdbIds: number[] }
 * Returns: { ratings: Record<string, number> } where key is tmdb-{id}
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tmdbIds } = body;

    if (!Array.isArray(tmdbIds) || tmdbIds.length === 0) {
      return NextResponse.json({ error: 'tmdbIds array required' }, { status: 400 });
    }

    // Limit batch size to avoid overwhelming the API
    const batchSize = 20;
    const ratings: Record<string, number> = {};

    // Process in batches
    for (let i = 0; i < tmdbIds.length; i += batchSize) {
      const batch = tmdbIds.slice(i, i + batchSize);
      
      // Fetch IMDb IDs from TMDB for this batch
      const imdbIdPromises = batch.map(async (tmdbId: number) => {
        try {
          const details = await getMovieDetails(tmdbId);
          const tmdbMovieDetails = details as any;
          const imdbId = tmdbMovieDetails?.external_ids?.imdb_id || null;
          console.log(`TMDB ${tmdbId} -> IMDb ${imdbId || 'N/A'}`);
          return {
            tmdbId,
            imdbId,
          };
        } catch (error) {
          console.error(`Failed to fetch details for TMDB ${tmdbId}:`, error);
          return { tmdbId, imdbId: null };
        }
      });

      const imdbIdResults = await Promise.all(imdbIdPromises);
      console.log(`Got IMDb IDs: ${imdbIdResults.filter(r => r.imdbId).length}/${imdbIdResults.length}`);
      
      // Filter out movies without IMDb IDs
      const validImdbIds = imdbIdResults
        .filter(result => result.imdbId)
        .map(result => result.imdbId);

      if (validImdbIds.length > 0) {
        console.log(`Fetching IMDb ratings for ${validImdbIds.length} movies:`, validImdbIds.slice(0, 5));
        // Fetch ratings in batch from imdbapi.dev
        const ratingMap = await getIMDbRatingsBatch(validImdbIds);
        
        console.log(`Got ${ratingMap.size} ratings from IMDb API`);
        
        // Map ratings back to TMDB IDs
        imdbIdResults.forEach(({ tmdbId, imdbId }) => {
          if (imdbId && ratingMap.has(imdbId)) {
            const rating = ratingMap.get(imdbId)!;
            ratings[`tmdb-${tmdbId}`] = rating;
            console.log(`Mapped rating ${rating} for tmdb-${tmdbId} (imdb: ${imdbId})`);
          }
        });
      } else {
        console.log('No valid IMDb IDs found in batch');
      }

      // Small delay between batches to avoid rate limits
      if (i + batchSize < tmdbIds.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    return NextResponse.json({ ratings });
  } catch (error) {
    console.error('IMDb ratings fetch error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch IMDb ratings';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

