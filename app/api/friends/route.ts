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
    // Get direct friends from friends table
    const { data: directFriendships, error: directFriendsError } = await supabase
      .from('friends')
      .select('friend_id')
      .eq('user_id', session.user.id);

    if (directFriendsError) {
      console.error('Direct friends error:', directFriendsError);
    }

    // Get friend user data
    const friendIds = (directFriendships || []).map((f: any) => f.friend_id);
    let directFriends: any[] = [];
    if (friendIds.length > 0) {
      const { data: friendUsers, error: friendUsersError } = await supabase
        .from('users')
        .select('*')
        .in('id', friendIds);

      if (!friendUsersError && friendUsers) {
        directFriends = friendUsers.map((user: any) => ({
          users: user,
          friend_id: user.id,
        }));
      }
    }

    // Get all teams the user is a member of
    const { data: userTeams, error: teamsError } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('user_id', session.user.id);

    if (teamsError) {
      return NextResponse.json({ error: teamsError.message }, { status: 500 });
    }

    const teamIds = (userTeams || []).map((t: any) => t.team_id);

    // Get all members of those teams (excluding the current user)
    let memberships: any[] = [];
    if (teamIds.length > 0) {
      const { data: teamMemberships, error: membersError } = await supabase
        .from('team_members')
        .select(`
          *,
          users(*)
        `)
        .in('team_id', teamIds)
        .neq('user_id', session.user.id);

      if (membersError) {
        return NextResponse.json({ error: membersError.message }, { status: 500 });
      }
      memberships = teamMemberships || [];
    }

    // Group by user ID to get unique friends
    const friendsMap = new Map<string, any>();
    
    // Add direct friends
    directFriends.forEach((friendship: any) => {
      const friend = friendship.users;
      if (friend && !friendsMap.has(friend.id)) {
        friendsMap.set(friend.id, {
          ...transformUserToFrontend(friend),
          sharedTeams: [],
        });
      }
    });

    // Add team members
    memberships.forEach((membership: any) => {
      const userId = membership.user_id;
      if (!friendsMap.has(userId)) {
        friendsMap.set(userId, {
          ...transformUserToFrontend(membership.users, membership),
          sharedTeams: [],
        });
      }
      friendsMap.get(userId).sharedTeams.push({
        id: membership.team_id,
        role: membership.role,
      });
    });

    const friends = Array.from(friendsMap.values());

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

    // Create friendship (bidirectional)
    const { error: insertError } = await supabase
      .from('friends')
      .insert([
        { user_id: session.user.id, friend_id: friendUser.id },
        { user_id: friendUser.id, friend_id: session.user.id }
      ]);

    if (insertError) {
      console.error('Insert friendship error:', insertError);
      return NextResponse.json(
        { error: 'Failed to add friend' },
        { status: 500 }
      );
    }

    // Get the friend's full data
    const { data: friendData, error: friendDataError } = await supabase
      .from('users')
      .select('*')
      .eq('id', friendUser.id)
      .single();

    if (friendDataError) {
      return NextResponse.json(
        { error: 'Friend added but failed to fetch friend data' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      friend: transformUserToFrontend(friendData),
    });
  } catch (error) {
    console.error('Add friend error:', error);
    return NextResponse.json(
      { error: 'Failed to add friend' },
      { status: 500 }
    );
  }
}

