import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { createServerClient } from '@/lib/supabase';
import { transformUserToFrontend } from '@/lib/utils/transformers';
import { checkProfanity } from '@/lib/utils/profanity';

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
      username: user.username || null, // Include username in response
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
    const { name, image, banner, username } = body;

    // Build update object with only provided fields
    const updateData: { name?: string | null; image?: string | null; banner_url?: string | null; username?: string } = {};
    if (name !== undefined) {
      const trimmedName = typeof name === 'string' ? name.trim() : String(name).trim();
      if (trimmedName) {
        // Check for profanity and slurs
        const profanityCheck = checkProfanity(trimmedName);
        if (!profanityCheck.isValid) {
          return NextResponse.json(
            { error: profanityCheck.error || 'Name contains inappropriate language' },
            { status: 400 }
          );
        }
        updateData.name = trimmedName;
      } else {
        updateData.name = null;
      }
    }
    if (image !== undefined) {
      updateData.image = image.trim() || null;
    }
    if (banner !== undefined) {
      updateData.banner_url = banner.trim() || null;
    }
    if (username !== undefined && username !== null) {
      // Username must be lowercase and trimmed
      const trimmedUsername = typeof username === 'string' ? username.trim() : String(username).trim();
      if (trimmedUsername) {
        // Check for profanity and slurs
        const profanityCheck = checkProfanity(trimmedUsername);
        if (!profanityCheck.isValid) {
          return NextResponse.json(
            { error: profanityCheck.error || 'Username contains inappropriate language' },
            { status: 400 }
          );
        }
        updateData.username = trimmedUsername.toLowerCase();
      }
      // If empty, don't include in update (shouldn't happen from modal, but handle gracefully)
    }

    // If no valid fields to update, return error
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    // If updating username, check if it's already taken
    if (updateData.username !== undefined && updateData.username !== null) {
      // Use the same pattern as the friends route which works
      const { data: existingUser, error: checkError } = await supabase
        .from('users')
        .select('id, username')
        .eq('username', updateData.username)
        .maybeSingle();

      // Only treat as error if it's not a "not found" error (PGRST116 = no rows returned)
      if (checkError && checkError.code !== 'PGRST116') {
        console.error('Username check error:', JSON.stringify(checkError, null, 2));
        console.error('Error details:', {
          message: checkError.message,
          code: checkError.code,
          details: checkError.details,
          hint: checkError.hint
        });
        // Don't fail here - let the database unique constraint handle it
        // This allows the update to proceed and the DB will catch duplicates
      }

      // Check if username is taken by another user (only if check succeeded)
      if (!checkError && existingUser && existingUser.id !== session.user.id) {
        return NextResponse.json(
          { error: 'Username is already taken' },
          { status: 400 }
        );
      }
    }

    // Update user
    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', session.user.id)
      .select()
      .single();

    if (updateError || !updatedUser) {
      console.error('User update error:', JSON.stringify(updateError, null, 2));
      console.error('Update data attempted:', updateData);
      console.error('User ID:', session.user.id);
      
      // Check if it's a schema/column error
      if (updateError?.message?.includes('column') || 
          updateError?.message?.includes('Could not find') ||
          updateError?.message?.includes('schema cache')) {
        return NextResponse.json(
          { 
            error: 'Database schema error. The username column may not exist. Please run this SQL in your Supabase SQL Editor:\n\nALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;\n\nThen wait 1-2 minutes for Supabase\'s schema cache to refresh.',
            details: updateError.message 
          },
          { status: 500 }
        );
      }
      
      // Check if it's a unique constraint violation (username already taken)
      if (updateError?.code === '23505' || 
          updateError?.message?.includes('unique') || 
          updateError?.message?.includes('duplicate') ||
          updateError?.message?.includes('violates unique constraint')) {
        return NextResponse.json(
          { error: 'Username is already taken' },
          { status: 400 }
        );
      }
      
      return NextResponse.json(
        { 
          error: 'Failed to update user', 
          details: updateError?.message || 'Unknown error',
          code: updateError?.code,
          hint: updateError?.hint
        },
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

