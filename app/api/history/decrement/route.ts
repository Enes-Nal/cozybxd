import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { createServerClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
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

    // Get all logs for this media
    const { data: logs } = await supabase
      .from('logs')
      .select('id')
      .eq('media_id', finalMediaId);

    if (!logs || logs.length === 0) {
      return NextResponse.json(
        { error: 'No watch history found' },
        { status: 404 }
      );
    }

    const logIds = logs.map(log => log.id);

    // Find the most recent log_attendee entry for this user
    const { data: attendees } = await supabase
      .from('log_attendees')
      .select('id, log_id, created_at')
      .eq('user_id', session.user.id)
      .in('log_id', logIds)
      .order('created_at', { ascending: false })
      .limit(1);

    if (!attendees || attendees.length === 0) {
      return NextResponse.json(
        { error: 'No watch history found for user' },
        { status: 404 }
      );
    }

    // Delete the most recent attendee entry
    const { error: deleteError } = await supabase
      .from('log_attendees')
      .delete()
      .eq('id', attendees[0].id);

    if (deleteError) {
      return NextResponse.json(
        { error: deleteError.message },
        { status: 500 }
      );
    }

    // Get updated total count for this user and media
    const { count } = await supabase
      .from('log_attendees')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', session.user.id)
      .in('log_id', logIds);

    return NextResponse.json({ 
      success: true,
      count: count || 0
    });
  } catch (error) {
    console.error('Decrement watch count error:', error);
    return NextResponse.json(
      { error: 'Failed to decrement watch count' },
      { status: 500 }
    );
  }
}

