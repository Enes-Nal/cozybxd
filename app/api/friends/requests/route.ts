import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { createServerClient } from '@/lib/supabase';
import { transformUserToFrontend } from '@/lib/utils/transformers';

// Helper function to handle requests response
async function handleRequestsResponse(requests: any[], type: string, supabase: any): Promise<NextResponse> {
  // Get user IDs to fetch
  const userIds = requests.map((req: any) => 
    type === 'incoming' ? req.requester_id : req.recipient_id
  );

  if (userIds.length === 0) {
    return NextResponse.json([]);
  }

  // Fetch user data
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('*')
    .in('id', userIds);

  if (usersError) {
    console.error('Fetch users error:', usersError);
    return NextResponse.json({ error: usersError.message }, { status: 500 });
  }

  // Create a map of user ID to user data
  const userMap = new Map((users || []).map((user: any) => [user.id, user]));

  // Transform the data
  const transformedRequests = requests.map((req: any) => {
    const userId = type === 'incoming' ? req.requester_id : req.recipient_id;
    const user = userMap.get(userId);
    
    return {
      id: req.id,
      user: user ? transformUserToFrontend(user) : null,
      status: req.status,
      created_at: req.created_at,
      read_at: req.read_at || null,
      type: type,
    };
  }).filter((req: any) => req.user !== null); // Filter out any requests with missing user data

  return NextResponse.json(transformedRequests);
}

// GET - Fetch friend requests (incoming and outgoing)
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServerClient();
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'incoming'; // 'incoming' or 'outgoing'

  try {
    let requestsQuery;
    if (type === 'incoming') {
      // Get requests where current user is the recipient (both pending and accepted)
      requestsQuery = supabase
        .from('friend_requests')
        .select('id, requester_id, recipient_id, status, created_at, read_at')
        .eq('recipient_id', session.user.id)
        .in('status', ['pending', 'accepted'])
        .order('created_at', { ascending: false });
    } else {
      // Get requests where current user is the requester
      requestsQuery = supabase
        .from('friend_requests')
        .select('id, requester_id, recipient_id, status, created_at, read_at')
        .eq('requester_id', session.user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
    }

    const { data: requests, error: requestsError } = await requestsQuery;

    if (requestsError) {
      console.error('Fetch friend requests error:', requestsError);
      // If read_at column doesn't exist, try without it
      if (requestsError.message && requestsError.message.includes('read_at')) {
        // Retry without read_at if column doesn't exist
        if (type === 'incoming') {
          const retryQuery = supabase
            .from('friend_requests')
            .select('id, requester_id, recipient_id, status, created_at')
            .eq('recipient_id', session.user.id)
            .in('status', ['pending', 'accepted'])
            .order('created_at', { ascending: false });
          
          const { data: retryRequests, error: retryError } = await retryQuery;
          if (retryError) {
            return NextResponse.json({ error: retryError.message }, { status: 500 });
          }
          // Add read_at as null for compatibility
          const requestsWithReadAt = (retryRequests || []).map((req: any) => ({
            ...req,
            read_at: null
          }));
          const result = await handleRequestsResponse(requestsWithReadAt, type, supabase);
          return result;
        } else {
          const retryQuery = supabase
            .from('friend_requests')
            .select('id, requester_id, recipient_id, status, created_at')
            .eq('requester_id', session.user.id)
            .eq('status', 'pending')
            .order('created_at', { ascending: false });
          
          const { data: retryRequests, error: retryError } = await retryQuery;
          if (retryError) {
            return NextResponse.json({ error: retryError.message }, { status: 500 });
          }
          // Add read_at as null for compatibility
          const requestsWithReadAt = (retryRequests || []).map((req: any) => ({
            ...req,
            read_at: null
          }));
          const result = await handleRequestsResponse(requestsWithReadAt, type, supabase);
          return result;
        }
      }
      return NextResponse.json({ error: requestsError.message }, { status: 500 });
    }

    if (!requests || requests.length === 0) {
      return NextResponse.json([]);
    }

    const result = await handleRequestsResponse(requests, type, supabase);
    return result;
  } catch (error) {
    console.error('Friend requests fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch friend requests' },
      { status: 500 }
    );
  }
}

// DELETE - Reject or cancel a friend request
export async function DELETE(request: NextRequest) {
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

    // Get the request to verify ownership
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

    // Check if user is the requester (can cancel) or recipient (can reject)
    const isRequester = friendRequest.requester_id === session.user.id;
    const isRecipient = friendRequest.recipient_id === session.user.id;

    if (!isRequester && !isRecipient) {
      return NextResponse.json(
        { error: 'Unauthorized to delete this request' },
        { status: 403 }
      );
    }

    // Only allow deletion of pending requests
    if (friendRequest.status !== 'pending') {
      return NextResponse.json(
        { error: 'Cannot delete a request that is not pending' },
        { status: 400 }
      );
    }

    // Update status to 'cancelled' if requester, 'rejected' if recipient
    const newStatus = isRequester ? 'cancelled' : 'rejected';
    const { error: updateError } = await supabase
      .from('friend_requests')
      .update({ status: newStatus })
      .eq('id', requestId);

    if (updateError) {
      console.error('Update friend request error:', updateError);
      return NextResponse.json(
        { error: 'Failed to delete friend request' },
        { status: 500 }
      );
    }

    // Mark as read when rejecting (only if read_at column exists)
    if (isRecipient) {
      const { error: markReadError } = await supabase
        .from('friend_requests')
        .update({ read_at: new Date().toISOString() })
        .eq('id', requestId);

      // Supabase/PostgREST returns errors via the response object (not thrown exceptions).
      // Ignore if the DB doesn't have read_at yet (or PostgREST schema cache is stale).
      if (markReadError) {
        if (markReadError.message && markReadError.message.includes('read_at')) {
          console.log('read_at column may not exist, skipping mark as read');
        } else {
          console.error('Mark friend request as read error:', markReadError);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete friend request error:', error);
    return NextResponse.json(
      { error: 'Failed to delete friend request' },
      { status: 500 }
    );
  }
}

// PATCH - Mark friend requests as read
export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServerClient();

  try {
    const body = await request.json();
    const { requestIds, markAllAsRead } = body;

    if (markAllAsRead) {
      // Mark all unread incoming friend requests as read
      const { error } = await supabase
        .from('friend_requests')
        .update({ read_at: new Date().toISOString() })
        .eq('recipient_id', session.user.id)
        .is('read_at', null)
        .in('status', ['pending', 'accepted']);

      if (error) {
        // If read_at doesn't exist yet, treat as a no-op for backwards compatibility.
        if (error.message && error.message.includes('read_at')) {
          return NextResponse.json({ success: true });
        }
        console.error('Mark all friend requests as read error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    if (!requestIds || !Array.isArray(requestIds) || requestIds.length === 0) {
      return NextResponse.json(
        { error: 'Request IDs are required' },
        { status: 400 }
      );
    }

    // Mark specific friend requests as read
    const { error } = await supabase
      .from('friend_requests')
      .update({ read_at: new Date().toISOString() })
      .eq('recipient_id', session.user.id)
      .in('id', requestIds);

    if (error) {
      // If read_at doesn't exist yet, treat as a no-op for backwards compatibility.
      if (error.message && error.message.includes('read_at')) {
        return NextResponse.json({ success: true });
      }
      console.error('Mark friend requests as read error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Mark friend requests as read error:', error);
    return NextResponse.json(
      { error: 'Failed to mark friend requests as read' },
      { status: 500 }
    );
  }
}
