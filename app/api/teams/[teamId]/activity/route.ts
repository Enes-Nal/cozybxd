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

    // Fetch activity logs first (without joins to avoid FK issues)
    const { data: logs, error: logsError } = await supabase
      .from('team_activity_logs')
      .select('*')
      .eq('team_id', teamId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (logsError) {
      console.error('Error fetching activity logs:', logsError);
      return NextResponse.json({ error: logsError.message }, { status: 500 });
    }

    // Manually enrich the data with users and media
    if (logs && Array.isArray(logs) && logs.length > 0) {
      const userIds = [...new Set(logs.map((log: any) => log.user_id).filter(Boolean))];
      const mediaIds = [...new Set(logs.map((log: any) => log.media_id).filter(Boolean))];

      // Fetch users
      let userMap = new Map();
      if (userIds.length > 0) {
        const { data: users, error: usersError } = await supabase
          .from('users')
          .select('id, name, image')
          .in('id', userIds);

        if (usersError) {
          console.warn('Error fetching users for activity logs:', usersError);
        } else if (users) {
          userMap = new Map(users.map((u: any) => [u.id, u]));
        }
      }

      // Fetch media
      let mediaMap = new Map();
      if (mediaIds.length > 0) {
        const { data: media, error: mediaError } = await supabase
          .from('media')
          .select('id, title, poster_url, type')
          .in('id', mediaIds);

        if (mediaError) {
          console.warn('Error fetching media for activity logs:', mediaError);
        } else if (media) {
          mediaMap = new Map(media.map((m: any) => [m.id, m]));
        }
      }

      // Combine the data
      const enrichedLogs = logs.map((log: any) => ({
        ...log,
        users: userMap.get(log.user_id) || null,
        media: log.media_id ? (mediaMap.get(log.media_id) || null) : null,
      }));

      return NextResponse.json(enrichedLogs);
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

