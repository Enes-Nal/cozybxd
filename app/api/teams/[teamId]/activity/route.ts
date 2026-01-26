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
  const searchParams = request.nextUrl.searchParams;
  const limit = parseInt(searchParams.get('limit') || '50', 10);

  const supabase = createServerClient();

  try {
    // Verify user is a member of the team
    const { data: membership } = await supabase
      .from('team_members')
      .select('*')
      .eq('team_id', teamId)
      .eq('user_id', session.user.id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: 'Not a team member' }, { status: 403 });
    }

    // Fetch activity logs with user and media information
    // Explicitly specify foreign key relationships for Supabase PostgREST
    const { data: logs, error } = await supabase
      .from('team_activity_logs')
      .select(`
        *,
        users!team_activity_logs_user_id_fkey(id, name, image),
        media!team_activity_logs_media_id_fkey(id, title, poster_url, type)
      `)
      .eq('team_id', teamId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    // If the explicit foreign key names don't work, try the simpler syntax
    // Supabase should auto-detect relationships, but if not, we'll fall back
    if (error && error.message?.includes('foreign key')) {
      const { data: logsFallback, error: errorFallback } = await supabase
        .from('team_activity_logs')
        .select(`
          *,
          users!user_id(id, name, image),
          media!media_id(id, title, poster_url, type)
        `)
        .eq('team_id', teamId)
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (!errorFallback) {
        return NextResponse.json(logsFallback || []);
      }
    }

    if (error) {
      console.error('Error fetching activity logs:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(logs || []);
  } catch (error) {
    console.error('Activity logs fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch activity logs' },
      { status: 500 }
    );
  }
}

