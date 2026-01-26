import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { createServerClient } from '@/lib/supabase';
import { checkCooldown, recordAction, getCooldownErrorMessage } from '@/lib/utils/cooldown';

function isValidUuid(value: string) {
  // Loose UUID v4-ish check; Supabase uses UUIDs
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export async function GET(_request: NextRequest, context: { params: Promise<{ reviewId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { reviewId } = await context.params;
  if (!reviewId || !isValidUuid(reviewId)) {
    return NextResponse.json({ error: 'Invalid reviewId' }, { status: 400 });
  }

  const supabase = createServerClient();

  try {
    const { data: replies, error } = await supabase
      .from('review_replies')
      .select(`
        *,
        users(*)
      `)
      .eq('review_id', reviewId)
      .order('created_at', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(replies || []);
  } catch (err) {
    console.error('Review replies fetch error:', err);
    return NextResponse.json({ error: 'Failed to fetch replies' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ reviewId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { reviewId } = await context.params;
  if (!reviewId || !isValidUuid(reviewId)) {
    return NextResponse.json({ error: 'Invalid reviewId' }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const comment = typeof body?.comment === 'string' ? body.comment.trim() : '';
  const ratingRaw = body?.rating;
  const rating =
    ratingRaw === null || ratingRaw === undefined || ratingRaw === ''
      ? null
      : Number(ratingRaw);

  if (!comment) {
    return NextResponse.json({ error: 'Reply comment is required' }, { status: 400 });
  }

  if (rating !== null && (!Number.isInteger(rating) || rating < 1 || rating > 5)) {
    return NextResponse.json({ error: 'Rating must be an integer between 1 and 5' }, { status: 400 });
  }

  // Check cooldown for creating review replies
  const cooldownCheck = await checkCooldown(session.user.id, 'create_review_reply');
  if (!cooldownCheck.allowed) {
    return NextResponse.json(
      { error: getCooldownErrorMessage('create_review_reply', cooldownCheck.remainingSeconds!) },
      { status: 429 }
    );
  }

  const supabase = createServerClient();

  try {
    // Ensure review exists and prevent replying to your own review (per your requirement)
    const { data: review, error: reviewError } = await supabase
      .from('reviews')
      .select('id, user_id')
      .eq('id', reviewId)
      .single();

    if (reviewError || !review) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 });
    }

    if (review.user_id === session.user.id) {
      return NextResponse.json({ error: 'You cannot reply to your own review' }, { status: 403 });
    }

    const { data: created, error: createError } = await supabase
      .from('review_replies')
      .insert({
        review_id: reviewId,
        user_id: session.user.id,
        rating,
        comment,
      })
      .select(`
        *,
        users(*)
      `)
      .single();

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }

    // Record the action after successful reply creation
    await recordAction(session.user.id, 'create_review_reply');

    return NextResponse.json(created);
  } catch (err) {
    console.error('Review reply create error:', err);
    return NextResponse.json({ error: 'Failed to create reply' }, { status: 500 });
  }
}



