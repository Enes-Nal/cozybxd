import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { createServerClient } from '@/lib/supabase';
import { transformUserToFrontend } from '@/lib/utils/transformers';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServerClient();

  try {
    // Get all teams the user is a member of
    const { data: userTeams, error: teamsError } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('user_id', session.user.id);

    if (teamsError) {
      return NextResponse.json({ error: teamsError.message }, { status: 500 });
    }

    const teamIds = (userTeams || []).map((t: any) => t.team_id);

    if (teamIds.length === 0) {
      return NextResponse.json([]);
    }

    // Get all members of those teams (excluding the current user)
    const { data: memberships, error: membersError } = await supabase
      .from('team_members')
      .select(`
        *,
        users(*)
      `)
      .in('team_id', teamIds)
      .neq('user_id', session.user.id);

    if (membersError) {
      return NextResponse.json({ error: membersError.message }, { status: 500 });
    }

    // Group by user ID to get unique friends
    const friendsMap = new Map<string, any>();
    (memberships || []).forEach((membership: any) => {
      const userId = membership.user_id;
      if (!friendsMap.has(userId)) {
        friendsMap.set(userId, {
          ...transformUserToFrontend(membership.users, membership),
          sharedTeams: [],
        });
      }
      friendsMap.get(userId).sharedTeams.push({
        id: membership.team_id,
        role: membership.role,
      });
    });

    const friends = Array.from(friendsMap.values());

    return NextResponse.json(friends);
  } catch (error) {
    console.error('Friends fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch friends' },
      { status: 500 }
    );
  }
}

