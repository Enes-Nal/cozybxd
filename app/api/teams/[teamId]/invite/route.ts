import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { createServerClient } from '@/lib/supabase';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ teamId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { teamId } = await context.params;
  const supabase = createServerClient();

  try {
    const body = await request.json();
    const { username } = body;

    if (!username || typeof username !== 'string' || username.trim() === '') {
      return NextResponse.json(
        { error: 'Username is required' },
        { status: 400 }
      );
    }

    const trimmedUsername = username.trim();
    const lowerUsername = trimmedUsername.toLowerCase();

    // Get team to check membership and permissions
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

    // Check if user is a member of the team
    const isMember = team.team_members.some((m: any) => m.user_id === session.user.id);
    if (!isMember) {
      return NextResponse.json(
        { error: 'You must be a member of this team to invite others' },
        { status: 403 }
      );
    }

    // Find user by username (case-insensitive exact match)
    // Try exact match first with lowercase
    let { data: inviteUser, error: userError } = await supabase
      .from('users')
      .select('id, name, email, username')
      .eq('username', lowerUsername)
      .maybeSingle();

    // If not found, try with original case
    if (!inviteUser && !userError) {
      const { data: userWithCase, error: caseError } = await supabase
        .from('users')
        .select('id, name, email, username')
        .eq('username', trimmedUsername)
        .maybeSingle();
      
      if (!caseError && userWithCase) {
        inviteUser = userWithCase;
      } else if (caseError && caseError.code !== 'PGRST116') {
        userError = caseError;
      }
    }

    // If still not found, do a broader search and filter in memory
    // This handles case-insensitive matching when usernames have mixed case
    if (!inviteUser && !userError && trimmedUsername.length > 0) {
      const { data: allUsersWithUsernames, error: fetchError } = await supabase
        .from('users')
        .select('id, name, email, username')
        .not('username', 'is', null)
        .limit(1000); // Reasonable limit for username search
      
      if (!fetchError && allUsersWithUsernames) {
        // Find exact case-insensitive match
        inviteUser = allUsersWithUsernames.find((u: any) => 
          u.username && u.username.toLowerCase() === lowerUsername
        ) || null;
      } else if (fetchError) {
        userError = fetchError;
      }
    }

    if (userError) {
      console.error('User lookup error:', userError);
      return NextResponse.json(
        { error: 'Failed to search for user' },
        { status: 500 }
      );
    }

    if (!inviteUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if trying to invite self
    if (inviteUser.id === session.user.id) {
      return NextResponse.json(
        { error: 'Cannot invite yourself' },
        { status: 400 }
      );
    }

    // Check if user is already a member
    const existingMember = team.team_members.find((m: any) => m.user_id === inviteUser.id);
    if (existingMember) {
      return NextResponse.json(
        { error: 'User is already a member of this team' },
        { status: 400 }
      );
    }

    // Add user as member
    const { data: membership, error: memberError } = await supabase
      .from('team_members')
      .insert({
        team_id: teamId,
        user_id: inviteUser.id,
        role: 'member',
      })
      .select(`
        *,
        users(*)
      `)
      .single();

    if (memberError) {
      return NextResponse.json({ error: memberError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      user: inviteUser,
      membership,
    });
  } catch (error) {
    console.error('Team invite error:', error);
    return NextResponse.json(
      { error: 'Failed to invite user' },
      { status: 500 }
    );
  }
}



