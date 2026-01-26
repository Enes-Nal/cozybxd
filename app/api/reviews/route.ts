import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { createServerClient } from '@/lib/supabase';
import { getMovieDetails, getPosterUrl, getBackdropUrl, getGenres } from '@/lib/api/tmdb';
import { getOMDbData } from '@/lib/api/omdb';
import { checkCooldown, recordAction, getCooldownErrorMessage } from '@/lib/utils/cooldown';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const mediaId = searchParams.get('mediaId');
  const tmdbId = searchParams.get('tmdbId');
  const userId = searchParams.get('userId');

  const supabase = createServerClient();

  try {
    let query = supabase
      .from('reviews')
      .select(`
        *,
        users(*),
        media(*)
      `);

    if (mediaId) {
      query = query.eq('media_id', mediaId);
    } else if (tmdbId) {
      // Find media by tmdb_id first, then query reviews
      const { data: media } = await supabase
        .from('media')
        .select('id')
        .eq('tmdb_id', parseInt(tmdbId))
        .single();
      
      if (media) {
        query = query.eq('media_id', media.id);
      } else {
        // No media found, return empty array
        return NextResponse.json([]);
      }
    }

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data: reviews, error } = await query
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(reviews || []);
  } catch (error) {
    console.error('Reviews fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reviews' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { mediaId, tmdbId, rating, comment, logId } = body;

  if ((!mediaId && !tmdbId) || !rating || rating < 1 || rating > 5) {
    return NextResponse.json(
      { error: 'Media ID or TMDB ID and rating (1-5) required' },
      { status: 400 }
    );
  }

  const supabase = createServerClient();

  try {
    let finalMediaId = mediaId;

    // If tmdbId is provided, find or sync the media first
    if (tmdbId && !mediaId) {
      // Check if media already exists
      const { data: existingMedia } = await supabase
        .from('media')
        .select('*')
        .eq('tmdb_id', tmdbId)
        .single();

      if (existingMedia) {
        finalMediaId = existingMedia.id;
      } else {
        // Sync media from TMDB
        const tmdbData = await getMovieDetails(tmdbId);
        if (!tmdbData) {
          return NextResponse.json(
            { error: 'Movie not found in TMDB' },
            { status: 404 }
          );
        }

        // Get genre names
        const genres = await getGenres();
        const genreMap = new Map(genres.map(g => [g.id, g.name]));
        const genreNames = (tmdbData.genre_ids || []).map(id => genreMap.get(id) || '').filter(Boolean);

        // Fetch IMDB rating if IMDB ID is available
        let imdbRating: number | null = null;
        let imdbId: string | null = null;
        
        const tmdbMovieDetails = tmdbData as any;
        if (tmdbMovieDetails.external_ids?.imdb_id) {
          imdbId = tmdbMovieDetails.external_ids.imdb_id;
          if (imdbId) {
            try {
              const omdbData = await getOMDbData(imdbId);
              if (omdbData?.imdbRating && omdbData.imdbRating !== 'N/A') {
                imdbRating = parseFloat(omdbData.imdbRating);
              }
            } catch (error) {
              console.error('Failed to fetch IMDB rating:', error);
            }
          }
        }

        // Create media record
        const { data: syncedMedia, error: mediaError } = await supabase
          .from('media')
          .insert({
            tmdb_id: tmdbId,
            imdb_id: imdbId,
            title: tmdbData.title,
            type: 'movie',
            poster_url: getPosterUrl(tmdbData.poster_path),
            backdrop_url: getBackdropUrl(tmdbData.backdrop_path),
            overview: tmdbData.overview || null,
            release_date: tmdbData.release_date ? new Date(tmdbData.release_date) : null,
            runtime: tmdbData.runtime || null,
            genres: genreNames,
            imdb_rating: imdbRating,
          })
          .select()
          .single();

        if (mediaError || !syncedMedia) {
          return NextResponse.json(
            { error: mediaError?.message || 'Failed to sync media from TMDB' },
            { status: 500 }
          );
        }

        finalMediaId = syncedMedia.id;
      }
    }

    if (!finalMediaId) {
      return NextResponse.json(
        { error: 'Could not determine media ID' },
        { status: 400 }
      );
    }

    // Check if review already exists for this user and media
    const { data: existing } = await supabase
      .from('reviews')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('media_id', finalMediaId)
      .maybeSingle();

    let review;
    if (existing) {
      // Updating existing review - no cooldown needed
      // Update existing review
      const { data: updated, error: updateError } = await supabase
        .from('reviews')
        .update({
          rating,
          comment: comment || null,
          log_id: logId || null,
        })
        .eq('id', existing.id)
        .select(`
          *,
          users(*),
          media(*)
        `)
        .single();

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      review = updated;
    } else {
      // Create new review - check cooldown first
      const cooldownCheck = await checkCooldown(session.user.id, 'create_review');
      if (!cooldownCheck.allowed) {
        return NextResponse.json(
          { error: getCooldownErrorMessage('create_review', cooldownCheck.remainingSeconds!) },
          { status: 429 }
        );
      }

      const { data: created, error: createError } = await supabase
        .from('reviews')
        .insert({
          user_id: session.user.id,
          media_id: finalMediaId,
          rating,
          comment: comment || null,
          log_id: logId || null,
        })
        .select(`
          *,
          users(*),
          media(*)
        `)
        .single();

      if (createError) {
        return NextResponse.json({ error: createError.message }, { status: 500 });
      }

      review = created;
      
      // Record the action after successful review creation
      await recordAction(session.user.id, 'create_review');
    }

    return NextResponse.json(review);
  } catch (error) {
    console.error('Review create/update error:', error);
    return NextResponse.json(
      { error: 'Failed to create/update review' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServerClient();

  try {
    // Support both JSON body and query params (helpful for clients that avoid DELETE bodies)
    const searchParams = request.nextUrl.searchParams;
    const reviewIdFromQuery = searchParams.get('reviewId');
    const mediaIdFromQuery = searchParams.get('mediaId');
    const tmdbIdFromQuery = searchParams.get('tmdbId');

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      // ignore - no JSON body
    }

    const reviewId = body?.reviewId || reviewIdFromQuery;
    const mediaId = body?.mediaId || mediaIdFromQuery;
    const tmdbId = body?.tmdbId || tmdbIdFromQuery;

    // Prefer deleting by explicit reviewId (most precise)
    if (reviewId) {
      const { data: deleted, error } = await supabase
        .from('reviews')
        .delete()
        .eq('id', reviewId)
        .eq('user_id', session.user.id)
        .select('id')
        .limit(1);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      if (!deleted || deleted.length === 0) {
        return NextResponse.json({ error: 'Review not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true, deletedId: deleted[0].id });
    }

    // Fallback: delete the current user's review for the given media/tmdb id
    if (!mediaId && !tmdbId) {
      return NextResponse.json(
        { error: 'reviewId or mediaId/tmdbId required' },
        { status: 400 }
      );
    }

    let finalMediaId: string | null = mediaId || null;

    if (!finalMediaId && tmdbId) {
      const { data: media } = await supabase
        .from('media')
        .select('id')
        .eq('tmdb_id', parseInt(tmdbId))
        .single();

      if (!media) {
        return NextResponse.json({ error: 'Media not found' }, { status: 404 });
      }

      finalMediaId = media.id;
    }

    if (!finalMediaId) {
      return NextResponse.json({ error: 'Could not determine media ID' }, { status: 400 });
    }

    const { data: deleted, error } = await supabase
      .from('reviews')
      .delete()
      .eq('user_id', session.user.id)
      .eq('media_id', finalMediaId)
      .select('id')
      .limit(1);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!deleted || deleted.length === 0) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, deletedId: deleted[0].id });
  } catch (error) {
    console.error('Review delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete review' },
      { status: 500 }
    );
  }
}

