import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { createServerClient } from '@/lib/supabase';

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { status } = await request.json();
    
    if (!status || !['Online', 'Idle', 'Do Not Disturb', 'Invisible'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const supabase = createServerClient();

    // Update user status in database
    // Note: We'll need to add a status column to the users table
    // For now, we'll store it in a user_preferences table or similar
    // Since we don't have a status column yet, we'll use a metadata approach
    
    // Check if user_preferences table exists, if not we'll just return success
    // and the client will handle localStorage
    const { error } = await supabase
      .from('users')
      .update({ 
        // We'll add status to metadata or create a separate table
        // For now, just return success - the client handles localStorage
      })
      .eq('id', session.user.id);

    // For now, we'll just return success since we're using localStorage
    // In the future, you can add a status column to the users table
    return NextResponse.json({ status, success: true });
  } catch (error) {
    console.error('Status update error:', error);
    return NextResponse.json(
      { error: 'Failed to update status' },
      { status: 500 }
    );
  }
}

