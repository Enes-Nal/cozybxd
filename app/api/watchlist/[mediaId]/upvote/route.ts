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
      .maybeSingle();

    if (voteError) {
      console.error('Error checking existing vote:', voteError);
      return NextResponse.json({ 
        error: 'Failed to check existing vote', 
        details: voteError.message,
        code: voteError.code 
      }, { status: 500 });
    }

    let newUpvotes = watchlistItem.upvotes || 0;
    let newDownvotes = watchlistItem.downvotes || 0;
    let voteAction = 'added';

    if (existingVote) {
      if (existingVote.vote_type === 'upvote') {
        // User already upvoted, remove the upvote (toggle off)
        newUpvotes = Math.max(0, newUpvotes - 1);
        voteAction = 'removed';
        
        // Delete the vote record
        const { error: deleteError } = await supabase
          .from('watchlist_votes')
          .delete()
          .eq('id', existingVote.id);
        
        if (deleteError) {
          console.error('Error deleting vote:', deleteError);
          return NextResponse.json({ 
            error: 'Failed to remove vote', 
            details: deleteError.message,
            code: deleteError.code 
          }, { status: 500 });
        }
      } else if (existingVote.vote_type === 'downvote') {
        // User downvoted, switch to upvote
        newDownvotes = Math.max(0, newDownvotes - 1);
        newUpvotes = (newUpvotes || 0) + 1;
        voteAction = 'switched';
        
        // Update the vote record
        const { error: updateVoteError } = await supabase
          .from('watchlist_votes')
          .update({ vote_type: 'upvote' })
          .eq('id', existingVote.id);
        
        if (updateVoteError) {
          console.error('Error updating vote:', updateVoteError);
          return NextResponse.json({ 
            error: 'Failed to update vote', 
            details: updateVoteError.message,
            code: updateVoteError.code 
          }, { status: 500 });
        }
      }
    } else {
      // User hasn't voted, add upvote
      newUpvotes = (newUpvotes || 0) + 1;
      
      // Create vote record
      const { error: insertError } = await supabase
        .from('watchlist_votes')
        .insert({
          watchlist_item_id: watchlistItem.id,
          user_id: session.user.id,
          vote_type: 'upvote'
        });
      
      if (insertError) {
        console.error('Error inserting vote:', insertError);
        return NextResponse.json({ 
          error: 'Failed to create vote', 
          details: insertError.message,
          code: insertError.code 
        }, { status: 500 });
      }
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
      console.error('Error updating watchlist item:', updateError);
      return NextResponse.json({ 
        error: 'Failed to update watchlist item', 
        details: updateError.message,
        code: updateError.code 
      }, { status: 500 });
    }

    const score = (updated.upvotes || 0) - (updated.downvotes || 0);
    
    // Log activity: movie upvoted (only for team watchlists and when vote was added/switched, not removed)
    if (teamId && voteAction !== 'removed') {
      // Get media info for logging
      const { data: media } = await supabase
        .from('media')
        .select('title, type')
        .eq('id', mediaId)
        .single();

      try {
        await supabase
          .from('team_activity_logs')
          .insert({
            team_id: teamId,
            user_id: session.user.id,
            activity_type: 'movie_upvoted',
            media_id: mediaId,
            metadata: media ? { 
              title: media.title,
              type: media.type,
              action: voteAction
            } : { action: voteAction },
          });
      } catch (err) {
        // Don't fail the request if logging fails
        console.error('Failed to log activity:', err);
      }
    }
    
    return NextResponse.json({ 
      upvotes: updated.upvotes,
      downvotes: updated.downvotes,
      score,
      userVote: voteAction === 'removed' ? null : 'upvote'
    });
  } catch (error) {
    console.error('Upvote error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to upvote', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

