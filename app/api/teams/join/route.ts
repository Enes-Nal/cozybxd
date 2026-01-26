import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { createServerClient } from '@/lib/supabase';
import { checkCooldown, recordAction, getCooldownErrorMessage } from '@/lib/utils/cooldown';

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check cooldown for joining teams
  const cooldownCheck = await checkCooldown(session.user.id, 'join_team');
  if (!cooldownCheck.allowed) {
    return NextResponse.json(
      { error: getCooldownErrorMessage('join_team', cooldownCheck.remainingSeconds!) },
      { status: 429 }
    );
  }

  const body = await request.json();
  const { inviteCode } = body;

  if (!inviteCode) {
    return NextResponse.json({ error: 'Invite code required' }, { status: 400 });
  }

  const supabase = createServerClient();

  try {
    const upperCode = inviteCode.toUpperCase();
    let teamId: string | null = null;

    // First, check temporary invite codes
    const { data: tempCode, error: tempCodeError } = await supabase
      .from('team_invite_codes')
      .select('*')
      .eq('code', upperCode)
      .eq('is_active', true)
      .maybeSingle();

    if (!tempCodeError && tempCode) {
      // Check if code is expired
      if (tempCode.expires_at && new Date(tempCode.expires_at) < new Date()) {
        return NextResponse.json({ error: 'Invite code has expired' }, { status: 400 });
      }

      // Check if max uses reached
      if (tempCode.max_uses && tempCode.current_uses >= tempCode.max_uses) {
        return NextResponse.json({ error: 'Invite code has reached maximum uses' }, { status: 400 });
      }

      teamId = tempCode.team_id;

      // Increment use count
      await supabase
        .from('team_invite_codes')
        .update({ 
          current_uses: tempCode.current_uses + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', tempCode.id);
    }

    // If no temporary code found, try permanent invite code
    if (!teamId) {
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

      teamId = team.id;
    }

    if (!teamId) {
      return NextResponse.json({ error: 'Invalid invite code' }, { status: 404 });
    }

    // Get team data
    const { data: team, error: teamFetchError } = await supabase
      .from('teams')
      .select('*')
      .eq('id', teamId)
      .single();

    if (teamFetchError || !team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    // Check if user is already a member
    const { data: existing } = await supabase
      .from('team_members')
      .select('*')
      .eq('team_id', teamId)
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: 'Already a member' }, { status: 400 });
    }

    // Add user as member
    const { data: membership, error: memberError } = await supabase
      .from('team_members')
      .insert({
        team_id: teamId,
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

    // Log activity: member joined
    try {
      await supabase
        .from('team_activity_logs')
        .insert({
          team_id: teamId,
          user_id: session.user.id,
          activity_type: 'member_joined',
          metadata: { action: 'joined' },
        });
    } catch (err) {
      // Don't fail the request if logging fails
      console.error('Failed to log activity:', err);
    }

    // Record the action after successful team join
    await recordAction(session.user.id, 'join_team');

    return NextResponse.json(membership.teams);
  } catch (error) {
    console.error('Team join error:', error);
    return NextResponse.json(
      { error: 'Failed to join team' },
      { status: 500 }
    );
  }
}

