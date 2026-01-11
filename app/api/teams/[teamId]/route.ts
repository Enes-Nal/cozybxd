import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { createServerClient } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ teamId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { teamId } = await context.params;
  const supabase = createServerClient();

  // Get team with all relations
  const { data: team, error: teamError } = await supabase
    .from('teams')
    .select(`
      *,
      team_members(
        *,
        users(*)
      )
    `)
    .eq('id', teamId)
    .single();

  if (teamError || !team) {
    return NextResponse.json({ error: 'Team not found' }, { status: 404 });
  }

  // Check if user is a member
  const isMember = team.team_members.some((m: any) => m.user_id === session.user.id);
  if (!isMember) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Get logs
  const { data: logs } = await supabase
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
    `)
    .eq('team_id', teamId)
    .order('watched_at', { ascending: false })
    .limit(20);

  // Get watchlist
  const { data: watchlist } = await supabase
    .from('watchlist_items')
    .select(`
      *,
      media(*)
    `)
    .eq('team_id', teamId)
    .order('upvotes', { ascending: false });

  return NextResponse.json({
    ...team,
    logs: logs || [],
    watchlist: watchlist || [],
  });
}
