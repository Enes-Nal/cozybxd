import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { createServerClient } from '@/lib/supabase';

// GET messages for a team
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ teamId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { teamId } = await context.params;
  const supabase = createServerClient();

  // Check if user is a member of the team
  const { data: membership, error: membershipError } = await supabase
    .from('team_members')
    .select('*')
    .eq('team_id', teamId)
    .eq('user_id', session.user.id)
    .single();

  if (membershipError || !membership) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Get query params for pagination
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');

  // Get messages with user info
  const { data: messages, error: messagesError } = await supabase
    .from('group_messages')
    .select(`
      *,
      users (
        id,
        name,
        image
      )
    `)
    .eq('team_id', teamId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (messagesError) {
    return NextResponse.json({ error: messagesError.message }, { status: 500 });
  }

  // Reverse to show oldest first (for display)
  return NextResponse.json({ messages: (messages || []).reverse() });
}

// POST a new message
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ teamId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { teamId } = await context.params;
  const body = await request.json();
  const { message } = body;

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 });
  }

  if (message.length > 5000) {
    return NextResponse.json({ error: 'Message is too long (max 5000 characters)' }, { status: 400 });
  }

  const supabase = createServerClient();

  // Check if user is a member of the team
  const { data: membership, error: membershipError } = await supabase
    .from('team_members')
    .select('*')
    .eq('team_id', teamId)
    .eq('user_id', session.user.id)
    .single();

  if (membershipError || !membership) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Insert message
  const { data: newMessage, error: insertError } = await supabase
    .from('group_messages')
    .insert({
      team_id: teamId,
      user_id: session.user.id,
      message: message.trim(),
    })
    .select(`
      *,
      users (
        id,
        name,
        image
      )
    `)
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json(newMessage, { status: 201 });
}

