import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { createServerClient } from '@/lib/supabase';
import { transformUserToFrontend } from '@/lib/utils/transformers';

export async function GET(request: NextRequest) {
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
      .eq('id', session.user.id)
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
      .eq('user_id', session.user.id);

    // Get user's reviews
    const { data: reviews } = await supabase
      .from('reviews')
      .select(`
        *,
        media(*)
      `)
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    // Get user's log attendance count
    const { count: watchedCount } = await supabase
      .from('log_attendees')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', session.user.id);

    // Get review count
    const { count: reviewCount } = await supabase
      .from('reviews')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', session.user.id);

    const transformedUser = transformUserToFrontend(user);

    return NextResponse.json({
      ...transformedUser,
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

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServerClient();

  try {
    const body = await request.json();
    const { name, image } = body;

    // Build update object with only provided fields
    const updateData: { name?: string; image?: string } = {};
    if (name !== undefined) {
      updateData.name = name.trim() || null;
    }
    if (image !== undefined) {
      updateData.image = image.trim() || null;
    }

    // If no valid fields to update, return error
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    // Update user
    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', session.user.id)
      .select()
      .single();

    if (updateError || !updatedUser) {
      console.error('User update error:', updateError);
      return NextResponse.json(
        { error: 'Failed to update user' },
        { status: 500 }
      );
    }

    const transformedUser = transformUserToFrontend(updatedUser);

    return NextResponse.json({
      ...transformedUser,
      message: 'Profile updated successfully',
    });
  } catch (error) {
    console.error('User update error:', error);
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    );
  }
}

