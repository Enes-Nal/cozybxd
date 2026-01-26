import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { createServerClient } from '@/lib/supabase';
import { transformMediaToMovie } from '@/lib/utils/transformers';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const teamId = searchParams.get('teamId');
  const userId = searchParams.get('userId') || session.user.id;

  const supabase = createServerClient();

  try {
    let query = supabase
      .from('watchlist_items')
      .select(`
        *,
        media(*)
      `);

    if (teamId) {
      query = query.eq('team_id', teamId).is('user_id', null);
    } else {
      query = query.eq('user_id', userId).is('team_id', null);
    }

    const { data: watchlistItems, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get logs for each media to determine status
    const mediaIds = (watchlistItems || []).map((item: any) => item.media_id);
    const { data: logs } = await supabase
      .from('logs')
      .select(`
        *,
        log_attendees(*)
      `)
      .in('media_id', mediaIds);

    // Group logs by media_id
    const logsByMedia: Record<string, any[]> = {};
    (logs || []).forEach((log: any) => {
      if (!logsByMedia[log.media_id]) {
        logsByMedia[log.media_id] = [];
      }
      logsByMedia[log.media_id].push(log);
    });

    // Get user votes for all watchlist items (only for team watchlists)
    const watchlistItemIds = (watchlistItems || []).map((item: any) => item.id);
    let voteMap: Record<string, 'upvote' | 'downvote'> = {};
    
    if (teamId) {
      const { data: userVotes } = await supabase
        .from('watchlist_votes')
        .select('watchlist_item_id, vote_type')
        .eq('user_id', session.user.id)
        .in('watchlist_item_id', watchlistItemIds);

      // Create a map of watchlist_item_id -> vote_type
      (userVotes || []).forEach((vote: any) => {
        voteMap[vote.watchlist_item_id] = vote.vote_type;
      });
    }

    // Transform to front-end format and calculate scores
    const movies = (watchlistItems || []).map((item: any) => {
      const itemWithVote = {
        ...item,
        userVote: voteMap[item.id] || null
      };
      const movie = transformMediaToMovie(item.media, itemWithVote, logsByMedia[item.media_id] || []);
      // Calculate score (upvotes - downvotes) for sorting
      const score = (item.upvotes || 0) - (item.downvotes || 0);
      return { ...movie, _sortScore: score, _addedAt: item.added_at };
    });

    // Sort by score (descending), then by added_at (descending)
    movies.sort((a: any, b: any) => {
      if (b._sortScore !== a._sortScore) {
        return b._sortScore - a._sortScore;
      }
      return new Date(b._addedAt).getTime() - new Date(a._addedAt).getTime();
    });

    // Remove temporary sort fields
    const sortedMovies = movies.map(({ _sortScore, _addedAt, ...movie }: any) => movie);

    return NextResponse.json(sortedMovies);
  } catch (error) {
    console.error('Watchlist fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch watchlist' },
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
  const { mediaId, teamId } = body;

  if (!mediaId) {
    return NextResponse.json({ error: 'Media ID required' }, { status: 400 });
  }

  const supabase = createServerClient();

  try {
    // Check if media exists, if not we might need to create it
    const { data: existingMedia } = await supabase
      .from('media')
      .select('*')
      .eq('id', mediaId)
      .single();

    if (!existingMedia) {
      return NextResponse.json({ error: 'Media not found' }, { status: 404 });
    }

    // Check if already in watchlist
    let checkQuery = supabase
      .from('watchlist_items')
      .select('*')
      .eq('media_id', mediaId);

    if (teamId) {
      checkQuery = checkQuery.eq('team_id', teamId).is('user_id', null);
    } else {
      checkQuery = checkQuery.eq('user_id', session.user.id).is('team_id', null);
    }

    const { data: existing } = await checkQuery;

    if (existing && existing.length > 0) {
      return NextResponse.json({ error: 'Already in watchlist' }, { status: 400 });
    }

    // If team watchlist, verify user is a member
    if (teamId) {
      const { data: membership } = await supabase
        .from('team_members')
        .select('*')
        .eq('team_id', teamId)
        .eq('user_id', session.user.id)
        .single();

      if (!membership) {
        return NextResponse.json({ error: 'Not a team member' }, { status: 403 });
      }
    }

    // Add to watchlist
    const { data: watchlistItem, error } = await supabase
      .from('watchlist_items')
      .insert({
        media_id: mediaId,
        team_id: teamId || null,
        user_id: teamId ? null : session.user.id,
        upvotes: 0,
      })
      .select(`
        *,
        media(*)
      `)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log activity: movie added (only for team watchlists)
    if (teamId) {
      try {
        await supabase
          .from('team_activity_logs')
          .insert({
            team_id: teamId,
            user_id: session.user.id,
            activity_type: 'movie_added',
            media_id: mediaId,
            metadata: { 
              title: existingMedia.title,
              type: existingMedia.type
            },
          });
      } catch (err) {
        // Don't fail the request if logging fails
        console.error('Failed to log activity:', err);
      }
    }

    const movie = transformMediaToMovie(watchlistItem.media, watchlistItem);

    return NextResponse.json(movie);
  } catch (error) {
    console.error('Watchlist add error:', error);
    return NextResponse.json(
      { error: 'Failed to add to watchlist' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const mediaIdParam = searchParams.get('mediaId');
  const teamId = searchParams.get('teamId');

  if (!mediaIdParam) {
    return NextResponse.json({ error: 'Media ID required' }, { status: 400 });
  }

  const supabase = createServerClient();

  try {
    // Handle both UUID and tmdb-{id} formats
    let actualMediaId: string;
    if (mediaIdParam.startsWith('tmdb-')) {
      // Extract tmdb_id and look up the media
      const tmdbId = mediaIdParam.replace('tmdb-', '');
      const { data: media, error: mediaError } = await supabase
        .from('media')
        .select('id')
        .eq('tmdb_id', parseInt(tmdbId))
        .single();

      if (mediaError || !media) {
        return NextResponse.json({ error: 'Media not found' }, { status: 404 });
      }
      actualMediaId = media.id;
    } else {
      // Assume it's a UUID
      actualMediaId = mediaIdParam;
    }

    // If team watchlist, verify user is a team member first
    if (teamId) {
      const { data: membership } = await supabase
        .from('team_members')
        .select('*')
        .eq('team_id', teamId)
        .eq('user_id', session.user.id)
        .single();

      if (!membership) {
        return NextResponse.json({ error: 'Not a team member' }, { status: 403 });
      }

      // Delete team watchlist item
      const { data, error } = await supabase
        .from('watchlist_items')
        .delete()
        .eq('media_id', actualMediaId)
        .eq('team_id', teamId)
        .is('user_id', null)
        .select();

      if (error) {
        console.error('Delete error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      if (!data || data.length === 0) {
        return NextResponse.json({ error: 'Watchlist item not found' }, { status: 404 });
      }

      // Log activity: movie removed (only for team watchlists)
      if (teamId && data.length > 0) {
        // Get media info for logging
        const { data: media } = await supabase
          .from('media')
          .select('title, type')
          .eq('id', actualMediaId)
          .single();

        try {
          await supabase
            .from('team_activity_logs')
            .insert({
              team_id: teamId,
              user_id: session.user.id,
              activity_type: 'movie_removed',
              media_id: actualMediaId,
              metadata: media ? { 
                title: media.title,
                type: media.type
              } : {},
            });
        } catch (err) {
          // Don't fail the request if logging fails
          console.error('Failed to log activity:', err);
        }
      }

      return NextResponse.json({ success: true });
    } else {
      // Delete personal watchlist item
      const { data, error } = await supabase
        .from('watchlist_items')
        .delete()
        .eq('media_id', actualMediaId)
        .eq('user_id', session.user.id)
        .is('team_id', null)
        .select();

      if (error) {
        console.error('Delete error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      if (!data || data.length === 0) {
        return NextResponse.json({ error: 'Watchlist item not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true });
    }
  } catch (error) {
    console.error('Watchlist delete error:', error);
    return NextResponse.json(
      { error: 'Failed to remove from watchlist' },
      { status: 500 }
    );
  }
}

