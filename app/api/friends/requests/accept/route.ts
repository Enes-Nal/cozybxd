import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { createServerClient } from '@/lib/supabase';
import { transformUserToFrontend } from '@/lib/utils/transformers';

// POST - Accept a friend request
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServerClient();

  try {
    const body = await request.json();
    const { requestId } = body;

    if (!requestId || typeof requestId !== 'string') {
      return NextResponse.json(
        { error: 'Request ID is required' },
        { status: 400 }
      );
    }

    // Get the friend request
    const { data: friendRequest, error: fetchError } = await supabase
      .from('friend_requests')
      .select('requester_id, recipient_id, status')
      .eq('id', requestId)
      .maybeSingle();

    if (fetchError) {
      console.error('Fetch friend request error:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch friend request' },
        { status: 500 }
      );
    }

    if (!friendRequest) {
      return NextResponse.json(
        { error: 'Friend request not found' },
        { status: 404 }
      );
    }

    // Verify that the current user is the recipient
    if (friendRequest.recipient_id !== session.user.id) {
      return NextResponse.json(
        { error: 'Unauthorized to accept this request' },
        { status: 403 }
      );
    }

    // Check if request is pending
    if (friendRequest.status !== 'pending') {
      return NextResponse.json(
        { error: 'This friend request is no longer pending' },
        { status: 400 }
      );
    }

    // Check if already friends
    const { data: existingFriendship1 } = await supabase
      .from('friends')
      .select('id')
      .eq('user_id', session.user.id)
      .eq('friend_id', friendRequest.requester_id)
      .maybeSingle();

    const { data: existingFriendship2 } = await supabase
      .from('friends')
      .select('id')
      .eq('user_id', friendRequest.requester_id)
      .eq('friend_id', session.user.id)
      .maybeSingle();

    if (existingFriendship1 || existingFriendship2) {
      // Already friends, just update the request status
      await supabase
        .from('friend_requests')
        .update({ status: 'accepted' })
        .eq('id', requestId);

      return NextResponse.json({
        success: true,
        message: 'Already friends',
      });
    }

    // Start a transaction-like operation
    // First, create the bidirectional friendship
    const { error: insertError } = await supabase
      .from('friends')
      .insert([
        { user_id: session.user.id, friend_id: friendRequest.requester_id },
        { user_id: friendRequest.requester_id, friend_id: session.user.id }
      ]);

    if (insertError) {
      console.error('Insert friendship error:', insertError);
      return NextResponse.json(
        { error: 'Failed to create friendship' },
        { status: 500 }
      );
    }

    // Update the friend request status to accepted
    const { error: updateError } = await supabase
      .from('friend_requests')
      .update({ status: 'accepted' })
      .eq('id', requestId);

    if (updateError) {
      console.error('Update friend request error:', updateError);
      // Note: Friendship is already created, but we'll log the error
      // In a real transaction system, we'd rollback, but Supabase doesn't support transactions
      // The friendship is still valid, so we'll continue
    }

    // Get the friend's full data
    const { data: friendData, error: friendDataError } = await supabase
      .from('users')
      .select('*')
      .eq('id', friendRequest.requester_id)
      .single();

    if (friendDataError) {
      return NextResponse.json(
        { error: 'Friend request accepted but failed to fetch friend data' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      friend: transformUserToFrontend(friendData),
    });
  } catch (error) {
    console.error('Accept friend request error:', error);
    return NextResponse.json(
      { error: 'Failed to accept friend request' },
      { status: 500 }
    );
  }
}


