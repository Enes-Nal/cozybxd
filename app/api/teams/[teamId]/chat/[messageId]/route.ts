import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { createServerClient } from '@/lib/supabase';

// DELETE a message (users can only delete their own messages)
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ teamId: string; messageId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { teamId, messageId } = await context.params;
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

  // Get the message to check ownership
  const { data: message, error: messageError } = await supabase
    .from('group_messages')
    .select('*')
    .eq('id', messageId)
    .eq('team_id', teamId)
    .single();

  if (messageError || !message) {
    return NextResponse.json({ error: 'Message not found' }, { status: 404 });
  }

  // Check if user owns the message
  if (message.user_id !== session.user.id) {
    return NextResponse.json({ error: 'You can only delete your own messages' }, { status: 403 });
  }

  // Delete the message
  const { error: deleteError } = await supabase
    .from('group_messages')
    .delete()
    .eq('id', messageId);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// PATCH to update a message (users can only update their own messages)
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ teamId: string; messageId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { teamId, messageId } = await context.params;
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

  // Get the message to check ownership
  const { data: existingMessage, error: messageError } = await supabase
    .from('group_messages')
    .select('*')
    .eq('id', messageId)
    .eq('team_id', teamId)
    .single();

  if (messageError || !existingMessage) {
    return NextResponse.json({ error: 'Message not found' }, { status: 404 });
  }

  // Check if user owns the message
  if (existingMessage.user_id !== session.user.id) {
    return NextResponse.json({ error: 'You can only edit your own messages' }, { status: 403 });
  }

  // Update the message
  const { data: updatedMessage, error: updateError } = await supabase
    .from('group_messages')
    .update({
      message: message.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', messageId)
    .select(`
      *,
      users (
        id,
        name,
        image
      )
    `)
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json(updatedMessage);
}

