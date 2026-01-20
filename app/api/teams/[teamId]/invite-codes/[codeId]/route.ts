import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { createServerClient } from '@/lib/supabase';

// PATCH - Update invite code (e.g., deactivate)
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ teamId: string; codeId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { teamId, codeId } = await context.params;
  const supabase = createServerClient();

  try {
    const body = await request.json();
    const { isActive } = body;

    // Check if user is admin
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

    const membership = team.team_members.find((m: any) => m.user_id === session.user.id);
    if (!membership || membership.role !== 'admin') {
      return NextResponse.json({ error: 'Only admins can update invite codes' }, { status: 403 });
    }

    // Verify the code belongs to this team
    const { data: inviteCode, error: codeError } = await supabase
      .from('team_invite_codes')
      .select('*')
      .eq('id', codeId)
      .eq('team_id', teamId)
      .single();

    if (codeError || !inviteCode) {
      return NextResponse.json({ error: 'Invite code not found' }, { status: 404 });
    }

    // Update the code
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (isActive !== undefined) {
      updateData.is_active = isActive;
    }

    const { data: updatedCode, error: updateError } = await supabase
      .from('team_invite_codes')
      .update(updateData)
      .eq('id', codeId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json(updatedCode);
  } catch (error) {
    console.error('Error updating invite code:', error);
    return NextResponse.json(
      { error: 'Failed to update invite code' },
      { status: 500 }
    );
  }
}


