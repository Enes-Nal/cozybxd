import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { createServerClient } from '@/lib/supabase';

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ teamId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { teamId } = await context.params;
  const supabase = createServerClient();

  // Get team to check membership
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
  const membership = team.team_members.find((m: any) => m.user_id === session.user.id);
  if (!membership) {
    return NextResponse.json({ error: 'You are not a member of this group' }, { status: 403 });
  }

  // Check if user is the only admin
  const adminMembers = team.team_members.filter((m: any) => m.role === 'admin');
  if (membership.role === 'admin' && adminMembers.length === 1) {
    return NextResponse.json(
      { error: 'Cannot leave group as the only admin. Delete the group instead or transfer admin to another member.' },
      { status: 400 }
    );
  }

  // Remove user from team
  const { error: deleteError } = await supabase
    .from('team_members')
    .delete()
    .eq('team_id', teamId)
    .eq('user_id', session.user.id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

