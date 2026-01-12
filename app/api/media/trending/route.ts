import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getTrendingMovies } from '@/lib/api/tmdb';

export async function GET() {
  try {
    const supabase = createServerClient();

    // Get trending media based on view counts from the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: viewCounts, error: viewError } = await supabase
      .from('view_counts')
      .select('media_id')
      .gte('viewed_at', thirtyDaysAgo.toISOString());

    if (viewError) {
      console.error('Error fetching view counts:', viewError);
    }

    // Count views per media
    const mediaViewCounts: Record<string, number> = {};
    (viewCounts || []).forEach((vc: any) => {
      mediaViewCounts[vc.media_id] = (mediaViewCounts[vc.media_id] || 0) + 1;
    });

    // Get top 20 most viewed media
    const topMediaIds = Object.entries(mediaViewCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 20)
      .map(([id]) => id);

    // If we have fewer than 15 items with view counts, supplement with TMDB trending
    const shouldSupplement = topMediaIds.length < 15;

    if (topMediaIds.length === 0) {
      // Fallback: get TMDB trending movies
      try {
        const tmdbMovies = await getTrendingMovies(1);
        return NextResponse.json({
          type: 'tmdb',
          results: tmdbMovies,
        });
      } catch (tmdbError) {
        // Final fallback: get recent media if no views and TMDB fails
        const { data: recentMedia } = await supabase
          .from('media')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(20);

        return NextResponse.json({
          type: 'media',
          results: recentMedia || [],
        });
      }
    }

    // Fetch media details for items with view counts
    const { data: trendingMedia, error: mediaError } = await supabase
      .from('media')
      .select('*')
      .in('id', topMediaIds);

    if (mediaError) {
      return NextResponse.json({ error: mediaError.message }, { status: 500 });
    }

    // Sort by view count
    const sortedMedia = (trendingMedia || []).sort((a, b) => {
      const viewsA = mediaViewCounts[a.id] || 0;
      const viewsB = mediaViewCounts[b.id] || 0;
      return viewsB - viewsA;
    });

    // If we need to supplement, get TMDB trending movies
    if (shouldSupplement) {
      try {
        const tmdbMovies = await getTrendingMovies(1);
        // Get existing TMDB IDs to avoid duplicates
        const existingTmdbIds = new Set(
          sortedMedia
            .filter((m: any) => m.tmdb_id)
            .map((m: any) => m.tmdb_id.toString())
        );
        
        // Filter out duplicates and limit to fill up to 20 items
        const uniqueTmdbMovies = tmdbMovies
          .filter((tmdbMovie) => !existingTmdbIds.has(tmdbMovie.id.toString()))
          .slice(0, 20 - sortedMedia.length);

        return NextResponse.json({
          type: 'mixed',
          results: [...sortedMedia, ...uniqueTmdbMovies],
        });
      } catch (tmdbError) {
        // If TMDB fails, just return what we have
        console.error('Failed to supplement with TMDB trending:', tmdbError);
        return NextResponse.json({
          type: 'media',
          results: sortedMedia,
        });
      }
    }

    return NextResponse.json({
      type: 'media',
      results: sortedMedia,
    });
  } catch (error) {
    console.error('Trending media error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch trending media';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

