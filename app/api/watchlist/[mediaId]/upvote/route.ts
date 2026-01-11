import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { createServerClient } from '@/lib/supabase';

export async function POST(
  request: NextRequest,
  { params }: { params: { mediaId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const teamId = searchParams.get('teamId');

  const supabase = createServerClient();

  try {
    // Find the watchlist item
    let query = supabase
      .from('watchlist_items')
      .select('*')
      .eq('media_id', params.mediaId);

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

    // Increment upvotes
    const { data: updated, error: updateError } = await supabase
      .from('watchlist_items')
      .update({ upvotes: (watchlistItem.upvotes || 0) + 1 })
      .eq('id', watchlistItem.id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ upvotes: updated.upvotes });
  } catch (error) {
    console.error('Upvote error:', error);
    return NextResponse.json(
      { error: 'Failed to upvote' },
      { status: 500 }
    );
  }
}

