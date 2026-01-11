import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { createServerClient } from '@/lib/supabase';

export async function GET(
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
      return NextResponse.json({ userVote: null });
    }

    const watchlistItem = watchlistItems[0];

    // Check if user has voted
    const { data: existingVote } = await supabase
      .from('watchlist_votes')
      .select('vote_type')
      .eq('watchlist_item_id', watchlistItem.id)
      .eq('user_id', session.user.id)
      .maybeSingle();

    return NextResponse.json({ 
      userVote: existingVote?.vote_type || null
    });
  } catch (error) {
    // If no vote found, return null (not an error)
    return NextResponse.json({ userVote: null });
  }
}

