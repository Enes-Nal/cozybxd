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
  const { pictureUrl, interestLevelVotingEnabled, name, description } = body;

  // Build update data - only include fields if they're being set
  const updateData: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };
  
  if (pictureUrl !== undefined) {
    updateData.picture_url = pictureUrl === null ? null : pictureUrl;
  }
  
  if (interestLevelVotingEnabled !== undefined) {
    updateData.interest_level_voting_enabled = interestLevelVotingEnabled === true;
  }
  
  if (name !== undefined) {
    updateData.name = name;
  }
  
  if (description !== undefined) {
    updateData.description = description === null ? null : description;
  }

  // Try the update using direct Supabase client
  let { data: updatedTeam, error: updateError } = await supabase
    .from('teams')
    .update(updateData)
    .eq('id', teamId)
    .select()
    .single();

  // If we get a schema cache error, try using the PostgreSQL function as fallback
  if (updateError) {
    const isSchemaError = updateError.message.includes('schema cache') || 
                         updateError.message.includes('picture_url') ||
                         updateError.message.includes('column') ||
                         updateError.message.includes('Could not find');
    
    if (isSchemaError && pictureUrl !== undefined) {
      // Fallback: Use PostgreSQL function to bypass schema cache
      const { data: functionResult, error: functionError } = await supabase
        .rpc('update_team_picture', {
          team_id_param: teamId,
          picture_url_param: pictureUrl === null ? null : pictureUrl
        });

      if (functionError) {
        // If function doesn't exist, provide helpful error message
        if (functionError.message.includes('function') && functionError.message.includes('does not exist')) {
          return NextResponse.json({ 
            error: `Database function not found. Please run the SQL in 'create-update-team-picture-function.sql' in your Supabase SQL Editor, OR run:\n\nALTER TABLE teams ADD COLUMN IF NOT EXISTS picture_url TEXT;\n\nThen wait 1-2 minutes for the schema cache to refresh. Original error: ${updateError.message}` 
          }, { status: 500 });
        }
        return NextResponse.json({ 
          error: `Database error: ${functionError.message}. Please ensure the picture_url column exists. Run: ALTER TABLE teams ADD COLUMN IF NOT EXISTS picture_url TEXT;` 
        }, { status: 500 });
      }

      // Function succeeded, get the full team data
      const { data: fullTeam, error: fetchError } = await supabase
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

      if (fetchError) {
        return NextResponse.json({ error: fetchError.message }, { status: 500 });
      }

      return NextResponse.json(fullTeam);
    }
    
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json(updatedTeam);
}

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
    return NextResponse.json({ error: 'Only admins can delete groups' }, { status: 403 });
  }

  // Delete the team (cascade will handle team_members, watchlist_items, logs, etc.)
  const { error: deleteError } = await supabase
    .from('teams')
    .delete()
    .eq('id', teamId);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}