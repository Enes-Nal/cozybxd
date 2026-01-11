import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { createServerClient } from '@/lib/supabase';
import { transformUserToFrontend } from '@/lib/utils/transformers';

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServerClient();

  try {
    // Get user
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', params.userId)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get user's team memberships
    const { data: memberships } = await supabase
      .from('team_members')
      .select(`
        *,
        teams(*)
      `)
      .eq('user_id', params.userId);

    // Get user's reviews
    const { data: reviews } = await supabase
      .from('reviews')
      .select(`
        *,
        media(*)
      `)
      .eq('user_id', params.userId)
      .order('created_at', { ascending: false })
      .limit(10);

    // Get user's log attendance count
    const { count: watchedCount } = await supabase
      .from('log_attendees')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', params.userId);

    // Get review count
    const { count: reviewCount } = await supabase
      .from('reviews')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', params.userId);

    const transformedUser = transformUserToFrontend(user);

    return NextResponse.json({
      ...transformedUser,
      email: user.email || null,
      stats: {
        watched: watchedCount || 0,
        reviews: reviewCount || 0,
        groups: memberships?.length || 0,
      },
      teams: memberships?.map((m: any) => m.teams) || [],
      recentReviews: reviews || [],
    });
  } catch (error) {
    console.error('User fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user' },
      { status: 500 }
    );
  }
}

