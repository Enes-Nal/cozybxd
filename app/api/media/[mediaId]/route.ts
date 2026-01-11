import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { transformMediaToMovie } from '@/lib/utils/transformers';

export async function GET(
  request: NextRequest,
  { params }: { params: { mediaId: string } }
) {
  try {
    const supabase = createServerClient();

    // Get media with related data
    const { data: media, error: mediaError } = await supabase
      .from('media')
      .select('*')
      .eq('id', params.mediaId)
      .single();

    if (mediaError || !media) {
      return NextResponse.json({ error: 'Media not found' }, { status: 404 });
    }

    // Get watchlist items for this media
    const { data: watchlistItems } = await supabase
      .from('watchlist_items')
      .select('*')
      .eq('media_id', params.mediaId);

    // Get logs for this media
    const { data: logs } = await supabase
      .from('logs')
      .select(`
        *,
        log_attendees(
          *,
          users(*)
        )
      `)
      .eq('media_id', params.mediaId)
      .order('watched_at', { ascending: false });

    // Get reviews
    const { data: reviews } = await supabase
      .from('reviews')
      .select(`
        *,
        users(*)
      `)
      .eq('media_id', params.mediaId)
      .order('created_at', { ascending: false });

    // Transform to front-end format
    const watchlistItem = watchlistItems && watchlistItems.length > 0 ? watchlistItems[0] : null;
    const movie = transformMediaToMovie(media, watchlistItem, logs || []);

    return NextResponse.json({
      ...movie,
      reviews: reviews || [],
      logs: logs || [],
      watchlistItem,
    });
  } catch (error) {
    console.error('Media detail error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch media details';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

