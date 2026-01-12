import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { createServerClient } from '@/lib/supabase';
import { nanoid } from 'nanoid';
import { getMovieDetails, getPosterUrl, getBackdropUrl, getGenres } from '@/lib/api/tmdb';
import { getOMDbData } from '@/lib/api/omdb';

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

    // Always create a new log entry for incrementing watch count
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

    // Add user as attendee
    const { error: attendeeError } = await supabase
      .from('log_attendees')
      .insert({
        log_id: log.id,
        user_id: session.user.id,
        slept: false,
      });

    if (attendeeError) {
      return NextResponse.json(
        { error: attendeeError.message },
        { status: 500 }
      );
    }

    // Create view count
    await supabase
      .from('view_counts')
      .insert({
        media_id: finalMediaId,
      });

    // Get updated total count for this user and media
    const { data: allLogs } = await supabase
      .from('logs')
      .select('id')
      .eq('media_id', finalMediaId);

    let totalCount = 0;
    if (allLogs && allLogs.length > 0) {
      const logIds = allLogs.map(l => l.id);
      const { count } = await supabase
        .from('log_attendees')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', session.user.id)
        .in('log_id', logIds);
      totalCount = count || 0;
    }

    return NextResponse.json({ 
      success: true,
      count: totalCount
    });
  } catch (error) {
    console.error('Increment watch count error:', error);
    return NextResponse.json(
      { error: 'Failed to increment watch count' },
      { status: 500 }
    );
  }
}

