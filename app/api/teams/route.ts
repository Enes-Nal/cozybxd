import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { createServerClient } from '@/lib/supabase';
import { nanoid } from 'nanoid';
import { checkCooldown, recordAction, getCooldownErrorMessage } from '@/lib/utils/cooldown';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServerClient();

  // Get teams where user is a member
  const { data: memberships, error: membersError } = await supabase
    .from('team_members')
    .select(`
      *,
      teams(
        *,
        team_members(
          *,
          users(*)
        )
      )
    `)
    .eq('user_id', session.user.id);

  if (membersError) {
    return NextResponse.json({ error: membersError.message }, { status: 500 });
  }

  // Get log counts for each team
  const teams = await Promise.all(
    (memberships || []).map(async (membership: any) => {
      const { count } = await supabase
        .from('logs')
        .select('*', { count: 'exact', head: true })
        .eq('team_id', membership.teams.id);

      return {
        ...membership.teams,
        members: membership.teams.team_members,
        _count: { logs: count || 0 },
      };
    })
  );

  return NextResponse.json(teams);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check cooldown for creating teams
  const cooldownCheck = await checkCooldown(session.user.id, 'create_team');
  if (!cooldownCheck.allowed) {
    return NextResponse.json(
      { error: getCooldownErrorMessage('create_team', cooldownCheck.remainingSeconds!) },
      { status: 429 }
    );
  }

  const body = await request.json();
  const { name, description, pictureUrl } = body;

  if (!name) {
    return NextResponse.json({ error: 'Team name required' }, { status: 400 });
  }

  const inviteCode = nanoid(8);
  const supabase = createServerClient();

  // Create team
  const { data: team, error: teamError } = await supabase
    .from('teams')
    .insert({
      name,
      description,
      invite_code: inviteCode,
      picture_url: pictureUrl || null,
    })
    .select()
    .single();

  if (teamError) {
    return NextResponse.json({ error: teamError.message }, { status: 500 });
  }

  // Add creator as admin member
  const { data: member, error: memberError } = await supabase
    .from('team_members')
    .insert({
      team_id: team.id,
      user_id: session.user.id,
      role: 'admin',
    })
    .select(`
      *,
      users(*)
    `)
    .single();

  if (memberError) {
    return NextResponse.json({ error: memberError.message }, { status: 500 });
  }

  // Record the action after successful team creation
  await recordAction(session.user.id, 'create_team');

  return NextResponse.json({
    ...team,
    team_members: [member],
  });
}
