import { NextRequest, NextResponse } from 'next/server';
import { searchMovies, TMDBMovie } from '@/lib/api/tmdb';
import { extractYouTubeId, getYouTubeVideoData } from '@/lib/api/youtube';
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

    // Use fuzzy search to rank results
    // Threshold: 0.0 = exact match, 1.0 = match anything
    // 0.4 allows for typos while still being reasonably strict
    const fuse = new Fuse(uniqueResults, {
      keys: [
        { name: 'title', weight: 0.8 },
        { name: 'overview', weight: 0.2 },
      ],
      threshold: 0.5, // Allow for typos and partial matches
      ignoreLocation: true,
      includeScore: true,
      minMatchCharLength: Math.max(2, Math.floor(query.length * 0.5)), // Require at least half the query length to match
    });

    const fuzzyResults = fuse.search(query);
    
    // Extract results, prioritizing exact matches and high scores
    // Score < 0.6 means reasonably good match (lower is better)
    const rankedResults = fuzzyResults
      .filter(result => result.score !== undefined && result.score < 0.7) // Include good fuzzy matches
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

    // If fuzzy search didn't find good matches, fall back to original results
    const finalResults = rankedResults.length > 0 
      ? rankedResults 
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

