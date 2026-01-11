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

    // Fetch media details
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

