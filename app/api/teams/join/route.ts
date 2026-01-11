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
  const { inviteCode } = body;

  if (!inviteCode) {
    return NextResponse.json({ error: 'Invite code required' }, { status: 400 });
  }

  const supabase = createServerClient();

  try {
    // Find team by invite code (case-insensitive)
    // Try exact match first
    let { data: team, error: teamError } = await supabase
      .from('teams')
      .select('*')
      .eq('invite_code', inviteCode)
      .maybeSingle();

    // If not found, try with different case variations
    if (!team && !teamError) {
      // Try uppercase version
      const { data: teamUpper, error: upperError } = await supabase
        .from('teams')
        .select('*')
        .eq('invite_code', inviteCode.toUpperCase())
        .maybeSingle();
      
      if (!upperError && teamUpper) {
        team = teamUpper;
      } else if (!team) {
        // Try lowercase version
        const { data: teamLower, error: lowerError } = await supabase
          .from('teams')
          .select('*')
          .eq('invite_code', inviteCode.toLowerCase())
          .maybeSingle();
        
        if (!lowerError && teamLower) {
          team = teamLower;
        } else if (lowerError && lowerError.code !== 'PGRST116') {
          teamError = lowerError;
        }
      }
    }

    // If still not found, do a broader case-insensitive search
    if (!team && !teamError) {
      const { data: allTeams, error: fetchError } = await supabase
        .from('teams')
        .select('*')
        .not('invite_code', 'is', null)
        .limit(1000); // Reasonable limit
      
      if (!fetchError && allTeams) {
        // Find case-insensitive match
        team = allTeams.find((t: any) => 
          t.invite_code && t.invite_code.toLowerCase() === inviteCode.toLowerCase()
        );
      } else if (fetchError) {
        teamError = fetchError;
      }
    }

    if (teamError) {
      console.error('Team lookup error:', teamError);
      return NextResponse.json({ error: 'Failed to search for team' }, { status: 500 });
    }

    if (!team) {
      return NextResponse.json({ error: 'Invalid invite code' }, { status: 404 });
    }

    // Check if user is already a member
    const { data: existing } = await supabase
      .from('team_members')
      .select('*')
      .eq('team_id', team.id)
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: 'Already a member' }, { status: 400 });
    }

    // Add user as member
    const { data: membership, error: memberError } = await supabase
      .from('team_members')
      .insert({
        team_id: team.id,
        user_id: session.user.id,
        role: 'member',
      })
      .select(`
        *,
        teams(*)
      `)
      .single();

    if (memberError) {
      return NextResponse.json({ error: memberError.message }, { status: 500 });
    }

    return NextResponse.json(membership.teams);
  } catch (error) {
    console.error('Team join error:', error);
    return NextResponse.json(
      { error: 'Failed to join team' },
      { status: 500 }
    );
  }
}

