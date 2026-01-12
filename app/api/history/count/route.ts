import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { createServerClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const mediaId = searchParams.get('mediaId');
  const tmdbId = searchParams.get('tmdbId');

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
        return NextResponse.json({ count: 0 });
      }

      finalMediaId = existingMedia.id;
    }

    // Get all logs for this media
    const { data: logs, error: logsError } = await supabase
      .from('logs')
      .select('id')
      .eq('media_id', finalMediaId);

    if (logsError || !logs) {
      return NextResponse.json({ count: 0 });
    }

    if (logs.length === 0) {
      return NextResponse.json({ count: 0 });
    }

    const logIds = logs.map(log => log.id);

    // Count log_attendees entries for this user across all these logs
    const { count, error: countError } = await supabase
      .from('log_attendees')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', session.user.id)
      .in('log_id', logIds);

    if (countError) {
      console.error('Error counting watch history:', countError);
      return NextResponse.json({ count: 0 });
    }

    return NextResponse.json({ count: count || 0 });
  } catch (error) {
    console.error('Watch count fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch watch count' },
      { status: 500 }
    );
  }
}

