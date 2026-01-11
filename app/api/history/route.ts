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

