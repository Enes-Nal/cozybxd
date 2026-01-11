import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { createServerClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createServerClient();

    // Get user status from database
    const { data: user, error } = await supabase
      .from('users')
      .select('status')
      .eq('id', session.user.id)
      .single();

    if (error) {
      console.error('Status fetch error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch status' },
        { status: 500 }
      );
    }

    // Map database status to frontend status
    // Database: 'Online', 'Idle', 'Do Not Disturb', 'Offline'
    // Frontend: 'Online', 'Idle', 'Do Not Disturb', 'Invisible'
    let frontendStatus: string;
    
    if (!user.status) {
      // No status set yet, default to 'Online'
      frontendStatus = 'Online';
    } else if (user.status === 'Offline') {
      // 'Offline' in database means 'Invisible' in frontend
      frontendStatus = 'Invisible';
    } else {
      // All other statuses map 1:1
      frontendStatus = user.status;
    }

    return NextResponse.json({ status: frontendStatus });
  } catch (error) {
    console.error('Status fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch status' },
      { status: 500 }
    );
  }
}

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

    // Map frontend status to database status
    // Frontend uses: 'Online', 'Idle', 'Do Not Disturb', 'Invisible'
    // Database stores: 'Online', 'Idle', 'Do Not Disturb', 'Invisible', 'Offline'
    const dbStatus = status === 'Invisible' ? 'Offline' : status;

    // Update user status in database
    const { error } = await supabase
      .from('users')
      .update({ 
        status: dbStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', session.user.id);

    if (error) {
      console.error('Status update error:', error);
      return NextResponse.json(
        { error: 'Failed to update status' },
        { status: 500 }
      );
    }

    return NextResponse.json({ status: dbStatus, success: true });
  } catch (error) {
    console.error('Status update error:', error);
    return NextResponse.json(
      { error: 'Failed to update status' },
      { status: 500 }
    );
  }
}

