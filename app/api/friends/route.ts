import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { createServerClient } from '@/lib/supabase';
import { transformUserToFrontend } from '@/lib/utils/transformers';
import { checkCooldown, recordAction, getCooldownErrorMessage } from '@/lib/utils/cooldown';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServerClient();

  try {
    // Get direct friends from friends table only (no team members)
    const { data: directFriendships, error: directFriendsError } = await supabase
      .from('friends')
      .select('friend_id')
      .eq('user_id', session.user.id);

    if (directFriendsError) {
      console.error('Direct friends error:', directFriendsError);
      return NextResponse.json({ error: directFriendsError.message }, { status: 500 });
    }

    // Get friend user data
    const friendIds = (directFriendships || []).map((f: any) => f.friend_id);
    let friends: any[] = [];
    
    if (friendIds.length > 0) {
      const { data: friendUsers, error: friendUsersError } = await supabase
        .from('users')
        .select('*')
        .in('id', friendIds);

      if (friendUsersError) {
        console.error('Friend users error:', friendUsersError);
        return NextResponse.json({ error: friendUsersError.message }, { status: 500 });
      }

      if (friendUsers) {
        friends = friendUsers.map((user: any) => ({
          ...transformUserToFrontend(user),
          username: user.username || null,
          isDirectFriend: true,
        }));
      }
    }

    return NextResponse.json(friends);
  } catch (error) {
    console.error('Friends fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch friends' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check cooldown for sending friend requests
  const cooldownCheck = await checkCooldown(session.user.id, 'send_friend_request');
  if (!cooldownCheck.allowed) {
    return NextResponse.json(
      { error: getCooldownErrorMessage('send_friend_request', cooldownCheck.remainingSeconds!) },
      { status: 429 }
    );
  }

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

    // Find user by username (case-insensitive exact match)
    // Try exact match first with lowercase
    let { data: friendUser, error: userError } = await supabase
      .from('users')
      .select('id, name, email, username')
      .eq('username', lowerUsername)
      .maybeSingle();

    // If not found, try with original case
    if (!friendUser && !userError) {
      const { data: userWithCase, error: caseError } = await supabase
        .from('users')
        .select('id, name, email, username')
        .eq('username', trimmedUsername)
        .maybeSingle();
      
      if (!caseError && userWithCase) {
        friendUser = userWithCase;
      } else if (caseError && caseError.code !== 'PGRST116') {
        userError = caseError;
      }
    }

    // If still not found, do a broader search and filter in memory
    // This handles case-insensitive matching when usernames have mixed case
    if (!friendUser && !userError && trimmedUsername.length > 0) {
      const { data: allUsersWithUsernames, error: fetchError } = await supabase
        .from('users')
        .select('id, name, email, username')
        .not('username', 'is', null)
        .limit(1000); // Reasonable limit for username search
      
      if (!fetchError && allUsersWithUsernames) {
        // Find exact case-insensitive match
        friendUser = allUsersWithUsernames.find((u: any) => 
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

    if (!friendUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if trying to add self
    if (friendUser.id === session.user.id) {
      return NextResponse.json(
        { error: 'Cannot add yourself as a friend' },
        { status: 400 }
      );
    }

    // Check if already friends (check both directions)
    const { data: existingFriendship1 } = await supabase
      .from('friends')
      .select('id')
      .eq('user_id', session.user.id)
      .eq('friend_id', friendUser.id)
      .maybeSingle();

    const { data: existingFriendship2 } = await supabase
      .from('friends')
      .select('id')
      .eq('user_id', friendUser.id)
      .eq('friend_id', session.user.id)
      .maybeSingle();

    const existingFriendship = existingFriendship1 || existingFriendship2;

    if (existingFriendship) {
      return NextResponse.json(
        { error: 'Already friends with this user' },
        { status: 400 }
      );
    }

    // Check if there's already a friend request (in either direction, any status)
    const { data: existingRequest1 } = await supabase
      .from('friend_requests')
      .select('id, status')
      .eq('requester_id', session.user.id)
      .eq('recipient_id', friendUser.id)
      .maybeSingle();

    const { data: existingRequest2 } = await supabase
      .from('friend_requests')
      .select('id, status')
      .eq('requester_id', friendUser.id)
      .eq('recipient_id', session.user.id)
      .maybeSingle();

    // Handle existing requests
    if (existingRequest1) {
      if (existingRequest1.status === 'pending') {
        return NextResponse.json(
          { error: 'Friend request already sent' },
          { status: 400 }
        );
      }
      // If the request was cancelled/rejected, delete it first to allow a new one
      const { error: deleteError } = await supabase
        .from('friend_requests')
        .delete()
        .eq('id', existingRequest1.id);
      
      if (deleteError) {
        console.error('Delete old friend request error:', deleteError);
        return NextResponse.json(
          { error: 'Failed to send friend request' },
          { status: 500 }
        );
      }
    }

    if (existingRequest2) {
      if (existingRequest2.status === 'pending') {
        return NextResponse.json(
          { error: 'This user has already sent you a friend request. Please accept it instead.' },
          { status: 400 }
        );
      }
      // If the request was cancelled/rejected, delete it first to allow a new one
      const { error: deleteError } = await supabase
        .from('friend_requests')
        .delete()
        .eq('id', existingRequest2.id);
      
      if (deleteError) {
        console.error('Delete old friend request error:', deleteError);
        return NextResponse.json(
          { error: 'Failed to send friend request' },
          { status: 500 }
        );
      }
    }

    // Create friend request
    const { error: insertError } = await supabase
      .from('friend_requests')
      .insert([
        { 
          requester_id: session.user.id, 
          recipient_id: friendUser.id,
          status: 'pending'
        }
      ]);

    if (insertError) {
      console.error('Insert friend request error:', insertError);
      return NextResponse.json(
        { error: insertError.message || 'Failed to send friend request' },
        { status: 500 }
      );
    }

    // Record the action after successful friend request
    await recordAction(session.user.id, 'send_friend_request');

    return NextResponse.json({
      success: true,
      message: 'Friend request sent',
    });
  } catch (error) {
    console.error('Add friend error:', error);
    return NextResponse.json(
      { error: 'Failed to add friend' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServerClient();

  try {
    const body = await request.json();
    const { friendId } = body;

    if (!friendId || typeof friendId !== 'string') {
      return NextResponse.json(
        { error: 'Friend ID is required' },
        { status: 400 }
      );
    }

    // Check if trying to unfriend self
    if (friendId === session.user.id) {
      return NextResponse.json(
        { error: 'Cannot unfriend yourself' },
        { status: 400 }
      );
    }

    // Check if friendship exists (check both directions)
    const { data: existingFriendship1 } = await supabase
      .from('friends')
      .select('id')
      .eq('user_id', session.user.id)
      .eq('friend_id', friendId)
      .maybeSingle();

    const { data: existingFriendship2 } = await supabase
      .from('friends')
      .select('id')
      .eq('user_id', friendId)
      .eq('friend_id', session.user.id)
      .maybeSingle();

    const existingFriendship = existingFriendship1 || existingFriendship2;

    if (!existingFriendship) {
      return NextResponse.json(
        { error: 'Friendship not found' },
        { status: 404 }
      );
    }

    // Delete both directions of the friendship
    const { error: deleteError1 } = await supabase
      .from('friends')
      .delete()
      .eq('user_id', session.user.id)
      .eq('friend_id', friendId);

    const { error: deleteError2 } = await supabase
      .from('friends')
      .delete()
      .eq('user_id', friendId)
      .eq('friend_id', session.user.id);

    if (deleteError1) {
      console.error('Delete friendship error (direction 1):', deleteError1);
      return NextResponse.json(
        { error: 'Failed to remove friend' },
        { status: 500 }
      );
    }

    if (deleteError2) {
      console.error('Delete friendship error (direction 2):', deleteError2);
      return NextResponse.json(
        { error: 'Failed to remove friend' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Unfriend error:', error);
    return NextResponse.json(
      { error: 'Failed to remove friend' },
      { status: 500 }
    );
  }
}

