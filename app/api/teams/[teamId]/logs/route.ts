import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { createServerClient } from '@/lib/supabase';

export async function POST(
  request: NextRequest,
  { params }: { params: { teamId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { mediaId, attendees, notes, isRobloxNight, watchedAt } = body;

  if (!mediaId || !attendees || !Array.isArray(attendees)) {
    return NextResponse.json(
      { error: 'Media ID and attendees required' },
      { status: 400 }
    );
  }

  const supabase = createServerClient();

  // Verify user is a team member
  const { data: membership, error: memberError } = await supabase
    .from('team_members')
    .select('*')
    .eq('team_id', params.teamId)
    .eq('user_id', session.user.id)
    .single();

  if (memberError || !membership) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Create log
  const { data: log, error: logError } = await supabase
    .from('logs')
    .insert({
      team_id: params.teamId,
      media_id: mediaId,
      notes,
      is_roblox_night: isRobloxNight || false,
      watched_at: watchedAt ? new Date(watchedAt).toISOString() : new Date().toISOString(),
    })
    .select()
    .single();

  if (logError) {
    return NextResponse.json({ error: logError.message }, { status: 500 });
  }

  // Create attendees
  if (attendees.length > 0) {
    const attendeeRecords = attendees.map((userId: string) => ({
      log_id: log.id,
      user_id: userId,
      slept: false,
    }));

    const { error: attendeesError } = await supabase
      .from('log_attendees')
      .insert(attendeeRecords);

    if (attendeesError) {
      return NextResponse.json({ error: attendeesError.message }, { status: 500 });
    }
  }

  // Create view count
  await supabase
    .from('view_counts')
    .insert({
      media_id: mediaId,
    });

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
    .eq('id', log.id)
    .single();

  return NextResponse.json(completeLog);
}
