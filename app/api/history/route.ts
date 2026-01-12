import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { createServerClient } from '@/lib/supabase';
import { transformMediaToMovie } from '@/lib/utils/transformers';
import { nanoid } from 'nanoid';
import { getMovieDetails, getPosterUrl, getBackdropUrl, getGenres } from '@/lib/api/tmdb';
import { getOMDbData } from '@/lib/api/omdb';

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
      .from('logs')
      .select(`
        *,
        media(*),
        log_attendees(
          *,
          users(*)
        ),
        reviews(
          *,
          users(*)
        )
      `);

    if (teamId) {
      query = query.eq('team_id', teamId);
    } else {
      // Get logs where user is an attendee - we'll filter after fetching
      query = query.not('log_attendees', 'is', null);
    }

    const { data: logs, error } = await query
      .order('watched_at', { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Filter logs by user if not team-specific
    let filteredLogs = logs || [];
    if (!teamId) {
      filteredLogs = filteredLogs.filter((log: any) => 
        log.log_attendees?.some((attendee: any) => attendee.user_id === userId)
      );
    }

    // Transform to front-end format
    const movies = filteredLogs.map((log: any) => {
      const movie = transformMediaToMovie(log.media, null, [log]);
      return {
        ...movie,
        watchedAt: log.watched_at,
        notes: log.notes,
        attendees: log.log_attendees || [],
        reviews: log.reviews || [],
      };
    });

    return NextResponse.json(movies);
  } catch (error) {
    console.error('History fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch history' },
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
  const { mediaId, tmdbId, watchedAt } = body;

  if (!mediaId && !tmdbId) {
    return NextResponse.json(
      { error: 'Media ID or TMDB ID required' },
      { status: 400 }
    );
  }

  const supabase = createServerClient();

  try {
    let finalMediaId = mediaId;

    // If tmdbId is provided, sync the media first
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
        // Sync media from TMDB directly
        try {
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
            try {
              const omdbData = await getOMDbData(imdbId);
              if (omdbData?.imdbRating && omdbData.imdbRating !== 'N/A') {
                imdbRating = parseFloat(omdbData.imdbRating);
              }
            } catch (error) {
              console.error('Failed to fetch IMDB rating:', error);
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
        } catch (error) {
          console.error('Media sync error:', error);
          return NextResponse.json(
            { error: 'Failed to sync media from TMDB' },
            { status: 500 }
          );
        }
      }
    }

    // Get or create a personal team for the user
    let personalTeamId: string;

    // First, try to get user's teams
    const { data: memberships } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('user_id', session.user.id)
      .limit(1);

    if (memberships && memberships.length > 0) {
      personalTeamId = memberships[0].team_id;
    } else {
      // Create a personal team for the user
      const inviteCode = nanoid(8);
      const { data: newTeam, error: teamError } = await supabase
        .from('teams')
        .insert({
          name: `${session.user.name || 'My'} Personal`,
          description: 'Personal watch history',
          invite_code: inviteCode,
        })
        .select()
        .single();

      if (teamError || !newTeam) {
        return NextResponse.json(
          { error: 'Failed to create personal team' },
          { status: 500 }
        );
      }

      // Add user as admin member
      const { error: memberError } = await supabase
        .from('team_members')
        .insert({
          team_id: newTeam.id,
          user_id: session.user.id,
          role: 'admin',
        });

      if (memberError) {
        return NextResponse.json(
          { error: 'Failed to add user to personal team' },
          { status: 500 }
        );
      }

      personalTeamId = newTeam.id;
    }

    // Check if log already exists for this user and media
    const { data: existingLogs } = await supabase
      .from('logs')
      .select(`
        *,
        log_attendees(*)
      `)
      .eq('team_id', personalTeamId)
      .eq('media_id', finalMediaId);

    let logId: string;

    if (existingLogs && existingLogs.length > 0) {
      // Check if user is already an attendee
      const existingLog = existingLogs.find((log: any) =>
        log.log_attendees?.some((attendee: any) => attendee.user_id === session.user.id)
      );

      if (existingLog) {
        // User already watched this, return existing log
        return NextResponse.json({ 
          message: 'Already logged',
          log: existingLog 
        });
      }

      // Use existing log and add user as attendee
      logId = existingLogs[0].id;
    } else {
      // Create new log
      const { data: log, error: logError } = await supabase
        .from('logs')
        .insert({
          team_id: personalTeamId,
          media_id: finalMediaId,
          watched_at: watchedAt ? new Date(watchedAt).toISOString() : new Date().toISOString(),
        })
        .select()
        .single();

      if (logError || !log) {
        return NextResponse.json(
          { error: logError?.message || 'Failed to create log' },
          { status: 500 }
        );
      }

      logId = log.id;

      // Create view count
      await supabase
        .from('view_counts')
        .insert({
          media_id: finalMediaId,
        });
    }

    // Add user as attendee (if not already)
    const { error: attendeeError } = await supabase
      .from('log_attendees')
      .insert({
        log_id: logId,
        user_id: session.user.id,
        slept: false,
      });

    if (attendeeError) {
      // Ignore duplicate key errors (user already attendee)
      if (!attendeeError.message.includes('duplicate') && !attendeeError.message.includes('unique')) {
        return NextResponse.json(
          { error: attendeeError.message },
          { status: 500 }
        );
      }
    }

    // Fetch complete log with relations
    const { data: completeLog } = await supabase
      .from('logs')
      .select(`
        *,
        media(*),
        log_attendees(
          *,
          users(*)
        )
      `)
      .eq('id', logId)
      .single();

    return NextResponse.json(completeLog);
  } catch (error) {
    console.error('History create error:', error);
    return NextResponse.json(
      { error: 'Failed to create history entry' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { mediaId, tmdbId } = body;

  if (!mediaId && !tmdbId) {
    return NextResponse.json(
      { error: 'Media ID or TMDB ID required' },
      { status: 400 }
    );
  }

  const supabase = createServerClient();

  try {
    let finalMediaId = mediaId;

    // If tmdbId is provided, find the media by tmdb_id
    if (tmdbId && !mediaId) {
      const { data: existingMedia } = await supabase
        .from('media')
        .select('*')
        .eq('tmdb_id', tmdbId)
        .single();

      if (!existingMedia) {
        return NextResponse.json(
          { error: 'Media not found' },
          { status: 404 }
        );
      }

      finalMediaId = existingMedia.id;
    }

    // Get user's teams
    const { data: memberships } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('user_id', session.user.id);

    if (!memberships || memberships.length === 0) {
      return NextResponse.json(
        { error: 'No teams found' },
        { status: 404 }
      );
    }

    const teamIds = memberships.map((m: any) => m.team_id);

    // Find logs for this media in user's teams
    const { data: logs } = await supabase
      .from('logs')
      .select(`
        *,
        log_attendees(*)
      `)
      .eq('media_id', finalMediaId)
      .in('team_id', teamIds);

    if (!logs || logs.length === 0) {
      return NextResponse.json(
        { error: 'Log entry not found' },
        { status: 404 }
      );
    }

    // Find logs where user is an attendee
    const userLogs = logs.filter((log: any) =>
      log.log_attendees?.some((attendee: any) => attendee.user_id === session.user.id)
    );

    if (userLogs.length === 0) {
      return NextResponse.json(
        { error: 'User is not an attendee of any log for this media' },
        { status: 404 }
      );
    }

    // Remove user from log attendees
    for (const log of userLogs) {
      const { error: deleteError } = await supabase
        .from('log_attendees')
        .delete()
        .eq('log_id', log.id)
        .eq('user_id', session.user.id);

      if (deleteError) {
        console.error('Error deleting log attendee:', deleteError);
      }
    }

    // If log has no more attendees, optionally delete the log itself
    // For now, we'll keep the log in case other users are attendees
    // But we could delete it if it's a personal team and has no attendees

    return NextResponse.json({ 
      message: 'Successfully removed from history',
      deleted: userLogs.length 
    });
  } catch (error) {
    console.error('History delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete history entry' },
      { status: 500 }
    );
  }
}

