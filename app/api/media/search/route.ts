import { NextRequest, NextResponse } from 'next/server';
import { searchMovies, TMDBMovie, findMovieByImdbId } from '@/lib/api/tmdb';
import { extractYouTubeId, getYouTubeVideoData } from '@/lib/api/youtube';
import { extractImdbId } from '@/lib/api/omdb';
import { createServerClient } from '@/lib/supabase';
import Fuse from 'fuse.js';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q');
  const type = searchParams.get('type') || 'all';

  if (!query) {
    return NextResponse.json({ error: 'Query required' }, { status: 400 });
  }

  try {
    // Check for IMDB URL
    const imdbId = extractImdbId(query);
    if (imdbId) {
      const movie = await findMovieByImdbId(imdbId);
      if (movie) {
        return NextResponse.json({
          type: 'movie',
          results: [movie],
        });
      } else {
        return NextResponse.json({ error: 'Movie not found for this IMDB ID' }, { status: 404 });
      }
    }

    // Check for YouTube URL
    if (type === 'youtube' || query.includes('youtube.com') || query.includes('youtu.be')) {
      const videoId = extractYouTubeId(query);
      if (!videoId) {
        return NextResponse.json({ error: 'Invalid YouTube URL' }, { status: 400 });
      }
      
      const videoData = await getYouTubeVideoData(videoId);
      if (!videoData) {
        return NextResponse.json({ error: 'Could not fetch YouTube video' }, { status: 404 });
      }
      
      return NextResponse.json({
        type: 'youtube',
        data: videoData,
      });
    }

    // Search both TMDB and local database in parallel
    const [tmdbResults, dbResults] = await Promise.all([
      searchMovies(query).catch(() => [] as TMDBMovie[]),
      searchLocalDatabase(query).catch(() => [] as any[]),
    ]);

    // Combine results - convert DB results to TMDB-like format for fuzzy search
    const allResults: Array<TMDBMovie & { source: 'tmdb' | 'db' }> = [
      ...tmdbResults.map(m => ({ ...m, source: 'tmdb' as const })),
      ...dbResults.map(m => ({ ...m, source: 'db' as const })),
    ];

    // Remove duplicates based on tmdb_id or title
    const seenIds = new Set<number>();
    const seenTitles = new Set<string>();
    const uniqueResults: Array<TMDBMovie & { source: 'tmdb' | 'db' }> = [];
    
    for (const result of allResults) {
      const id = result.id;
      const title = result.title.toLowerCase().trim();
      
      if (id && seenIds.has(id)) continue;
      if (seenTitles.has(title)) continue;
      
      if (id) seenIds.add(id);
      seenTitles.add(title);
      uniqueResults.push(result);
    }

    // Check for exact or near-exact title matches first (case-insensitive)
    const queryLower = query.toLowerCase().trim();
    const exactMatches = uniqueResults.filter(movie => {
      const titleLower = movie.title.toLowerCase().trim();
      return titleLower === queryLower || titleLower.includes(queryLower) || queryLower.includes(titleLower);
    });

    // Use fuzzy search to rank results
    // Threshold: 0.0 = exact match, 1.0 = match anything
    // 0.6 allows for more flexible matching while still being reasonable
    const fuse = new Fuse(uniqueResults, {
      keys: [
        { name: 'title', weight: 0.9 },
        { name: 'overview', weight: 0.1 },
      ],
      threshold: 0.6, // More lenient threshold for better matching
      ignoreLocation: true,
      includeScore: true,
      minMatchCharLength: 2, // Reduced from requiring half query length
      findAllMatches: true, // Find all matches, not just the first
    });

    const fuzzyResults = fuse.search(query);
    
    // Extract results, prioritizing exact matches and high scores
    // Score < 0.8 means reasonably good match (lower is better, increased threshold)
    const rankedResults = fuzzyResults
      .filter(result => result.score !== undefined && result.score < 0.8) // More lenient score threshold
      .sort((a, b) => {
        // Sort by score (lower is better), then by popularity (vote_average)
        if (Math.abs(a.score! - b.score!) < 0.1) {
          // If scores are close, prefer TMDB results (they have vote_average)
          if (a.item.source === 'tmdb' && b.item.source === 'db') return -1;
          if (a.item.source === 'db' && b.item.source === 'tmdb') return 1;
          // Within same source, prefer higher vote_average
          return (b.item.vote_average || 0) - (a.item.vote_average || 0);
        }
        return a.score! - b.score!;
      })
      .map(result => {
        // Remove the source field before returning
        const { source, ...movie } = result.item;
        return movie;
      });

    // Always include all TMDB results (they were already filtered by TMDB's search API)
    // This ensures movies like "Homunculus" appear even if fuzzy search doesn't rank them well
    const tmdbOnlyResults = tmdbResults
      .filter(m => {
        const id = m.id;
        const title = m.title.toLowerCase().trim();
        // Check if it's already in exact matches or ranked results
        const inExact = exactMatches.some(exact => exact.id === id || exact.title.toLowerCase().trim() === title);
        const inRanked = rankedResults.some(ranked => ranked.id === id);
        return !inExact && !inRanked;
      })
      .slice(0, 10); // Limit additional TMDB results to avoid too many

    // Combine exact matches with fuzzy results, prioritizing exact matches
    const exactMatchIds = new Set(exactMatches.map(m => m.id));
    const fuzzyWithoutExact = rankedResults.filter(m => !exactMatchIds.has(m.id));
    const combinedResults = [
      ...exactMatches.map(({ source, ...movie }) => movie),
      ...fuzzyWithoutExact,
      ...tmdbOnlyResults
    ];

    // If we have combined results, use them; otherwise fall back to all unique results
    const finalResults = combinedResults.length > 0 
      ? combinedResults.slice(0, 20) // Limit to top 20
      : uniqueResults.slice(0, 20).map(({ source, ...movie }) => movie);
    
    return NextResponse.json({
      type: 'movie',
      results: finalResults,
    });
  } catch (error) {
    console.error('Search error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to search media';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

async function searchLocalDatabase(query: string): Promise<TMDBMovie[]> {
  const supabase = createServerClient();
  
  // Search local database for media matching the query
  const { data: media, error } = await supabase
    .from('media')
    .select('*')
    .ilike('title', `%${query}%`)
    .limit(50);

  if (error) {
    console.error('Database search error:', error);
    return [];
  }

  // Convert database media to TMDB-like format
  return (media || []).map((m: any) => {
    // Extract poster path from full URL if it's a TMDB URL, otherwise keep as is
    let poster_path: string | null = null;
    if (m.poster_url) {
      const tmdbMatch = m.poster_url.match(/\/t\/p\/w\d+\/(.+)$/);
      poster_path = tmdbMatch ? `/${tmdbMatch[1]}` : m.poster_url;
    }
    
    let backdrop_path: string | null = null;
    if (m.backdrop_url) {
      const tmdbMatch = m.backdrop_url.match(/\/t\/p\/w\d+\/(.+)$/);
      backdrop_path = tmdbMatch ? `/${tmdbMatch[1]}` : m.backdrop_url;
    }
    
    return {
      id: m.tmdb_id || 0,
      title: m.title,
      overview: m.overview || '',
      release_date: m.release_date ? new Date(m.release_date).toISOString().split('T')[0] : '',
      poster_path,
      backdrop_path,
      runtime: m.runtime || null,
      genre_ids: [], // Will be populated if needed
      vote_average: m.imdb_rating || 0,
    };
  }).filter((m: TMDBMovie) => m.id > 0 || m.title); // Only include valid results
}

