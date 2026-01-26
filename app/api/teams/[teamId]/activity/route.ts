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
    const { data: membership, error: membershipError } = await supabase
      .from('team_members')
      .select('*')
      .eq('team_id', teamId)
      .eq('user_id', session.user.id)
      .single();

    if (membershipError || !membership) {
      console.error('Membership check error:', membershipError);
      return NextResponse.json({ error: 'Not a team member' }, { status: 403 });
    }

    // Fetch activity logs with user and media information
    // Try explicit foreign key syntax first, fallback to simple syntax if needed
    let { data: logs, error } = await supabase
      .from('team_activity_logs')
      .select(`
        *,
        users!user_id(id, name, image),
        media!media_id(id, title, poster_url, type)
      `)
      .eq('team_id', teamId)
      .order('created_at', { ascending: false })
      .limit(limit);

    // If explicit syntax fails, try simple auto-detection
    if (error) {
      console.warn('Activity log query with explicit FK failed, trying auto-detection:', error.message);
      const { data: logsFallback, error: errorFallback } = await supabase
        .from('team_activity_logs')
        .select(`
          *,
          users(id, name, image),
          media(id, title, poster_url, type)
        `)
        .eq('team_id', teamId)
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (!errorFallback) {
        logs = logsFallback;
        error = null;
      } else {
        console.error('Error fetching activity logs:', errorFallback);
        return NextResponse.json({ error: errorFallback.message }, { status: 500 });
      }
    }

    // If joins still failed, manually enrich the data
    if (logs && Array.isArray(logs) && logs.length > 0) {
      const userIds = [...new Set(logs.map((log: any) => log.user_id).filter(Boolean))];
      const mediaIds = [...new Set(logs.map((log: any) => log.media_id).filter(Boolean))];

      // Fetch users if not already joined
      if (userIds.length > 0 && (!logs[0]?.users || Object.keys(logs[0].users || {}).length === 0)) {
        const { data: users } = await supabase
          .from('users')
          .select('id, name, image')
          .in('id', userIds);

        if (users) {
          const userMap = new Map(users.map((u: any) => [u.id, u]));
          logs = logs.map((log: any) => ({
            ...log,
            users: userMap.get(log.user_id) || null,
          }));
        }
      }

      // Fetch media if not already joined
      if (mediaIds.length > 0 && (!logs[0]?.media || Object.keys(logs[0].media || {}).length === 0)) {
        const { data: media } = await supabase
          .from('media')
          .select('id, title, poster_url, type')
          .in('id', mediaIds);

        if (media) {
          const mediaMap = new Map(media.map((m: any) => [m.id, m]));
          logs = logs.map((log: any) => ({
            ...log,
            media: log.media_id ? (mediaMap.get(log.media_id) || null) : null,
          }));
        }
      }
    }

    return NextResponse.json(logs || []);
  } catch (error) {
    console.error('Activity logs fetch error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to fetch activity logs', details: errorMessage },
      { status: 500 }
    );
  }
}

