import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { createServerClient } from '@/lib/supabase';
import { transformMediaToMovie } from '@/lib/utils/transformers';
import { getMovieDetails } from '@/lib/api/tmdb';
import { getGenres } from '@/lib/api/tmdb';

// Helper to extract genre names from TMDB movie data
async function extractGenreNames(tmdbData: any): Promise<string[]> {
  try {
    // If genres array exists (from detail response), extract names directly
    if (Array.isArray(tmdbData.genres) && tmdbData.genres.length > 0) {
      return tmdbData.genres.map((g: any) => g.name).filter(Boolean);
    }
    
    // Otherwise, use genre_ids and map to names
    if (Array.isArray(tmdbData.genre_ids) && tmdbData.genre_ids.length > 0) {
      const genres = await getGenres();
      const genreMap = new Map(genres.map(g => [g.id, g.name]));
      return tmdbData.genre_ids.map((id: number) => genreMap.get(id) || '').filter(Boolean);
    }
    
    return [];
  } catch {
    return [];
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ mediaId: string }> }
) {
  try {
    const { mediaId } = await context.params;
    const supabase = createServerClient();

    // Get media with related data
    const { data: media, error: mediaError } = await supabase
      .from('media')
      .select('*')
      .eq('id', mediaId)
      .single();

    if (mediaError || !media) {
      return NextResponse.json({ error: 'Media not found' }, { status: 404 });
    }

    // Get watchlist items for this media
    const { data: watchlistItems } = await supabase
      .from('watchlist_items')
      .select('*')
      .eq('media_id', mediaId);

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
      .eq('media_id', mediaId)
      .order('watched_at', { ascending: false });

    // Get reviews
    const { data: reviews } = await supabase
      .from('reviews')
      .select(`
        *,
        users(*)
      `)
      .eq('media_id', mediaId)
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

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ mediaId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { mediaId } = await context.params;
    const supabase = createServerClient();

    // Get existing media
    const { data: media, error: mediaError } = await supabase
      .from('media')
      .select('*')
      .eq('id', mediaId)
      .single();

    if (mediaError || !media) {
      return NextResponse.json({ error: 'Media not found' }, { status: 404 });
    }

    // Only update if it's a TMDB movie and has a tmdb_id
    if (!media.tmdb_id) {
      return NextResponse.json({ error: 'Media does not have a TMDB ID' }, { status: 400 });
    }

    // Fetch fresh data from TMDB
    const tmdbData = await getMovieDetails(media.tmdb_id);
    if (!tmdbData) {
      return NextResponse.json({ error: 'Movie not found in TMDB' }, { status: 404 });
    }

    // Extract genre names
    const genres = await extractGenreNames(tmdbData);

    if (genres.length === 0) {
      return NextResponse.json({ error: 'No genres found for this movie' }, { status: 404 });
    }

    // Update the media with genres
    const { data: updated, error: updateError } = await supabase
      .from('media')
      .update({ genres })
      .eq('id', mediaId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Media update error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to update media';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

