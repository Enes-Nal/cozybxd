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

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ teamId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { teamId } = await context.params;
  const supabase = createServerClient();

  // Get team to check membership and role
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

  // Check if user is a member and is admin
  const membership = team.team_members.find((m: any) => m.user_id === session.user.id);
  if (!membership) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (membership.role !== 'admin') {
    return NextResponse.json({ error: 'Only admins can update group settings' }, { status: 403 });
  }

  const body = await request.json();
  const { pictureUrl } = body;

  // Update team
  const updateData: { picture_url?: string | null; updated_at: string } = {
    updated_at: new Date().toISOString(),
  };
  
  if (pictureUrl === undefined || pictureUrl === null) {
    updateData.picture_url = null;
  } else {
    updateData.picture_url = pictureUrl;
  }

  const { data: updatedTeam, error: updateError } = await supabase
    .from('teams')
    .update(updateData)
    .eq('id', teamId)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json(updatedTeam);
}