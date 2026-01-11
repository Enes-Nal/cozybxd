import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { createServerClient } from '@/lib/supabase';
import { transformMediaToMovie } from '@/lib/utils/transformers';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { teamId } = await params;
  const supabase = createServerClient();

  try {
    // Verify user is a team member
    const { data: membership } = await supabase
      .from('team_members')
      .select('*')
      .eq('team_id', teamId)
      .eq('user_id', session.user.id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: 'Not a team member' }, { status: 403 });
    }

    // Get team watchlist
    const { data: watchlistItems, error } = await supabase
      .from('watchlist_items')
      .select(`
        *,
        media(*)
      `)
      .eq('team_id', teamId)
      .is('user_id', null)
      .order('upvotes', { ascending: false })
      .order('added_at', { ascending: false });

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
      .eq('team_id', teamId)
      .in('media_id', mediaIds);

    // Group logs by media_id
    const logsByMedia: Record<string, any[]> = {};
    (logs || []).forEach((log: any) => {
      if (!logsByMedia[log.media_id]) {
        logsByMedia[log.media_id] = [];
      }
      logsByMedia[log.media_id].push(log);
    });

    // Transform to front-end format
    const movies = (watchlistItems || []).map((item: any) => 
      transformMediaToMovie(item.media, item, logsByMedia[item.media_id] || [])
    );

    return NextResponse.json(movies);
  } catch (error) {
    console.error('Team watchlist fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch team watchlist' },
      { status: 500 }
    );
  }
}

