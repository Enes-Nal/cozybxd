import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { createServerClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const mediaId = searchParams.get('mediaId');
  const userId = searchParams.get('userId');

  const supabase = createServerClient();

  try {
    let query = supabase
      .from('reviews')
      .select(`
        *,
        users(*),
        media(*)
      `);

    if (mediaId) {
      query = query.eq('media_id', mediaId);
    }

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data: reviews, error } = await query
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(reviews || []);
  } catch (error) {
    console.error('Reviews fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reviews' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { mediaId, rating, comment, logId } = body;

  if (!mediaId || !rating || rating < 1 || rating > 5) {
    return NextResponse.json(
      { error: 'Media ID and rating (1-5) required' },
      { status: 400 }
    );
  }

  const supabase = createServerClient();

  try {
    // Check if review already exists for this user and media
    const { data: existing } = await supabase
      .from('reviews')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('media_id', mediaId)
      .maybeSingle();

    let review;
    if (existing) {
      // Update existing review
      const { data: updated, error: updateError } = await supabase
        .from('reviews')
        .update({
          rating,
          comment: comment || null,
          log_id: logId || null,
        })
        .eq('id', existing.id)
        .select(`
          *,
          users(*),
          media(*)
        `)
        .single();

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      review = updated;
    } else {
      // Create new review
      const { data: created, error: createError } = await supabase
        .from('reviews')
        .insert({
          user_id: session.user.id,
          media_id: mediaId,
          rating,
          comment: comment || null,
          log_id: logId || null,
        })
        .select(`
          *,
          users(*),
          media(*)
        `)
        .single();

      if (createError) {
        return NextResponse.json({ error: createError.message }, { status: 500 });
      }

      review = created;
    }

    return NextResponse.json(review);
  } catch (error) {
    console.error('Review create/update error:', error);
    return NextResponse.json(
      { error: 'Failed to create/update review' },
      { status: 500 }
    );
  }
}

