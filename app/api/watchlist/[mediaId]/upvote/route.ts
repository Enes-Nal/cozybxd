import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { createServerClient } from '@/lib/supabase';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ mediaId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { mediaId } = await context.params;
  const searchParams = request.nextUrl.searchParams;
  const teamId = searchParams.get('teamId');

  const supabase = createServerClient();

  try {
    // Find the watchlist item
    let query = supabase
      .from('watchlist_items')
      .select('*')
      .eq('media_id', mediaId);

    if (teamId) {
      query = query.eq('team_id', teamId).is('user_id', null);
    } else {
      query = query.eq('user_id', session.user.id).is('team_id', null);
    }

    const { data: watchlistItems, error: findError } = await query;

    if (findError || !watchlistItems || watchlistItems.length === 0) {
      return NextResponse.json({ error: 'Watchlist item not found' }, { status: 404 });
    }

    const watchlistItem = watchlistItems[0];

    // Check if user already voted
    const { data: existingVote, error: voteError } = await supabase
      .from('watchlist_votes')
      .select('*')
      .eq('watchlist_item_id', watchlistItem.id)
      .eq('user_id', session.user.id)
      .single();

    let newUpvotes = watchlistItem.upvotes || 0;
    let newDownvotes = watchlistItem.downvotes || 0;
    let voteAction = 'added';

    if (existingVote) {
      if (existingVote.vote_type === 'upvote') {
        // User already upvoted, remove the upvote (toggle off)
        newUpvotes = Math.max(0, newUpvotes - 1);
        voteAction = 'removed';
        
        // Delete the vote record
        await supabase
          .from('watchlist_votes')
          .delete()
          .eq('id', existingVote.id);
      } else if (existingVote.vote_type === 'downvote') {
        // User downvoted, switch to upvote
        newDownvotes = Math.max(0, newDownvotes - 1);
        newUpvotes = (newUpvotes || 0) + 1;
        voteAction = 'switched';
        
        // Update the vote record
        await supabase
          .from('watchlist_votes')
          .update({ vote_type: 'upvote' })
          .eq('id', existingVote.id);
      }
    } else {
      // User hasn't voted, add upvote
      newUpvotes = (newUpvotes || 0) + 1;
      
      // Create vote record
      await supabase
        .from('watchlist_votes')
        .insert({
          watchlist_item_id: watchlistItem.id,
          user_id: session.user.id,
          vote_type: 'upvote'
        });
    }

    // Update watchlist item counts
    const { data: updated, error: updateError } = await supabase
      .from('watchlist_items')
      .update({ 
        upvotes: newUpvotes,
        downvotes: newDownvotes
      })
      .eq('id', watchlistItem.id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    const score = (updated.upvotes || 0) - (updated.downvotes || 0);
    
    return NextResponse.json({ 
      upvotes: updated.upvotes,
      downvotes: updated.downvotes,
      score,
      userVote: voteAction === 'removed' ? null : 'upvote'
    });
  } catch (error) {
    console.error('Upvote error:', error);
    return NextResponse.json(
      { error: 'Failed to upvote' },
      { status: 500 }
    );
  }
}

